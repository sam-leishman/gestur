import { db } from '$lib/server/db';
import { images, sessionImages, sessions, userImageStats } from '$lib/server/db/schema';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

type StatField = 'drawCount' | 'skipCount';
const SQL_COL: Record<StatField, ReturnType<typeof sql>> = {
	drawCount: sql`draw_count + 1`,
	skipCount: sql`skip_count + 1`
};

type ImageSnapshot = { filePath: string; title: string };

/**
 * Looks up the current filePath/title for a batch of image ids, for
 * snapshotting onto history rows at write time. Falls back to a placeholder
 * for an id that can't be resolved (e.g. deleted in another tab mid-session)
 * so the entry is still recorded instead of silently dropped.
 */
function snapshotImages(imageIds: string[]): Map<string, ImageSnapshot> {
	const map = new Map<string, ImageSnapshot>();
	if (imageIds.length === 0) return map;
	const rows = db
		.select({ id: images.id, filePath: images.filePath, title: images.title })
		.from(images)
		.where(inArray(images.id, imageIds))
		.all();
	for (const row of rows) map.set(row.id, { filePath: row.filePath, title: row.title });
	for (const id of imageIds) {
		if (!map.has(id)) map.set(id, { filePath: id, title: 'Unknown image' });
	}
	return map;
}

function upsertStat(userId: string, imageId: string, snapshot: ImageSnapshot, field: StatField) {
	db.insert(userImageStats)
		.values({ userId, imageId, filePath: snapshot.filePath, title: snapshot.title, [field]: 1 })
		.onConflictDoUpdate({
			target: [userImageStats.userId, userImageStats.imageId],
			set: { [field]: SQL_COL[field], filePath: snapshot.filePath, title: snapshot.title }
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
	localDate: string;
	goalMinutesSnapshot: number;
};

/**
 * Records aggregate per-image stats and a persisted session-history record
 * (with its ordered drawn/skipped image entries) in one transaction.
 */
export function recordSession(input: RecordSessionInput): string {
	const {
		userId,
		startedAt,
		completedAt,
		status,
		targetCount,
		durationSeconds,
		draws,
		skips,
		localDate,
		goalMinutesSnapshot
	} = input;
	let sessionId = '';

	db.transaction(() => {
		const snapshots = snapshotImages([...new Set([...draws, ...skips])]);

		for (const imageId of draws) upsertStat(userId, imageId, snapshots.get(imageId)!, 'drawCount');
		for (const imageId of skips) upsertStat(userId, imageId, snapshots.get(imageId)!, 'skipCount');

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
				skippedCount: skips.length,
				localDate,
				goalMinutesSnapshot
			})
			.returning()
			.all();
		sessionId = session.id;

		if (draws.length > 0) {
			db.insert(sessionImages)
				.values(draws.map((imageId, position) => ({
					sessionId: session.id,
					imageId,
					filePath: snapshots.get(imageId)!.filePath,
					title: snapshots.get(imageId)!.title,
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
					filePath: snapshots.get(imageId)!.filePath,
					title: snapshots.get(imageId)!.title,
					result: 'skipped' as const,
					position
				})))
				.run();
		}
	});

	return sessionId;
}

/**
 * Re-attributes an already-persisted session to a different local date.
 * Used by the midnight-grace flow, where a session completed just after
 * midnight can be counted toward the previous day instead.
 */
export function updateSessionLocalDate(userId: string, sessionId: string, localDate: string): void {
	db.update(sessions)
		.set({ localDate })
		.where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
		.run();
}

export type DailyActivity = {
	localDate: string;
	totalSeconds: number;
	goalMinutes: number;
};

/**
 * Aggregates drawn time per local date from session history.
 * Contributed time per session is drawnCount * durationSeconds, so stopped
 * sessions still count for whatever was actually drawn. Each date's goal
 * reflects the goal snapshot from that date's most recently started session,
 * so historical qualification stays tied to the goal active at the time.
 */
export function getDailyActivity(userId: string): DailyActivity[] {
	const rows = db
		.select({
			localDate: sessions.localDate,
			drawnCount: sessions.drawnCount,
			durationSeconds: sessions.durationSeconds,
			goalMinutesSnapshot: sessions.goalMinutesSnapshot
		})
		.from(sessions)
		.where(eq(sessions.userId, userId))
		.orderBy(asc(sessions.startedAt))
		.all();

	const byDate = new Map<string, DailyActivity>();
	for (const row of rows) {
		const existing = byDate.get(row.localDate);
		const contributedSeconds = row.drawnCount * row.durationSeconds;
		if (existing) {
			existing.totalSeconds += contributedSeconds;
			existing.goalMinutes = row.goalMinutesSnapshot;
		} else {
			byDate.set(row.localDate, {
				localDate: row.localDate,
				totalSeconds: contributedSeconds,
				goalMinutes: row.goalMinutesSnapshot
			});
		}
	}

	return [...byDate.values()];
}
