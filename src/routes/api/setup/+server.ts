import { createHash, timingSafeEqual } from 'crypto';
import { json } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { config } from '$lib/server/config';
import { hasUsers } from '$lib/server/setup';
import { usernameToEmail } from '$lib/permissions';
import type { RequestHandler } from './$types';

let creatingAdmin = false;

const digest = (value: string) => createHash('sha256').update(value).digest();
const tokensMatch = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

export const GET: RequestHandler = () => json({ requiresToken: !!config.auth.setupToken });

export const POST: RequestHandler = async ({ request }) => {
	if (hasUsers()) return json({ error: 'Setup has already been completed' }, { status: 409 });

	const { username, password, confirmPassword, token } = await request.json();

	if (config.auth.setupToken && !tokensMatch(String(token ?? ''), config.auth.setupToken))
		return json({ error: 'Invalid setup token' }, { status: 403 });
	if (!username?.trim()) return json({ error: 'Username is required' }, { status: 400 });
	if (password !== confirmPassword) return json({ error: 'Passwords do not match' }, { status: 400 });
	if (!password || password.length < 8)
		return json({ error: 'Password must be at least 8 characters' }, { status: 400 });

	if (creatingAdmin) return json({ error: 'Setup is already in progress' }, { status: 409 });
	creatingAdmin = true;
	try {
		if (hasUsers()) return json({ error: 'Setup has already been completed' }, { status: 409 });
		await auth.api.createUser({
			body: { email: usernameToEmail(username), name: username.trim(), password, role: 'admin', data: { username } }
		});
	} catch (e) {
		return json({ error: (e as Error).message || 'Setup failed' }, { status: 400 });
	} finally {
		creatingAdmin = false;
	}

	await auth.api.signInUsername({ body: { username, password }, headers: request.headers });
	return json({ success: true });
};
