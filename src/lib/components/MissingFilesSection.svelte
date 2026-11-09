<script lang="ts">
    import { CheckSquare, Heart, ImageOff, Link2, Pencil, SkipForward, Square, Trash2 } from 'lucide-svelte';
    import RelinkSearchPanel from '$lib/components/RelinkSearchPanel.svelte';
    import MissingFilesSelectionBar from '$lib/components/MissingFilesSelectionBar.svelte';
    import type { MissingImage } from '$lib/types';
    import {
        fetchMissingImages,
        searchUncataloguedFiles,
        relinkImage,
        removeMissingImage,
        bulkRemoveMissingImages,
        type UncataloguedMatch
    } from '$lib/utils/missingFiles';

    let items = $state<MissingImage[]>([]);
    let loading = $state(true);

    // ── Relink (search-to-pick) ──────────────────────────────────────────────
    let relinkingId = $state<string | null>(null);
    let relinkSearch = $state('');
    let relinkResults = $state<UncataloguedMatch[]>([]);
    let relinkSearchLoading = $state(false);
    let relinkError = $state<string | null>(null);
    let searchTimer: ReturnType<typeof setTimeout> | null = null;

    // ── Remove (two-click confirm, matching the rest of the app) ────────────
    let removingId = $state<string | null>(null);

    // ── Multi-select ──────────────────────────────────────────────────────────
    let selectedIds = $state<Set<string>>(new Set());
    const allSelected = $derived(items.length > 0 && items.every((item) => selectedIds.has(item.id)));

    async function load() {
        loading = true;
        items = await fetchMissingImages();
        loading = false;
    }

    $effect(() => {
        load();
    });

    function toggleItemSelection(id: string) {
        relinkingId = null;
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        selectedIds = next;
    }

    function selectAll() {
        relinkingId = null;
        selectedIds = new Set(items.map((item) => item.id));
    }

    function deselectAll() {
        selectedIds = new Set();
    }

    function toggleRelink(id: string) {
        removingId = null;
        relinkError = null;
        if (relinkingId === id) {
            relinkingId = null;
            return;
        }
        relinkingId = id;
        relinkSearch = '';
        relinkResults = [];
    }

    function onRelinkSearchInput() {
        relinkError = null;
        if (searchTimer) clearTimeout(searchTimer);
        const term = relinkSearch.trim();
        if (!term) {
            relinkResults = [];
            relinkSearchLoading = false;
            return;
        }
        relinkSearchLoading = true;
        searchTimer = setTimeout(async () => {
            relinkResults = await searchUncataloguedFiles(term);
            relinkSearchLoading = false;
        }, 300);
    }

    async function performRelink(id: string, filePath: string) {
        relinkError = null;
        const result = await relinkImage(id, filePath);
        if (!result.ok) {
            relinkError = result.error;
            return;
        }
        items = items.filter((item) => item.id !== id);
        relinkingId = null;
    }

    async function removeRow(id: string) {
        if (removingId !== id) {
            removingId = id;
            relinkingId = null;
            return;
        }
        removingId = null;
        if (!(await removeMissingImage(id))) return;
        items = items.filter((item) => item.id !== id);
    }

    async function deleteSelected() {
        const ids = selectedIds;
        const filePaths = items.filter((item) => ids.has(item.id)).map((item) => item.filePath);
        if (!(await bulkRemoveMissingImages(filePaths))) return;
        items = items.filter((item) => !ids.has(item.id));
        selectedIds = new Set();
    }
</script>

