import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { images, sessionImages, sessions, userImageStats } from '$lib/server/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';
import { updateSessionLocalDate } from '$lib/server/sessionUtils';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GET: RequestHandler = ({ params, locals }) => {
	const userId = locals.user!.id;
	const sessionId = params.id!;

	const [session] = db
		.select()
		.from(sessions)
		.where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
		.all();

	if (!session) return json({ error: 'Not found' }, { status: 404 });

	function fetchImages(result: 'drawn' | 'skipped') {
		// Left-joined to `images`/`userImageStats` rather than inner-joined: if
		// the catalogue entry has since been deleted, `imageId` is null (the FK
		// is set-null-on-delete, not cascading) and we fall back to the
		// filePath/title snapshotted on this row when the session was recorded,
		// instead of the entry — and the session's draw/skip count — silently
		// disappearing.
		const rows = db
			.select({
				id: sessionImages.imageId,
				snapshotFilePath: sessionImages.filePath,
				snapshotTitle: sessionImages.title,
				liveFilePath: images.filePath,
				liveTitle: images.title,
				liked: userImageStats.liked
			})
			.from(sessionImages)
			.leftJoin(images, eq(sessionImages.imageId, images.id))
			.leftJoin(
				userImageStats,
				and(eq(userImageStats.imageId, sessionImages.imageId), eq(userImageStats.userId, userId))
			)
			.where(and(eq(sessionImages.sessionId, sessionId), eq(sessionImages.result, result)))
			.orderBy(asc(sessionImages.position))
			.all();

		return rows.map((row) => ({
			id: row.id,
			filePath: row.liveFilePath ?? row.snapshotFilePath,
			title: row.liveTitle ?? row.snapshotTitle,
			liked: row.liked ?? false
		}));
	}

	return json({
		id: session.id,
		startedAt: session.startedAt.toISOString(),
		completedAt: session.completedAt.toISOString(),
		status: session.status,
		targetCount: session.targetCount,
		durationSeconds: session.durationSeconds,
		drawnCount: session.drawnCount,
		skippedCount: session.skippedCount,
		drawnImages: fetchImages('drawn'),
		skippedImages: fetchImages('skipped')
	});
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const userId = locals.user!.id;
	const sessionId = params.id!;
	const { localDate }: { localDate: string } = await request.json();

	if (typeof localDate !== 'string' || !DATE_RE.test(localDate)) {
		return json({ error: 'Invalid localDate' }, { status: 400 });
	}

	updateSessionLocalDate(userId, sessionId, localDate);

	return json({ ok: true });
};
