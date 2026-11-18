<script lang="ts">
    // Mini grid browser used to pick up to 4 images as a folder's preview thumbnails.
    // Reuses the main browse endpoint (and therefore the same lazy thumbnail-generation
    // behavior as the full browser) rather than a bespoke listing API, per DRY.
    import { ChevronRight, File, Folder, House } from 'lucide-svelte';
    import LoadedImage from '$lib/components/LoadedImage.svelte';
    import { isImageFile } from '$lib/utils/images';

    type BrowseItem =
        | { name: string; type: 'dir'; thumbnails: string[] }
        | { name: string; type: 'file'; catalogued: boolean; liked: boolean; imageId?: string };

    const MAX_SELECTED = 4;

    let {
        folderPath,
        folderName,
        initialSelection,
        onSave,
        onCancel
    }: {
        folderPath: string;
        folderName: string;
        initialSelection: string[];
        onSave: (imagePaths: string[]) => void;
        onCancel: () => void;
    } = $props();

    // Path segments below `folderPath` — navigation never goes above it.
    let subPath = $state<string[]>([]);
    let items = $state<BrowseItem[]>([]);
    let loading = $state(true);
    let fetchError = $state<string | null>(null);
    // Snapshot the initial selection once; the picker then owns its own selection state
    // independent of the parent's `thumbnails` array (which only updates after a save).
    // svelte-ignore state_referenced_locally
    let selected = $state<string[]>([...initialSelection]);
    let saving = $state(false);

    function relPathFor(name: string): string {
        return [folderPath, ...subPath, name].join('/');
    }

    $effect(() => {
        const path = [folderPath, ...subPath].join('/');
        loading = true;
        fetchError = null;
        const controller = new AbortController();

        fetch(`/api/browse?${new URLSearchParams({ path, filter: 'all', search: '' })}`, { signal: controller.signal })
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
                    fetchError = 'Failed to load folder contents.';
                    items = [];
                    loading = false;
                }
            });

        return () => controller.abort();
    });

    function navigateInto(name: string) {
        subPath = [...subPath, name];
    }

    function navigateTo(index: number) {
        subPath = subPath.slice(0, index);
    }

    function toggleSelected(relPath: string) {
        if (selected.includes(relPath)) {
            selected = selected.filter((p) => p !== relPath);
        } else if (selected.length < MAX_SELECTED) {
            selected = [...selected, relPath];
        }
    }

    function save() {
        if (selected.length === 0 || saving) return;
        saving = true;
        onSave(selected);
    }
</script>

<div class="flex flex-col gap-3 min-h-0">
    <p class="text-sm text-warm-gray">
        Choose up to {MAX_SELECTED} images to show on the "{folderName}" folder card ({selected.length}/{MAX_SELECTED} selected).
    </p>

    <!-- Breadcrumb, scoped to the folder being edited -->
    <nav class="flex items-center gap-1 text-sm flex-wrap" aria-label="Breadcrumb">
        <button
            type="button"
            onclick={() => navigateTo(0)}
            class="flex items-center gap-1 text-warm-gray hover:text-ink transition-colors"
        >
            <House class="w-4 h-4" />
            <span class="truncate max-w-32">{folderName}</span>
        </button>
        {#each subPath as segment, i (i)}
            <ChevronRight class="w-3 h-3 text-muted shrink-0" />
            {#if i === subPath.length - 1}
                <span class="text-ink font-medium truncate max-w-32">{segment}</span>
            {:else}
                <button
                    type="button"
                    onclick={() => navigateTo(i + 1)}
                    class="text-warm-gray hover:text-ink transition-colors truncate max-w-32"
                >
                    {segment}
                </button>
            {/if}
        {/each}
    </nav>

    <div class="border-t border-muted"></div>

    <div class="flex-1 min-h-0 overflow-y-auto max-h-96">
        {#if loading}
            <div class="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
                {#each [0, 1, 2, 3, 4, 5, 6, 7] as i (i)}
                    <div class="aspect-square bg-pressed rounded-lg animate-pulse" style="opacity: {1 - i * 0.08}"></div>
                {/each}
            </div>
        {:else if fetchError}
            <p class="text-warm-gray text-center py-8">{fetchError}</p>
        {:else if items.length === 0}
            <p class="text-warm-gray text-center py-8">No items found</p>
        {:else}
            <div class="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
                {#each items as item (item.name)}
                    {#if item.type === 'dir'}
                        <button
                            type="button"
                            onclick={() => navigateInto(item.name)}
                            class="group relative aspect-square rounded-lg overflow-hidden border border-muted hover:border-warm-gray transition-colors"
                        >
                            <div class="w-full h-full flex items-center justify-center bg-pressed">
                                <Folder class="w-6 h-6 text-terracotta" />
                            </div>
                            <div class="absolute bottom-0 left-0 right-0 px-1.5 pt-3 pb-1 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
                                <span class="text-[10px] text-white truncate block">{item.name}</span>
                            </div>
                        </button>
                    {:else if isImageFile(item.name)}
                        {@const relPath = relPathFor(item.name)}
                        {@const pickIndex = selected.indexOf(relPath)}
                        {@const isSelected = pickIndex !== -1}
                        <button
                            type="button"
                            onclick={() => toggleSelected(relPath)}
                            disabled={!isSelected && selected.length >= MAX_SELECTED}
                            class="group relative aspect-square rounded-lg overflow-hidden border-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                                {isSelected ? 'border-terracotta' : 'border-muted hover:border-warm-gray'}"
                        >
                            <LoadedImage
                                src="/api/images/file?path={encodeURIComponent(relPath)}&size=thumb"
                                alt={item.name}
                                class="w-full h-full object-cover"
                                draggable={false}
                                loading="lazy"
                            />
                            {#if isSelected}
                                <span class="absolute top-1 left-1 w-5 h-5 flex items-center justify-center rounded-full bg-terracotta text-white text-[11px] font-semibold drop-shadow">
                                    {pickIndex + 1}
                                </span>
                            {/if}
                        </button>
                    {:else}
                        <div class="aspect-square rounded-lg flex items-center justify-center bg-pressed border border-muted">
                            <File class="w-6 h-6 text-warm-gray" />
                        </div>
                    {/if}
                {/each}
            </div>
        {/if}
    </div>

    <div class="flex items-center justify-end gap-2 pt-1">
        <button type="button" onclick={onCancel} class="btn btn-terracotta-tint">Cancel</button>
        <button type="button" onclick={save} disabled={selected.length === 0 || saving} class="btn btn-primary disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
        </button>
    </div>
</div>
