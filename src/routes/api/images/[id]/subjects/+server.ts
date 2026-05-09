import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { imageSubjects, subjects } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';
import { buildImagePayload } from '$lib/server/imageUtils';

export const POST: RequestHandler = async ({ params, request }) => {
    const imageId = params.id!;
    const { subjectId, label } = await request.json();
    if (!subjectId) return json({ error: 'subjectId is required' }, { status: 400 });

    const [subject] = db.select().from(subjects).where(eq(subjects.id, subjectId)).all();
    if (!subject) return json({ error: 'Subject not found' }, { status: 404 });

    db.insert(imageSubjects).values({ imageId, subjectId, label: label?.trim() || null }).run();

    const payload = buildImagePayload(imageId);
    return json(payload, { status: 201 });
};
