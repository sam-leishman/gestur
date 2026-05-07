import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { imageSubjectFieldValues, imageSubjects, subjectFields } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

export const PATCH: RequestHandler = async ({ params, request }) => {
    const imageSubjectId = params.isid!;
    const subjectFieldId = params.fid!;
    const { value } = await request.json();

    const [imageSubject] = db
        .select()
        .from(imageSubjects)
        .where(eq(imageSubjects.id, imageSubjectId))
        .all();
    if (!imageSubject) return json({ error: 'Image subject not found' }, { status: 404 });

    const [field] = db
        .select()
        .from(subjectFields)
        .where(
            and(
                eq(subjectFields.id, subjectFieldId),
                eq(subjectFields.subjectId, imageSubject.subjectId)
            )
        )
        .all();
    if (!field) return json({ error: 'Field not found' }, { status: 404 });

    const existing = db
        .select()
        .from(imageSubjectFieldValues)
        .where(
            and(
                eq(imageSubjectFieldValues.imageSubjectId, imageSubjectId),
                eq(imageSubjectFieldValues.subjectFieldId, subjectFieldId)
            )
        )
        .all();

    const stringValue = value === null || value === undefined ? null : String(value);

    if (existing.length > 0) {
        db.update(imageSubjectFieldValues)
            .set({ value: stringValue })
            .where(
                and(
                    eq(imageSubjectFieldValues.imageSubjectId, imageSubjectId),
                    eq(imageSubjectFieldValues.subjectFieldId, subjectFieldId)
                )
            )
            .run();
    } else {
        db.insert(imageSubjectFieldValues)
            .values({
                imageSubjectId,
                subjectId: imageSubject.subjectId,
                subjectFieldId,
                value: stringValue
            })
            .run();
    }

    return json({ ok: true });
};
