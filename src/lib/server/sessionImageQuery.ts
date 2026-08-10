import { db } from '$lib/server/db';
import { images, userImageStats, imageSubjects, imageSubjectFieldValues } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import {
	ROOT_DIRECTORY_KEY,
	type SessionFieldFilter,
	type SessionImage,
	type SessionImageFilter,
	type SessionSubjectFilter
} from '$lib/types';

/**
 * Parses and defensively normalizes a client-supplied filter payload,
 * discarding any malformed entries rather than throwing.
 */
export function normalizeSessionImageFilter(body: unknown): SessionImageFilter {
	const raw = (body ?? {}) as Partial<SessionImageFilter>;

	const directories = Array.isArray(raw.directories)
		? raw.directories.filter((d): d is string => typeof d === 'string')
		: [];

	const subjects = Array.isArray(raw.subjects)
		? raw.subjects
				.filter((s): s is SessionSubjectFilter => !!s && typeof s.subjectId === 'string')
				.map((s) => ({
					subjectId: s.subjectId,
					fields: Array.isArray(s.fields)
						? s.fields
								.filter(
									(f): f is SessionFieldFilter =>
										!!f && typeof f.fieldId === 'string' && Array.isArray(f.values)
								)
								.map((f) => ({
									fieldId: f.fieldId,
									values: f.values.filter((v): v is string => typeof v === 'string')
								}))
						: []
				}))
		: [];

	return { directories, likedOnly: raw.likedOnly === true, subjects };
}

function topLevelDirectory(filePath: string): string {
	const slashIndex = filePath.indexOf('/');
	return slashIndex === -1 ? ROOT_DIRECTORY_KEY : filePath.slice(0, slashIndex);
}

function intersect(a: Set<string> | null, b: Set<string>): Set<string> {
	if (a === null) return b;
	const result = new Set<string>();
	for (const id of a) {
		if (b.has(id)) result.add(id);
	}
	return result;
}

function matchingImageIdsForDirectories(directories: string[], allImages: SessionImage[]): Set<string> {
	const dirSet = new Set(directories);
	const matched = new Set<string>();
	for (const image of allImages) {
		if (dirSet.has(topLevelDirectory(image.filePath))) matched.add(image.id);
	}
	return matched;
}

function likedImageIds(userId: string): Set<string> {
	const rows = db
		.select({ imageId: userImageStats.imageId })
		.from(userImageStats)
		.where(and(eq(userImageStats.userId, userId), eq(userImageStats.liked, true)))
		.all();
	return new Set(rows.map((r) => r.imageId));
}

/**
 * Resolves the image IDs matching a single subject filter group. Within a
 * group, field constraints are AND'd together; within a field constraint,
 * selected values are OR'd.
 */
function matchingImageIdsForSubjectGroup(group: SessionSubjectFilter): Set<string> {
	const subjectRows = db
		.select({ imageId: imageSubjects.imageId, imageSubjectId: imageSubjects.id })
		.from(imageSubjects)
		.where(eq(imageSubjects.subjectId, group.subjectId))
		.all();

	if (group.fields.length === 0) {
		return new Set(subjectRows.map((r) => r.imageId));
	}

	const imageSubjectIds = subjectRows.map((r) => r.imageSubjectId);
	if (imageSubjectIds.length === 0) return new Set();

	const valueRows = db
		.select({
			imageSubjectId: imageSubjectFieldValues.imageSubjectId,
			subjectFieldId: imageSubjectFieldValues.subjectFieldId,
			value: imageSubjectFieldValues.value
		})
		.from(imageSubjectFieldValues)
		.where(inArray(imageSubjectFieldValues.imageSubjectId, imageSubjectIds))
		.all();

	const imageSubjectIdToImageId = new Map(subjectRows.map((r) => [r.imageSubjectId, r.imageId]));

	const matched = new Set<string>();
	for (const imageSubjectId of imageSubjectIds) {
		const satisfiesAllFields = group.fields.every((constraint) =>
			valueRows.some(
				(v) =>
					v.imageSubjectId === imageSubjectId &&
					v.subjectFieldId === constraint.fieldId &&
					constraint.values.includes(v.value ?? '')
			)
		);
		if (satisfiesAllFields) {
			const imageId = imageSubjectIdToImageId.get(imageSubjectId);
			if (imageId) matched.add(imageId);
		}
	}
	return matched;
}

function matchingImageIdsForSubjects(subjectFilters: SessionSubjectFilter[]): Set<string> {
	const matched = new Set<string>();
	for (const group of subjectFilters) {
		for (const id of matchingImageIdsForSubjectGroup(group)) matched.add(id);
	}
	return matched;
}

/**
 * Returns catalogued images matching the given filter for the given user.
 * Used by both the session-preview and session-start endpoints so match
 * semantics can never drift between the two.
 */
export function getFilteredSessionImages(filter: SessionImageFilter, userId: string): SessionImage[] {
	const allImages = db.select({ id: images.id, filePath: images.filePath }).from(images).all();

	let candidateIds: Set<string> | null = null;

	if (filter.directories.length > 0) {
		candidateIds = intersect(candidateIds, matchingImageIdsForDirectories(filter.directories, allImages));
	}

	if (filter.likedOnly) {
		candidateIds = intersect(candidateIds, likedImageIds(userId));
	}

	if (filter.subjects.length > 0) {
		candidateIds = intersect(candidateIds, matchingImageIdsForSubjects(filter.subjects));
	}

	if (candidateIds === null) return allImages;
	return allImages.filter((image) => candidateIds!.has(image.id));
}
