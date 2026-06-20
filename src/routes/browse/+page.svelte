<script lang="ts">
    import { ArrowLeft, CheckSquare, ChevronRight, File, FileImage, Folder, Heart, House, Plus, Search, Square, X } from 'lucide-svelte';
    import Modal from '$lib/components/Modal.svelte';
    import ImageDetailPanel from '$lib/components/ImageDetailPanel.svelte';
    import { isImageFile } from '$lib/utils/images';

    type FilterType = 'all' | 'catalogued' | 'uncatalogued';
    type BrowseItem =
        | { name: string; type: 'dir' }
        | { name: string; type: 'file'; catalogued: boolean; liked: boolean; imageId?: string };
    type SubjectField = { id: string; name: string; type: 'text' | 'number' | 'boolean' | 'select'; options: string[] | null; required: boolean; value: string | null; };

    // ── Browse state ───────────────────────────────────────────────────────────
    let currentPath = $state<string[]>([]);
    let search = $state('');
    let filter = $state<FilterType>('all');
    let debouncedSearch = $state('');
    let items = $state<BrowseItem[]>([]);
    let loading = $state(true);
    let fetchError = $state<string | null>(null);

    // ── Detail panel state ─────────────────────────────────────────────────────
    let selectedFilePath = $state<string | null>(null);
    let selectedFileName = $state<string | null>(null);
    let panelLiked = $state(false);
    let panelHasOverlay = $state(false);

    // ── Multi-select state ──────────────────────────────────────────────────
    let selectMode = $state(false);
    let selectedPaths = $state<Set<string>>(new Set());
    let anchorIndex = $state(-1);

    // ── Keyboard navigation state ───────────────────────────────────────────
    let focusedIndex = $state(-1);
    let listContainer: HTMLDivElement | null = null;

    // ── Subjects (shared: detail panel dropdown + bulk modal) ────────────────
    let allSubjects = $state<{ id: string; name: string }[]>([]);

    $effect(() => {
        fetch('/api/subjects')
            .then((r) => r.json())
            .then((data: { id: string; name: string }[]) => { allSubjects = data; })
            .catch(() => {});
    });

    // ── Bulk add subject modal ─────────────────────────────────────────────
    let bulkUncatalogueOpen = $state(false);
    let bulkSubjectOpen = $state(false);
    let bulkSubjectId = $state<string | null>(null);
    let bulkSubjectFields = $state<SubjectField[]>([]);
    let bulkLabel = $state('');
    let bulkFieldValues = $state<Record<string, string | null>>({});
    let bulkStatus = $state<'idle' | 'saving' | 'error'>('idle');
    let bulkErrorMessage = $state<string | null>(null);
    let bulkSuccessMessage = $state<string | null>(null);

    // ── Debounce: search ───────────────────────────────────────────────────────
    $effect(() => {
        const term = search;
        const timer = setTimeout(() => { debouncedSearch = term; }, 300);
        return () => clearTimeout(timer);
    });


    // ── Fetch browse items ─────────────────────────────────────────────────────
    $effect(() => {
        const path = currentPath.join('/');
        const f = filter;
        const s = debouncedSearch;

        loading = true;
        fetchError = null;
        focusedIndex = -1;

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


    // ── Navigation ─────────────────────────────────────────────────────────────
    function navigateInto(name: string) {
        currentPath = [...currentPath, name];
        focusedIndex = -1;
        exitSelectMode();
    }

    function navigateTo(index: number) {
        currentPath = currentPath.slice(0, index);
        focusedIndex = -1;
        exitSelectMode();
    }

    // ── File selection ─────────────────────────────────────────────────────────
    function selectFile(item: BrowseItem & { type: 'file' }) {
        const relPath = search
            ? item.name
            : [...currentPath, item.name].join('/');
        if (selectedFilePath === relPath) return;

        selectedFilePath = relPath;
        selectedFileName = relPath.split('/').pop()!;
    }

    function clearSelection() {
        selectedFilePath = null;
        selectedFileName = null;
    }

    // ── Mark / unmark catalogued status in the browse list ──────────────────────
    function setCatalogued(filePath: string, catalogued: boolean) {
        const name = filePath.split('/').pop()!;
        items = items.map((item) =>
            item.type === 'file' && (item.name === name || item.name === filePath)
                ? { ...item, catalogued }
                : item
        );
    }

    // ── Like toggle ────────────────────────────────────────────────────────────
    function setLiked(filePath: string, value: boolean) {
        const name = filePath.split('/').pop()!;
        items = items.map((item) =>
            item.type === 'file' && (item.name === name || item.name === filePath)
                ? { ...item, liked: value }
                : item
        );
    }

    async function toggleLikeById(imageId: string, filePath: string) {
        const isCurrentFile = filePath === selectedFilePath;
        const currentLiked = isCurrentFile ? panelLiked : (items.find((i) => i.type === 'file' && (i.name === filePath.split('/').pop() || i.name === filePath)) as { liked: boolean } | undefined)?.liked ?? false;
        const next = !currentLiked;
        if (isCurrentFile) panelLiked = next;
        setLiked(filePath, next);
        const res = await fetch(`/api/images/${imageId}/like`, { method: 'POST' });
        if (!res.ok) { if (isCurrentFile) panelLiked = currentLiked; setLiked(filePath, currentLiked); return; }
        const data: { liked: boolean } = await res.json();
        if (isCurrentFile) panelLiked = data.liked;
        setLiked(filePath, data.liked);
    }

    // ── Derived: how many selected paths are currently catalogued ──────────────
    const selectedCataloguedCount = $derived(
        Array.from(selectedPaths).filter((relPath) => {
            const name = relPath.split('/').pop()!;
            return items.some(
                (item) =>
                    item.type === 'file' &&
                    (item.name === name || item.name === relPath) &&
                    item.catalogued
            );
        }).length
    );

    // ── Helper: relative path for a file item ──────────────────────────────────
    function getRelPath(item: BrowseItem & { type: 'file' }): string {
        return search ? item.name : [...currentPath, item.name].join('/');
    }

    // ── Derived: all file items and select-all state ────────────────────────────
    const fileItems = $derived(
        items.filter((i): i is BrowseItem & { type: 'file' } => i.type === 'file')
    );
    const allFilesSelected = $derived(
        fileItems.length > 0 && fileItems.every((i) => selectedPaths.has(getRelPath(i)))
    );

    // ── Multi-select actions ───────────────────────────────────────────────────
    function enterSelectMode() {
        const preselected = selectedFilePath;
        clearSelection();
        selectMode = true;
        anchorIndex = -1;
        selectedPaths = preselected ? new Set([preselected]) : new Set();
    }

    function exitSelectMode() {
        selectMode = false;
        selectedPaths = new Set();
        anchorIndex = -1;
        bulkUncatalogueOpen = false;
        bulkSubjectOpen = false;
        bulkSuccessMessage = null;
        resetBulkModal();
        clearSelection();
    }

    function toggleFileInSelection(relPath: string) {
        const next = new Set(selectedPaths);
        if (next.has(relPath)) {
            next.delete(relPath);
        } else {
            next.add(relPath);
        }
        selectedPaths = next;
    }

    function selectAll() {
        selectedPaths = new Set(fileItems.map((i) => getRelPath(i)));
    }

    function handleFileClick(item: BrowseItem & { type: 'file' }, index: number, event: MouseEvent) {
        const relPath = getRelPath(item);
        const isShift = event.shiftKey;
        const isMeta = event.metaKey || event.ctrlKey;

        if (isShift) {
            if (!selectMode) {
                const prevIdx = items.findIndex(
                    (it) => it.type === 'file' && getRelPath(it) === selectedFilePath
                );
                enterSelectMode();
                if (prevIdx !== -1) anchorIndex = prevIdx;
            }
            const from = anchorIndex !== -1 ? anchorIndex : index;
            const lo = Math.min(from, index);
            const hi = Math.max(from, index);
            const next = new Set(selectedPaths);
            for (let i = lo; i <= hi; i++) {
                const rangeItem = items[i];
                if (rangeItem && rangeItem.type === 'file') next.add(getRelPath(rangeItem));
            }
            selectedPaths = next;
            focusedIndex = index;
            return;
        }

        if (isMeta) {
            if (!selectMode) enterSelectMode();
            toggleFileInSelection(relPath);
            anchorIndex = index;
            focusedIndex = index;
            return;
        }

        anchorIndex = index;

        if (selectMode) {
            toggleFileInSelection(relPath);
            focusedIndex = index;
            return;
        }

        if (selectedFilePath === relPath) {
            focusedIndex = -1;
            clearSelection();
        } else {
            focusedIndex = index;
            selectFile(item);
        }
    }

    // ── Keyboard navigation ────────────────────────────────────────────────
    function navigateToIndex(index: number) {
        if (items.length === 0) return;
        focusedIndex = Math.max(0, Math.min(index, items.length - 1));
        const item = items[focusedIndex];
        if (item.type === 'file') {
            selectFile(item);
        } else {
            clearSelection();
        }
        listContainer
            ?.querySelector<HTMLElement>(`[data-kb-index="${focusedIndex}"]`)
            ?.scrollIntoView({ block: 'nearest' });
    }

    function handleListKeydown(e: KeyboardEvent) {
        const target = e.target as HTMLElement;
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (selectMode || loading || items.length === 0) return;
        if (panelHasOverlay || bulkUncatalogueOpen || bulkSubjectOpen) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                navigateToIndex(focusedIndex < 0 ? 0 : focusedIndex + 1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                navigateToIndex(focusedIndex < 0 ? items.length - 1 : focusedIndex - 1);
                break;
            case 'ArrowRight':
            case 'Enter': {
                const focused = focusedIndex >= 0 ? items[focusedIndex] : null;
                if (focused?.type === 'dir') {
                    e.preventDefault();
                    navigateInto(focused.name);
                }
                break;
            }
            case 'ArrowLeft':
                if (currentPath.length > 0 && !search) {
                    e.preventDefault();
                    navigateTo(currentPath.length - 1);
                }
                break;
            case 'Escape':
                clearSelection();
                focusedIndex = -1;
                break;
        }
    }

    $effect(() => {
        document.addEventListener('keydown', handleListKeydown);
        return () => document.removeEventListener('keydown', handleListKeydown);
    });

    // ── Bulk uncatalogue ───────────────────────────────────────────────────────
    async function bulkUncatalogue() {
        bulkUncatalogueOpen = false;
        const res = await fetch('/api/images/bulk-uncatalogue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePaths: Array.from(selectedPaths) })
        });
        if (!res.ok) return;
        const count = selectedPaths.size;
        for (const filePath of selectedPaths) {
            setCatalogued(filePath, false);
        }
        selectedPaths = new Set();
        bulkSuccessMessage = `Uncatalogued ${count} ${count === 1 ? 'image' : 'images'}`;
        setTimeout(() => { bulkSuccessMessage = null; }, 3000);
    }

    // ── Bulk add subject ───────────────────────────────────────────────────────
    function resetBulkModal() {
        bulkSubjectId = null;
        bulkSubjectFields = [];
        bulkLabel = '';
        bulkFieldValues = {};
        bulkStatus = 'idle';
        bulkErrorMessage = null;
    }

    $effect(() => {
        const id = bulkSubjectId;
        if (!id) {
            bulkSubjectFields = [];
            return;
        }
        fetch(`/api/subjects/${id}/fields`)
            .then((r) => r.json())
            .then((data: Omit<SubjectField, 'value'>[]) => {
                bulkSubjectFields = data.map((f) => ({ ...f, value: null }));
            })
            .catch(() => {});
    });

    async function bulkAddSubject() {
        if (!bulkSubjectId || selectedPaths.size === 0) return;
        bulkStatus = 'saving';
        bulkErrorMessage = null;
        try {
            const res = await fetch('/api/images/bulk-subjects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filePaths: Array.from(selectedPaths),
                    subjectId: bulkSubjectId,
                    label: bulkLabel.trim() || null,
                    fieldValues: bulkFieldValues
                })
            });
            if (!res.ok) {
                const data = await res.json();
                bulkErrorMessage = data.error ?? 'Failed to add subjects';
                bulkStatus = 'error';
                return;
            }
            const count = selectedPaths.size;
            for (const filePath of selectedPaths) {
                setCatalogued(filePath, true);
            }
            bulkSubjectOpen = false;
            resetBulkModal();
            bulkSuccessMessage = `Subject added to ${count} ${count === 1 ? 'image' : 'images'}`;
            setTimeout(() => { bulkSuccessMessage = null; }, 3000);
        } catch {
            bulkErrorMessage = 'An unexpected error occurred';
            bulkStatus = 'error';
        }
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

    <!-- Main content row -->
    <div class="flex gap-4 flex-1 min-h-0">

        <!-- File browser panel -->
        <div class="
            bg-canvas rounded-lg p-4 flex flex-col gap-3 min-h-0
            {selectedFilePath && !selectMode ? 'hidden lg:flex lg:w-80 lg:shrink-0' : selectMode ? 'flex flex-1 lg:flex-none lg:w-80 lg:shrink-0' : 'flex flex-1'}
        ">
            <!-- Breadcrumb + select toggle -->
            <div class="flex items-center gap-2 min-h-6">
                <nav class="flex items-center gap-1 text-sm flex-wrap flex-1 min-w-0 {search ? 'hidden' : ''}" aria-label="Breadcrumb">
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
                <button
                    type="button"
                    onclick={() => selectMode ? exitSelectMode() : enterSelectMode()}
                    class="p-1.5 rounded-lg transition-colors shrink-0 {selectMode ? 'text-terracotta bg-terracotta-tint' : 'text-warm-gray hover:text-ink hover:bg-pressed'}"
                    aria-label={selectMode ? 'Exit select mode' : 'Select multiple images'}
                >
                    <CheckSquare class="w-4 h-4" />
                </button>
            </div>

            {#if !search}<div class="border-t border-muted"></div>{/if}

            <!-- Items list -->
            <div
                bind:this={listContainer}
                class="flex-1 overflow-y-auto min-h-0 {selectMode && selectedPaths.size > 0 ? 'pb-20 lg:pb-0' : ''}"
            >
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
                        {#each items as item, i (item.name)}
                            {#if item.type === 'dir'}
                                <button
                                    type="button"
                                    data-kb-index={i}
                                    onclick={() => navigateInto(item.name)}
                                    class="flex items-center gap-3 py-3 px-2 rounded-lg transition-colors text-left w-full focus:outline-none
                                        {focusedIndex === i ? 'bg-pressed' : 'hover:bg-pressed'}"
                                >
                                    <Folder class="w-5 h-5 text-terracotta shrink-0" />
                                    <span class="text-ink flex-1 truncate">{item.name}</span>
                                    <ChevronRight class="w-4 h-4 text-muted shrink-0" />
                                </button>
                            {:else}
                                {@const relPath = search ? item.name : [...currentPath, item.name].join('/')}
                                {@const isSelected = selectMode ? selectedPaths.has(relPath) : selectedFilePath === relPath}
                                <div
                                    class="group flex items-center rounded-lg transition-colors
                                        {isSelected
                                            ? 'bg-terracotta-tint border border-terracotta/30'
                                            : 'hover:bg-pressed'}"
                                >
                                    <button
                                        type="button"
                                        data-kb-index={i}
                                        onclick={(e) => handleFileClick(item, i, e)}
                                        class="flex items-center gap-3 py-3 pl-2 text-left flex-1 min-w-0 focus:outline-none
                                            {item.catalogued && !selectMode ? 'pr-1' : 'pr-2'}"
                                    >
                                        {#if selectMode}
                                            {#if isSelected}
                                                <CheckSquare class="w-5 h-5 text-terracotta shrink-0" />
                                            {:else}
                                                <Square class="w-5 h-5 text-warm-gray shrink-0" />
                                            {/if}
                                        {:else if isImageFile(item.name)}
                                            <FileImage class="w-5 h-5 {isSelected ? 'text-terracotta' : 'text-warm-gray'} shrink-0" />
                                        {:else}
                                            <File class="w-5 h-5 {isSelected ? 'text-terracotta' : 'text-warm-gray'} shrink-0" />
                                        {/if}
                                        <span class="text-ink flex-1 truncate text-sm">{item.name}</span>
                                        {#if item.catalogued}
                                            <span class="text-xs px-2 py-0.5 bg-terracotta-tint text-terracotta rounded-full font-medium shrink-0">
                                                Catalogued
                                            </span>
                                        {/if}
                                    </button>
                                    {#if item.catalogued && !selectMode && item.imageId}
                                        <button
                                            type="button"
                                            onclick={() => toggleLikeById(item.imageId!, relPath)}
                                            class="shrink-0 p-1.5 mr-1 rounded transition-opacity {item.liked ? 'text-terracotta opacity-100' : 'text-warm-gray opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100'}"
                                            aria-label={item.liked ? 'Unlike' : 'Like'}
                                        >
                                            <Heart class="w-3.5 h-3.5 {item.liked ? 'fill-current' : ''}" />
                                        </button>
                                    {/if}
                                </div>
                            {/if}
                        {/each}
                    </div>
                {/if}
            </div>
        </div>

        <!-- Bulk actions panel (shown in select mode on desktop) -->
        {#if selectMode}
            <div class="hidden lg:flex flex-1 flex-col gap-3 min-h-0 min-w-0">
                <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-ink flex-1">
                        {selectedPaths.size}
                        {selectedPaths.size === 1 ? 'image' : 'images'} selected
                    </span>
                    {#if !allFilesSelected && fileItems.length > 0}
                        <button
                            type="button"
                            onclick={selectAll}
                            class="text-xs text-warm-gray hover:text-ink transition-colors"
                        >
                            Select all
                        </button>
                    {/if}
                    {#if selectedPaths.size > 0}
                        <button
                            type="button"
                            onclick={() => { selectedPaths = new Set(); }}
                            class="text-xs text-warm-gray hover:text-ink transition-colors"
                        >
                            Deselect all
                        </button>
                    {/if}
                    <button
                        type="button"
                        onclick={exitSelectMode}
                        class="p-1.5 text-warm-gray hover:text-ink hover:bg-pressed rounded-lg transition-colors"
                        aria-label="Exit select mode"
                    >
                        <X class="w-4 h-4" />
                    </button>
                </div>
                <div class="bg-canvas rounded-lg border border-muted p-4 flex flex-col gap-3">
                    {#if selectedPaths.size === 0}
                        {#if bulkSuccessMessage}
                            <p class="text-sm text-terracotta">{bulkSuccessMessage}</p>
                        {:else}
                            <p class="text-sm text-warm-gray py-2">Select images from the list to get started.</p>
                        {/if}
                    {:else}
                        {#if bulkSuccessMessage}
                            <p class="text-sm text-terracotta">{bulkSuccessMessage}</p>
                        {/if}
                        <button
                            type="button"
                            onclick={() => { resetBulkModal(); bulkSubjectOpen = true; }}
                            class="btn btn-primary flex items-center gap-2 self-start"
                        >
                            <Plus class="w-4 h-4" />
                            Add Subject
                        </button>
                        {#if selectedCataloguedCount > 0}
                            <button
                                type="button"
                                onclick={() => { bulkUncatalogueOpen = true; }}
                                class="self-start text-xs px-2.5 py-1 rounded-lg border border-muted text-warm-gray hover:text-red-600 hover:border-red-300 transition-colors"
                            >
                                {selectedCataloguedCount === selectedPaths.size
                                    ? `Uncatalogue ${selectedCataloguedCount} ${selectedCataloguedCount === 1 ? 'image' : 'images'}`
                                    : `Uncatalogue ${selectedCataloguedCount} of ${selectedPaths.size} images`}
                            </button>
                        {/if}
                    {/if}
                </div>
            </div>

        <!-- Detail panel (shown when a file is selected) -->
        {:else if selectedFilePath}
            <div class="flex-1 flex flex-col gap-3 min-h-0 min-w-0">

                <!-- Panel header: filename + close -->
                <div class="flex items-center gap-2 min-w-0">
                    <button
                        type="button"
                        onclick={clearSelection}
                        class="lg:hidden p-1.5 text-warm-gray hover:text-ink hover:bg-pressed rounded-lg transition-colors shrink-0"
                        aria-label="Back to files"
                    >
                        <ArrowLeft class="w-4 h-4" />
                    </button>
                    <span class="text-sm font-medium text-ink truncate flex-1 min-w-0">{selectedFileName}</span>
                    <button
                        type="button"
                        onclick={clearSelection}
                        class="p-1.5 text-warm-gray hover:text-ink hover:bg-pressed rounded-lg transition-colors shrink-0"
                        aria-label="Close preview"
                    >
                        <X class="w-4 h-4" />
                    </button>
                </div>

                <!-- Image preview (fixed, never squishes) -->
                <div class="bg-canvas rounded-lg border border-muted overflow-hidden flex items-center justify-center shrink-0 h-72">
                    {#if isImageFile(selectedFileName ?? '')}
                        <img
                            src="/api/images/file?path={encodeURIComponent(selectedFilePath)}"
                            alt={selectedFileName ?? ''}
                            class="max-w-full max-h-full object-contain"
                        />
                    {:else}
                        <div class="flex flex-col items-center gap-2 text-warm-gray py-8">
                            <File class="w-12 h-12" />
                            <span class="text-sm">{selectedFileName}</span>
                        </div>
                    {/if}
                </div>

                <!-- Scrollable metadata -->
                <div class="flex-1 overflow-y-auto min-h-0">
                    <div class="bg-canvas rounded-lg border border-muted p-4">
                        <ImageDetailPanel
                            filePath={selectedFilePath}
                            bind:liked={panelLiked}
                            bind:hasOverlay={panelHasOverlay}
                            onLikeChange={(_, l) => setLiked(selectedFilePath!, l)}
                            onFirstCatalogue={(path) => setCatalogued(path, true)}
                            onUncatalogue={(_, path) => setCatalogued(path, false)}
                        />
                    </div>
                </div>
            </div>
        {/if}
    </div>
</div>

<!-- Mobile sticky bottom bar (shown in select mode when files are selected) -->
{#if selectMode && selectedPaths.size > 0}
    <div class="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-canvas border-t border-muted px-4 py-3 flex items-center gap-3 shadow-lg">
        <span class="text-sm font-medium text-ink flex-1">
            {selectedPaths.size} {selectedPaths.size === 1 ? 'image' : 'images'} selected
        </span>
        <button type="button" onclick={exitSelectMode} class="btn">Cancel</button>
        {#if selectedCataloguedCount > 0}
            <button
                type="button"
                onclick={() => { bulkUncatalogueOpen = true; }}
                class="text-xs px-2.5 py-1 rounded-lg border border-muted text-warm-gray hover:text-red-600 hover:border-red-300 transition-colors"
            >
                {selectedCataloguedCount === selectedPaths.size
                    ? `Uncatalogue ${selectedCataloguedCount}`
                    : `Uncatalogue ${selectedCataloguedCount} of ${selectedPaths.size}`}
            </button>
        {/if}
        <button
            type="button"
            onclick={() => { resetBulkModal(); bulkSubjectOpen = true; }}
            class="btn btn-primary flex items-center gap-2"
        >
            <Plus class="w-4 h-4" />
            Add Subject
        </button>
    </div>
{/if}

<Modal bind:open={bulkUncatalogueOpen} title="Uncatalogue {selectedCataloguedCount} {selectedCataloguedCount === 1 ? 'image' : 'images'}?">
    <p class="text-sm text-warm-gray">
        This will remove <span class="font-medium text-ink">{selectedCataloguedCount} {selectedCataloguedCount === 1 ? 'image' : 'images'}</span> from the catalogue,
        including all linked subjects and field values. Files that aren't catalogued will be unaffected.
        The files themselves won't be deleted.
    </p>
    <div class="flex justify-end gap-2 mt-2">
        <button type="button" onclick={() => { bulkUncatalogueOpen = false; }} class="btn">Cancel</button>
        <button type="button" onclick={bulkUncatalogue} class="btn bg-red-600 hover:bg-red-700 text-white transition-colors">
            Uncatalogue
        </button>
    </div>
</Modal>

<Modal
    bind:open={bulkSubjectOpen}
    title="Add subject to {selectedPaths.size} {selectedPaths.size === 1 ? 'image' : 'images'}"
    onclose={resetBulkModal}
>
    {#if !bulkSubjectId}
        <div class="flex flex-col gap-3">
            <p class="text-sm text-warm-gray">Choose a subject to add to all selected images:</p>
            {#if allSubjects.length === 0}
                <p class="text-sm text-warm-gray">No subjects defined yet.</p>
            {:else}
                <div class="max-h-56 overflow-y-auto flex flex-col border border-muted rounded-lg divide-y divide-muted">
                    {#each allSubjects as subject (subject.id)}
                        <button
                            type="button"
                            onclick={() => { bulkSubjectId = subject.id; }}
                            class="text-left px-3 py-2.5 text-sm text-ink hover:bg-pressed transition-colors first:rounded-t-lg last:rounded-b-lg"
                        >
                            {subject.name}
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
        <div class="flex justify-end mt-4">
            <button type="button" onclick={() => { bulkSubjectOpen = false; }} class="btn">Cancel</button>
        </div>
    {:else}
        <div class="flex flex-col gap-3">
            <div class="flex items-center gap-2">
                <button
                    type="button"
                    onclick={resetBulkModal}
                    class="flex items-center gap-1 text-xs text-warm-gray hover:text-ink transition-colors shrink-0"
                >
                    <ArrowLeft class="w-3 h-3" />
                    Back
                </button>
                <span class="text-xs font-medium text-warm-gray bg-canvas border border-muted rounded px-1.5 py-0.5">
                    {allSubjects.find((s) => s.id === bulkSubjectId)?.name}
                </span>
            </div>

            <div class="flex flex-col gap-1">
                <label for="bulk-label" class="text-xs font-medium text-warm-gray">Label</label>
                <input
                    id="bulk-label"
                    type="text"
                    bind:value={bulkLabel}
                    placeholder="Add label…"
                    class="rounded-lg border-muted text-sm w-full"
                />
            </div>

            {#each bulkSubjectFields as field (field.id)}
                <div class="flex flex-col gap-1">
                    <label for="bulk-field-{field.id}" class="text-xs font-medium text-warm-gray flex items-center gap-1">
                        {field.name}
                        {#if field.required}<span class="text-terracotta">*</span>{/if}
                    </label>
                    {#if field.type === 'boolean'}
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input
                                id="bulk-field-{field.id}"
                                type="checkbox"
                                checked={bulkFieldValues[field.id] === 'true'}
                                onchange={(e) => { bulkFieldValues = { ...bulkFieldValues, [field.id]: e.currentTarget.checked ? 'true' : 'false' }; }}
                                class="rounded border-muted"
                            />
                            <span class="text-sm text-ink">Yes</span>
                        </label>
                    {:else if field.type === 'select'}
                        <select
                            id="bulk-field-{field.id}"
                            value={bulkFieldValues[field.id] ?? ''}
                            onchange={(e) => { bulkFieldValues = { ...bulkFieldValues, [field.id]: e.currentTarget.value || null }; }}
                            class="rounded-lg border-muted text-sm w-full"
                        >
                            <option value="">— Select —</option>
                            {#each field.options ?? [] as option (option)}
                                <option value={option}>{option}</option>
                            {/each}
                        </select>
                    {:else if field.type === 'number'}
                        <input
                            id="bulk-field-{field.id}"
                            type="number"
                            value={bulkFieldValues[field.id] ?? ''}
                            oninput={(e) => { bulkFieldValues = { ...bulkFieldValues, [field.id]: e.currentTarget.value || null }; }}
                            placeholder="Enter number…"
                            class="rounded-lg border-muted text-sm w-full"
                        />
                    {:else}
                        <input
                            id="bulk-field-{field.id}"
                            type="text"
                            value={bulkFieldValues[field.id] ?? ''}
                            oninput={(e) => { bulkFieldValues = { ...bulkFieldValues, [field.id]: e.currentTarget.value || null }; }}
                            placeholder="Enter text…"
                            class="rounded-lg border-muted text-sm w-full"
                        />
                    {/if}
                </div>
            {/each}

            {#if bulkErrorMessage}
                <p class="text-sm text-red-600">{bulkErrorMessage}</p>
            {/if}
        </div>

        <div class="flex justify-end gap-2 mt-4">
            <button
                type="button"
                onclick={() => { bulkSubjectOpen = false; resetBulkModal(); }}
                class="btn"
            >
                Cancel
            </button>
            <button
                type="button"
                onclick={bulkAddSubject}
                disabled={bulkStatus === 'saving'}
                class="btn btn-primary"
            >
                {bulkStatus === 'saving' ? 'Adding…' : `Add to ${selectedPaths.size} ${selectedPaths.size === 1 ? 'image' : 'images'}`}
            </button>
        </div>
    {/if}
</Modal>