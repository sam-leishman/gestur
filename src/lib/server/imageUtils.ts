import { db } from '$lib/server/db';
import { images, imageSubjects, subjects, subjectFields, imageSubjectFieldValues } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';

export function buildImagePayload(imageId: string) {
    const [image] = db.select().from(images).where(eq(images.id, imageId)).all();
    if (!image) return null;

    const linkedSubjects = db
        .select({
            imageSubjectId: imageSubjects.id,
            subjectId: subjects.id,
            subjectName: subjects.name
        })
        .from(imageSubjects)
        .innerJoin(subjects, eq(imageSubjects.subjectId, subjects.id))
        .where(eq(imageSubjects.imageId, imageId))
        .orderBy(asc(subjects.name))
        .all();

    const subjectData = linkedSubjects.map(({ imageSubjectId, subjectId, subjectName }) => {
        const fields = db
            .select()
            .from(subjectFields)
            .where(eq(subjectFields.subjectId, subjectId))
            .orderBy(asc(subjectFields.sortOrder))
            .all();

        const values = db
            .select()
            .from(imageSubjectFieldValues)
            .where(eq(imageSubjectFieldValues.imageSubjectId, imageSubjectId))
            .all();

        const valueMap = Object.fromEntries(values.map((v) => [v.subjectFieldId, v.value]));

        return {
            imageSubjectId,
            subjectId,
            subjectName,
            fields: fields.map((f) => ({
                ...f,
                value: valueMap[f.id] ?? null
            }))
        };
    });

    return { ...image, subjects: subjectData };
}
