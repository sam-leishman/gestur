import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { drawingDays } from '$lib/server/db/schema';
import type { RequestHandler } from '@sveltejs/kit';

function utcOffsetDate(offsetDays: number): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() + offsetDays);
	return d.toISOString().slice(0, 10);
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user!.id;
	const { date }: { date: string } = await request.json();

	if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return json({ error: 'Invalid date' }, { status: 400 });
	}

	// Allow [-1, +1] days from server UTC today — covers all timezones + midnight grace
	const minDate = utcOffsetDate(-1);
	const maxDate = utcOffsetDate(1);
	if (date < minDate || date > maxDate) {
		return json({ error: 'Date out of range' }, { status: 400 });
	}

	db.insert(drawingDays)
		.values({ userId, date })
		.onConflictDoNothing()
		.run();

	return json({ ok: true });
};
