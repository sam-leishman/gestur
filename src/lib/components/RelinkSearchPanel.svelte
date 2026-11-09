<script lang="ts">
    import { Search, X } from 'lucide-svelte';
    import type { UncataloguedMatch } from '$lib/utils/missingFiles';

    let {
        search = $bindable(''),
        results,
        loading,
        error,
        oninput,
        onPick,
        onCancel
    }: {
        search: string;
        results: UncataloguedMatch[];
        loading: boolean;
        error: string | null;
        oninput: () => void;
        onPick: (name: string) => void;
        onCancel: () => void;
    } = $props();
</script>

<div class="border-t border-muted bg-pressed p-3 flex flex-col gap-2">
    <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-gray pointer-events-none" />
        <input
            type="search"
            bind:value={search}
            {oninput}
            placeholder="Search for the file's new location…"
            class="w-full rounded-lg border-muted pl-9 text-sm"
        />
    </div>
    {#if error}
        <p class="text-xs text-red-600">{error}</p>
    {/if}
    {#if loading}
        <p class="text-xs text-warm-gray px-1">Searching…</p>
    {:else if search.trim() && results.length === 0}
        <p class="text-xs text-warm-gray px-1">No matching uncatalogued files</p>
    {:else if results.length > 0}
        <div class="flex flex-col divide-y divide-muted max-h-40 overflow-y-auto rounded-lg border border-muted bg-canvas">
            {#each results as result (result.name)}
                <button
                    type="button"
                    onclick={() => onPick(result.name)}
                    class="text-left px-3 py-2 text-sm text-ink hover:bg-pressed transition-colors truncate shrink-0"
                >
                    {result.name}
                </button>
            {/each}
        </div>
    {/if}
    <button
        type="button"
        onclick={onCancel}
        class="self-start text-xs text-warm-gray hover:text-ink transition-colors flex items-center gap-1"
    >
        <X class="w-3 h-3" />
        Cancel
    </button>
</div>
