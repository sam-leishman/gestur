import { json } from '@sveltejs/kit';
import {
	getDailyGoalMinutes,
	setDailyGoalMinutes,
	MIN_DAILY_GOAL_MINUTES
} from '$lib/server/settingsUtils';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = ({ locals }) => {
	const userId = locals.user!.id;
	return json({ dailyGoalMinutes: getDailyGoalMinutes(userId) });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user!.id;
	const { dailyGoalMinutes }: { dailyGoalMinutes: number } = await request.json();

	if (!Number.isFinite(dailyGoalMinutes) || !Number.isInteger(dailyGoalMinutes) || dailyGoalMinutes < MIN_DAILY_GOAL_MINUTES) {
		return json({ error: `dailyGoalMinutes must be an integer >= ${MIN_DAILY_GOAL_MINUTES}` }, { status: 400 });
	}

	setDailyGoalMinutes(userId, dailyGoalMinutes);

	return json({ dailyGoalMinutes });
};
