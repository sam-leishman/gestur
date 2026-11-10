<script lang="ts">
    import { onMount } from 'svelte';
    import { Plus, Trash2, Ban, KeyRound, CircleCheck } from 'lucide-svelte';
    import Modal from '$lib/components/Modal.svelte';
    import { authClient } from '$lib/auth-client';
    import { usernameToEmail } from '$lib/permissions';

    type UserRow = { id: string; name: string; role?: string | null; banned?: boolean | null };

    const session = authClient.useSession();

    let users: UserRow[] = $state([]);
    let error: string | undefined = $state(undefined);
    let createOpen = $state(false);
    let loading = $state(false);
    let form = $state({ username: '', password: '', role: 'user' });

    async function load() {
        const { data, error: e } = await authClient.admin.listUsers({ query: { sortBy: 'createdAt' } });
        if (e) error = e.message;
        else users = data.users as UserRow[];
    }

    async function run(action: Promise<{ error: { message?: string } | null }>) {
        const { error: e } = await action;
        error = e?.message;
        await load();
    }

    async function createUser() {
        loading = true;
        const { error: e } = await authClient.admin.createUser({
            email: usernameToEmail(form.username),
            name: form.username.trim(),
            password: form.password,
            role: form.role as 'user' | 'admin',
            data: { username: form.username.trim() }
        });
        loading = false;
        error = e?.message;
        if (e) return;
        createOpen = false;
        form = { username: '', password: '', role: 'user' };
        await load();
    }

    function resetPassword(u: UserRow) {
        const newPassword = prompt(`New password for ${u.name} (min 8 characters)`);
        if (newPassword) run(authClient.admin.setUserPassword({ userId: u.id, newPassword }));
    }

    function remove(u: UserRow) {
        if (confirm(`Delete user ${u.name}? This cannot be undone.`)) run(authClient.admin.removeUser({ userId: u.id }));
    }

    onMount(load);
</script>

<div class="p-4 max-w-3xl mx-auto flex flex-col gap-4">
    <div class="flex items-center">
        <h1 class="text-2xl font-bold">Users</h1>
        <div class="flex-1"></div>
        <button class="btn btn-primary flex items-center gap-2" onclick={() => (createOpen = true)}>
            <Plus class="w-4 h-4" /> Add user
        </button>
    </div>

    {#if error}<p class="text-red-500">{error}</p>{/if}

    <div class="border border-muted rounded-lg bg-canvas divide-y divide-muted">
        {#each users as u (u.id)}
            {@const self = u.id === $session.data?.user.id}
            <div class="flex items-center gap-3 p-3">
                <div class="flex-1">
                    <p class="font-medium">{u.name}{self ? ' (you)' : ''}</p>
                    {#if u.banned}<p class="text-sm text-red-500">Banned</p>{/if}
                </div>
                <select
                    class="rounded-lg border-muted"
                    value={u.role ?? 'user'}
                    onchange={(e) => run(authClient.admin.setRole({ userId: u.id, role: e.currentTarget.value as 'user' | 'admin' }))}
                >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                </select>
                <button title="Reset password" class="p-2 text-warm-gray hover:text-ink" onclick={() => resetPassword(u)}>
                    <KeyRound class="w-4 h-4" />
                </button>
                {#if !self}
                    <button
                        title={u.banned ? 'Unban' : 'Ban'}
                        class="p-2 text-warm-gray hover:text-ink"
                        onclick={() => run(u.banned ? authClient.admin.unbanUser({ userId: u.id }) : authClient.admin.banUser({ userId: u.id }))}
                    >
                        {#if u.banned}<CircleCheck class="w-4 h-4" />{:else}<Ban class="w-4 h-4" />{/if}
                    </button>
                    <button title="Delete" class="p-2 text-red-500 hover:text-red-700" onclick={() => remove(u)}>
                        <Trash2 class="w-4 h-4" />
                    </button>
                {/if}
            </div>
        {/each}
    </div>
</div>

<Modal bind:open={createOpen} title="Add user">
    <form onsubmit={(e) => { e.preventDefault(); createUser(); }} class="flex flex-col gap-4">
        <input type="text" bind:value={form.username} placeholder="Username" required class="w-full rounded-lg border-muted" />
        <input type="password" bind:value={form.password} placeholder="Password (min 8 characters)" required minlength="8" class="w-full rounded-lg border-muted" />
        <select bind:value={form.role} class="w-full rounded-lg border-muted">
            <option value="user">User</option>
            <option value="admin">Admin</option>
        </select>
        <button type="submit" disabled={loading} class="btn btn-primary">{loading ? 'Creating...' : 'Create user'}</button>
    </form>
</Modal>
