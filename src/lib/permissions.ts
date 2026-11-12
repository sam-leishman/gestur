import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements, adminAc } from 'better-auth/plugins/admin/access';

export const statement = {
	...defaultStatements,
	catalogue: ['browse', 'manage'],
	subject: ['create', 'update', 'delete'],
	tag: ['create', 'update', 'delete'],
	data: ['view']
} as const;

export const ac = createAccessControl(statement);

export const admin = ac.newRole({
	...adminAc.statements,
	catalogue: ['browse', 'manage'],
	subject: ['create', 'update', 'delete'],
	tag: ['create', 'update', 'delete'],
	data: ['view']
});

export const user = ac.newRole({});

export const roles = { admin, user };

export type Permissions = { [R in keyof typeof statement]?: (typeof statement)[R][number][] };

export const hasPermission = (role: string | null | undefined, permissions: Permissions) =>
	role === 'admin' || role === 'user' ? roles[role].authorize(permissions as never).success : false;

export const usernameToEmail = (username: string) => `${username.trim().toLowerCase()}@gestur.app`;

export const SETUP_ROUTE = '/setup';
export const SETUP_API_ROUTE = '/api/setup';
export const LOGIN_ROUTE = '/login';
export const PUBLIC_ROUTES = [LOGIN_ROUTE, SETUP_ROUTE];

const inPath = (pathname: string, base: string) => pathname === base || pathname.startsWith(base + '/');

export const PAGE_PERMISSIONS: { base: string; permissions: Permissions }[] = [
	{ base: '/browse', permissions: { catalogue: ['browse'] } },
	{ base: '/data', permissions: { data: ['view'] } },
	{ base: '/admin', permissions: { user: ['list'] } }
];

const ALL = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const SUBJECT_ACTIONS: Record<string, 'create' | 'update' | 'delete'> = {
	POST: 'create',
	PUT: 'update',
	PATCH: 'update',
	DELETE: 'delete'
};
const TAG_ACTIONS = SUBJECT_ACTIONS;

// API routes that mutate global (non per-user) data or expose the filesystem.
const API_PERMISSIONS: { pattern: RegExp; methods: string[]; permissions: (method: string) => Permissions }[] = [
	{ pattern: /^\/api\/browse$/, methods: ALL, permissions: () => ({ catalogue: ['browse'] }) },
	{ pattern: /^\/api\/images$/, methods: ['POST'], permissions: () => ({ catalogue: ['manage'] }) },
	{ pattern: /^\/api\/images\/missing$/, methods: ALL, permissions: () => ({ catalogue: ['manage'] }) },
	{ pattern: /^\/api\/images\/bulk-[^/]+$/, methods: ALL, permissions: () => ({ catalogue: ['manage'] }) },
	{ pattern: /^\/api\/images\/[^/]+$/, methods: ['PUT', 'DELETE'], permissions: () => ({ catalogue: ['manage'] }) },
	{ pattern: /^\/api\/images\/[^/]+\/relink$/, methods: ALL, permissions: () => ({ catalogue: ['manage'] }) },
	{ pattern: /^\/api\/images\/[^/]+\/subjects(\/.*)?$/, methods: ALL, permissions: () => ({ catalogue: ['manage'] }) },
	{ pattern: /^\/api\/images\/[^/]+\/tags(\/.*)?$/, methods: ALL, permissions: () => ({ catalogue: ['manage'] }) },
	{
		pattern: /^\/api\/subjects(\/.*)?$/,
		methods: Object.keys(SUBJECT_ACTIONS),
		permissions: (method) => ({ subject: [SUBJECT_ACTIONS[method]] })
	},
	{
		pattern: /^\/api\/tags(\/.*)?$/,
		methods: Object.keys(TAG_ACTIONS),
		permissions: (method) => ({ tag: [TAG_ACTIONS[method]] })
	}
];

export const requiredApiPermissions = (pathname: string, method: string): Permissions | undefined =>
	API_PERMISSIONS.find((r) => r.pattern.test(pathname) && r.methods.includes(method))?.permissions(method);

export const requiredPagePermissions = (pathname: string): Permissions | undefined =>
	PAGE_PERMISSIONS.find((p) => inPath(pathname, p.base))?.permissions;
