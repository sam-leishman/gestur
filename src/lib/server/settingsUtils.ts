import { db } from '$lib/server/db';
import { userSettings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const DEFAULT_DAILY_GOAL_MINUTES = 30;
export const MIN_DAILY_GOAL_MINUTES = 1;
export const LOW_GOAL_WARNING_THRESHOLD_MINUTES = 9;

export function getDailyGoalMinutes(userId: string): number {
	const [row] = db
		.select({ dailyGoalMinutes: userSettings.dailyGoalMinutes })
		.from(userSettings)
		.where(eq(userSettings.userId, userId))
		.all();

	return row?.dailyGoalMinutes ?? DEFAULT_DAILY_GOAL_MINUTES;
}

export function setDailyGoalMinutes(userId: string, minutes: number): void {
	db.insert(userSettings)
		.values({ userId, dailyGoalMinutes: minutes })
		.onConflictDoUpdate({
			target: userSettings.userId,
			set: { dailyGoalMinutes: minutes }
		})
		.run();
}
