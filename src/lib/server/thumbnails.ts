import { createHash, randomBytes } from 'crypto';
import { existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'fs';
import { extname, join } from 'path';
import sharp from 'sharp';
import { config } from '$lib/server/config';

export type ThumbSize = 'thumb' | 'preview';

// Max dimension (longest side) for each generated variant, chosen to comfortably cover the
// UI's actual display sizes at 2x device pixel ratio:
//   - grid tiles are ~200-240px (browse/stats grids, session result view)
//   - detail panels/modals are ~290-320px wide
const SIZE_DIMENSIONS: Record<ThumbSize, number> = {
    thumb: 480,
    preview: 1200
};

// Raster formats sharp's prebuilt binaries can decode. HEIC/HEIF are intentionally excluded:
// sharp's prebuilt binaries don't ship HEIC decoding (patent-encumbered codec, upstream decision),
// so those fall back to serving the original file untouched. SVG is already a lightweight vector
// format and doesn't benefit from raster resizing.
const RESIZABLE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif']);

export function isResizable(filePath: string): boolean {
    return RESIZABLE_EXTENSIONS.has(extname(filePath).toLowerCase());
}

// Dedupe concurrent generation requests for the same cache key (e.g. a grid of images all
// requesting the same not-yet-cached thumbnail at once).
const inFlight = new Map<string, Promise<string>>();

// Caps total concurrent sharp() jobs process-wide (independent of the per-cache-key dedupe above,
// which only prevents duplicate work for the *same* file). Without this, opening a folder full of
// uncached images fires one resize job per image all at once, which can spike CPU/memory enough to
// make the whole app unresponsive on resource-constrained hosts (e.g. a NAS). Extra requests queue
// up and run as slots free, rather than all running at once.
const MAX_CONCURRENT_GENERATIONS = 2;
let activeGenerations = 0;
const waitQueue: Array<() => void> = [];

async function acquireGenerationSlot(): Promise<void> {
    if (activeGenerations < MAX_CONCURRENT_GENERATIONS) {
        activeGenerations++;
        return;
    }
    await new Promise<void>((resolve) => waitQueue.push(resolve));
    activeGenerations++;
}

function releaseGenerationSlot(): void {
    activeGenerations--;
    const next = waitQueue.shift();
    if (next) next();
}

function cachePathFor(relPath: string, size: ThumbSize, mtimeMs: number, fileSize: number): string {
    const hash = createHash('sha1').update(relPath).digest('hex');
    const dir = join(config.paths.thumbnails, size);
    return join(dir, `${hash}-${Math.round(mtimeMs)}-${fileSize}.webp`);
}

async function generateThumbnail(absPath: string, cachePath: string, size: ThumbSize): Promise<void> {
    await acquireGenerationSlot();
    try {
        const dimension = SIZE_DIMENSIONS[size];
        const dir = join(config.paths.thumbnails, size);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

        const tmpPath = `${cachePath}.tmp-${randomBytes(6).toString('hex')}`;
        try {
            await sharp(absPath)
                .resize({ width: dimension, height: dimension, fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 80 })
                .toFile(tmpPath);
            renameSync(tmpPath, cachePath);
        } catch (err) {
            if (existsSync(tmpPath)) unlinkSync(tmpPath);
            throw err;
        }
    } finally {
        releaseGenerationSlot();
    }
}

/**
 * Returns the path to a cached, resized WebP thumbnail for the given file, generating it first
 * if needed. Returns `null` if the file isn't a resizable raster format, or if sharp fails to
 * process it (e.g. a corrupt file) — callers should fall back to serving the original in that case.
 */
export async function ensureThumbnail(absPath: string, relPath: string, size: ThumbSize): Promise<string | null> {
    if (!isResizable(absPath)) return null;

    const stat = statSync(absPath);
    const cachePath = cachePathFor(relPath, size, stat.mtimeMs, stat.size);

    if (existsSync(cachePath)) return cachePath;

    const key = cachePath;
    let pending = inFlight.get(key);
    if (!pending) {
        pending = generateThumbnail(absPath, cachePath, size)
            .then(() => cachePath)
            .finally(() => inFlight.delete(key));
        inFlight.set(key, pending);
    }

    try {
        return await pending;
    } catch (err) {
        console.warn(`[Thumbnails] Failed to generate ${size} thumbnail for ${relPath}:`, err);
        return null;
    }
}
