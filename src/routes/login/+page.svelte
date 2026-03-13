<script lang="ts">
	import { goto } from "$app/navigation";
    import { authClient } from "$lib/auth-client";

    let loading = $state(false);
    let error: string | undefined = $state(undefined);

    let formData = $state({
        username: '',
        password: ''
    });
    
    async function handleLogin() {
        loading = true;
        error = undefined;

        const { data, error: signInError } = await authClient.signIn.username({
            username: formData.username,
            password: formData.password
        });
        
        if (signInError) {
            error = signInError.message || 'Login failed';
            loading = false;
            return;
        }
        
        goto('/');
        loading = false;
    }
</script>

<div class="flex items-center justify-center min-h-screen p-4">
    <form
        onsubmit={e => {e.preventDefault(); handleLogin()}}
        class="flex flex-col gap-4 border-muted border p-4 rounded-lg bg-canvas shadow-lg w-100"
    >
        <div class="text-center">
            <h1 class="text-3xl font-bold">
                Welcome to <span class="text-terracotta">Gestur</span>
            </h1>
            <h2 class="text-lg text-warm-gray">Sign in to your account</h2>
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
            placeholder="Password"
            required
            class="w-full rounded-lg border-muted"
        />
        <button
            type="submit"
            disabled={loading}
            class="btn btn-primary"
        >
            {loading ? 'Logging in...' : 'Login'}
        </button>
        {#if error}
            <p class="text-center text-red-500">{error}</p>
        {/if}
        <p class="text-center">
            Don't have an account? <a href="/register" class="text-terracotta hover:underline">Register</a>
        </p>
    </form>
</div>
