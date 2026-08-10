import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { images } from '$lib/server/db/schema';
import { ROOT_DIRECTORY_KEY, type SessionDirectoryOption } from '$lib/types';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = () => {
    const rows = db.select({ filePath: images.filePath }).from(images).all();

    const counts = new Map<string, number>();
    for (const { filePath } of rows) {
        const slashIndex = filePath.indexOf('/');
        const key = slashIndex === -1 ? ROOT_DIRECTORY_KEY : filePath.slice(0, slashIndex);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const directories: SessionDirectoryOption[] = Array.from(counts.entries())
        .map(([key, count]) => ({ key, label: key === ROOT_DIRECTORY_KEY ? '(Root)' : key, count }))
        .sort((a, b) => a.label.localeCompare(b.label));

    return json({ directories });
};
