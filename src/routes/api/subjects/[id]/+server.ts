import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { subjects } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

export const PUT: RequestHandler = async ({ params, request }) => {
    const id = params.id!;
    const { name } = await request.json();
    if (!name?.trim()) return json({ error: 'Name is required' }, { status: 400 });

    try {
        const [row] = db
            .update(subjects)
            .set({ name: name.trim() })
            .where(eq(subjects.id, id))
            .returning()
            .all();
        if (!row) return json({ error: 'Not found' }, { status: 404 });
        return json(row);
    } catch (e) {
        if ((e as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return json({ error: 'A subject with that name already exists' }, { status: 409 });
        }
        throw e;
    }
};

export const DELETE: RequestHandler = ({ params }) => {
    const id = params.id!;
    db.delete(subjects).where(eq(subjects.id, id)).run();
    return new Response(null, { status: 204 });
};
