import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { images, imageSubjects, subjects, subjectFields, imageSubjectFieldValues } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

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
                        tx.insert(imageSubjectFieldValues)
                            .values({
                                imageSubjectId: imageSubject.id,
                                subjectId,
                                subjectFieldId: field.id,
                                value
                            })
                            .run();
                    }
                }
            }
        });

        return json({ count: filePaths.length });
    } catch {
        return json({ error: 'Failed to add subjects — all changes rolled back' }, { status: 500 });
    }
};
