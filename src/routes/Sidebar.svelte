<script lang="ts">
	import { page } from "$app/state";
	import { User, House, Image } from "lucide-svelte";

    let { isOpen = $bindable(true) } = $props();

    const isActive = (path: string) => {
		return page.url.pathname === path || page.url.pathname.startsWith(path + '/');
	};

    const navItems = $derived([
        {
            label: 'Home',
            icon: House,
            href: '/',
            isActive: isActive('/')
        },
        {
            label: 'Browse',
            icon: Image,
            href: '/browse',
            isActive: isActive('/browse')
        },
        {
            label: 'Profile',
            icon: User,
            href: '/profile',
            isActive: isActive('/profile')
        }
    ]);
</script>

<!-- Mobile overlay -->
{#if isOpen}
	<div
		onclick={() => isOpen = false}
		class="fixed inset-0 bg-black/50 z-10 lg:hidden"
		aria-hidden="true"
	></div>
{/if}

<aside
    class="
        fixed left-0 bottom-0 w-25 h-full top-(--header-height) z-40 bg-canvas border-r border-muted
        transition-transform duration-300 lg:translate-x-0 {isOpen ? 'translate-x-0' : '-translate-x-full'}
    "
>
    <nav class="flex flex-col h-full py-4">
        {#each navItems as item}
            <a
                href={item.href}
                class="
                    flex flex-col items-center justify-center gap-1 py-4 px-2 transition-colors
                    {item.isActive 
                        ? 'text-terracotta bg-terracotta-tint border-l-4 border-terracotta' 
                        : 'text-warm-gray hover:text-ink hover:bg-pressed'}
                "
            >
                <item.icon class="w-6 h-6" />
                {item.label}
            </a>
        {/each}
    </nav>
</aside>