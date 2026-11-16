<script lang="ts">
    import { ImageOff } from 'lucide-svelte';

    let {
        src,
        alt = '',
        class: className = '',
        draggable = true,
        loading = undefined,
        onerror = undefined
    }: {
        src: string;
        alt?: string;
        class?: string;
        draggable?: boolean;
        loading?: 'lazy' | 'eager';
        onerror?: () => void;
    } = $props();

    let failed = $state(false);
    let loaded = $state(false);

    $effect(() => {
        if (src) {
            failed = false;
            loaded = false;
        }
    });

    function handleLoad() {
        loaded = true;
    }

    function handleError() {
        failed = true;
        onerror?.();
    }
</script>

{#if failed}
    <div class="{className} flex items-center justify-center bg-pressed text-warm-gray" title="Image file is missing">
        <ImageOff class="w-1/4 h-1/4 min-w-4 min-h-4" />
    </div>
{:else}
    <!--
        bg-pressed gives the tile a neutral fill instead of a blank gap while the image loads or
        decodes (which, for not-yet-cached thumbnails, can take a few seconds) — without it, a
        slow-but-healthy load looks identical to nothing happening. animate-pulse adds a subtle
        skeleton-loading animation for the same reason, and clears once the image has loaded.
    -->
    <img
        {src}
        {alt}
        class="{className} bg-pressed {loaded ? '' : 'animate-pulse'}"
        {draggable}
        {loading}
        decoding="async"
        onload={handleLoad}
        onerror={handleError}
    />
{/if}
