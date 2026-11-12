<script lang="ts">
    // Shared "pick one item from a named list" presentation, used by the
    // detail-panel add dropdowns and the bulk-action modals (subjects, tags).
    // A search box is always shown when there's anything to pick from so
    // users can filter long lists instead of scrolling them.
    import { Search } from 'lucide-svelte';

    type Item = { id: string; name: string };

    let {
        items,
        onSelect,
        emptyMessage = 'No items available',
        variant = 'dropdown',
        searchPlaceholder = 'Search…'
    }: {
        items: Item[];
        onSelect: (id: string) => void;
        emptyMessage?: string;
        variant?: 'dropdown' | 'list';
        searchPlaceholder?: string;
    } = $props();

    let query = $state('');
    let searchInput = $state<HTMLInputElement | null>(null);

    const showSearch = $derived(items.length > 0);
    const filteredItems = $derived(
        query.trim()
            ? items.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
            : items
    );

    // Autofocus the search box as soon as it appears (e.g. when a dropdown
    // opens) so typing-to-filter works immediately without an extra click.
    $effect(() => {
        if (showSearch) searchInput?.focus();
    });

    function onSearchKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter' && filteredItems.length > 0) {
            e.preventDefault();
            onSelect(filteredItems[0].id);
        }
    }
</script>

{#if showSearch}
    <div class="{variant === 'dropdown' ? 'p-2 border-b border-muted' : 'mb-2'}">
        <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-gray pointer-events-none" />
            <input
                bind:this={searchInput}
                type="text"
                bind:value={query}
                onkeydown={onSearchKeydown}
                placeholder={searchPlaceholder}
                class="w-full rounded-lg border-muted pl-9"
            />
        </div>
    </div>
{/if}

{#if items.length === 0}
    <p class="text-sm text-warm-gray {variant === 'dropdown' ? 'px-3 py-2' : ''}">{emptyMessage}</p>
{:else if filteredItems.length === 0}
    <p class="text-sm text-warm-gray {variant === 'dropdown' ? 'px-3 py-2' : ''}">No matches for "{query.trim()}"</p>
{:else if variant === 'dropdown'}
    <div class="max-h-48 overflow-y-auto">
        {#each filteredItems as item (item.id)}
            <button
                type="button"
                onclick={() => onSelect(item.id)}
                class="w-full text-left px-3 py-2 text-sm text-ink hover:bg-pressed transition-colors"
            >
                {item.name}
            </button>
        {/each}
    </div>
{:else}
    <div class="max-h-56 overflow-y-auto flex flex-col border border-muted rounded-lg divide-y divide-muted">
        {#each filteredItems as item (item.id)}
            <button
                type="button"
                onclick={() => onSelect(item.id)}
                class="text-left px-3 py-2.5 text-sm text-ink hover:bg-pressed transition-colors first:rounded-t-lg last:rounded-b-lg"
            >
                {item.name}
            </button>
        {/each}
    </div>
{/if}
