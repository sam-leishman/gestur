export type SessionImage = { id: string; filePath: string };

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
};

export function createEmptySessionImageFilter(): SessionImageFilter {
	return { directories: [], likedOnly: false, subjects: [] };
}

export function isSessionImageFilterEmpty(filter: SessionImageFilter): boolean {
	return filter.directories.length === 0 && !filter.likedOnly && filter.subjects.length === 0;
}

export type SessionDirectoryOption = { key: string; label: string; count: number };

export type Subject = { id: string; name: string };

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

export type SessionDetail = SessionSummary & {
	drawnImages: (SessionImage & { liked: boolean })[];
	skippedImages: (SessionImage & { liked: boolean })[];
};
