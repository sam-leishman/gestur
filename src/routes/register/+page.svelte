<script lang="ts">
	import { goto } from "$app/navigation";
    import { authClient } from "$lib/auth-client";

    let loading = $state(false);
    let error: string | undefined = $state(undefined);

    let formData = $state({
        username: '',
        password: '',
        confirmPassword: ''
    });
    
    async function handleRegister() {
        loading = true;
        error = undefined;
        
        if (formData.password !== formData.confirmPassword) {
            error = 'Passwords do not match';
            loading = false;
            return;
        }

        const { data, error: signUpError } = await authClient.signUp.email({
            email: `${formData.username}@gestur.app`,
            name: formData.username,
            password: formData.password,
            username: formData.username
        });

        if (signUpError) {
            error = signUpError.message || 'Registration failed';
            loading = false;
            return;
        }

        goto('/');
        loading = false;
    }
</script>

<div class="flex items-center justify-center min-h-screen p-4">
    <form
        onsubmit={e => {e.preventDefault(); handleRegister()}}
        class="flex flex-col gap-4 border-muted border p-4 rounded-lg bg-canvas shadow-lg w-100"
    >
        <div class="text-center">
            <h1 class="text-3xl font-bold">
                Welcome to <span class="text-terracotta">Gestur</span>
            </h1>
            <h2 class="text-lg text-warm-gray">Create an account</h2>
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
        <input
            type="password"
            bind:value={formData.confirmPassword}
            placeholder="Confirm Password"
            required
            class="w-full rounded-lg border-muted"
        />
        <button
            type="submit"
            disabled={loading}
            class="btn btn-primary"
        >
            {loading ? 'Creating account...' : 'Create account'}
        </button>
        {#if error}
            <p class="text-center text-red-500">{error}</p>
        {/if}
        <p class="text-center">
            Already have an account? <a href="/login" class="text-terracotta hover:underline">Login</a>
        </p>
    </form>
</div>
