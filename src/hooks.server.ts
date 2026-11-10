import { redirect, json, type Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { hasUsers } from '$lib/server/setup';
import {
	hasPermission,
	LOGIN_ROUTE,
	PUBLIC_ROUTES,
	requiredApiPermissions,
	requiredPagePermissions,
	SETUP_API_ROUTE,
	SETUP_ROUTE
} from '$lib/permissions';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	const isAuthApi = pathname.startsWith('/api/auth/');
	const isSetupApi = pathname === SETUP_API_ROUTE;

	if (!building && !isAuthApi && !isSetupApi) {
		const needsSetup = !hasUsers();
		if (needsSetup && pathname !== SETUP_ROUTE) throw redirect(303, SETUP_ROUTE);
		if (!needsSetup && pathname === SETUP_ROUTE) throw redirect(303, LOGIN_ROUTE);
	}

	if (isSetupApi) {
		if (hasUsers()) return json({ error: 'Setup has already been completed' }, { status: 409 });
		return resolve(event);
	}

	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	const isPublicRoute = PUBLIC_ROUTES.includes(pathname) || isAuthApi;

	if (PUBLIC_ROUTES.includes(pathname) && session?.user) {
		throw redirect(303, '/');
	}

	if (!isPublicRoute && !session?.user) {
		if (pathname.startsWith('/api/')) return json({ error: 'Unauthorized' }, { status: 401 });
		throw redirect(303, LOGIN_ROUTE);
	}

	const role = session?.user.role;
	const pagePermissions = requiredPagePermissions(pathname);
	if (pagePermissions && !hasPermission(role, pagePermissions)) throw redirect(303, '/');

	const apiPermissions = requiredApiPermissions(pathname, event.request.method);
	if (apiPermissions && !hasPermission(role, apiPermissions)) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
