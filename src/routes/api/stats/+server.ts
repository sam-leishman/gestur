import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { images, userImageStats } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = ({ locals }) => {
    const userId = locals.user!.id;

    // Left-joined, with the live filePath/title preferred and the snapshot
    // taken at write time as a fallback: a deleted image's lifetime stats
    // stay in these totals and leaderboards (imageId null => "removed from
    // catalogue" in the UI) instead of quietly dropping out of them.
    const rows = db
        .select({
            imageId: userImageStats.imageId,
            filePath: images.filePath,
            snapshotFilePath: userImageStats.filePath,
            title: images.title,
            snapshotTitle: userImageStats.title,
            drawCount: userImageStats.drawCount,
            skipCount: userImageStats.skipCount,
            liked: userImageStats.liked
        })
        .from(userImageStats)
        .leftJoin(images, eq(userImageStats.imageId, images.id))
        .where(eq(userImageStats.userId, userId))
        .all()
        .map((row) => ({
            imageId: row.imageId,
            filePath: row.filePath ?? row.snapshotFilePath,
            title: row.title ?? row.snapshotTitle,
            drawCount: row.drawCount,
            skipCount: row.skipCount,
            liked: row.liked
        }));

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
        .map(({ imageId, filePath, title, drawCount }) => ({ imageId, filePath, title, drawCount }));

    const mostSkipped = [...rows]
        .filter((r) => r.skipCount > 0)
        .sort((a, b) => b.skipCount - a.skipCount)
        .slice(0, 12)
        .map(({ imageId, filePath, title, skipCount }) => ({ imageId, filePath, title, skipCount }));

    return json({ totalDraws, totalSkips, totalLiked, totalSeen, mostDrawn, mostSkipped });
};
