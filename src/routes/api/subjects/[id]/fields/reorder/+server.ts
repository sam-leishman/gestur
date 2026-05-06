import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { subjectFields } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

export const PATCH: RequestHandler = async ({ params, request }) => {
    const subjectId = params.id!;
    const { order }: { order: { id: string; sortOrder: number }[] } = await request.json();
    if (!Array.isArray(order)) return json({ error: 'Invalid payload' }, { status: 400 });

    db.transaction((tx) => {
        for (const { id, sortOrder } of order) {
            tx.update(subjectFields).set({ sortOrder }).where(and(eq(subjectFields.id, id), eq(subjectFields.subjectId, subjectId))).run();
        }
    });

    return json({ ok: true });
};
