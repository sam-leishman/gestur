import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userImageStats } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, locals }) => {
    const userId = locals.user!.id;
    const { imageIds }: { imageIds: string[] } = await request.json();

    if (!Array.isArray(imageIds) || imageIds.length === 0) {
        return json({});
    }

    const rows = db
        .select({ imageId: userImageStats.imageId, liked: userImageStats.liked })
        .from(userImageStats)
        .where(and(eq(userImageStats.userId, userId), inArray(userImageStats.imageId, imageIds)))
        .all();

    const result: Record<string, boolean> = Object.fromEntries(imageIds.map((id) => [id, false]));
    for (const row of rows) {
        result[row.imageId] = row.liked;
    }

    return json(result);
};
