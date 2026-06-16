import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { images } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';
import { buildImagePayload } from '$lib/server/imageUtils';

export const GET: RequestHandler = ({ url, locals }) => {
    const filePath = url.searchParams.get('path') || '';
    if (!filePath) return json({ image: null });

    const [image] = db.select().from(images).where(eq(images.filePath, filePath)).all();
    if (!image) return json({ image: null });

    const payload = buildImagePayload(image.id, locals.user?.id);
    return json({ image: payload });
};

export const POST: RequestHandler = async ({ request }) => {
    const { filePath, title } = await request.json();
    if (!filePath?.trim()) return json({ error: 'filePath is required' }, { status: 400 });
    if (!title?.trim()) return json({ error: 'title is required' }, { status: 400 });

    const [existing] = db.select().from(images).where(eq(images.filePath, filePath)).all();
    if (existing) {
        return json(buildImagePayload(existing.id));
    }

    try {
        const [image] = db
            .insert(images)
            .values({ filePath: filePath.trim(), title: title.trim() })
            .returning()
            .all();
        return json(buildImagePayload(image.id), { status: 201 });
    } catch {
        const [race] = db.select().from(images).where(eq(images.filePath, filePath)).all();
        if (race) return json(buildImagePayload(race.id));
        return json({ error: 'Failed to create image' }, { status: 500 });
    }
};
