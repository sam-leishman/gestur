import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userImageStats } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = ({ params, locals }) => {
    const imageId = params.id!;
    const userId = locals.user!.id;

    const [existing] = db
        .select()
        .from(userImageStats)
        .where(and(eq(userImageStats.imageId, imageId), eq(userImageStats.userId, userId)))
        .all();

    if (existing) {
        const [updated] = db
            .update(userImageStats)
            .set({ liked: !existing.liked })
            .where(eq(userImageStats.id, existing.id))
            .returning()
            .all();
        return json({ liked: updated.liked });
    }

    const [created] = db
        .insert(userImageStats)
        .values({ userId, imageId, liked: true })
        .returning()
        .all();
    return json({ liked: created.liked });
};
