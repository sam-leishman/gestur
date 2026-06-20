import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { images, userImageStats } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = ({ locals }) => {
    const userId = locals.user!.id;

    const rows = db
        .select({
            imageId: userImageStats.imageId,
            filePath: images.filePath,
            drawCount: userImageStats.drawCount,
            skipCount: userImageStats.skipCount,
            liked: userImageStats.liked
        })
        .from(userImageStats)
        .innerJoin(images, eq(userImageStats.imageId, images.id))
        .where(eq(userImageStats.userId, userId))
        .all();

    let totalDraws = 0;
    let totalSkips = 0;
    let totalLiked = 0;
    let totalSeen = 0;

    for (const row of rows) {
        totalDraws += row.drawCount;
        totalSkips += row.skipCount;
        if (row.liked) totalLiked++;
        if (row.drawCount > 0 || row.skipCount > 0 || row.liked) totalSeen++;
    }

    const mostDrawn = [...rows]
        .filter((r) => r.drawCount > 0)
        .sort((a, b) => b.drawCount - a.drawCount)
        .slice(0, 12)
        .map(({ imageId, filePath, drawCount }) => ({ imageId, filePath, drawCount }));

    const mostSkipped = [...rows]
        .filter((r) => r.skipCount > 0)
        .sort((a, b) => b.skipCount - a.skipCount)
        .slice(0, 12)
        .map(({ imageId, filePath, skipCount }) => ({ imageId, filePath, skipCount }));

    return json({ totalDraws, totalSkips, totalLiked, totalSeen, mostDrawn, mostSkipped });
};
