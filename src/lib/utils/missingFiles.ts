import type { MissingImage } from '$lib/types';

export type UncataloguedMatch = { name: string };

/** Catalogued images whose file can't be found on disk. */
export async function fetchMissingImages(): Promise<MissingImage[]> {
    const res = await fetch('/api/images/missing');
    if (!res.ok) return [];
    const data: { images: MissingImage[] } = await res.json();
    return data.images;
}

/** Uncatalogued files anywhere in the library matching `term`, for relink pickers. */
export async function searchUncataloguedFiles(term: string): Promise<UncataloguedMatch[]> {
    const params = new URLSearchParams({ path: '', filter: 'uncatalogued', search: term });
    const res = await fetch(`/api/browse?${params}`);
    if (!res.ok) return [];
    const data: { items: UncataloguedMatch[] } = await res.json();
    return data.items;
}

export async function relinkImage(id: string, filePath: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const res = await fetch(`/api/images/${id}/relink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error ?? 'Failed to relink' };
}

export async function removeMissingImage(id: string): Promise<boolean> {
    const res = await fetch(`/api/images/${id}`, { method: 'DELETE' });
    return res.ok;
}

/** Removes multiple catalogue entries at once, by file path. */
export async function bulkRemoveMissingImages(filePaths: string[]): Promise<boolean> {
    const res = await fetch('/api/images/bulk-uncatalogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePaths })
    });
    return res.ok;
}
