import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { images } from '$lib/server/db/schema';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = () => {
    const rows = db.select({ id: images.id, filePath: images.filePath }).from(images).all();
    return json({ images: rows });
};
