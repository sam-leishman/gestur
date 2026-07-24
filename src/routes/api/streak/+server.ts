import { json } from '@sveltejs/kit';
import { computeStreaks } from '$lib/server/streakUtils';
import { getDailyActivity } from '$lib/server/sessionUtils';
import { getDailyGoalMinutes } from '$lib/server/settingsUtils';
import type { RequestHandler } from '@sveltejs/kit';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GET: RequestHandler = ({ locals, url }) => {
	const userId = locals.user!.id;

	const todayStr = url.searchParams.get('today') ?? '';
	const yesterdayStr = url.searchParams.get('yesterday') ?? '';

	if (!DATE_RE.test(todayStr) || !DATE_RE.test(yesterdayStr)) {
		return json({ error: 'Invalid or missing today/yesterday params' }, { status: 400 });
	}

	const currentGoalMinutes = getDailyGoalMinutes(userId);
	const dailyActivity = getDailyActivity(userId);

	const drawnDates = dailyActivity
		.filter((day) => day.totalSeconds >= day.goalMinutes * 60)
		.map((day) => day.localDate);

	const { currentStreak, longestStreak } = computeStreaks(drawnDates, todayStr, yesterdayStr);

	const todayActivity = dailyActivity.find((day) => day.localDate === todayStr);
	const todaySeconds = todayActivity?.totalSeconds ?? 0;

	return json({
		currentStreak,
		longestStreak,
		drawnDates,
		dailyGoalMinutes: currentGoalMinutes,
		todaySeconds
	});
};
