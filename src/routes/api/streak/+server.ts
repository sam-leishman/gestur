import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { drawingDays } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { computeStreaks } from '$lib/server/streakUtils';
import type { RequestHandler } from '@sveltejs/kit';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GET: RequestHandler = ({ locals, url }) => {
	const userId = locals.user!.id;

	const todayStr = url.searchParams.get('today') ?? '';
	const yesterdayStr = url.searchParams.get('yesterday') ?? '';

	if (!DATE_RE.test(todayStr) || !DATE_RE.test(yesterdayStr)) {
		return json({ error: 'Invalid or missing today/yesterday params' }, { status: 400 });
	}

	const rows = db
		.select({ date: drawingDays.date })
		.from(drawingDays)
		.where(eq(drawingDays.userId, userId))
		.all();

	const drawnDates = rows.map((r) => r.date);
	const { currentStreak, longestStreak } = computeStreaks(drawnDates, todayStr, yesterdayStr);

	return json({ currentStreak, longestStreak, drawnDates });
};
