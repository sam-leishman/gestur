<script lang="ts">
    import type { Snippet } from 'svelte';

    let {
        open = $bindable(false),
        title,
        children,
        headerActions,
        onclose,
        maxWidth = 'max-w-md'
    }: {
        open: boolean;
        title: string;
        children: Snippet;
        headerActions?: Snippet;
        onclose?: () => void;
        maxWidth?: string;
    } = $props();

    function close() {
        open = false;
        onclose?.();
    }

    function handleBackdrop(e: MouseEvent) {
        if (e.target === e.currentTarget) close();
    }

    function handleKeydown(e: KeyboardEvent) {
        if (open && e.key === 'Escape') close();
    }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onclick={handleBackdrop}
        onkeydown={handleKeydown}
        aria-modal="true"
        role="dialog"
        tabindex="-1"
        aria-label={title}
    >
        <div class="bg-canvas border border-muted rounded-xl shadow-xl w-full {maxWidth} flex flex-col gap-4 p-6">
            <div class="flex items-center gap-2">
                <h2 class="text-lg font-semibold text-ink flex-1">{title}</h2>
                {#if headerActions}{@render headerActions()}{/if}
                <button
                    type="button"
                    onclick={close}
                    class="text-warm-gray hover:text-ink transition-colors p-1 rounded"
                    aria-label="Close"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 6 6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            {@render children()}
        </div>
    </div>
{/if}
