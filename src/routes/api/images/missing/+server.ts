import { json } from '@sveltejs/kit';
import { getMissingImages } from '$lib/server/imageUtils';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = ({ locals }) => {
    return json({ images: getMissingImages(locals.user?.id) });
};
