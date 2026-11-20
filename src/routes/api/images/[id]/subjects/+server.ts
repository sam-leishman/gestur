import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { imageSubjects, subjects } from '$lib/server/db/schema';
import { and, eq, max } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';
import { buildImagePayload } from '$lib/server/imageUtils';

export const POST: RequestHandler = async ({ params, request }) => {
    const imageId = params.id!;
    const { subjectId, label } = await request.json();
    if (!subjectId) return json({ error: 'subjectId is required' }, { status: 400 });

    const [subject] = db.select().from(subjects).where(eq(subjects.id, subjectId)).all();
    if (!subject) return json({ error: 'Subject not found' }, { status: 404 });

    // New instances are appended after any existing instances of the same
    // subject on this image, so "Add Subject" always lands at the end of the
    // numbered list rather than wherever its random id happens to sort.
    const [{ maxSortOrder }] = db
        .select({ maxSortOrder: max(imageSubjects.sortOrder) })
        .from(imageSubjects)
        .where(and(eq(imageSubjects.imageId, imageId), eq(imageSubjects.subjectId, subjectId)))
        .all();
    const sortOrder = maxSortOrder === null ? 0 : maxSortOrder + 1;

    db.insert(imageSubjects).values({ imageId, subjectId, label: label?.trim() || null, sortOrder }).run();

    const payload = buildImagePayload(imageId);
    return json(payload, { status: 201 });
};
