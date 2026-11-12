import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { imageTags, tags } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';
import { buildImagePayload } from '$lib/server/imageUtils';

export const POST: RequestHandler = async ({ params, request }) => {
    const imageId = params.id!;
    const { tagId } = await request.json();
    if (!tagId) return json({ error: 'tagId is required' }, { status: 400 });

    const [tag] = db.select().from(tags).where(eq(tags.id, tagId)).all();
    if (!tag) return json({ error: 'Tag not found' }, { status: 404 });

    db.insert(imageTags).values({ imageId, tagId }).onConflictDoNothing().run();

    const payload = buildImagePayload(imageId);
    return json(payload, { status: 201 });
};
