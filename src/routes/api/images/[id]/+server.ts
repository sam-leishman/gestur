import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { images } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

export const DELETE: RequestHandler = ({ params }) => {
    const id = params.id!;
    db.delete(images).where(eq(images.id, id)).run();
    return new Response(null, { status: 204 });
};

export const PUT: RequestHandler = async ({ params, request }) => {
    const id = params.id!;
    const { title } = await request.json();
    if (!title?.trim()) return json({ error: 'title is required' }, { status: 400 });

    const [row] = db
        .update(images)
        .set({ title: title.trim() })
        .where(eq(images.id, id))
        .returning()
        .all();

    if (!row) return json({ error: 'Not found' }, { status: 404 });
    return json(row);
};
