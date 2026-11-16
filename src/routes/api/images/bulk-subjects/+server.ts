import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { images, imageSubjects, subjects, subjectFields, imageSubjectFieldValues } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';
import { upsertImageSubjectFieldValue } from '$lib/server/imageUtils';
import { chunk } from '$lib/server/dbUtils';

export const POST: RequestHandler = async ({ request }) => {
    const body = await request.json();
    const { filePaths, subjectId, label, fieldValues } = body as {
        filePaths: string[];
        subjectId: string;
        label?: string | null;
        fieldValues?: Record<string, string | null>;
    };

    if (!Array.isArray(filePaths) || filePaths.length === 0) {
        return json({ error: 'filePaths is required' }, { status: 400 });
    }
    if (!subjectId) {
        return json({ error: 'subjectId is required' }, { status: 400 });
    }

    const [subject] = db.select().from(subjects).where(eq(subjects.id, subjectId)).all();
    if (!subject) {
        return json({ error: 'Subject not found' }, { status: 404 });
    }

    const fields = db.select().from(subjectFields).where(eq(subjectFields.subjectId, subjectId)).all();

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

                const [imageSubject] = tx
                    .insert(imageSubjects)
                    .values({ imageId: image.id, subjectId, label: label?.trim() || null })
                    .returning()
                    .all();

                for (const field of fields) {
                    const value = fieldValues?.[field.id] ?? null;
                    if (value !== null && value !== '') {
                        // Freshly-inserted `imageSubject`, so this is always a new row —
                        // skip the existence check the shared helper would otherwise do.
                        upsertImageSubjectFieldValue(tx, {
                            imageSubjectId: imageSubject.id,
                            subjectId,
                            subjectFieldId: field.id,
                            value,
                            exists: false
                        });
                    }
                }
            }
        });

        return json({ count: filePaths.length });
    } catch {
        return json({ error: 'Failed to add subjects — all changes rolled back' }, { status: 500 });
    }
};

// Bulk-edits fields on *existing* `imageSubjects` instances (one per
// image, already disambiguated client-side). Only the given fields are
// touched — other fields and other instances on the same image are left
// alone.
export const PATCH: RequestHandler = async ({ request }) => {
    const body = await request.json();
    const { imageSubjectIds, subjectId, fieldValues } = body as {
        imageSubjectIds: string[];
        subjectId: string;
        fieldValues: Record<string, string | null>;
    };

    if (!Array.isArray(imageSubjectIds) || imageSubjectIds.length === 0) {
        return json({ error: 'imageSubjectIds is required' }, { status: 400 });
    }
    if (!subjectId) {
        return json({ error: 'subjectId is required' }, { status: 400 });
    }
    if (!fieldValues || Object.keys(fieldValues).length === 0) {
        return json({ error: 'fieldValues is required' }, { status: 400 });
    }

    // Re-validate server-side that every instance actually belongs to the
    // claimed subject, rather than trusting the client's disambiguation.
    // Chunked: SQLite caps bound parameters per statement, and a large
    // multi-select could otherwise exceed that in a single `inArray`
    // (see dbUtils.ts for why we don't rely on the driver's default being high).
    const matchedCount = chunk(imageSubjectIds).reduce(
        (total, ids) =>
            total +
            db
                .select({ id: imageSubjects.id })
                .from(imageSubjects)
                .where(and(inArray(imageSubjects.id, ids), eq(imageSubjects.subjectId, subjectId)))
                .all().length,
        0
    );
    if (matchedCount !== imageSubjectIds.length) {
        return json({ error: 'One or more image subjects do not match the given subject' }, { status: 400 });
    }

    const fields = db.select().from(subjectFields).where(eq(subjectFields.subjectId, subjectId)).all();
    const fieldIds = new Set(fields.map((f) => f.id));
    const touchedFieldIds = Object.keys(fieldValues).filter((id) => fieldIds.has(id));
    if (touchedFieldIds.length === 0) {
        return json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Prefetch which (imageSubjectId, subjectFieldId) pairs already have a row,
    // in one batched query per chunk, so the write loop below can go straight
    // to insert/update without a `select` per cell (N instances × M fields).
    const existingPairs = new Set<string>();
    for (const ids of chunk(imageSubjectIds)) {
        const rows = db
            .select({ imageSubjectId: imageSubjectFieldValues.imageSubjectId, subjectFieldId: imageSubjectFieldValues.subjectFieldId })
            .from(imageSubjectFieldValues)
            .where(
                and(
                    inArray(imageSubjectFieldValues.imageSubjectId, ids),
                    inArray(imageSubjectFieldValues.subjectFieldId, touchedFieldIds)
                )
            )
            .all();
        for (const row of rows) existingPairs.add(`${row.imageSubjectId}:${row.subjectFieldId}`);
    }

    try {
        db.transaction((tx) => {
            for (const imageSubjectId of imageSubjectIds) {
                for (const subjectFieldId of touchedFieldIds) {
                    const value = fieldValues[subjectFieldId];
                    upsertImageSubjectFieldValue(tx, {
                        imageSubjectId,
                        subjectId,
                        subjectFieldId,
                        value: value === undefined ? null : value,
                        exists: existingPairs.has(`${imageSubjectId}:${subjectFieldId}`)
                    });
                }
            }
        });

        return json({ updated: imageSubjectIds.length });
    } catch {
        return json({ error: 'Failed to update subjects — all changes rolled back' }, { status: 500 });
    }
};
