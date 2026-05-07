import { error } from '@sveltejs/kit';
import { createReadStream, existsSync, statSync } from 'fs';
import { join, resolve, relative, isAbsolute, extname } from 'path';
import { config } from '$lib/server/config';
import type { RequestHandler } from '@sveltejs/kit';
import { Readable } from 'stream';

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

export const GET: RequestHandler = ({ url }) => {
    const pathParam = url.searchParams.get('path') || '';
    if (!pathParam) throw error(400, 'Missing path');

    const imagesRoot = resolve(config.paths.images);
    const targetPath = resolve(join(imagesRoot, pathParam));

    const rel = relative(imagesRoot, targetPath);
    if (rel.startsWith('..') || isAbsolute(rel)) throw error(400, 'Invalid path');

    if (!existsSync(targetPath)) throw error(404, 'File not found');

    const stat = statSync(targetPath);
    if (!stat.isFile()) throw error(400, 'Not a file');

    const ext = extname(targetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

    const stream = createReadStream(targetPath);
    const webStream = Readable.toWeb(stream) as ReadableStream;

    return new Response(webStream, {
        headers: {
            'Content-Type': contentType,
            'Content-Length': String(stat.size),
            'Cache-Control': 'private, max-age=3600'
        }
    });
};
