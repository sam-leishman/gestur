<script lang="ts">
    import { onMount } from 'svelte';
    import { ChartNoAxesColumn, Pencil, SkipForward, Heart, Eye } from 'lucide-svelte';
    import ImageMetadataModal from '$lib/components/ImageMetadataModal.svelte';
    import type { SessionImage } from '$lib/types';

    type StatsImage = { imageId: string; filePath: string; drawCount?: number; skipCount?: number };
    type StatsData = {
        totalDraws: number;
        totalSkips: number;
        totalLiked: number;
        totalSeen: number;
        mostDrawn: StatsImage[];
        mostSkipped: StatsImage[];
    };

    let data = $state<StatsData | null>(null);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let selectedImage = $state<SessionImage | null>(null);
    let imageModalOpen = $state(false);

    function openModal(img: StatsImage) {
        selectedImage = { id: img.imageId, filePath: img.filePath };
        imageModalOpen = true;
    }

    onMount(async () => {
        try {
            const res = await fetch('/api/stats');
            if (!res.ok) throw new Error('Failed to load stats');
            data = await res.json();
        } catch {
            error = 'Could not load stats. Please try again.';
        } finally {
            loading = false;
        }
    });

    function imageName(filePath: string) {
        return filePath.split('/').pop() ?? filePath;
    }
</script>

<div class="p-4 flex flex-col gap-8 max-w-5xl">
    <div>
        <h1 class="text-2xl font-bold text-ink">Stats</h1>
        <p class="text-warm-gray text-sm mt-1">Your drawing activity at a glance.</p>
    </div>

    {#if loading}
        <p class="text-warm-gray text-sm">Loading…</p>
    {:else if error}
        <p class="text-sm text-red-600">{error}</p>
    {:else if data}
        <!-- Overview cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="bg-canvas border border-muted rounded-xl p-4 flex flex-col gap-1">
                <div class="flex items-center gap-1.5 text-warm-gray text-xs font-medium">
                    <Pencil class="w-3.5 h-3.5" />
                    Total Draws
                </div>
                <span class="text-3xl font-bold text-terracotta tabular-nums">{data.totalDraws}</span>
            </div>
            <div class="bg-canvas border border-muted rounded-xl p-4 flex flex-col gap-1">
                <div class="flex items-center gap-1.5 text-warm-gray text-xs font-medium">
                    <SkipForward class="w-3.5 h-3.5" />
                    Total Skips
                </div>
                <span class="text-3xl font-bold text-terracotta tabular-nums">{data.totalSkips}</span>
            </div>
            <div class="bg-canvas border border-muted rounded-xl p-4 flex flex-col gap-1">
                <div class="flex items-center gap-1.5 text-warm-gray text-xs font-medium">
                    <Heart class="w-3.5 h-3.5" />
                    Liked
                </div>
                <span class="text-3xl font-bold text-terracotta tabular-nums">{data.totalLiked}</span>
            </div>
            <div class="bg-canvas border border-muted rounded-xl p-4 flex flex-col gap-1">
                <div class="flex items-center gap-1.5 text-warm-gray text-xs font-medium">
                    <Eye class="w-3.5 h-3.5" />
                    Unique Seen
                </div>
                <span class="text-3xl font-bold text-terracotta tabular-nums">{data.totalSeen}</span>
            </div>
        </div>

        {#if data.totalDraws === 0 && data.totalSkips === 0}
            <div class="bg-canvas border border-muted rounded-xl p-8 text-center">
                <ChartNoAxesColumn class="w-10 h-10 text-muted mx-auto mb-3" />
                <p class="text-ink font-medium">No sessions yet</p>
                <p class="text-warm-gray text-sm mt-1">Start a draw session to begin tracking your activity.</p>
            </div>
        {:else}
            <!-- Most Drawn -->
            {#if data.mostDrawn.length > 0}
                <div class="flex flex-col gap-3">
                    <h2 class="text-base font-semibold text-ink flex items-center gap-2">
                        <Pencil class="w-4 h-4 text-terracotta" />
                        Most Drawn
                    </h2>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {#each data.mostDrawn as img (img.imageId)}
                            <button
                                type="button"
                                onclick={() => openModal(img)}
                                class="relative aspect-square overflow-hidden rounded-lg bg-canvas border border-muted group hover:ring-2 hover:ring-terracotta/50 transition-all focus-visible:ring-2 focus-visible:ring-terracotta/50"
                                title={imageName(img.filePath)}
                            >
                                <img
                                    src="/api/images/file?path={encodeURIComponent(img.filePath)}"
                                    alt={imageName(img.filePath)}
                                    class="w-full h-full object-cover"
                                    draggable="false"
                                />
                                <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                    <p class="absolute bottom-1.5 left-1.5 right-1.5 text-white text-xs leading-tight truncate">
                                        {imageName(img.filePath)}
                                    </p>
                                </div>
                                <div class="absolute top-1.5 right-1.5 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm rounded-md px-1.5 py-0.5 text-white text-xs font-medium tabular-nums">
                                    <Pencil class="w-2.5 h-2.5" />
                                    {img.drawCount}
                                </div>
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Most Skipped -->
            {#if data.mostSkipped.length > 0}
                <div class="flex flex-col gap-3">
                    <h2 class="text-base font-semibold text-ink flex items-center gap-2">
                        <SkipForward class="w-4 h-4 text-terracotta" />
                        Most Skipped
                    </h2>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {#each data.mostSkipped as img (img.imageId)}
                            <button
                                type="button"
                                onclick={() => openModal(img)}
                                class="relative aspect-square overflow-hidden rounded-lg bg-canvas border border-muted group hover:ring-2 hover:ring-terracotta/50 transition-all focus-visible:ring-2 focus-visible:ring-terracotta/50"
                                title={imageName(img.filePath)}
                            >
                                <img
                                    src="/api/images/file?path={encodeURIComponent(img.filePath)}"
                                    alt={imageName(img.filePath)}
                                    class="w-full h-full object-cover"
                                    draggable="false"
                                />
                                <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                    <p class="absolute bottom-1.5 left-1.5 right-1.5 text-white text-xs leading-tight truncate">
                                        {imageName(img.filePath)}
                                    </p>
                                </div>
                                <div class="absolute top-1.5 right-1.5 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm rounded-md px-1.5 py-0.5 text-white text-xs font-medium tabular-nums">
                                    <SkipForward class="w-2.5 h-2.5" />
                                    {img.skipCount}
                                </div>
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}
        {/if}
    {/if}
</div>

<ImageMetadataModal bind:open={imageModalOpen} image={selectedImage} />
