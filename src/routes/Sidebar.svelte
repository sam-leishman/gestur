<script lang="ts">
	import { page } from "$app/state";
	import { PencilLine, Image, Database, ChartNoAxesColumn, Users } from "lucide-svelte";
	import { authClient } from "$lib/auth-client";
	import { hasPermission, requiredPagePermissions } from "$lib/permissions";

    let { isOpen = $bindable(true) } = $props();

    const isActive = (path: string) => {
		return page.url.pathname === path || page.url.pathname.startsWith(path + '/');
	};

    const session = authClient.useSession();
    const role = $derived($session.data?.user.role);

    const allNavItems = $derived([
        {
            label: 'Draw',
            icon: PencilLine,
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
            label: 'Data',
            icon: Database,
            href: '/data',
            isActive: isActive('/data')
        },
        {
            label: 'Stats',
            icon: ChartNoAxesColumn,
            href: '/stats',
            isActive: isActive('/stats')
        },
        {
            label: 'Users',
            icon: Users,
            href: '/admin/users',
            isActive: isActive('/admin/users')
        }
    ]);

    const navItems = $derived(
        allNavItems.filter((item) => {
            const required = requiredPagePermissions(item.href);
            return !required || hasPermission(role, required);
        })
    );
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