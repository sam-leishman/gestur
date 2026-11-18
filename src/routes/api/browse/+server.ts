import { json } from '@sveltejs/kit';
import { existsSync, readdirSync } from 'fs';
import { join, resolve, relative, isAbsolute } from 'path';
import { config } from '$lib/server/config';
import { db } from '$lib/server/db';
import { images, userImageStats, folderThumbnails } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { isImageFile } from '$lib/utils/images';
import type { RequestHandler } from '@sveltejs/kit';

// How many preview thumbnails are shown on a folder's grid card.
const FOLDER_THUMBNAIL_COUNT = 4;

export const GET: RequestHandler = ({ url, locals }) => {
	const pathParam = url.searchParams.get('path') || '';
	const filter = url.searchParams.get('filter') || 'all';
	const search = url.searchParams.get('search') || '';

	const imagesRoot = resolve(config.paths.images);
	const targetPath = resolve(join(imagesRoot, pathParam));

	// Prevent directory traversal
	const rel = relative(imagesRoot, targetPath);
	if (rel.startsWith('..') || isAbsolute(rel)) {
		return json({ error: 'Invalid path' }, { status: 400 });
	}

	// Load all catalogued file paths from DB into a Set for O(1) lookup
	const cataloguedRows = db.select({ filePath: images.filePath, id: images.id }).from(images).all();
	const cataloguedPaths = new Set<string>(cataloguedRows.map((r) => r.filePath));

	// Load liked file paths for the current user
	const likedPaths = new Set<string>();
	if (locals.user?.id) {
		const imageIdToPath = new Map(cataloguedRows.map((r) => [r.id, r.filePath]));
		const likedRows = db
			.select({ imageId: userImageStats.imageId })
			.from(userImageStats)
			.where(and(eq(userImageStats.userId, locals.user.id), eq(userImageStats.liked, true)))
			.all();
		for (const row of likedRows) {
			const path = row.imageId !== null ? imageIdToPath.get(row.imageId) : undefined;
			if (path) likedPaths.add(path);
		}
	}

	const pathToId = new Map(cataloguedRows.map((r) => [r.filePath, r.id]));

	// Search mode: flatten the entire subtree and filter by name
	if (search) {
		const allRelFiles = getAllRelativeFiles(targetPath, imagesRoot);
		const searchLower = search.toLowerCase();
		const files: Array<{ name: string; type: 'file'; catalogued: boolean; liked: boolean; imageId?: string }> = allRelFiles
			.reduce<Array<{ name: string; type: 'file'; catalogued: boolean; liked: boolean; imageId?: string }>>((acc, relPath) => {
				const name = relPath.split('/').pop()!;
				if (!name.toLowerCase().includes(searchLower)) return acc;
				const catalogued = cataloguedPaths.has(relPath);
				if (filter === 'catalogued' && !catalogued) return acc;
				if (filter === 'uncatalogued' && catalogued) return acc;
				acc.push({ name: relPath, type: 'file', catalogued, liked: likedPaths.has(relPath), imageId: pathToId.get(relPath) });
				return acc;
			}, [])
			.sort((a, b) => a.name.localeCompare(b.name));

		return json({ items: files });
	}

	// Browse mode: list only the current directory.
	// Walk the subtree once to build a set of matching relative paths, then use
	// it to filter both files and directories without redundant recursive scans.
	let entries;
	try {
		entries = readdirSync(targetPath, { withFileTypes: true });
	} catch {
		return json({ items: [] });
	}

	const matchingRelPaths = buildMatchingSet(targetPath, imagesRoot, filter, cataloguedPaths);
	const matchingSet = new Set(matchingRelPaths);

	const dirNames: string[] = [];
	const files: Array<{ name: string; type: 'file'; catalogued: boolean; liked: boolean; imageId?: string }> = [];

	for (const entry of entries) {
		const { name } = entry;

		if (entry.isDirectory()) {
			const dirRelPrefix = relative(imagesRoot, join(targetPath, name)) + '/';
			if (!matchingRelPaths.some((p) => p.startsWith(dirRelPrefix))) continue;
			dirNames.push(name);
		} else if (entry.isFile() && isImageFile(name)) {
			const relPath = relative(imagesRoot, join(targetPath, name));
			if (!matchingSet.has(relPath)) continue;
			const catalogued = cataloguedPaths.has(relPath);
			files.push({ name, type: 'file', catalogued, liked: likedPaths.has(relPath), imageId: pathToId.get(relPath) });
		}
	}

	dirNames.sort((a, b) => a.localeCompare(b));
	files.sort((a, b) => a.name.localeCompare(b.name));

	const folders = dirNames.map((name) => ({
		name,
		type: 'dir' as const,
		thumbnails: getFolderThumbnails(join(targetPath, name), imagesRoot)
	}));

	return json({ items: [...folders, ...files] });
};

/**
 * Preview images shown on a folder's grid card: an admin-chosen override if one has been saved
 * for this folder, otherwise the first images found in its subtree (direct children first, then
 * subfolders, both in alphabetical order). The scan stops as soon as enough images are found
 * rather than walking the whole subtree, since folders can be large.
 */
function getFolderThumbnails(dirPath: string, imagesRoot: string): string[] {
	const folderRelPath = relative(imagesRoot, dirPath);
	const override = db
		.select({ imagePaths: folderThumbnails.imagePaths })
		.from(folderThumbnails)
		.where(eq(folderThumbnails.folderPath, folderRelPath))
		.get();

	if (override) {
		const valid = override.imagePaths.filter(
			(relPath) => isImageFile(relPath) && existsSync(join(imagesRoot, relPath))
		);
		if (valid.length > 0) return valid.slice(0, FOLDER_THUMBNAIL_COUNT);
	}

	return collectFirstImageFiles(dirPath, imagesRoot, FOLDER_THUMBNAIL_COUNT);
}

function collectFirstImageFiles(dirPath: string, imagesRoot: string, limit: number): string[] {
	const result: string[] = [];

	function walk(dir: string): void {
		if (result.length >= limit) return;
		let entries;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		entries.sort((a, b) => a.name.localeCompare(b.name));

		for (const entry of entries) {
			if (result.length >= limit) return;
			if (entry.isFile() && isImageFile(entry.name)) {
				result.push(relative(imagesRoot, join(dir, entry.name)));
			}
		}
		for (const entry of entries) {
			if (result.length >= limit) return;
			if (entry.isDirectory()) walk(join(dir, entry.name));
		}
	}

	walk(dirPath);
	return result;
}

function getAllRelativeFiles(dirPath: string, imagesRoot: string): string[] {
	const result: string[] = [];
	try {
		const entries = readdirSync(dirPath, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = join(dirPath, entry.name);
			if (entry.isDirectory()) {
				result.push(...getAllRelativeFiles(fullPath, imagesRoot));
			} else if (entry.isFile() && isImageFile(entry.name)) {
				result.push(relative(imagesRoot, fullPath));
			}
		}
	} catch {
		// ignore inaccessible directories
	}
	return result;
}

function buildMatchingSet(
	dirPath: string,
	imagesRoot: string,
	filter: string,
	cataloguedPaths: Set<string>
): Array<string> {
	return getAllRelativeFiles(dirPath, imagesRoot).filter((relPath) => {
		const catalogued = cataloguedPaths.has(relPath);
		if (filter === 'catalogued') return catalogued;
		if (filter === 'uncatalogued') return !catalogued;
		return true;
	});
}
