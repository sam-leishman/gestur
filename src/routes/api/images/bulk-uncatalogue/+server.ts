import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { images } from '$lib/server/db/schema';
import { inArray } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
    const { filePaths } = await request.json() as { filePaths: string[] };

    if (!Array.isArray(filePaths) || filePaths.length === 0) {
        return json({ error: 'filePaths is required' }, { status: 400 });
    }

    const deleted = db
        .delete(images)
        .where(inArray(images.filePath, filePaths))
        .returning()
        .all();

    return json({ count: deleted.length });
};
