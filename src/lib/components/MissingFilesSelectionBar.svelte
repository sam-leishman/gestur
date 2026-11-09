<script lang="ts">
    import { Trash2 } from 'lucide-svelte';

    let {
        selectedCount,
        allSelected,
        onSelectAll,
        onDeselectAll,
        onDeleteSelected
    }: {
        selectedCount: number;
        allSelected: boolean;
        onSelectAll: () => void;
        onDeselectAll: () => void;
        onDeleteSelected: () => void;
    } = $props();

    // Two-click confirm, matching the per-row delete convention elsewhere in
    // this feature — re-arms whenever the selection changes so a stale
    // "click again" state can't linger across a different set of items.
    let confirming = $state(false);

    $effect(() => {
        if (selectedCount) confirming = false;
    });

    function handleDeleteClick() {
        if (!confirming) {
            confirming = true;
            return;
        }
        confirming = false;
        onDeleteSelected();
    }
</script>

<div class="flex items-center gap-3 px-1 shrink-0">
    <span class="text-sm font-medium text-ink flex-1">
        {selectedCount} selected
    </span>
    <button
        type="button"
        onclick={allSelected ? onDeselectAll : onSelectAll}
        class="text-xs text-warm-gray hover:text-ink transition-colors"
    >
        {allSelected ? 'Deselect all' : 'Select all'}
    </button>
    <button
        type="button"
        onclick={handleDeleteClick}
        class="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors
            {confirming
                ? 'border-red-300 bg-red-50 text-red-600'
                : 'border-muted text-warm-gray hover:text-red-600 hover:border-red-300'}"
    >
        <Trash2 class="w-3.5 h-3.5" />
        {confirming ? 'Click again to confirm' : `Delete ${selectedCount}`}
    </button>
</div>
