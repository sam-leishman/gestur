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

// Both Node's `Readable.toWeb()` (nodejs/node#54205) and Undici's own Node-stream-to-body
// conversion (used internally when a Node stream is passed directly to `Response`) have the same
// class of bug: if the consumer cancels the stream (e.g. a browser aborting an <img> request on
// navigation) while the underlying file read is still in flight, a late event can try to close/
// enqueue into an already-closed controller, throwing an *uncatchable* exception that crashes the
// whole process. Neither library's adapter can be trusted here, so this builds the ReadableStream
// by hand: every controller call is wrapped in try/catch (a no-op if the stream was already
// cancelled/closed), and `cancelled` is checked before acting on any further source events.
function streamFile(path: string, contentType: string, size: number, cacheControl: string): Response {
    const nodeStream = createReadStream(path);
    let cancelled = false;

    const webStream = new ReadableStream({
        start(controller) {
            nodeStream.on('data', (chunk) => {
                if (cancelled) return;
                // createReadStream() without an explicit encoding always emits Buffer chunks;
                // the string case only exists in the shared ReadStream type when an encoding is set.
                const buf = chunk as Buffer;
                try {
                    controller.enqueue(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
                } catch {
                    // Controller already closed/errored (e.g. a cancel() landed between this
                    // event being queued and handled) — nothing to do, the stream is done either way.
                }
            });
            nodeStream.on('end', () => {
                if (cancelled) return;
                try {
                    controller.close();
                } catch {
                    // Already closed by a concurrent cancel() — safe to ignore.
                }
            });
            nodeStream.on('error', (err) => {
                console.warn(`[Images] Error streaming ${path}:`, err);
                if (cancelled) return;
                try {
                    controller.error(err);
                } catch {
                    // Already closed/errored — safe to ignore.
                }
            });
        },
        cancel() {
            cancelled = true;
            nodeStream.destroy();
        }
    });

    return new Response(webStream, {
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
