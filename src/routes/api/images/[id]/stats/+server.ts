import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userImageStats } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from '@sveltejs/kit';

const CLEARABLE_FIELDS = ['drawCount', 'skipCount'] as const;
type ClearableField = typeof CLEARABLE_FIELDS[number];

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
    const imageId = params.id!;
    const userId = locals.user!.id;
    const { field }: { field: ClearableField } = await request.json();

    if (!CLEARABLE_FIELDS.includes(field)) {
        return json({ error: 'Invalid field' }, { status: 400 });
    }

    db.update(userImageStats)
        .set({ [field]: 0 })
        .where(and(eq(userImageStats.imageId, imageId), eq(userImageStats.userId, userId)))
        .run();

    return json({ ok: true });
};
