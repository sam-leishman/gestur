import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userImageStats } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

type StatField = 'drawCount' | 'skipCount';
const SQL_COL: Record<StatField, ReturnType<typeof sql>> = {
    drawCount: sql`draw_count + 1`,
    skipCount: sql`skip_count + 1`
};

function upsertStat(userId: string, imageId: string, field: StatField) {
    db.insert(userImageStats)
        .values({ userId, imageId, [field]: 1 })
        .onConflictDoUpdate({
            target: [userImageStats.userId, userImageStats.imageId],
            set: { [field]: SQL_COL[field] }
        })
        .run();
}

export const POST: RequestHandler = async ({ request, locals }) => {
    const userId = locals.user!.id;
    const { draws, skips }: { draws: string[]; skips: string[] } = await request.json();

    if (!Array.isArray(draws) || !Array.isArray(skips)) {
        return json({ error: 'Invalid payload' }, { status: 400 });
    }

    db.transaction(() => {
        for (const imageId of draws) upsertStat(userId, imageId, 'drawCount');
        for (const imageId of skips) upsertStat(userId, imageId, 'skipCount');
    });

    return json({ ok: true });
};
