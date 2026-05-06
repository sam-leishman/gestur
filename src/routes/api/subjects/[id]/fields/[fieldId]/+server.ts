import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { subjectFields } from '$lib/server/db/schema';
import { and, eq, asc } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';
import { validateFieldBody, resolveFieldOptions } from '$lib/server/fieldUtils';

export const PUT: RequestHandler = async ({ params, request }) => {
    const id = params.id!;
    const fieldId = params.fieldId!;
    const { name, type, options, required } = await request.json();

    const validationError = validateFieldBody({ name, type });
    if (validationError) return validationError;

    try {
        const [row] = db
            .update(subjectFields)
            .set({
                name: name.trim(),
                type,
                options: resolveFieldOptions(type, options),
                required: required ?? false
            })
            .where(and(eq(subjectFields.id, fieldId), eq(subjectFields.subjectId, id)))
            .returning()
            .all();
        if (!row) return json({ error: 'Not found' }, { status: 404 });
        return json(row);
    } catch (e) {
        if ((e as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return json({ error: 'A field with that name already exists for this subject' }, { status: 409 });
        }
        throw e;
    }
};

export const DELETE: RequestHandler = ({ params }) => {
    const id = params.id!;
    const fieldId = params.fieldId!;

    db.transaction((tx) => {
        tx.delete(subjectFields).where(and(eq(subjectFields.id, fieldId), eq(subjectFields.subjectId, id))).run();

        const remaining = tx
            .select({ id: subjectFields.id })
            .from(subjectFields)
            .where(eq(subjectFields.subjectId, id))
            .orderBy(asc(subjectFields.sortOrder))
            .all();

        for (let i = 0; i < remaining.length; i++) {
            tx.update(subjectFields).set({ sortOrder: i }).where(eq(subjectFields.id, remaining[i].id)).run();
        }
    });

    return new Response(null, { status: 204 });
};
