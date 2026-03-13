<script lang="ts">
	import { goto } from "$app/navigation";
    import { authClient } from "$lib/auth-client";
    
    const session = authClient.useSession();

    async function handleSignOut() {
        await authClient.signOut();
        goto('/login');
    }
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>
{#if $session.data}
    <p>Logged in as {$session.data.user.name}</p>
    <button onclick={handleSignOut} class="btn btn-primary">Sign out</button>
{/if}
