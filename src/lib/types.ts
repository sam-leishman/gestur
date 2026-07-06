export type SessionImage = { id: string; filePath: string };

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
