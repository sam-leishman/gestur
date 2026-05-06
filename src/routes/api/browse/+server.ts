import { json } from '@sveltejs/kit';
import { readdirSync } from 'fs';
import { join, resolve, relative, isAbsolute } from 'path';
import { config } from '$lib/server/config';
import { db } from '$lib/server/db';
import { images } from '$lib/server/db/schema';
import { isImageFile } from '$lib/utils/images';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = ({ url }) => {
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
	const cataloguedRows = db.select({ filePath: images.filePath }).from(images).all();
	const cataloguedPaths = new Set<string>(cataloguedRows.map((r) => r.filePath));

	// Search mode: flatten the entire subtree and filter by name
	if (search) {
		const allRelFiles = getAllRelativeFiles(targetPath, imagesRoot);
		const searchLower = search.toLowerCase();

		const files: Array<{ name: string; type: 'file'; catalogued: boolean }> = allRelFiles
			.reduce<Array<{ name: string; type: 'file'; catalogued: boolean }>>((acc, relPath) => {
				const name = relPath.split('/').pop()!;
				if (!name.toLowerCase().includes(searchLower)) return acc;
				const catalogued = cataloguedPaths.has(relPath);
				if (filter === 'catalogued' && !catalogued) return acc;
				if (filter === 'uncatalogued' && catalogued) return acc;
				acc.push({ name: relPath, type: 'file', catalogued });
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

	const folders: Array<{ name: string; type: 'dir' }> = [];
	const files: Array<{ name: string; type: 'file'; catalogued: boolean }> = [];

	for (const entry of entries) {
		const { name } = entry;

		if (entry.isDirectory()) {
			const dirRelPrefix = relative(imagesRoot, join(targetPath, name)) + '/';
			if (!matchingRelPaths.some((p) => p.startsWith(dirRelPrefix))) continue;
			folders.push({ name, type: 'dir' });
		} else if (entry.isFile() && isImageFile(name)) {
			const relPath = relative(imagesRoot, join(targetPath, name));
			if (!matchingSet.has(relPath)) continue;
			const catalogued = cataloguedPaths.has(relPath);
			files.push({ name, type: 'file', catalogued });
		}
	}

	folders.sort((a, b) => a.name.localeCompare(b.name));
	files.sort((a, b) => a.name.localeCompare(b.name));

	return json({ items: [...folders, ...files] });
};

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
