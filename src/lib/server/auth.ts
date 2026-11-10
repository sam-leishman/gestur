import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { username, admin } from 'better-auth/plugins';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { count, eq } from 'drizzle-orm';
import { ac, roles } from '$lib/permissions';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/auth.schema';
import { config } from './config';

const GUARDED_PATHS = ['/admin/remove-user', '/admin/set-role', '/admin/ban-user'];

export const auth = betterAuth({
	baseURL: {
		allowedHosts: [...config.auth.allowedHosts],
		fallback: `http://localhost:${config.server.port}`
	},
	secret: config.auth.secret,
	database: drizzleAdapter(db, { provider: 'sqlite' }),
	emailAndPassword: { enabled: true, disableSignUp: true },
	hooks: {
		before: createAuthMiddleware(async (ctx) => {
			if (!GUARDED_PATHS.includes(ctx.path)) return;
			const userId = ctx.body?.userId;
			const target = db.select().from(userTable).where(eq(userTable.id, userId)).get();
			if (!target) return;
			// /admin/ban-user and /admin/remove-user already reject self-targeting (YOU_CANNOT_BAN_YOURSELF /
			// YOU_CANNOT_REMOVE_YOURSELF); only /admin/set-role allows self-demotion, so that's the one case
			// the last-admin check below needs to actually catch.
			const demoting = ctx.path !== '/admin/set-role' || ctx.body?.role !== 'admin';
			if (target.role !== 'admin' || !demoting) return;
			const [{ n }] = db.select({ n: count() }).from(userTable).where(eq(userTable.role, 'admin')).all();
			if (n <= 1) throw new APIError('BAD_REQUEST', { message: 'Cannot remove or demote the last admin' });
		})
	},
	plugins: [
		username(),
		admin({ ac, roles, defaultRole: 'user', adminRoles: ['admin'] }),
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	],
	advanced: {
		trustedProxyHeaders: true
	}
});
