<script lang="ts">
    import { CheckSquare, Folder, Square } from 'lucide-svelte';
    import Modal from '$lib/components/Modal.svelte';
    import type { SessionDirectoryOption } from '$lib/types';

    // `selected` empty is the ONLY representation of "all directories" (no
    // restriction). To keep that representation canonical — and avoid ever
    // showing an "all boxes checked" state as an explicit comma-separated
    // list — every mutation below collapses back to `[]` whenever the
    // resulting set covers every available option. Unchecking the last
    // remaining explicit selection is a no-op, since an empty array is
    // reserved for "all" and can't also mean "none".
    let { selected = $bindable([]) }: { selected: string[] } = $props();

    let options = $state<SessionDirectoryOption[]>([]);
    let loading = $state(true);
    let modalOpen = $state(false);

    $effect(() => {
        fetch('/api/images/session/directories')
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then((data: { directories: SessionDirectoryOption[] }) => {
                options = data.directories;
            })
            .catch(() => {})
            .finally(() => {
                loading = false;
            });
    });

    function toggle(key: string) {
        const isAllSelected = selected.length === 0;
        const currentlySelected = isAllSelected ? options.map((o) => o.key) : selected;
        const isChecked = currentlySelected.includes(key);

        // The last remaining checked box can't be unchecked — an empty array
        // is reserved to mean "all", not "none".
        if (isChecked && currentlySelected.length === 1) return;

        const next = isChecked ? currentlySelected.filter((k) => k !== key) : [...currentlySelected, key];
        selected = next.length === options.length ? [] : next;
    }

    function selectAll() {
        selected = [];
    }

    const summary = $derived(
        selected.length === 0
            ? 'All directories'
            : selected
                    .map((key) => options.find((o) => o.key === key)?.label ?? key)
                    .slice(0, 2)
                    .join(', ') + (selected.length > 2 ? ` +${selected.length - 2}` : '')
    );
</script>

<button
    type="button"
    onclick={() => (modalOpen = true)}
    class="flex items-center gap-2 rounded-lg border border-muted px-3 py-2 text-sm text-ink hover:border-warm-gray transition-colors w-full text-left"
>
    <Folder class="w-4 h-4 text-terracotta shrink-0" />
    <span class="flex-1 truncate">{summary}</span>
</button>

<Modal bind:open={modalOpen} title="Select directories" maxWidth="max-w-sm">
    {#if loading}
        <p class="text-sm text-warm-gray py-4 text-center">Loading directories…</p>
    {:else if options.length === 0}
        <p class="text-sm text-warm-gray py-4 text-center">No catalogued directories found.</p>
    {:else}
        <div class="flex gap-2 text-sm">
            <button type="button" onclick={selectAll} class="btn btn-terracotta-tint text-xs">
                Select all
            </button>
        </div>
        <div class="flex flex-col divide-y divide-muted max-h-72 overflow-y-auto -mx-2">
            {#each options as option (option.key)}
                {@const checked = selected.length === 0 || selected.includes(option.key)}
                <button
                    type="button"
                    onclick={() => toggle(option.key)}
                    class="flex items-center gap-3 py-2 px-2 text-left hover:bg-pressed transition-colors"
                >
                    {#if checked}
                        <CheckSquare class="w-4 h-4 text-terracotta shrink-0" />
                    {:else}
                        <Square class="w-4 h-4 text-warm-gray shrink-0" />
                    {/if}
                    <span class="flex-1 truncate text-sm text-ink">{option.label}</span>
                    <span class="text-xs text-warm-gray shrink-0">{option.count}</span>
                </button>
            {/each}
        </div>
        <button type="button" onclick={() => (modalOpen = false)} class="btn btn-primary w-full">
            Done
        </button>
    {/if}
</Modal>
