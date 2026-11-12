<script lang="ts">
    import { Plus } from 'lucide-svelte';
    import ItemPickerList from '$lib/components/ItemPickerList.svelte';

    type Item = { id: string; name: string };

    let {
        items,
        onSelect,
        open = $bindable(false),
        label = 'Add',
        emptyMessage = 'No items available',
        searchPlaceholder = 'Search…',
        disabled = false
    }: {
        items: Item[];
        onSelect: (id: string) => void;
        open?: boolean;
        label?: string;
        emptyMessage?: string;
        searchPlaceholder?: string;
        disabled?: boolean;
    } = $props();

    function select(id: string) {
        open = false;
        onSelect(id);
    }
</script>

<div class="relative">
    <button
        type="button"
        onclick={() => { open = !open; }}
        class="btn btn-primary flex items-center gap-1 text-sm py-1.5 px-3"
        {disabled}
    >
        <Plus class="w-3.5 h-3.5" />
        {label}
    </button>
    {#if open}
        <div
            class="fixed inset-0 z-10"
            onclick={() => { open = false; }}
            aria-hidden="true"
        ></div>
        <div class="absolute right-0 z-20 mt-1 w-60 bg-canvas border border-muted rounded-lg shadow-lg overflow-hidden">
            <ItemPickerList {items} onSelect={select} {emptyMessage} {searchPlaceholder} variant="dropdown" />
        </div>
    {/if}
</div>
