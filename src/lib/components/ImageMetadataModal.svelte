<script lang="ts">
    import Modal from '$lib/components/Modal.svelte';
    import ImageDetailPanel from '$lib/components/ImageDetailPanel.svelte';
    import type { SessionImage } from '$lib/types';

    let {
        open = $bindable(false),
        image,
        onLikeChange
    }: {
        open: boolean;
        image: SessionImage | null;
        onLikeChange?: (imageId: string, liked: boolean) => void;
    } = $props();

    let displayTitle = $state('');
    const fileName = $derived(image?.filePath.split('/').pop() ?? '');
</script>

<Modal bind:open title={displayTitle || fileName} maxWidth="max-w-3xl">
    <div class="flex flex-col md:flex-row gap-5">
        <!-- Image preview -->
        <div class="md:w-72 md:shrink-0 flex items-center justify-center bg-pressed rounded-lg overflow-hidden h-52 md:h-80">
            {#if image}
                <img
                    src="/api/images/file?path={encodeURIComponent(image.filePath)}"
                    alt={fileName}
                    class="max-w-full max-h-full object-contain"
                />
            {/if}
        </div>

        <!-- Metadata panel -->
        <div class="flex-1 flex flex-col overflow-y-auto md:max-h-80">
            <ImageDetailPanel
                filePath={open ? (image?.filePath ?? null) : null}
                bind:displayTitle
                {onLikeChange}
            />
        </div>
    </div>
</Modal>
