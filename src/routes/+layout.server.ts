import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

const PUBLIC_ROUTES = ['/login', '/register'];

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const isPublicRoute = PUBLIC_ROUTES.includes(url.pathname) || url.pathname.startsWith('/api/auth/');
	
	if (!isPublicRoute && !locals.user) {
		throw redirect(303, '/login');
	}

	if (PUBLIC_ROUTES.includes(url.pathname) && locals.user) {
		throw redirect(303, '/');
	}

	return {
		user: locals.user,
		session: locals.session
	};
};
