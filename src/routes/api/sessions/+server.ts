import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sessions } from '$lib/server/db/schema';
import { and, count, desc, eq, gte, lte } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';
import { recordSession, type SessionResultStatus } from '$lib/server/sessionUtils';

const STATUS_VALUES = ['completed', 'stopped'] as const;

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function isStatus(value: string | null): value is SessionResultStatus {
	return value !== null && (STATUS_VALUES as readonly string[]).includes(value);
}

export const GET: RequestHandler = ({ locals, url }) => {
	const userId = locals.user!.id;

	const limitParam = Number(url.searchParams.get('limit'));
	const offsetParam = Number(url.searchParams.get('offset'));
	const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : DEFAULT_LIMIT;
	const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

	const statusParam = url.searchParams.get('status');
	const status = isStatus(statusParam) ? statusParam : null;
	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');

	const conditions = [eq(sessions.userId, userId)];
	if (status) conditions.push(eq(sessions.status, status));
	if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) conditions.push(gte(sessions.completedAt, new Date(`${from}T00:00:00`)));
	if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) conditions.push(lte(sessions.completedAt, new Date(`${to}T23:59:59.999`)));

	const where = and(...conditions);

	const [{ value: total }] = db.select({ value: count() }).from(sessions).where(where).all();

	const rows = db
		.select({
			id: sessions.id,
			startedAt: sessions.startedAt,
			completedAt: sessions.completedAt,
			status: sessions.status,
			targetCount: sessions.targetCount,
			durationSeconds: sessions.durationSeconds,
			drawnCount: sessions.drawnCount,
			skippedCount: sessions.skippedCount
		})
		.from(sessions)
		.where(where)
		.orderBy(desc(sessions.completedAt))
		.limit(limit)
		.offset(offset)
		.all();

	const items = rows.map((row) => ({
		...row,
		startedAt: row.startedAt.toISOString(),
		completedAt: row.completedAt.toISOString()
	}));

	return json({ sessions: items, total, limit, offset });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user!.id;
	const body = await request.json();
	const {
		draws,
		skips,
		targetCount,
		durationSeconds,
		startedAt,
		status
	}: {
		draws: string[];
		skips: string[];
		targetCount: number;
		durationSeconds: number;
		startedAt: string;
		status: SessionResultStatus;
	} = body;

	const validPayload =
		Array.isArray(draws) &&
		Array.isArray(skips) &&
		(draws.length > 0 || skips.length > 0) &&
		Number.isFinite(targetCount) && targetCount >= 1 &&
		Number.isFinite(durationSeconds) && durationSeconds >= 1 &&
		isStatus(status) &&
		typeof startedAt === 'string' && !Number.isNaN(Date.parse(startedAt));

	if (!validPayload) {
		return json({ error: 'Invalid payload' }, { status: 400 });
	}

	const id = recordSession({
		userId,
		startedAt: new Date(startedAt),
		completedAt: new Date(),
		status,
		targetCount,
		durationSeconds,
		draws,
		skips
	});

	return json({ id }, { status: 201 });
};
