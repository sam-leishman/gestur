<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { goto } from "$app/navigation";
    import { authClient } from "$lib/auth-client";
	import Sidebar from './Sidebar.svelte';
	import { Menu, User, LogOut } from 'lucide-svelte';

	let { children } = $props();
    
    const session = authClient.useSession();

	let sidebarOpen = $state(true);
	let userDropdownOpen = $state(false);

    async function handleSignOut() {
        await authClient.signOut();
        goto('/login');
    }
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if !$session.data}
	<!-- Public pages - no header, no sidebar -->
	{@render children()}
{:else if $session.data}
	<div>
		<header class="fixed top-0 left-0 right-0 z-50 min-h-(--header-height) max-h-(--header-height) px-4 py-2 flex items-center bg-canvas border-b border-muted shadow-sm">
			<button
				type="button"
				onclick={() => sidebarOpen = !sidebarOpen}
				class="lg:hidden p-2 mr-2 text-warm-gray hover:text-ink hover:bg-pressed rounded-lg transition-colors"
				aria-label="Toggle sidebar"
			>
				<Menu class="w-6 h-6" />
			</button>
			<h1 class="text-3xl font-bold text-terracotta">Gestur</h1>
			<div class="flex-1"></div>
			{#if $session.data}
				<div class="relative">
					<button
						onclick={() => userDropdownOpen = !userDropdownOpen}
						class="flex items-center gap-2 btn btn-terracotta-tint rounded-lg"
					>
						<User />
						<p>{$session.data.user.name}</p>
					</button>
					{#if userDropdownOpen}
						<div
							class="fixed inset-0 z-40"
							onclick={() => userDropdownOpen = false}
							aria-hidden="true"
						></div>
						<div class="absolute right-0 z-50 mt-2 w-48 bg-canvas border border-muted rounded-lg overflow-hidden shadow-lg">
							<button
								onclick={handleSignOut}
								class="w-full flex items-center gap-2 px-4 py-2 text-warm-gray hover:text-ink hover:bg-pressed"
							>
								<LogOut class="w-4 h-4" />
								Sign out
							</button>
						</div>
					{/if}
				</div>
			{/if}
		</header>

		<Sidebar bind:isOpen={sidebarOpen} />

		<main class="pt-(--header-height) lg:pl-25">
			{@render children()}
		</main>
	</div>
{/if}
