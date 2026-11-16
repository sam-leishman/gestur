import { json } from '@sveltejs/kit';
import { runThumbnailCleanup } from '$lib/server/thumbnailCleanup';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = () => {
    const result = runThumbnailCleanup();
    if (!result) return json({ error: 'A cleanup is already in progress' }, { status: 409 });
    return json(result);
};
