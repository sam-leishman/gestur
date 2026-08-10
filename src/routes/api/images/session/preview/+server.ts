import { json } from '@sveltejs/kit';
import { getFilteredSessionImages, normalizeSessionImageFilter } from '$lib/server/sessionImageQuery';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, locals }) => {
    const userId = locals.user!.id;
    const filter = normalizeSessionImageFilter(await request.json());
    const matchCount = getFilteredSessionImages(filter, userId).length;
    return json({ matchCount });
};
