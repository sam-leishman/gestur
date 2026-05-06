import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { subjects } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = () => {
    const rows = db
        .select()
        .from(subjects)
        .orderBy(asc(subjects.name))
        .all();
    return json(rows);
};

export const POST: RequestHandler = async ({ request }) => {
    const { name } = await request.json();
    if (!name?.trim()) return json({ error: 'Name is required' }, { status: 400 });

    try {
        const [row] = db.insert(subjects).values({ name: name.trim() }).returning().all();
        return json(row, { status: 201 });
    } catch (e) {
        if ((e as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return json({ error: 'A subject with that name already exists' }, { status: 409 });
        }
        throw e;
    }
};
