import { json } from '@sveltejs/kit';
import { getBrowseViewMode, setBrowseViewMode, type BrowseViewMode } from '$lib/server/settingsUtils';
import type { RequestHandler } from '@sveltejs/kit';

const VALID_MODES: BrowseViewMode[] = ['grid', 'list'];

export const GET: RequestHandler = ({ locals }) => {
	const userId = locals.user!.id;
	return json({ browseViewMode: getBrowseViewMode(userId) });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user!.id;
	const { browseViewMode }: { browseViewMode: BrowseViewMode } = await request.json();

	if (!VALID_MODES.includes(browseViewMode)) {
		return json({ error: `browseViewMode must be one of ${VALID_MODES.join(', ')}` }, { status: 400 });
	}

	setBrowseViewMode(userId, browseViewMode);

	return json({ browseViewMode });
};
