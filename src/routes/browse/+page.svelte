<script lang="ts">
    import { ArrowLeft, CheckSquare, ChevronDown, ChevronRight, File, FileImage, Folder, Heart, House, LayoutGrid, List, Pencil, Plus, Search, Square, X } from 'lucide-svelte';
    import Modal from '$lib/components/Modal.svelte';
    import ImageDetailPanel from '$lib/components/ImageDetailPanel.svelte';
    import LoadedImage from '$lib/components/LoadedImage.svelte';
    import MissingFilesBanner from '$lib/components/MissingFilesBanner.svelte';
    import ItemPickerList from '$lib/components/ItemPickerList.svelte';
    import FolderThumbnailPicker from '$lib/components/FolderThumbnailPicker.svelte';
    import { authClient } from '$lib/auth-client';
    import { isImageFile } from '$lib/utils/images';

    type FilterType = 'all' | 'catalogued' | 'uncatalogued';
    type ViewMode = 'grid' | 'list';
    type BrowseItem =
        | { name: string; type: 'dir'; thumbnails: string[] }
        | { name: string; type: 'file'; catalogued: boolean; liked: boolean; imageId?: string };

    // Folder thumbnail picker is a catalogue-management action — admin only (same
    // gating as the catalogue editing controls in ImageDetailPanel).
    const session = authClient.useSession();
    const isAdmin = $derived($session.data?.user.role === 'admin');
    type SubjectField = { id: string; name: string; type: 'text' | 'number' | 'boolean' | 'select'; options: string[] | null; required: boolean; value: string | null; };

    // ── Browse state ───────────────────────────────────────────────────────────
    let currentPath = $state<string[]>([]);
    let search = $state('');
    let filter = $state<FilterType>('all');
    let debouncedSearch = $state('');
    let items = $state<BrowseItem[]>([]);
    let loading = $state(true);
    let fetchError = $state<string | null>(null);

    // ── View mode (grid/list, persisted per user) ────────────────────────────
    let viewMode = $state<ViewMode>('grid');

    $effect(() => {
        fetch('/api/browse-view-mode')
            .then((r) => r.json())
            .then((data: { browseViewMode: ViewMode }) => { viewMode = data.browseViewMode; })
            .catch(() => {});
    });

    async function setViewMode(mode: ViewMode) {
        if (viewMode === mode) return;
        viewMode = mode;
        await fetch('/api/browse-view-mode', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ browseViewMode: mode })
        });
    }

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

    // ── Subjects & tags (shared: detail panel dropdown + bulk modal) ─────────
    let allSubjects = $state<{ id: string; name: string }[]>([]);
    let allTags = $state<{ id: string; name: string }[]>([]);

    $effect(() => {
        fetch('/api/subjects')
            .then((r) => r.json())
            .then((data: { id: string; name: string }[]) => { allSubjects = data; })
            .catch(() => {});
    });

    $effect(() => {
        fetch('/api/tags')
            .then((r) => r.json())
            .then((data: { id: string; name: string }[]) => { allTags = data; })
            .catch(() => {});
    });

    // ── Bulk add/edit subject modal ──────────────────────────────────────────
    let bulkUncatalogueOpen = $state(false);
    let bulkSubjectOpen = $state(false);
    let bulkSubjectMode = $state<'add' | 'edit'>('add');
    let bulkSubjectId = $state<string | null>(null);
    let bulkSubjectFields = $state<SubjectField[]>([]);
    let bulkLabel = $state('');
    let bulkFieldValues = $state<Record<string, string | null>>({});
    let bulkStatus = $state<'idle' | 'saving' | 'error'>('idle');
    let bulkErrorMessage = $state<string | null>(null);
    let bulkSuccessMessage = $state<string | null>(null);

    // ── Bulk edit existing subject: per-image instance resolution ───────────
    type BulkSubjectInstance = { id: string; label: string | null; fieldValues: Record<string, string | null> };
    type BulkSubjectImage = { filePath: string; instances: BulkSubjectInstance[] };
    let bulkEditImages = $state<BulkSubjectImage[]>([]);
    let bulkEditLoading = $state(false);
    // Chosen instance id per ambiguous image's filePath; absent/'' means "skip this image".
    let bulkEditChoice = $state<Record<string, string>>({});
    let bulkEditTouchedFields = $state<Record<string, boolean>>({});
    // Accordion: at most one ambiguous image's instance picker is expanded at a time.
    let bulkEditExpandedPath = $state<string | null>(null);

    const bulkEditNoMatch = $derived(bulkEditImages.filter((i) => i.instances.length === 0));
    const bulkEditSingle = $derived(bulkEditImages.filter((i) => i.instances.length === 1));
    const bulkEditAmbiguous = $derived(bulkEditImages.filter((i) => i.instances.length > 1));
    const bulkEditResolvedInstances = $derived([
        ...bulkEditSingle.map((i) => i.instances[0]),
        ...bulkEditAmbiguous
            .map((i) => i.instances.find((inst) => inst.id === bulkEditChoice[i.filePath]))
            .filter((inst): inst is BulkSubjectInstance => !!inst)
    ]);

    function bulkEditFieldState(fieldId: string): { common: string | null; mixed: boolean } {
        if (bulkEditResolvedInstances.length === 0) return { common: null, mixed: false };
        const values = bulkEditResolvedInstances.map((r) => r.fieldValues[fieldId] ?? null);
        const mixed = !values.every((v) => v === values[0]);
        return { common: mixed ? null : values[0], mixed };
    }

    function bulkFieldDisplayValue(fieldId: string): string {
        if (bulkSubjectMode === 'edit' && !bulkEditTouchedFields[fieldId]) {
            const { common, mixed } = bulkEditFieldState(fieldId);
            return mixed ? '' : (common ?? '');
        }
        return bulkFieldValues[fieldId] ?? '';
    }

    function setBulkFieldValue(fieldId: string, value: string | null) {
        bulkFieldValues = { ...bulkFieldValues, [fieldId]: value };
        if (bulkSubjectMode === 'edit') {
            bulkEditTouchedFields = { ...bulkEditTouchedFields, [fieldId]: true };
        }
    }

    // ── Bulk add tag modal ───────────────────────────────────────────────────
    let bulkTagOpen = $state(false);
    let bulkTagStatus = $state<'idle' | 'saving' | 'error'>('idle');
    let bulkTagErrorMessage = $state<string | null>(null);

    // ── Folder thumbnail picker (admin) ──────────────────────────────────────
    let editingFolderName = $state<string | null>(null);
    const editingFolderPath = $derived(
        editingFolderName ? [...currentPath, editingFolderName].join('/') : null
    );
    const editingFolderThumbnails = $derived(
        (items.find((i) => i.type === 'dir' && i.name === editingFolderName) as (BrowseItem & { type: 'dir' }) | undefined)
            ?.thumbnails ?? []
    );

    function openFolderThumbnailPicker(name: string) {
        editingFolderName = name;
    }

    function closeFolderThumbnailPicker() {
        editingFolderName = null;
    }

    async function saveFolderThumbnails(imagePaths: string[]) {
        const folderPath = editingFolderPath;
        const name = editingFolderName;
        if (!folderPath || !name) return;
        const res = await fetch('/api/folder-thumbnails', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath, imagePaths })
        });
        if (!res.ok) return;
        items = items.map((item) =>
            item.type === 'dir' && item.name === name ? { ...item, thumbnails: imagePaths } : item
        );
        closeFolderThumbnailPicker();
    }

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
    const dirItems = $derived(
        items.filter((i): i is BrowseItem & { type: 'dir' } => i.type === 'dir')
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
        bulkTagOpen = false;
        bulkSuccessMessage = null;
        resetBulkModal();
        resetBulkTagModal();
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
    // Navigation is spatial rather than view-specific: we measure how many
    // items share the same row (1 in list view, N in grid view) and derive
    // up/down/left/right movement from that, so the same logic works for
    // both view modes without branching on `viewMode`.
    function getColumnsPerRow(): number {
        if (!listContainer) return 1;
        const cells = Array.from(listContainer.querySelectorAll<HTMLElement>('[data-kb-index]'));
        if (cells.length < 2) return 1;
        // Use getBoundingClientRect (viewport-relative) rather than offsetTop, since
        // offsetTop is relative to each element's offsetParent — grid cards wrap their
        // data-kb-index button in a `position: relative` div, which would otherwise
        // make every button report offsetTop 0 and break row detection.
        const firstTop = cells[0].getBoundingClientRect().top;
        let count = 0;
        for (const cell of cells) {
            if (Math.abs(cell.getBoundingClientRect().top - firstTop) < 1) count++;
            else break;
        }
        return Math.max(count, 1);
    }

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
        if (panelHasOverlay || bulkUncatalogueOpen || bulkSubjectOpen || bulkTagOpen) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                navigateToIndex(focusedIndex < 0 ? 0 : focusedIndex + getColumnsPerRow());
                break;
            case 'ArrowUp':
                e.preventDefault();
                navigateToIndex(focusedIndex < 0 ? items.length - 1 : focusedIndex - getColumnsPerRow());
                break;
            case 'ArrowRight':
                e.preventDefault();
                navigateToIndex(focusedIndex < 0 ? 0 : focusedIndex + 1);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                navigateToIndex(focusedIndex < 0 ? 0 : focusedIndex - 1);
                break;
            case 'Enter': {
                const focused = focusedIndex >= 0 ? items[focusedIndex] : null;
                if (focused?.type === 'dir') {
                    e.preventDefault();
                    navigateInto(focused.name);
                }
                break;
            }
            case 'Backspace':
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

    // ── Bulk add/edit subject ───────────────────────────────────────────────────
    function resetBulkSelection() {
        bulkSubjectId = null;
        bulkSubjectFields = [];
        bulkLabel = '';
        bulkFieldValues = {};
        bulkEditImages = [];
        bulkEditChoice = {};
        bulkEditExpandedPath = null;
        bulkEditTouchedFields = {};
        bulkStatus = 'idle';
        bulkErrorMessage = null;
    }

    function resetBulkModal() {
        resetBulkSelection();
        bulkSubjectMode = 'add';
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

    $effect(() => {
        const id = bulkSubjectId;
        const mode = bulkSubjectMode;
        if (mode !== 'edit' || !id || selectedPaths.size === 0) {
            bulkEditImages = [];
            return;
        }
        bulkEditLoading = true;
        bulkErrorMessage = null;
        fetch('/api/images/bulk-subjects/instances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePaths: Array.from(selectedPaths), subjectId: id })
        })
            .then(async (r) => {
                if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? 'Failed to check selected images');
                return r.json();
            })
            .then((data: BulkSubjectImage[]) => {
                bulkEditImages = data;
                bulkEditChoice = {};
                bulkEditExpandedPath = null;
                bulkEditTouchedFields = {};
            })
            .catch((err: Error) => {
                bulkEditImages = [];
                bulkErrorMessage = err.message || 'Failed to check selected images';
            })
            .finally(() => { bulkEditLoading = false; });
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

    async function bulkEditSubject() {
        const resolved = bulkEditResolvedInstances;
        if (!bulkSubjectId || resolved.length === 0 || Object.keys(bulkEditTouchedFields).length === 0) return;
        bulkStatus = 'saving';
        bulkErrorMessage = null;
        try {
            const fieldValuesToSend: Record<string, string | null> = {};
            for (const fieldId of Object.keys(bulkEditTouchedFields)) {
                fieldValuesToSend[fieldId] = bulkFieldValues[fieldId] ?? null;
            }
            const res = await fetch('/api/images/bulk-subjects', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageSubjectIds: resolved.map((i) => i.id),
                    subjectId: bulkSubjectId,
                    fieldValues: fieldValuesToSend
                })
            });
            const data = await res.json();
            if (!res.ok) {
                bulkErrorMessage = data.error ?? 'Failed to update subjects';
                bulkStatus = 'error';
                return;
            }
            const skippedAmbiguous = bulkEditAmbiguous.length - bulkEditAmbiguous.filter((i) => bulkEditChoice[i.filePath]).length;
            const skipped = bulkEditNoMatch.length + skippedAmbiguous;
            bulkSubjectOpen = false;
            resetBulkModal();
            bulkSuccessMessage = `Updated ${data.updated} ${data.updated === 1 ? 'image' : 'images'}`
                + (skipped > 0 ? ` (${skipped} skipped)` : '');
            setTimeout(() => { bulkSuccessMessage = null; }, 3000);
        } catch {
            bulkErrorMessage = 'An unexpected error occurred';
            bulkStatus = 'error';
        }
    }

    // ── Bulk add tag ─────────────────────────────────────────────────────────
    function resetBulkTagModal() {
        bulkTagStatus = 'idle';
        bulkTagErrorMessage = null;
    }

    async function bulkAddTag(tagId: string) {
        if (selectedPaths.size === 0) return;
        bulkTagStatus = 'saving';
        bulkTagErrorMessage = null;
        try {
            const res = await fetch('/api/images/bulk-tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePaths: Array.from(selectedPaths), tagId })
            });
            if (!res.ok) {
                const data = await res.json();
                bulkTagErrorMessage = data.error ?? 'Failed to add tag';
                bulkTagStatus = 'error';
                return;
            }
            const count = selectedPaths.size;
            for (const filePath of selectedPaths) {
                setCatalogued(filePath, true);
            }
            bulkTagOpen = false;
            resetBulkTagModal();
            bulkSuccessMessage = `Tag added to ${count} ${count === 1 ? 'image' : 'images'}`;
            setTimeout(() => { bulkSuccessMessage = null; }, 3000);
        } catch {
            bulkTagErrorMessage = 'An unexpected error occurred';
            bulkTagStatus = 'error';
        }
    }