<div class="flex flex-col gap-3 bg-canvas border border-muted rounded-lg p-4 shrink-0">
    <div class="flex items-center gap-2">
        <ImageOff class="w-4 h-4 text-terracotta shrink-0" />
        <h2 class="font-semibold text-ink">Missing Files</h2>
        {#if !loading && items.length > 0}
            <span class="text-xs px-1.5 py-0.5 bg-terracotta-tint text-terracotta rounded-full font-medium">
                {items.length}
            </span>
        {/if}
    </div>
    <p class="text-sm text-warm-gray">
        Catalogued images whose file can't be found on disk — likely moved, renamed, or deleted outside the app.
        Relink them to a new location, or remove them from your catalogue.
    </p>

    {#if selectedIds.size > 0}
        <MissingFilesSelectionBar
            selectedCount={selectedIds.size}
            {allSelected}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
            onDeleteSelected={deleteSelected}
        />
    {/if}

    <div class="flex flex-col gap-2 max-h-[28rem] overflow-y-auto">
        {#if loading}
            {#each Array(3) as _, i (i)}
                <div class="h-16 bg-pressed rounded-lg animate-pulse shrink-0" style="opacity: {1 - i * 0.25}"></div>
            {/each}
        {:else if items.length === 0}
            <p class="text-sm text-warm-gray text-center py-6">No missing files — everything checks out.</p>
        {:else}
            {#each items as item (item.id)}
                <div class="border border-muted rounded-lg overflow-hidden shrink-0">
                    <div class="flex items-center gap-3 px-3 py-2.5">
                        <button
                            type="button"
                            onclick={() => toggleItemSelection(item.id)}
                            class="p-0.5 -m-0.5 shrink-0"
                            aria-label={selectedIds.has(item.id) ? 'Deselect' : 'Select'}
                        >
                            {#if selectedIds.has(item.id)}
                                <CheckSquare class="w-4 h-4 text-terracotta" />
                            {:else}
                                <Square class="w-4 h-4 text-warm-gray" />
                            {/if}
                        </button>
                        <ImageOff class="w-4 h-4 text-warm-gray shrink-0" />
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1.5">
                                <p class="text-sm font-medium text-ink truncate">{item.title}</p>
                                {#if item.liked}
                                    <Heart class="w-3 h-3 text-terracotta fill-current shrink-0" aria-label="Liked" />
                                {/if}
                            </div>
                            <p class="text-xs text-warm-gray break-all">{item.filePath}</p>
                            {#if item.subjectCount > 0 || item.drawCount > 0 || item.skipCount > 0}
                                <div class="flex items-center gap-3 mt-1 text-xs text-warm-gray">
                                    {#if item.subjectCount > 0}
                                        <span>{item.subjectCount} subject{item.subjectCount !== 1 ? 's' : ''}</span>
                                    {/if}
                                    {#if item.drawCount > 0}
                                        <span class="flex items-center gap-1"><Pencil class="w-3 h-3" />{item.drawCount}</span>
                                    {/if}
                                    {#if item.skipCount > 0}
                                        <span class="flex items-center gap-1"><SkipForward class="w-3 h-3" />{item.skipCount}</span>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                        {#if selectedIds.size === 0}
                            <button
                                type="button"
                                onclick={() => toggleRelink(item.id)}
                                class="p-1.5 rounded-lg transition-colors shrink-0
                                    {relinkingId === item.id ? 'text-terracotta bg-terracotta-tint' : 'text-warm-gray hover:text-terracotta hover:bg-pressed'}"
                                aria-label="Relink"
                                title="Relink to a different file"
                            >
                                <Link2 class="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onclick={() => removeRow(item.id)}
                                class="p-1.5 rounded-lg transition-colors shrink-0
                                    {removingId === item.id ? 'text-red-600 bg-red-50' : 'text-warm-gray hover:text-red-600 hover:bg-pressed'}"
                                aria-label="Remove from catalogue"
                                title={removingId === item.id ? 'Click again to confirm' : 'Remove from catalogue'}
                            >
                                <Trash2 class="w-4 h-4" />
                            </button>
                        {/if}
                    </div>

                    {#if relinkingId === item.id}
                        <RelinkSearchPanel
                            bind:search={relinkSearch}
                            results={relinkResults}
                            loading={relinkSearchLoading}
                            error={relinkError}
                            oninput={onRelinkSearchInput}
                            onPick={(name) => performRelink(item.id, name)}
                            onCancel={() => (relinkingId = null)}
                        />
                    {/if}
                </div>
            {/each}
        {/if}
    </div>
</div>
