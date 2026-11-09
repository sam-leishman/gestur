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

    $effect(() => {
        if (src) failed = false;
    });

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
    <img {src} {alt} class={className} {draggable} {loading} onerror={handleError} />
{/if}
