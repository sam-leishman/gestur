import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { db } from '$lib/server/db';
import { images, imageSubjects, subjects, subjectFields, imageSubjectFieldValues, userImageStats } from '$lib/server/db/schema';
import { config } from '$lib/server/config';
import { eq, asc, and, inArray } from 'drizzle-orm';
import type { MissingImage } from '$lib/types';

/**
 * Whether a catalogued image's file still exists on disk. `filePath` is
 * relative to `config.paths.images`, the same root used when it was
 * catalogued.
 */
export function imageExistsOnDisk(filePath: string): boolean {
    return existsSync(resolve(join(resolve(config.paths.images), filePath)));
}

/**
 * Catalogued images whose file can no longer be found on disk, enriched with
 * enough metadata (subject/draw/skip counts, liked status) for the "what am
 * I about to relink or delete" context shown in the UI.
 */
export function getMissingImages(userId?: string): MissingImage[] {
    const rows = db.select({ id: images.id, filePath: images.filePath, title: images.title }).from(images).all();
    const missingRows = rows.filter((row) => !imageExistsOnDisk(row.filePath));
    if (missingRows.length === 0) return [];

    const ids = missingRows.map((row) => row.id);

    const subjectCounts = new Map<string, number>();
    for (const row of db.select({ imageId: imageSubjects.imageId }).from(imageSubjects).where(inArray(imageSubjects.imageId, ids)).all()) {
        subjectCounts.set(row.imageId, (subjectCounts.get(row.imageId) ?? 0) + 1);
    }

    const stats = new Map<string, { liked: boolean; drawCount: number; skipCount: number }>();
    if (userId) {
        const statsRows = db
            .select({ imageId: userImageStats.imageId, liked: userImageStats.liked, drawCount: userImageStats.drawCount, skipCount: userImageStats.skipCount })
            .from(userImageStats)
            .where(and(inArray(userImageStats.imageId, ids), eq(userImageStats.userId, userId)))
            .all();
        for (const row of statsRows) stats.set(row.imageId, row);
    }

    return missingRows.map((row) => ({
        ...row,
        subjectCount: subjectCounts.get(row.id) ?? 0,
        liked: stats.get(row.id)?.liked ?? false,
        drawCount: stats.get(row.id)?.drawCount ?? 0,
        skipCount: stats.get(row.id)?.skipCount ?? 0
    }));
}

export function buildImagePayload(imageId: string, userId?: string) {
    const [image] = db.select().from(images).where(eq(images.id, imageId)).all();
    if (!image) return null;

    let liked = false;
    let drawCount = 0;
    let skipCount = 0;
    if (userId) {
        const [stats] = db
            .select({ liked: userImageStats.liked, drawCount: userImageStats.drawCount, skipCount: userImageStats.skipCount })
            .from(userImageStats)
            .where(and(eq(userImageStats.imageId, imageId), eq(userImageStats.userId, userId)))
            .all();
        liked = stats?.liked ?? false;
        drawCount = stats?.drawCount ?? 0;
        skipCount = stats?.skipCount ?? 0;
    }

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

    return { ...image, liked, drawCount, skipCount, subjects: subjectData };
}
