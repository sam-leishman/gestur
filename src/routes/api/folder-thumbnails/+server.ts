import { json } from '@sveltejs/kit';
import { existsSync, statSync } from 'fs';
import { join, resolve, relative, isAbsolute } from 'path';
import { config } from '$lib/server/config';
import { db } from '$lib/server/db';
import { folderThumbnails } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { isImageFile } from '$lib/utils/images';
import type { RequestHandler } from '@sveltejs/kit';

const MAX_THUMBNAILS = 4;

function resolveWithinImages(relPath: string): string | null {
	const imagesRoot = resolve(config.paths.images);
	const target = resolve(join(imagesRoot, relPath));
	const rel = relative(imagesRoot, target);
	if (rel.startsWith('..') || isAbsolute(rel)) return null;
	return target;
}

export const PUT: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { folderPath, imagePaths } = body as { folderPath: string; imagePaths: string[] };

	if (typeof folderPath !== 'string' || !folderPath) {
		return json({ error: 'folderPath is required' }, { status: 400 });
	}
	if (!Array.isArray(imagePaths) || imagePaths.length === 0 || imagePaths.length > MAX_THUMBNAILS) {
		return json({ error: `imagePaths must contain between 1 and ${MAX_THUMBNAILS} paths` }, { status: 400 });
	}

	const folderAbsPath = resolveWithinImages(folderPath);
	if (!folderAbsPath || !existsSync(folderAbsPath) || !statSync(folderAbsPath).isDirectory()) {
		return json({ error: 'Invalid folder path' }, { status: 400 });
	}

	for (const imagePath of imagePaths) {
		const imageAbsPath = resolveWithinImages(imagePath);
		if (!imageAbsPath || !existsSync(imageAbsPath) || !statSync(imageAbsPath).isFile() || !isImageFile(imagePath)) {
			return json({ error: `Invalid image path: ${imagePath}` }, { status: 400 });
		}
		const relToFolder = relative(folderAbsPath, imageAbsPath);
		if (!relToFolder || relToFolder.startsWith('..') || isAbsolute(relToFolder)) {
			return json({ error: `Image is not inside the folder: ${imagePath}` }, { status: 400 });
		}
	}

	db.insert(folderThumbnails)
		.values({ folderPath, imagePaths })
		.onConflictDoUpdate({ target: folderThumbnails.folderPath, set: { imagePaths } })
		.run();

	return json({ folderPath, imagePaths });
};

export const DELETE: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { folderPath } = body as { folderPath: string };

	if (typeof folderPath !== 'string' || !folderPath) {
		return json({ error: 'folderPath is required' }, { status: 400 });
	}

	db.delete(folderThumbnails).where(eq(folderThumbnails.folderPath, folderPath)).run();

	return json({ folderPath });
};
