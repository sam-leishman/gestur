import { count } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/auth.schema';

let hasUsersCache = false;

export function hasUsers(): boolean {
	if (hasUsersCache) return true;
	const [row] = db.select({ n: count() }).from(user).all();
	hasUsersCache = row.n > 0;
	return hasUsersCache;
}
