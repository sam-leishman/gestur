import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { imageSubjects } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

export const DELETE: RequestHandler = ({ params }) => {
    const isid = params.isid!;
    db.delete(imageSubjects).where(eq(imageSubjects.id, isid)).run();
    return new Response(null, { status: 204 });
};