</script>

{#snippet dirRow(item: BrowseItem & { type: 'dir' }, i: number)}
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
{/snippet}

{#snippet dirCard(item: BrowseItem & { type: 'dir' }, i: number)}
    <div
        class="group relative aspect-square rounded-lg overflow-hidden border transition-colors
            {focusedIndex === i ? 'border-terracotta ring-2 ring-terracotta/40' : 'border-muted hover:border-warm-gray'}"
    >
        <button
            type="button"
            data-kb-index={i}
            onclick={() => navigateInto(item.name)}
            class="block w-full h-full focus:outline-none"
        >
            {#if item.thumbnails.length > 0}
                <div class="w-full h-full grid grid-cols-2 grid-rows-2 gap-px bg-muted">
                    {#each [0, 1, 2, 3] as slot (slot)}
                        {#if item.thumbnails[slot]}
                            <LoadedImage
                                src="/api/images/file?path={encodeURIComponent(item.thumbnails[slot])}&size=thumb"
                                alt=""
                                class="w-full h-full object-cover"
                                draggable={false}
                                loading="lazy"
                            />
                        {:else}
                            <div class="w-full h-full bg-pressed"></div>
                        {/if}
                    {/each}
                </div>
            {:else}
                <div class="w-full h-full flex items-center justify-center bg-pressed">
                    <Folder class="w-8 h-8 text-terracotta" />
                </div>
            {/if}
        </button>

        {#if isAdmin}
            <button
                type="button"
                onclick={() => openFolderThumbnailPicker(item.name)}
                class="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/50 backdrop-blur-sm text-white/80 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
                aria-label="Choose folder thumbnails"
                title="Choose folder thumbnails"
            >
                <Pencil class="w-3.5 h-3.5" />
            </button>
        {/if}

        <div class="absolute bottom-0 left-0 right-0 px-1.5 pt-4 pb-1 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
            <span class="text-[11px] text-white truncate block">{item.name}</span>
        </div>
    </div>
{/snippet}

{#snippet fileRow(item: BrowseItem & { type: 'file' }, i: number)}
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
{/snippet}

{#snippet fileCard(item: BrowseItem & { type: 'file' }, i: number)}
    {@const relPath = search ? item.name : [...currentPath, item.name].join('/')}
    {@const isSelected = selectMode ? selectedPaths.has(relPath) : selectedFilePath === relPath}
    <div
        class="group relative aspect-square rounded-lg overflow-hidden border transition-colors
            {isSelected ? 'border-terracotta ring-2 ring-terracotta/40' : 'border-muted hover:border-warm-gray'}"
    >
        <button
            type="button"
            data-kb-index={i}
            onclick={(e) => handleFileClick(item, i, e)}
            class="block w-full h-full focus:outline-none"
        >
            {#if isImageFile(item.name)}
                <LoadedImage
                    src="/api/images/file?path={encodeURIComponent(relPath)}&size=thumb"
                    alt={item.name}
                    class="w-full h-full object-cover"
                    draggable={false}
                    loading="lazy"
                />
            {:else}
                <div class="w-full h-full flex items-center justify-center bg-pressed">
                    <File class="w-8 h-8 text-warm-gray" />
                </div>
            {/if}
        </button>

        {#if selectMode}
            <div class="absolute top-1.5 left-1.5 pointer-events-none">
                {#if isSelected}
                    <CheckSquare class="w-5 h-5 text-terracotta drop-shadow" />
                {:else}
                    <Square class="w-5 h-5 text-white drop-shadow" />
                {/if}
            </div>
        {/if}

        {#if item.catalogued}
            <span class="absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5 bg-terracotta-tint text-terracotta rounded-full font-medium">
                Catalogued
            </span>
        {/if}

        <div class="absolute bottom-0 left-0 right-0 px-1.5 pt-4 pb-1 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
            <span class="text-[11px] text-white truncate block">{item.name}</span>
        </div>

        {#if item.catalogued && !selectMode && item.imageId}
            <button
                type="button"
                onclick={() => toggleLikeById(item.imageId!, relPath)}
                class="absolute bottom-1 right-1 p-1 rounded-md bg-black/50 backdrop-blur-sm transition-opacity
                    {item.liked ? 'opacity-100 text-terracotta' : 'text-white/80 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100'}"
                aria-label={item.liked ? 'Unlike' : 'Like'}
            >
                <Heart class="w-3.5 h-3.5 {item.liked ? 'fill-current' : ''}" />
            </button>
        {/if}
    </div>
{/snippet}

<div class="p-4 flex flex-col gap-4 h-[calc(100vh-var(--header-height))]">
    <MissingFilesBanner />

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
            {selectedFilePath && !selectMode ? 'hidden lg:flex lg:flex-1' : selectMode ? 'flex flex-1 lg:flex-1' : 'flex flex-1'}
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
                <div class="flex items-center gap-0.5 shrink-0 border border-muted rounded-lg p-0.5">
                    <button
                        type="button"
                        onclick={() => setViewMode('grid')}
                        class="p-1 rounded-md transition-colors {viewMode === 'grid' ? 'bg-terracotta-tint text-terracotta' : 'text-warm-gray hover:text-ink hover:bg-pressed'}"
                        aria-label="Grid view"
                        aria-pressed={viewMode === 'grid'}
                    >
                        <LayoutGrid class="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onclick={() => setViewMode('list')}
                        class="p-1 rounded-md transition-colors {viewMode === 'list' ? 'bg-terracotta-tint text-terracotta' : 'text-warm-gray hover:text-ink hover:bg-pressed'}"
                        aria-label="List view"
                        aria-pressed={viewMode === 'list'}
                    >
                        <List class="w-4 h-4" />
                    </button>
                </div>
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
                    {#if viewMode === 'grid'}
                        <div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
                            {#each Array(6) as _, i (i)}
                                <div class="aspect-square bg-pressed rounded-lg animate-pulse" style="opacity: {1 - i * 0.12}"></div>
                            {/each}
                        </div>
                    {:else}
                        <div class="flex flex-col divide-y divide-muted">
                            {#each Array(6) as _, i (i)}
                                <div class="flex items-center gap-3 py-3 px-2 animate-pulse">
                                    <div class="w-5 h-5 bg-pressed rounded shrink-0"></div>
                                    <div class="h-4 bg-pressed rounded" style="width: {48 + (i * 13) % 40}%"></div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                {:else if fetchError}
                    <p class="text-warm-gray text-center py-8">{fetchError}</p>
                {:else if items.length === 0}
                    <p class="text-warm-gray text-center py-8">No items found</p>
                {:else if viewMode === 'list'}
                    <div class="flex flex-col divide-y divide-muted">
                        {#each items as item, i (item.name)}
                            {#if item.type === 'dir'}
                                {@render dirRow(item, i)}
                            {:else}
                                {@render fileRow(item, i)}
                            {/if}
                        {/each}
                    </div>
                {:else}
                    <div class="flex flex-col gap-4">
                        {#if dirItems.length > 0}
                            <div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
                                {#each dirItems as item (item.name)}
                                    {@const i = items.indexOf(item)}
                                    {@render dirCard(item, i)}
                                {/each}
                            </div>
                        {/if}
                        {#if fileItems.length > 0}
                            <div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
                                {#each fileItems as item (item.name)}
                                    {@const i = items.indexOf(item)}
                                    {@render fileCard(item, i)}
                                {/each}
                            </div>
                        {/if}
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
                        <div class="flex gap-2 self-start">
                            <button
                                type="button"
                                onclick={() => { resetBulkModal(); bulkSubjectOpen = true; }}
                                class="btn btn-primary flex items-center gap-2"
                            >
                                <Plus class="w-4 h-4" />
                                Subjects
                            </button>
                            <button
                                type="button"
                                onclick={() => { resetBulkTagModal(); bulkTagOpen = true; }}
                                class="btn btn-primary flex items-center gap-2"
                            >
                                <Plus class="w-4 h-4" />
                                Add Tag
                            </button>
                        </div>
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
                        <LoadedImage
                            src="/api/images/file?path={encodeURIComponent(selectedFilePath)}&size=preview"
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
            Subjects
        </button>
        <button
            type="button"
            onclick={() => { resetBulkTagModal(); bulkTagOpen = true; }}
            class="btn btn-primary flex items-center gap-2"
        >
            <Plus class="w-4 h-4" />
            Tag
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
    title={bulkSubjectMode === 'add'
        ? `Add subject to ${selectedPaths.size} ${selectedPaths.size === 1 ? 'image' : 'images'}`
        : `Edit subject on ${selectedPaths.size} ${selectedPaths.size === 1 ? 'image' : 'images'}`}
    onclose={resetBulkModal}
>
    {#if !bulkSubjectId}
        <div class="flex flex-col gap-3">
            <div class="flex gap-1 border-b border-muted">
                <button
                    type="button"
                    onclick={() => { bulkSubjectMode = 'add'; }}
                    class="px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors {bulkSubjectMode === 'add' ? 'border-terracotta text-ink' : 'border-transparent text-warm-gray hover:text-ink'}"
                >
                    Add new
                </button>
                <button
                    type="button"
                    onclick={() => { bulkSubjectMode = 'edit'; }}
                    class="px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors {bulkSubjectMode === 'edit' ? 'border-terracotta text-ink' : 'border-transparent text-warm-gray hover:text-ink'}"
                >
                    Edit existing
                </button>
            </div>
            <p class="text-sm text-warm-gray">
                {bulkSubjectMode === 'add'
                    ? 'Choose a subject to add to all selected images:'
                    : 'Choose a subject to edit on images that already have it:'}
            </p>
            <ItemPickerList
                items={allSubjects}
                onSelect={(id) => { bulkSubjectId = id; }}
                emptyMessage="No subjects defined yet."
                searchPlaceholder="Search subjects…"
                variant="list"
            />
        </div>
        <div class="flex justify-end mt-4">
            <button type="button" onclick={() => { bulkSubjectOpen = false; }} class="btn">Cancel</button>
        </div>
    {:else}
        <div class="flex flex-col gap-3">
            <div class="flex items-center gap-2">
                <button
                    type="button"
                    onclick={resetBulkSelection}
                    class="flex items-center gap-1 text-xs text-warm-gray hover:text-ink transition-colors shrink-0"
                >
                    <ArrowLeft class="w-3 h-3" />
                    Back
                </button>
                <span class="text-xs font-medium text-warm-gray bg-canvas border border-muted rounded px-1.5 py-0.5">
                    {allSubjects.find((s) => s.id === bulkSubjectId)?.name}
                </span>
            </div>

            <!-- One clean outer scroll region for everything below, rather than
                 nested scrollable sub-boxes — same approach as MissingFilesModal. -->
            <div class="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
            {#if bulkSubjectMode === 'add'}
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
            {:else if bulkEditLoading}
                <p class="text-sm text-warm-gray py-2">Checking selected images…</p>
            {:else}
                {#if bulkEditNoMatch.length > 0}
                    <p class="text-xs text-warm-gray">
                        {bulkEditNoMatch.length} {bulkEditNoMatch.length === 1 ? 'image isn\u2019t catalogued or doesn\u2019t have' : 'images aren\u2019t catalogued or don\u2019t have'} this subject, and will be skipped.
                    </p>
                {/if}

                {#if bulkEditAmbiguous.length > 0}
                    {@const ambiguousSubjectName = allSubjects.find((s) => s.id === bulkSubjectId)?.name ?? 'Subject'}
                    <div class="flex flex-col gap-2 border border-muted rounded-lg p-2">
                        <p class="text-xs font-medium text-warm-gray">
                            {bulkEditAmbiguous.length} {bulkEditAmbiguous.length === 1 ? 'image has' : 'images have'} multiple instances of this subject — choose which one to edit:
                        </p>
                        <div class="flex flex-col gap-2">
                            {#each bulkEditAmbiguous as image (image.filePath)}
                                {@const chosenId = bulkEditChoice[image.filePath] ?? ''}
                                {@const chosenIndex = image.instances.findIndex((inst) => inst.id === chosenId)}
                                {@const chosenInstance = chosenIndex === -1 ? null : image.instances[chosenIndex]}
                                {@const isExpanded = bulkEditExpandedPath === image.filePath}
                                <div class="rounded-lg border border-muted overflow-hidden">
                                    <button
                                        type="button"
                                        onclick={() => { bulkEditExpandedPath = isExpanded ? null : image.filePath; }}
                                        class="flex items-center gap-2 w-full py-2 px-2.5 bg-pressed text-left"
                                    >
                                        {#if isExpanded}
                                            <ChevronDown class="w-3.5 h-3.5 text-warm-gray shrink-0" />
                                        {:else}
                                            <ChevronRight class="w-3.5 h-3.5 text-warm-gray shrink-0" />
                                        {/if}
                                        <span class="text-xs text-ink truncate flex-1 min-w-0">{image.filePath.split('/').pop()}</span>
                                        <span class="text-xs shrink-0 {chosenInstance ? 'text-terracotta font-medium' : 'text-warm-gray'}">
                                            {chosenInstance
                                                ? `${ambiguousSubjectName} #${chosenIndex + 1}${chosenInstance.label ? ` — ${chosenInstance.label}` : ''}`
                                                : 'Skipped'}
                                        </span>
                                    </button>
                                    {#if isExpanded}
                                        <div class="flex flex-col gap-1 p-2">
                                            {#each image.instances as instance, i (instance.id)}
                                                {@const selected = chosenId === instance.id}
                                                <button
                                                    type="button"
                                                    onclick={() => { bulkEditChoice = { ...bulkEditChoice, [image.filePath]: instance.id }; }}
                                                    class="text-left rounded-lg border px-2 py-1.5 transition-colors
                                                        {selected ? 'border-terracotta bg-terracotta-tint' : 'border-muted hover:bg-pressed'}"
                                                >
                                                    <!-- "#{i + 1}" matches the ordinal shown for this same instance in the
                                                         per-image detail panel (both are ordered by imageSubjects.id asc server-side) -->
                                                    <span class="text-xs font-medium text-ink">
                                                        {ambiguousSubjectName} #{i + 1}{instance.label ? ` — ${instance.label}` : ''}
                                                    </span>
                                                    {#if bulkSubjectFields.length > 0}
                                                        <div class="flex flex-wrap gap-1 mt-1">
                                                            {#each bulkSubjectFields as field (field.id)}
                                                                <span class="text-[10px] px-1.5 py-0.5 bg-canvas border border-muted rounded text-warm-gray">
                                                                    {field.name}: {instance.fieldValues[field.id] ?? '—'}
                                                                </span>
                                                            {/each}
                                                        </div>
                                                    {/if}
                                                </button>
                                            {/each}
                                            <button
                                                type="button"
                                                onclick={() => { bulkEditChoice = { ...bulkEditChoice, [image.filePath]: '' }; }}
                                                class="text-left rounded-lg border px-2 py-1.5 text-xs transition-colors
                                                    {chosenId === '' ? 'border-terracotta bg-terracotta-tint text-ink' : 'border-muted text-warm-gray hover:bg-pressed'}"
                                            >
                                                Skip this image
                                            </button>
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if bulkEditResolvedInstances.length === 0}
                    <p class="text-sm text-warm-gray py-2">No images are eligible to edit yet.</p>
                {/if}
            {/if}

            {#if bulkSubjectMode === 'add' || (!bulkEditLoading && bulkEditResolvedInstances.length > 0)}
                {#each bulkSubjectFields as field (field.id)}
                    {@const mixed = bulkSubjectMode === 'edit' && !bulkEditTouchedFields[field.id] && bulkEditFieldState(field.id).mixed}
                    <div class="flex flex-col gap-1">
                        <label for="bulk-field-{field.id}" class="text-xs font-medium text-warm-gray flex items-center gap-1">
                            {field.name}
                            {#if field.required}<span class="text-terracotta">*</span>{/if}
                            {#if mixed}<span class="text-warm-gray font-normal italic">(Mixed)</span>{/if}
                        </label>
                        {#if field.type === 'boolean'}
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input
                                    id="bulk-field-{field.id}"
                                    type="checkbox"
                                    checked={bulkFieldDisplayValue(field.id) === 'true'}
                                    onchange={(e) => { setBulkFieldValue(field.id, e.currentTarget.checked ? 'true' : 'false'); }}
                                    class="rounded border-muted"
                                />
                                <span class="text-sm text-ink">Yes</span>
                            </label>
                        {:else if field.type === 'select'}
                            <select
                                id="bulk-field-{field.id}"
                                value={bulkFieldDisplayValue(field.id)}
                                onchange={(e) => { setBulkFieldValue(field.id, e.currentTarget.value || null); }}
                                class="rounded-lg border-muted text-sm w-full"
                            >
                                <option value="">{mixed ? '— Mixed —' : '— Select —'}</option>
                                {#each field.options ?? [] as option (option)}
                                    <option value={option}>{option}</option>
                                {/each}
                            </select>
                        {:else if field.type === 'number'}
                            <input
                                id="bulk-field-{field.id}"
                                type="number"
                                value={bulkFieldDisplayValue(field.id)}
                                oninput={(e) => { setBulkFieldValue(field.id, e.currentTarget.value || null); }}
                                placeholder={mixed ? '(Mixed)' : 'Enter number…'}
                                class="rounded-lg border-muted text-sm w-full"
                            />
                        {:else}
                            <input
                                id="bulk-field-{field.id}"
                                type="text"
                                value={bulkFieldDisplayValue(field.id)}
                                oninput={(e) => { setBulkFieldValue(field.id, e.currentTarget.value || null); }}
                                placeholder={mixed ? '(Mixed)' : 'Enter text…'}
                                class="rounded-lg border-muted text-sm w-full"
                            />
                        {/if}
                    </div>
                {/each}
            {/if}

            {#if bulkErrorMessage}
                <p class="text-sm text-red-600">{bulkErrorMessage}</p>
            {/if}
            </div>
        </div>

        <div class="flex justify-end gap-2 mt-4">
            <button
                type="button"
                onclick={() => { bulkSubjectOpen = false; resetBulkModal(); }}
                class="btn"
            >
                Cancel
            </button>
            {#if bulkSubjectMode === 'add'}
                <button
                    type="button"
                    onclick={bulkAddSubject}
                    disabled={bulkStatus === 'saving'}
                    class="btn btn-primary"
                >
                    {bulkStatus === 'saving' ? 'Adding…' : `Add to ${selectedPaths.size} ${selectedPaths.size === 1 ? 'image' : 'images'}`}
                </button>
            {:else}
                <button
                    type="button"
                    onclick={bulkEditSubject}
                    disabled={bulkStatus === 'saving' || bulkEditResolvedInstances.length === 0 || Object.keys(bulkEditTouchedFields).length === 0}
                    class="btn btn-primary"
                >
                    {bulkStatus === 'saving' ? 'Updating…' : `Update ${bulkEditResolvedInstances.length} ${bulkEditResolvedInstances.length === 1 ? 'image' : 'images'}`}
                </button>
            {/if}
        </div>
    {/if}
</Modal>

<Modal
    bind:open={bulkTagOpen}
    title="Add tag to {selectedPaths.size} {selectedPaths.size === 1 ? 'image' : 'images'}"
    onclose={resetBulkTagModal}
>
    <div class="flex flex-col gap-3">
        <p class="text-sm text-warm-gray">Choose a tag to add to all selected images:</p>
        <div class="{bulkTagStatus === 'saving' ? 'opacity-60 pointer-events-none' : ''}">
            <ItemPickerList
                items={allTags}
                onSelect={bulkAddTag}
                emptyMessage="No tags defined yet."
                searchPlaceholder="Search tags…"
                variant="list"
            />
        </div>
        {#if bulkTagStatus === 'saving'}
            <p class="text-sm text-warm-gray">Adding…</p>
        {/if}
        {#if bulkTagErrorMessage}
            <p class="text-sm text-red-600">{bulkTagErrorMessage}</p>
        {/if}
    </div>
    <div class="flex justify-end mt-4">
        <button type="button" onclick={() => { bulkTagOpen = false; }} class="btn">Cancel</button>
    </div>
</Modal>

{#if editingFolderName && editingFolderPath}
    <Modal open={true} title="Choose folder thumbnails" onclose={closeFolderThumbnailPicker} maxWidth="max-w-xl">
        <FolderThumbnailPicker
            folderPath={editingFolderPath}
            folderName={editingFolderName}
            initialSelection={editingFolderThumbnails}
            onSave={saveFolderThumbnails}
            onCancel={closeFolderThumbnailPicker}
        />
    </Modal>
{/if}