import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { images, imageSubjects, imageSubjectFieldValues } from '$lib/server/db/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';
import { queryChunked } from '$lib/server/dbUtils';

// Resolves, for each given file path, the existing `imageSubjects` instances
// (if any) of a given subject on that image — used by the bulk "edit
// existing subject" flow to figure out which images have exactly one
// instance (safe to auto-include), which have none (excluded), and which
// have several (need the user to disambiguate).
export const POST: RequestHandler = async ({ request }) => {
    const { filePaths, subjectId } = (await request.json()) as {
        filePaths: string[];
        subjectId: string;
    };

    if (!Array.isArray(filePaths) || filePaths.length === 0) {
        return json({ error: 'filePaths is required' }, { status: 400 });
    }
    if (!subjectId) {
        return json({ error: 'subjectId is required' }, { status: 400 });
    }

    const trimmedPaths = filePaths.map((p) => p.trim());

    // Chunked: a large multi-select's file paths/ids could otherwise exceed
    // SQLite's per-statement bound-parameter limit in a single `inArray`
    // (see dbUtils.ts for why we don't rely on the driver's default being high).
    const matchedImages = queryChunked(trimmedPaths, (paths) =>
        db
            .select({ id: images.id, filePath: images.filePath })
            .from(images)
            .where(inArray(images.filePath, paths))
            .all()
    );
    const imageIdByPath = new Map(matchedImages.map((i) => [i.filePath, i.id]));
    const imageIds = matchedImages.map((i) => i.id);

    // Ordered the same way `buildImagePayload` orders an image's subjects
    // (asc by `sortOrder`, falling back to `id`) so an instance's
    // position/ordinal here matches the "Pose #1" / "Pose #2" numbering
    // shown in the per-image detail panel — otherwise the two UIs can
    // disagree about which instance is "#1", which is exactly the
    // confusing-looking mismatch this ordering avoids.
    const instanceRows = queryChunked(imageIds, (ids) =>
        db
            .select({ id: imageSubjects.id, imageId: imageSubjects.imageId, label: imageSubjects.label })
            .from(imageSubjects)
            .where(and(inArray(imageSubjects.imageId, ids), eq(imageSubjects.subjectId, subjectId)))
            .orderBy(asc(imageSubjects.sortOrder), asc(imageSubjects.id))
            .all()
    );
    const instanceIds = instanceRows.map((r) => r.id);

    const valueRows = queryChunked(instanceIds, (ids) =>
        db
            .select()
            .from(imageSubjectFieldValues)
            .where(inArray(imageSubjectFieldValues.imageSubjectId, ids))
            .all()
    );
    const valuesByInstance = new Map<string, Record<string, string | null>>();
    for (const row of valueRows) {
        const map = valuesByInstance.get(row.imageSubjectId) ?? {};
        map[row.subjectFieldId] = row.value;
        valuesByInstance.set(row.imageSubjectId, map);
    }

    const instancesByImageId = new Map<string, { id: string; label: string | null; fieldValues: Record<string, string | null> }[]>();
    for (const row of instanceRows) {
        const list = instancesByImageId.get(row.imageId) ?? [];
        list.push({ id: row.id, label: row.label, fieldValues: valuesByInstance.get(row.id) ?? {} });
        instancesByImageId.set(row.imageId, list);
    }

    const result = trimmedPaths.map((filePath) => {
        const imageId = imageIdByPath.get(filePath);
        return {
            filePath,
            instances: imageId ? (instancesByImageId.get(imageId) ?? []) : []
        };
    });

    return json(result);
};
