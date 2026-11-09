import { json } from '@sveltejs/kit';
import { join, resolve, relative, isAbsolute } from 'path';
import { db } from '$lib/server/db';
import { images } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { config } from '$lib/server/config';
import { imageExistsOnDisk, buildImagePayload } from '$lib/server/imageUtils';
import { isImageFile } from '$lib/utils/images';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ params, request }) => {
    const id = params.id!;
    const { filePath } = (await request.json()) as { filePath?: string };

    const trimmed = filePath?.trim();
    if (!trimmed) return json({ error: 'filePath is required' }, { status: 400 });
    if (!isImageFile(trimmed)) return json({ error: 'Not an image file' }, { status: 400 });

    const imagesRoot = resolve(config.paths.images);
    const targetPath = resolve(join(imagesRoot, trimmed));
    const rel = relative(imagesRoot, targetPath);
    if (rel.startsWith('..') || isAbsolute(rel)) return json({ error: 'Invalid path' }, { status: 400 });

    if (!imageExistsOnDisk(trimmed)) return json({ error: 'File not found' }, { status: 404 });

    const [existing] = db.select().from(images).where(eq(images.filePath, trimmed)).all();
    if (existing && existing.id !== id) {
        return json({ error: 'That file is already catalogued' }, { status: 409 });
    }

    const [row] = db.update(images).set({ filePath: trimmed }).where(eq(images.id, id)).returning().all();
    if (!row) return json({ error: 'Not found' }, { status: 404 });

    return json(buildImagePayload(id));
};
