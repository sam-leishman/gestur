import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { imageSubjects, subjects } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';
import { buildImagePayload } from '$lib/server/imageUtils';

export const POST: RequestHandler = async ({ params, request }) => {
    const imageId = params.id!;
    const { subjectId } = await request.json();
    if (!subjectId) return json({ error: 'subjectId is required' }, { status: 400 });

    const [subject] = db.select().from(subjects).where(eq(subjects.id, subjectId)).all();
    if (!subject) return json({ error: 'Subject not found' }, { status: 404 });

    const [existing] = db
        .select()
        .from(imageSubjects)
        .where(and(eq(imageSubjects.imageId, imageId), eq(imageSubjects.subjectId, subjectId)))
        .all();

    if (existing) {
        return json({ error: 'Subject already linked to this image' }, { status: 409 });
    }

    db.insert(imageSubjects).values({ imageId, subjectId }).run();

    const payload = buildImagePayload(imageId);
    return json(payload, { status: 201 });
};
