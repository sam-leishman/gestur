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
            subjectName: subjects.name,
            label: imageSubjects.label
        })
        .from(imageSubjects)
        .innerJoin(subjects, eq(imageSubjects.subjectId, subjects.id))
        .where(eq(imageSubjects.imageId, imageId))
        .orderBy(asc(subjects.name), asc(imageSubjects.id))
        .all();

    const subjectData = linkedSubjects.map(({ imageSubjectId, subjectId, subjectName, label }) => {
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
            label,
            fields: fields.map((f) => ({
                ...f,
                value: valueMap[f.id] ?? null
            }))
        };
    });

    return { ...image, subjects: subjectData };
}
