<script lang="ts">
    import { ImageOff, LoaderCircle } from 'lucide-svelte';

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
        A wrapper is needed (rather than putting everything on the <img> itself) so the loading
        spinner can be layered on top as its own element: an opacity/filter trick on the <img>
        alone can't hide stale pixels from a *previous* src while the next one is still loading.
        `className` is applied to both the wrapper and the <img>: on the wrapper it establishes
        sizing (so callers' existing `w-full h-full` / `max-w-full max-h-full` classes keep
        working unchanged) and a positioning context for the overlay; `object-cover`/
        `object-contain` are no-ops on the wrapper but are what the <img> actually needs.
    -->
    <div class="{className} relative w-full h-full flex items-center justify-center bg-pressed">
        <img
            {src}
            {alt}
            class="{className} block"
            {draggable}
            {loading}
            decoding="async"
            onload={handleLoad}
            onerror={handleError}
        />
        {#if !loaded}
            <div class="absolute inset-0 flex items-center justify-center bg-pressed">
                <LoaderCircle class="w-1/4 h-1/4 min-w-4 min-h-4 text-warm-gray animate-spin" />
            </div>
        {/if}
    </div>
{/if}
