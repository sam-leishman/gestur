export type ThumbnailCleanupResult = { removed: number; bytes: number };

/** Sweeps the thumbnail cache for orphaned entries (images deleted/moved/renamed on disk). */
export async function cleanupThumbnailCache(): Promise<{ ok: true; result: ThumbnailCleanupResult } | { ok: false; error: string }> {
    const res = await fetch('/api/thumbnails/cleanup', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? 'Failed to clean up thumbnail cache' };
    return { ok: true, result: data as ThumbnailCleanupResult };
}
