<script lang="ts">
    import { ImageOff } from 'lucide-svelte';
    import MissingFilesModal from '$lib/components/MissingFilesModal.svelte';
    import { fetchMissingImages } from '$lib/utils/missingFiles';

    let count = $state(0);
    let modalOpen = $state(false);

    $effect(() => {
        fetchMissingImages().then((images) => { count = images.length; });
    });
</script>

{#if count > 0}
    <div class="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-terracotta-tint border border-terracotta/30">
        <ImageOff class="w-4 h-4 text-terracotta shrink-0" />
        <p class="text-sm text-ink flex-1">
            {count} catalogued {count === 1 ? 'image' : 'images'} can't find {count === 1 ? 'its' : 'their'} file{count === 1 ? '' : 's'}
        </p>
        <button
            type="button"
            onclick={() => (modalOpen = true)}
            class="btn btn-terracotta-tint text-sm py-1 px-3 shrink-0"
        >
            Review
        </button>
    </div>
{/if}

<MissingFilesModal bind:open={modalOpen} onCountChange={(n) => (count = n)} />
