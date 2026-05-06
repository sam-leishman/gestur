import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { subjectFields } from '$lib/server/db/schema';
import { eq, asc, max } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';
import { validateFieldBody, resolveFieldOptions } from '$lib/server/fieldUtils';

export const GET: RequestHandler = ({ params }) => {
    const id = params.id!;
    const rows = db
        .select()
        .from(subjectFields)
        .where(eq(subjectFields.subjectId, id))
        .orderBy(asc(subjectFields.sortOrder))
        .all();
    return json(rows);
};

export const POST: RequestHandler = async ({ params, request }) => {
    const id = params.id!;
    const { name, type, options, required } = await request.json();

    const validationError = validateFieldBody({ name, type });
    if (validationError) return validationError;

    const [maxRow] = db
        .select({ max: max(subjectFields.sortOrder) })
        .from(subjectFields)
        .where(eq(subjectFields.subjectId, id))
        .all();
    const nextOrder = (maxRow?.max ?? -1) + 1;

    try {
        const [row] = db
            .insert(subjectFields)
            .values({
                subjectId: id,
                name: name.trim(),
                type,
                options: resolveFieldOptions(type, options),
                required: required ?? false,
                sortOrder: nextOrder
            })
            .returning()
            .all();
        return json(row, { status: 201 });
    } catch (e) {
        if ((e as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return json({ error: 'A field with that name already exists for this subject' }, { status: 409 });
        }
        throw e;
    }
};
