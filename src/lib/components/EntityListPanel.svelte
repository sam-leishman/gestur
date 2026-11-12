<script lang="ts">
    // Shared "named catalogue entity" list panel (create/rename/delete via a
    // name-only modal) — used for both the Subjects and Tags lists on /data.
    import { Plus, Pencil, Trash2, ChevronRight, Search } from 'lucide-svelte';
    import Modal from '$lib/components/Modal.svelte';

    type Entity = { id: string; name: string };

    let {
        title,
        apiBase,
        singularLabel,
        namePlaceholder = `e.g. ${singularLabel}…`,
        selectedId = $bindable(null),
        onSelect = undefined
    }: {
        title: string;
        apiBase: string;
        singularLabel: string;
        namePlaceholder?: string;
        selectedId?: string | null;
        onSelect?: (item: Entity) => void;
    } = $props();

    let items = $state<Entity[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    let modalOpen = $state(false);
    let modalEdit = $state<Entity | null>(null);
    let nameValue = $state('');
    let saving = $state(false);
    let modalError = $state<string | null>(null);

    let deletingId = $state<string | null>(null);
    let query = $state('');

    const showSearch = $derived(items.length > 0);
    const filteredItems = $derived(
        query.trim()
            ? items.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
            : items
    );

    $effect(() => {
        load();
    });

    async function load() {
        loading = true;
        error = null;
        try {
            const res = await fetch(apiBase);
            if (!res.ok) throw new Error();
            items = await res.json();
        } catch {
            error = `Failed to load ${singularLabel.toLowerCase()}s.`;
        } finally {
            loading = false;
        }
    }

    function openCreate() {
        modalEdit = null;
        nameValue = '';
        modalError = null;
        modalOpen = true;
    }

    function openEdit(item: Entity, e: MouseEvent) {
        e.stopPropagation();
        modalEdit = item;
        nameValue = item.name;
        modalError = null;
        modalOpen = true;
    }

    async function save() {
        saving = true;
        modalError = null;
        try {
            const url = modalEdit ? `${apiBase}/${modalEdit.id}` : apiBase;
            const res = await fetch(url, {
                method: modalEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: nameValue })
            });
            if (!res.ok) {
                const err = await res.json();
                modalError = err.error ?? 'Failed to save.';
                return;
            }
            const result: Entity = await res.json();
            if (modalEdit) {
                items = items.map((i) => (i.id === result.id ? result : i)).sort((a, b) => a.name.localeCompare(b.name));
            } else {
                items = [...items, result].sort((a, b) => a.name.localeCompare(b.name));
            }
            modalOpen = false;
        } finally {
            saving = false;
        }
    }

    function confirmDelete(id: string, e: MouseEvent) {
        e.stopPropagation();
        if (deletingId === id) {
            doDelete(id);
        } else {
            deletingId = id;
        }
    }

    async function doDelete(id: string) {
        const res = await fetch(`${apiBase}/${id}`, { method: 'DELETE' });
        if (!res.ok) return;
        items = items.filter((i) => i.id !== id);
        if (selectedId === id) selectedId = null;
        deletingId = null;
    }

    function select(item: Entity) {
        if (!onSelect) return;
        selectedId = item.id;
        deletingId = null;
        onSelect(item);
    }
</script>

<Modal bind:open={modalOpen} title={modalEdit ? `Edit ${singularLabel}` : `New ${singularLabel}`}>
    <form onsubmit={(e) => { e.preventDefault(); save(); }} class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
            <label for="entity-name-{apiBase}" class="text-sm font-medium text-warm-gray">Name</label>
            <input
                id="entity-name-{apiBase}"
                type="text"
                bind:value={nameValue}
                placeholder={namePlaceholder}
                class="rounded-lg border-muted w-full"
                required
            />
        </div>
        {#if modalError}
            <p class="text-sm text-red-600">{modalError}</p>
        {/if}
        <div class="flex justify-end gap-2">
            <button type="button" onclick={() => (modalOpen = false)} class="btn btn-terracotta-tint text-ink">
                Cancel
            </button>
            <button type="submit" disabled={saving || !nameValue.trim()} class="btn btn-primary">
                {saving ? 'Saving…' : 'Save'}
            </button>
        </div>
    </form>
</Modal>

<div class="flex flex-col gap-3 w-64 shrink-0 bg-canvas border border-muted rounded-lg p-4 min-h-0">
    <div class="flex items-center justify-between">
        <h2 class="font-semibold text-ink">{title}</h2>
        <button type="button" onclick={openCreate} class="btn btn-primary p-1.5" aria-label="New {singularLabel.toLowerCase()}">
            <Plus class="w-4 h-4" />
        </button>
    </div>

    {#if showSearch}
        <div class="relative shrink-0">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-gray pointer-events-none" />
            <input
                type="text"
                bind:value={query}
                placeholder="Search {singularLabel.toLowerCase()}s…"
                class="w-full rounded-lg border-muted pl-9"
            />
        </div>
    {/if}

    <div class="flex-1 overflow-y-auto min-h-0 flex flex-col gap-1">
        {#if loading}
            {#each Array(4) as _, i (i)}
                <div class="h-10 bg-pressed rounded-lg animate-pulse" style="opacity: {1 - i * 0.15}"></div>
            {/each}
        {:else if error}
            <p class="text-sm text-warm-gray text-center py-4">{error}</p>
        {:else if items.length === 0}
            <p class="text-sm text-warm-gray text-center py-4">No {singularLabel.toLowerCase()}s yet</p>
        {:else if filteredItems.length === 0}
            <p class="text-sm text-warm-gray text-center py-4">No matches for "{query.trim()}"</p>
        {:else}
            {#each filteredItems as item (item.id)}
                <div
                    class="group flex items-center gap-1 rounded-lg px-2 py-2 transition-colors
                        {onSelect ? 'cursor-pointer' : ''}
                        {selectedId === item.id
                            ? 'bg-terracotta-tint border border-terracotta/30'
                            : 'hover:bg-pressed'}"
                    onclick={() => select(item)}
                    onkeydown={(e) => e.key === 'Enter' && select(item)}
                    role={onSelect ? 'button' : undefined}
                    tabindex={onSelect ? 0 : undefined}
                    aria-pressed={onSelect ? selectedId === item.id : undefined}
                >
                    <span class="flex-1 text-sm text-ink truncate">{item.name}</span>
                    <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                            type="button"
                            onclick={(e) => openEdit(item, e)}
                            class="p-1 text-warm-gray hover:text-ink transition-colors rounded"
                            aria-label="Edit {singularLabel.toLowerCase()}"
                        >
                            <Pencil class="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onclick={(e) => confirmDelete(item.id, e)}
                            class="p-1 rounded transition-colors {deletingId === item.id ? 'text-red-600 bg-red-50' : 'text-warm-gray hover:text-red-600'}"
                            title={deletingId === item.id ? 'Click again to confirm' : `Delete ${singularLabel.toLowerCase()}`}
                            aria-label="Delete {singularLabel.toLowerCase()}"
                        >
                            <Trash2 class="w-3.5 h-3.5" />
                        </button>
                    </div>
                    {#if onSelect}
                        <ChevronRight class="w-3.5 h-3.5 text-muted shrink-0 {selectedId === item.id ? 'opacity-100' : 'opacity-0'}" />
                    {/if}
                </div>
            {/each}
        {/if}
    </div>
</div>
