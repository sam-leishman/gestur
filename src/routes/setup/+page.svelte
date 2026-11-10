<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";

    let loading = $state(false);
    let error: string | undefined = $state(undefined);
    let requiresToken = $state(false);

    let formData = $state({
        username: '',
        password: '',
        confirmPassword: '',
        token: ''
    });

    onMount(async () => {
        const res = await fetch('/api/setup');
        ({ requiresToken } = await res.json());
    });

    async function handleSetup() {
        loading = true;
        error = undefined;

        if (formData.password !== formData.confirmPassword) {
            error = 'Passwords do not match';
            loading = false;
            return;
        }

        const res = await fetch('/api/setup', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (!res.ok) {
            const body = await res.json();
            error = body.error || 'Setup failed';
            loading = false;
            return;
        }

        goto('/');
        loading = false;
    }
</script>

<div class="flex items-center justify-center min-h-screen p-4">
    <form
        onsubmit={e => {e.preventDefault(); handleSetup()}}
        class="flex flex-col gap-4 border-muted border p-4 rounded-lg bg-canvas shadow-lg w-100"
    >
        <div class="text-center">
            <h1 class="text-3xl font-bold">
                Welcome to <span class="text-terracotta">Gestur</span>
            </h1>
            <h2 class="text-lg text-warm-gray">Create the admin account</h2>
        </div>
        <input
            type="text"
            bind:value={formData.username}
            placeholder="Username"
            required
            class="w-full rounded-lg border-muted"
        />
        <input
            type="password"
            bind:value={formData.password}
            placeholder="Password (min 8 characters)"
            required
            minlength="8"
            class="w-full rounded-lg border-muted"
        />
        <input
            type="password"
            bind:value={formData.confirmPassword}
            placeholder="Confirm Password"
            required
            class="w-full rounded-lg border-muted"
        />
        {#if requiresToken}
            <input
                type="password"
                bind:value={formData.token}
                placeholder="Setup token"
                required
                class="w-full rounded-lg border-muted"
            />
        {/if}
        <button
            type="submit"
            disabled={loading}
            class="btn btn-primary"
        >
            {loading ? 'Creating account...' : 'Create admin account'}
        </button>
        {#if error}
            <p class="text-center text-red-500">{error}</p>
        {/if}
    </form>
</div>
