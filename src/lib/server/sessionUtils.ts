import { db } from '$lib/server/db';
import { sessionImages, sessions, userImageStats } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';

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

export type SessionResultStatus = 'completed' | 'stopped';

export type RecordSessionInput = {
	userId: string;
	startedAt: Date;
	completedAt: Date;
	status: SessionResultStatus;
	targetCount: number;
	durationSeconds: number;
	draws: string[];
	skips: string[];
};

/**
 * Records aggregate per-image stats and a persisted session-history record
 * (with its ordered drawn/skipped image entries) in one transaction.
 */
export function recordSession(input: RecordSessionInput): string {
	const { userId, startedAt, completedAt, status, targetCount, durationSeconds, draws, skips } = input;
	let sessionId = '';

	db.transaction(() => {
		for (const imageId of draws) upsertStat(userId, imageId, 'drawCount');
		for (const imageId of skips) upsertStat(userId, imageId, 'skipCount');

		const [session] = db
			.insert(sessions)
			.values({
				userId,
				startedAt,
				completedAt,
				status,
				targetCount,
				durationSeconds,
				drawnCount: draws.length,
				skippedCount: skips.length
			})
			.returning()
			.all();
		sessionId = session.id;

		if (draws.length > 0) {
			db.insert(sessionImages)
				.values(draws.map((imageId, position) => ({
					sessionId: session.id,
					imageId,
					result: 'drawn' as const,
					position
				})))
				.run();
		}

		if (skips.length > 0) {
			db.insert(sessionImages)
				.values(skips.map((imageId, position) => ({
					sessionId: session.id,
					imageId,
					result: 'skipped' as const,
					position
				})))
				.run();
		}
	});

	return sessionId;
}
