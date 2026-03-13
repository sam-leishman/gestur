import { redirect, type Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const PUBLIC_ROUTES = [
	'/login',
	'/register'
];
const AUTH_ROUTES = [
	'/login',
	'/register'
];

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	// Route protection
	const isPublicRoute = PUBLIC_ROUTES.includes(event.url.pathname) || event.url.pathname.startsWith('/api/auth/');
	const isAuthRoute = AUTH_ROUTES.includes(event.url.pathname);

	if (isAuthRoute && session?.user) {
		throw redirect(303, '/');
	}

	if (!isPublicRoute && !session?.user) {
		throw redirect(303, '/login');
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
