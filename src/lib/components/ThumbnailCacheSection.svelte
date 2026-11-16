<script lang="ts">
    import { ImageDown } from 'lucide-svelte';
    import { cleanupThumbnailCache } from '$lib/utils/thumbnailCache';

    let running = $state(false);
    let message = $state<string | null>(null);
    let errorMessage = $state<string | null>(null);

    function formatBytes(bytes: number): string {
        return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)}MB` : `${(bytes / 1024).toFixed(0)}KB`;
    }

    async function runCleanup() {
        running = true;
        message = null;
        errorMessage = null;
        const outcome = await cleanupThumbnailCache();
        running = false;
        if (!outcome.ok) {
            errorMessage = outcome.error;
            return;
        }
        const { removed, bytes } = outcome.result;
        message = removed === 0
            ? 'No orphaned thumbnails found — cache is clean.'
            : `Removed ${removed} orphaned thumbnail${removed === 1 ? '' : 's'}, reclaiming ${formatBytes(bytes)}.`;
    }
</script>

<div class="flex flex-col gap-3 bg-canvas border border-muted rounded-lg p-4 shrink-0">
    <div class="flex items-center gap-2">
        <ImageDown class="w-4 h-4 text-terracotta shrink-0" />
        <h2 class="font-semibold text-ink">Thumbnail Cache</h2>
    </div>
    <p class="text-sm text-warm-gray">
        Generated thumbnails are cached on disk and cleaned up automatically once a day. Images deleted,
        moved, or renamed outside the app can leave orphaned thumbnails behind until then — run a cleanup
        now to reclaim that space immediately.
    </p>

    <div class="flex items-center gap-3">
        <button type="button" onclick={runCleanup} disabled={running} class="btn btn-terracotta-tint text-ink self-start">
            {running ? 'Cleaning up…' : 'Clean up now'}
        </button>
        {#if message}
            <p class="text-sm text-warm-gray">{message}</p>
        {:else if errorMessage}
            <p class="text-sm text-red-600">{errorMessage}</p>
        {/if}
    </div>
</div>
