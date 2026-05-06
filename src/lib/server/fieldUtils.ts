import { json } from '@sveltejs/kit';

const VALID_TYPES = ['text', 'number', 'boolean', 'select'] as const;

export function validateFieldBody(body: { name?: string; type?: string }): Response | null {
	if (!body.name?.trim()) return json({ error: 'Name is required' }, { status: 400 });
	if (!body.type) return json({ error: 'Type is required' }, { status: 400 });
	if (!(VALID_TYPES as readonly string[]).includes(body.type)) return json({ error: 'Invalid type' }, { status: 400 });
	return null;
}

export function resolveFieldOptions(type: string, options?: string[] | null): string[] | null {
	return type === 'select' ? (options ?? []) : null;
}
