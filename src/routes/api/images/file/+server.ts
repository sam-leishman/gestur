import { error } from '@sveltejs/kit';
import { createReadStream, existsSync, statSync } from 'fs';
import { join, resolve, relative, isAbsolute, extname } from 'path';
import { config } from '$lib/server/config';
import { ensureThumbnail, type ThumbSize } from '$lib/server/thumbnails';
import type { RequestHandler } from '@sveltejs/kit';

const MIME_TYPES: Record<string, string> = {
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png',
    '.gif':  'image/gif',
    '.bmp':  'image/bmp',
    '.webp': 'image/webp',
    '.tiff': 'image/tiff',
    '.tif':  'image/tiff',
    '.svg':  'image/svg+xml',
    '.heic': 'image/heic',
    '.heif': 'image/heif'
};

const THUMB_SIZES = new Set<ThumbSize>(['thumb', 'preview']);

function streamFile(path: string, contentType: string, size: number, cacheControl: string): Response {
    const stream = createReadStream(path);
    // Surface read failures (e.g. the file is removed mid-stream) as a stream error instead of
    // letting Node emit an unhandled 'error' event, which would crash the process.
    stream.on('error', (err) => {
        console.warn(`[Images] Error streaming ${path}:`, err);
    });

    // Pass the Node stream directly rather than converting it with Readable.toWeb(): that adapter
    // has a long-standing Node bug (nodejs/node#54205) where a client cancelling the response
    // mid-stream (e.g. a browser aborting an <img> request on navigation) causes a double
    // controller.close() that throws an *uncatchable* exception, crashing the whole process.
    // Undici (the Response implementation) special-cases Node streams passed as the body, so this
    // sidesteps the bug entirely.
    return new Response(stream as unknown as BodyInit, {
        headers: {
            'Content-Type': contentType,
            'Content-Length': String(size),
            'Cache-Control': cacheControl
        }
    });
}

export const GET: RequestHandler = async ({ url }) => {
    const pathParam = url.searchParams.get('path') || '';
    if (!pathParam) throw error(400, 'Missing path');

    const sizeParam = url.searchParams.get('size');
    const thumbSize = THUMB_SIZES.has(sizeParam as ThumbSize) ? (sizeParam as ThumbSize) : null;

    const imagesRoot = resolve(config.paths.images);
    const targetPath = resolve(join(imagesRoot, pathParam));

    const rel = relative(imagesRoot, targetPath);
    if (rel.startsWith('..') || isAbsolute(rel)) throw error(400, 'Invalid path');

    if (!existsSync(targetPath)) throw error(404, 'File not found');

    const stat = statSync(targetPath);
    if (!stat.isFile()) throw error(400, 'Not a file');

    if (thumbSize) {
        const thumbPath = await ensureThumbnail(targetPath, pathParam, thumbSize);
        if (thumbPath) {
            const thumbStat = statSync(thumbPath);
            // Cache filenames embed the source file's mtime/size, so a given URL+size always
            // maps to the same immutable bytes until the source image itself changes.
            return streamFile(thumbPath, 'image/webp', thumbStat.size, 'public, max-age=31536000, immutable');
        }
        // Unsupported format (e.g. HEIC/SVG) or generation failure — fall through to original.
    }

    const ext = extname(targetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

    return streamFile(targetPath, contentType, stat.size, 'private, max-age=3600');
};
