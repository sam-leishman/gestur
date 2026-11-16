import { createHash } from 'crypto';
import { existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, relative, sep } from 'path';
import { config } from '$lib/server/config';

// How often to sweep the thumbnail cache for orphans (images deleted/moved/renamed on disk since
// their thumbnail was generated). The server is a long-running process (adapter-node), so a plain
// setInterval is all that's needed — no cron dependency or external scheduler required.
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 60 * 1000;

let isRunning = false;

function hashRelPath(relPath: string): string {
	return createHash('sha1').update(relPath).digest('hex');
}

// Recursively collects the hash of every live image's relative path (matching the same
// `relPath` format callers pass to `ensureThumbnail`: forward-slash-joined, relative to the
// images root) so cache entries can be checked for a still-existing source.
function collectLiveHashes(dir: string, imagesRoot: string, hashes: Set<string>): void {
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return; // directory may be unreadable or have disappeared mid-walk
	}

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			collectLiveHashes(fullPath, imagesRoot, hashes);
		} else if (entry.isFile()) {
			const relPath = relative(imagesRoot, fullPath).split(sep).join('/');
			hashes.add(hashRelPath(relPath));
		}
	}
}

// Cache filenames are `<sha1-of-relpath>-<mtime>-<size>.webp` (see thumbnails.ts) — the hash is
// the leading segment before the first dash.
function hashFromCacheFilename(filename: string): string {
	return filename.split('-')[0];
}

function sweepCacheDir(dir: string, liveHashes: Set<string>): { removed: number; bytes: number } {
	let removed = 0;
	let bytes = 0;

	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return { removed, bytes };
	}

	for (const entry of entries) {
		if (!entry.isFile() || liveHashes.has(hashFromCacheFilename(entry.name))) continue;

		const fullPath = join(dir, entry.name);
		try {
			const { size } = statSync(fullPath);
			unlinkSync(fullPath);
			removed++;
			bytes += size;
		} catch {
			// Best-effort cleanup; skip files we fail to stat/remove and try again next sweep.
		}
	}

	return { removed, bytes };
}

export type CleanupResult = { removed: number; bytes: number };

/**
 * Removes cached thumbnails whose source image no longer exists under the images root. Returns
 * `null` if a sweep was already in progress (the caller should treat that as a no-op, not a
 * failure) rather than running two sweeps concurrently.
 */
export function runThumbnailCleanup(): CleanupResult | null {
	if (isRunning) return null;
	if (!existsSync(config.paths.thumbnails)) return { removed: 0, bytes: 0 };
	isRunning = true;

	try {
		const liveHashes = new Set<string>();
		collectLiveHashes(config.paths.images, config.paths.images, liveHashes);

		let totalRemoved = 0;
		let totalBytes = 0;
		for (const sizeDir of readdirSync(config.paths.thumbnails, { withFileTypes: true })) {
			if (!sizeDir.isDirectory()) continue;
			const { removed, bytes } = sweepCacheDir(
				join(config.paths.thumbnails, sizeDir.name),
				liveHashes
			);
			totalRemoved += removed;
			totalBytes += bytes;
		}

		if (totalRemoved > 0) {
			console.log(
				`[Thumbnails] Cleanup removed ${totalRemoved} orphaned thumbnail(s), reclaiming ${(totalBytes / (1024 * 1024)).toFixed(1)}MB`
			);
		}

		return { removed: totalRemoved, bytes: totalBytes };
	} catch (err) {
		console.warn('[Thumbnails] Cleanup sweep failed:', err);
		return { removed: 0, bytes: 0 };
	} finally {
		isRunning = false;
	}
}

/** Starts the recurring daily cleanup sweep. Safe to call once per server process. */
export function startThumbnailCleanupSchedule(): void {
	setTimeout(runThumbnailCleanup, INITIAL_DELAY_MS);
	setInterval(runThumbnailCleanup, CLEANUP_INTERVAL_MS);
}
