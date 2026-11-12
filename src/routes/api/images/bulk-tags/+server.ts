import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { images, imageTags, tags } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
    const body = await request.json();
    const { filePaths, tagId } = body as { filePaths: string[]; tagId: string };

    if (!Array.isArray(filePaths) || filePaths.length === 0) {
        return json({ error: 'filePaths is required' }, { status: 400 });
    }
    if (!tagId) {
        return json({ error: 'tagId is required' }, { status: 400 });
    }

    const [tag] = db.select().from(tags).where(eq(tags.id, tagId)).all();
    if (!tag) {
        return json({ error: 'Tag not found' }, { status: 404 });
    }

    try {
        db.transaction((tx) => {
            for (const filePath of filePaths) {
                const trimmed = filePath.trim();

                let [image] = tx.select().from(images).where(eq(images.filePath, trimmed)).all();
                if (!image) {
                    const fileName = trimmed.split('/').pop()!;
                    const title = fileName.replace(/\.[^.]+$/, '');
                    [image] = tx
                        .insert(images)
                        .values({ filePath: trimmed, title })
                        .returning()
                        .all();
                }

                tx.insert(imageTags).values({ imageId: image.id, tagId }).onConflictDoNothing().run();
            }
        });

        return json({ count: filePaths.length });
    } catch {
        return json({ error: 'Failed to add tag — all changes rolled back' }, { status: 500 });
    }
};
