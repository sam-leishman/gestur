export type SessionImage = { id: string; filePath: string };

/**
 * A session image as shown in session history/results. `id` is `null` when
 * the catalogue entry has since been deleted — `filePath`/`title` are a
 * snapshot taken when the session was recorded, so the entry still renders
 * (and is still counted) instead of silently vanishing. `SessionImage` is
 * structurally assignable to this, so components that render both a
 * just-finished (always-live) session and historical ones can share a
 * single prop type.
 */
export type DisplayableSessionImage = {
	id: string | null;
	filePath: string;
	title?: string;
};

// ── Session image filtering ─────────────────────────────────────────────────
// Top-level "directory" key used for catalogued images that live directly in
// the images root (i.e. their file path has no directory segment).
export const ROOT_DIRECTORY_KEY = '__root__';

export type SessionFieldFilter = {
	fieldId: string;
	values: string[];
};

export type SessionSubjectFilter = {
	subjectId: string;
	fields: SessionFieldFilter[];
};

export type SessionImageFilter = {
	directories: string[];
	likedOnly: boolean;
	subjects: SessionSubjectFilter[];
	tagIds: string[];
};

export function createEmptySessionImageFilter(): SessionImageFilter {
	return { directories: [], likedOnly: false, subjects: [], tagIds: [] };
}

export function isSessionImageFilterEmpty(filter: SessionImageFilter): boolean {
	return (
		filter.directories.length === 0 &&
		!filter.likedOnly &&
		filter.subjects.length === 0 &&
		filter.tagIds.length === 0
	);
}

export type SessionDirectoryOption = { key: string; label: string; count: number };

export type Subject = { id: string; name: string };

export type Tag = { id: string; name: string };

export type SubjectFieldType = 'text' | 'number' | 'boolean' | 'select';

export type SubjectField = {
	id: string;
	subjectId: string;
	name: string;
	type: SubjectFieldType;
	options: string[] | null;
	required: boolean;
	sortOrder: number;
};

export type SessionStatus = 'completed' | 'stopped';

export type SessionSummary = {
	id: string;
	startedAt: string;
	completedAt: string;
	status: SessionStatus;
	targetCount: number;
	durationSeconds: number;
	drawnCount: number;
	skippedCount: number;
};

export type SessionHistoryImage = DisplayableSessionImage & {
	title: string;
	liked: boolean;
};

export type SessionDetail = SessionSummary & {
	drawnImages: SessionHistoryImage[];
	skippedImages: SessionHistoryImage[];
};

// ── Missing-file management ──────────────────────────────────────────────
export type MissingImage = {
	id: string;
	filePath: string;
	title: string;
	subjectCount: number;
	drawCount: number;
	skipCount: number;
	liked: boolean;
};
