<script lang="ts">
    import Modal from '$lib/components/Modal.svelte';
    import RelinkSearchPanel from '$lib/components/RelinkSearchPanel.svelte';
    import MissingFilesSelectionBar from '$lib/components/MissingFilesSelectionBar.svelte';
    import { CheckSquare, ImageOff, Link2, Square, Trash2 } from 'lucide-svelte';
    import type { MissingImage } from '$lib/types';
    import {
        fetchMissingImages,
        searchUncataloguedFiles,
        relinkImage,
        removeMissingImage,
        bulkRemoveMissingImages,
        type UncataloguedMatch
    } from '$lib/utils/missingFiles';

    let {
        open = $bindable(false),
        onCountChange
    }: {
        open: boolean;
        onCountChange?: (count: number) => void;
    } = $props();

    let items = $state<MissingImage[]>([]);
    let loading = $state(true);

    // ── Relink (search-to-pick) ──────────────────────────────────────────────
    // Only one row can be in "relink" mode at a time, which keeps this state flat.
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
        onCountChange?.(items.length);
        loading = false;
    }

    $effect(() => {
        if (open) load();
        else {
            relinkingId = null;
            removingId = null;
            selectedIds = new Set();
        }
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
        onCountChange?.(items.length);
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
        onCountChange?.(items.length);
    }

    async function deleteSelected() {
        const ids = selectedIds;
        const filePaths = items.filter((item) => ids.has(item.id)).map((item) => item.filePath);
        if (!(await bulkRemoveMissingImages(filePaths))) return;
        items = items.filter((item) => !ids.has(item.id));
        selectedIds = new Set();
        onCountChange?.(items.length);
    }
</script>

<Modal bind:open title="Missing Files" maxWidth="max-w-lg">
    <div class="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
        {#if loading}
            {#each Array(3) as _, i (i)}
                <div class="h-16 bg-pressed rounded-lg animate-pulse shrink-0" style="opacity: {1 - i * 0.25}"></div>
            {/each}
        {:else if items.length === 0}
            <p class="text-sm text-warm-gray text-center py-4">No missing files — everything checks out.</p>
        {:else}
            {#if selectedIds.size > 0}
                <MissingFilesSelectionBar
                    selectedCount={selectedIds.size}
                    {allSelected}
                    onSelectAll={selectAll}
                    onDeselectAll={deselectAll}
                    onDeleteSelected={deleteSelected}
                />
            {:else}
                <p class="text-sm text-warm-gray">
                    These catalogued images can't find their file on disk. Relink them to a new location, or remove them from your catalogue.
                </p>
            {/if}
            {#each items as item (item.id)}
                <div class="border border-muted rounded-lg overflow-hidden shrink-0">
                    <div class="flex items-center gap-2 px-3 py-2.5">
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
                            <p class="text-sm font-medium text-ink truncate">{item.title}</p>
                            <p class="text-xs text-warm-gray truncate">{item.filePath}</p>
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
</Modal>
