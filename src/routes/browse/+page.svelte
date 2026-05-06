<script lang="ts">
    import { ChevronRight, File, FileImage, Folder, House, Search } from 'lucide-svelte';
    import { isImageFile } from '$lib/utils/images';

    type FilterType = 'all' | 'catalogued' | 'uncatalogued';
    type BrowseItem =
        | { name: string; type: 'dir' }
        | { name: string; type: 'file'; catalogued: boolean };

    let currentPath = $state<string[]>([]);
    let search = $state('');
    let filter = $state<FilterType>('all');
    let debouncedSearch = $state('');
    let items = $state<BrowseItem[]>([]);
    let loading = $state(true);
    let fetchError = $state<string | null>(null);

    $effect(() => {
        const term = search;
        const timer = setTimeout(() => {
            debouncedSearch = term;
        }, 300);
        return () => clearTimeout(timer);
    });

    $effect(() => {
        const path = currentPath.join('/');
        const f = filter;
        const s = debouncedSearch;

        loading = true;
        fetchError = null;

        const controller = new AbortController();
        const params = new URLSearchParams({ path, filter: f, search: s });

        fetch(`/api/browse?${params}`, { signal: controller.signal })
            .then((res) => {
                if (!res.ok) throw new Error();
                return res.json();
            })
            .then((data: { items: BrowseItem[] }) => {
                items = data.items;
                loading = false;
            })
            .catch((err: Error) => {
                if (err.name !== 'AbortError') {
                    fetchError = 'Failed to load directory contents.';
                    items = [];
                    loading = false;
                }
            });

        return () => controller.abort();
    });

    function navigateInto(name: string) {
        currentPath = [...currentPath, name];
    }

    function navigateTo(index: number) {
        currentPath = currentPath.slice(0, index);
    }
</script>

<div class="p-4 flex flex-col gap-4 h-[calc(100vh-var(--header-height))]">
    <!-- Search and filters -->
    <div class="flex flex-col gap-3 border-muted border p-4 rounded-lg bg-canvas">
        <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-gray pointer-events-none" />
            <input
                type="search"
                bind:value={search}
                placeholder="Search by filename…"
                class="w-full rounded-lg border-muted pl-9"
            />
        </div>
        <div class="flex gap-2">
            {#each (['all', 'catalogued', 'uncatalogued'] as FilterType[]) as f (f)}
                <button
                    type="button"
                    onclick={() => (filter = f)}
                    class="btn capitalize {filter === f ? 'btn-primary' : 'btn-terracotta-tint'}"
                >
                    {f}
                </button>
            {/each}
        </div>
    </div>

    <!-- File browser -->
    <div class="bg-canvas rounded-lg p-4 flex flex-col gap-3 flex-1 min-h-0">
        <!-- Breadcrumb (hidden during search) -->
        <nav class="flex items-center gap-1 text-sm flex-wrap min-h-6 {search ? 'hidden' : ''}" aria-label="Breadcrumb">
            <button
                type="button"
                onclick={() => navigateTo(0)}
                class="flex items-center gap-1 text-warm-gray hover:text-ink transition-colors"
                aria-label="Images root"
            >
                <House class="w-4 h-4" />
            </button>
            {#each currentPath as segment, i (i)}
                <ChevronRight class="w-3 h-3 text-muted shrink-0" />
                {#if i === currentPath.length - 1}
                    <span class="text-ink font-medium truncate max-w-48">{segment}</span>
                {:else}
                    <button
                        type="button"
                        onclick={() => navigateTo(i + 1)}
                        class="text-warm-gray hover:text-ink transition-colors truncate max-w-48"
                    >
                        {segment}
                    </button>
                {/if}
            {/each}
        </nav>

        {#if !search}<div class="border-t border-muted"></div>{/if}

        <!-- Items list -->
        <div class="flex-1 overflow-y-auto min-h-0">
        {#if loading}
            <div class="flex flex-col divide-y divide-muted">
                {#each Array(6) as _, i (i)}
                    <div class="flex items-center gap-3 py-3 px-2 animate-pulse">
                        <div class="w-5 h-5 bg-pressed rounded shrink-0"></div>
                        <div class="h-4 bg-pressed rounded" style="width: {48 + (i * 13) % 40}%"></div>
                    </div>
                {/each}
            </div>
        {:else if fetchError}
            <p class="text-warm-gray text-center py-8">{fetchError}</p>
        {:else if items.length === 0}
            <p class="text-warm-gray text-center py-8">No items found</p>
        {:else}
            <div class="flex flex-col divide-y divide-muted">
                {#each items as item (item.name)}
                    {#if item.type === 'dir'}
                        <button
                            type="button"
                            onclick={() => navigateInto(item.name)}
                            class="flex items-center gap-3 py-3 px-2 hover:bg-pressed rounded-lg transition-colors text-left w-full"
                        >
                            <Folder class="w-5 h-5 text-terracotta shrink-0" />
                            <span class="text-ink flex-1 truncate">{item.name}</span>
                            <ChevronRight class="w-4 h-4 text-muted shrink-0" />
                        </button>
                    {:else}
                        <div class="flex items-center gap-3 py-3 px-2">
                            {#if isImageFile(item.name)}
                                <FileImage class="w-5 h-5 text-warm-gray shrink-0" />
                            {:else}
                                <File class="w-5 h-5 text-warm-gray shrink-0" />
                            {/if}
                            <span class="text-ink flex-1 truncate">{item.name}</span>
                            {#if item.catalogued}
                                <span class="text-xs px-2 py-0.5 bg-terracotta-tint text-terracotta rounded-full font-medium shrink-0">
                                    Catalogued
                                </span>
                            {/if}
                        </div>
                    {/if}
                {/each}
            </div>
        {/if}
        </div>
    </div>
</div>