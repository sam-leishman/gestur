<script lang="ts">
    import { Heart } from 'lucide-svelte';
    import type { Snippet } from 'svelte';
    import type { SessionImage } from '$lib/types';

    let {
        stoppedEarly,
        targetCount,
        drawnImages,
        skippedImages,
        likedIds,
        onToggleLike,
        onSelectImage,
        headerActions,
        banner
    }: {
        stoppedEarly: boolean;
        targetCount: number;
        drawnImages: SessionImage[];
        skippedImages: SessionImage[];
        likedIds: Set<string>;
        onToggleLike: (imageId: string) => void;
        onSelectImage: (image: SessionImage) => void;
        headerActions?: Snippet;
        banner?: Snippet;
    } = $props();
</script>

{#snippet thumbGrid(imgs: SessionImage[])}
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {#each imgs as img, i (i)}
            {@const isLiked = likedIds.has(img.id)}
            <div class="group relative aspect-square overflow-hidden rounded-lg bg-white/5">
                <button
                    type="button"
                    onclick={() => onSelectImage(img)}
                    class="w-full h-full hover:ring-2 hover:ring-white/30 transition-all focus-visible:ring-2 focus-visible:ring-white/30"
                    title={img.filePath.split('/').pop()}
                >
                    <img
                        src="/api/images/file?path={encodeURIComponent(img.filePath)}"
                        alt=""
                        class="w-full h-full object-cover"
                        draggable="false"
                    />
                </button>
                <button
                    type="button"
                    onclick={() => onToggleLike(img.id)}
                    class="absolute bottom-1.5 right-1.5 p-1 rounded-md bg-black/50 backdrop-blur-sm transition-opacity
                        {isLiked ? 'opacity-100 text-terracotta' : 'text-white/80 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100'}"
                    aria-label={isLiked ? 'Unlike' : 'Like'}
                >
                    <Heart class="w-3.5 h-3.5 {isLiked ? 'fill-current' : ''}" />
                </button>
            </div>
        {/each}
    </div>
{/snippet}

<div class="flex-1 flex flex-col min-h-0 overflow-hidden">
    <!-- Header -->
    <div class="flex items-start justify-between px-6 pt-6 pb-4 shrink-0">
        <div>
            <p class="text-white text-2xl font-semibold">{stoppedEarly ? 'Session stopped' : 'Session complete'}</p>
            <p class="text-white/60 text-sm mt-0.5">
                {#if stoppedEarly}
                    {drawnImages.length} of {targetCount} image{targetCount !== 1 ? 's' : ''} drawn
                {:else}
                    {drawnImages.length} image{drawnImages.length !== 1 ? 's' : ''} drawn
                {/if}
                {#if skippedImages.length > 0}
                    · {skippedImages.length} skipped
                {/if}
            </p>
        </div>
        {#if headerActions}{@render headerActions()}{/if}
    </div>

    {#if banner}{@render banner()}{/if}

    <!-- Thumbnail sections -->
    <div class="flex-1 overflow-y-auto px-6 pb-6 flex flex-col gap-6">
        {#if drawnImages.length === 0 && skippedImages.length === 0}
            <p class="text-white/50 text-sm">No images in this session.</p>
        {:else}
            {#if drawnImages.length > 0}
                <div>
                    <h3 class="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">
                        Drawn ({drawnImages.length})
                    </h3>
                    {@render thumbGrid(drawnImages)}
                </div>
            {/if}
            {#if skippedImages.length > 0}
                <div>
                    <h3 class="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">
                        Skipped ({skippedImages.length})
                    </h3>
                    {@render thumbGrid(skippedImages)}
                </div>
            {/if}
        {/if}
    </div>
</div>
