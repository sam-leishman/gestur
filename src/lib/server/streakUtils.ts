export interface StreakResult {
	currentStreak: number;
	longestStreak: number;
}

/**
 * Computes streak stats from an array of "YYYY-MM-DD" date strings.
 * todayStr and yesterdayStr are the caller's local date strings for today and yesterday.
 */
export function computeStreaks(
	dates: string[],
	todayStr: string,
	yesterdayStr: string
): StreakResult {
	if (dates.length === 0) {
		return { currentStreak: 0, longestStreak: 0 };
	}

	const set = new Set(dates);
	const sorted = [...set].sort();

	// Longest streak (any contiguous run)
	let longestStreak = 1;
	let run = 1;
	for (let i = 1; i < sorted.length; i++) {
		if (isConsecutive(sorted[i - 1], sorted[i])) {
			run++;
			if (run > longestStreak) longestStreak = run;
		} else {
			run = 1;
		}
	}

	// Current streak: count backwards from today or yesterday
	let currentStreak = 0;
	let anchor = set.has(todayStr) ? todayStr : set.has(yesterdayStr) ? yesterdayStr : null;
	if (anchor) {
		let cursor = anchor;
		while (set.has(cursor)) {
			currentStreak++;
			cursor = offsetDateStr(cursor, -1);
		}
	}

	return { currentStreak, longestStreak };
}

function isConsecutive(a: string, b: string): boolean {
	return offsetDateStr(a, 1) === b;
}

function offsetDateStr(dateStr: string, days: number): string {
	const d = new Date(dateStr + 'T12:00:00');
	d.setDate(d.getDate() + days);
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}
