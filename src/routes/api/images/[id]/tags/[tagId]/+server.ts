import { db } from '$lib/server/db';
import { imageTags } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

export const DELETE: RequestHandler = ({ params }) => {
    const { id, tagId } = params as { id: string; tagId: string };
    db.delete(imageTags).where(and(eq(imageTags.imageId, id), eq(imageTags.tagId, tagId))).run();
    return new Response(null, { status: 204 });
};
