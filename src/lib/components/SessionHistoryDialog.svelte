<script lang="ts">
    import type { SessionDetail, SessionImage } from '$lib/types';
    import SessionResultView from '$lib/components/SessionResultView.svelte';
    import ImageMetadataModal from '$lib/components/ImageMetadataModal.svelte';

    let {
        open = $bindable(false),
        sessionId
    }: {
        open: boolean;
        sessionId: string | null;
    } = $props();

    let detail = $state<SessionDetail | null>(null);
    let loading = $state(false);
    let error = $state<string | null>(null);
    let likedIds = $state(new Set<string>());
    let imageModalOpen = $state(false);
    let selectedImage = $state<SessionImage | null>(null);

    $effect(() => {
        if (open && sessionId) {
            loadDetail(sessionId);
        } else if (!open) {
            detail = null;
            error = null;
            imageModalOpen = false;
            selectedImage = null;
        }
    });

    async function loadDetail(id: string) {
        loading = true;
        error = null;
        detail = null;
        try {
            const res = await fetch(`/api/sessions/${id}`);
            if (!res.ok) throw new Error('Failed to load session');
            const data: SessionDetail = await res.json();
            detail = data;
            likedIds = new Set(
                [...data.drawnImages, ...data.skippedImages]
                    .filter((img) => img.liked)
                    .map((img) => img.id)
            );
        } catch {
            error = 'Could not load this session. Please try again.';
        } finally {
            loading = false;
        }
    }

    async function toggleLike(imageId: string) {
        const wasLiked = likedIds.has(imageId);
        const next = new Set(likedIds);
        if (wasLiked) next.delete(imageId); else next.add(imageId);
        likedIds = next;
        try {
            const res = await fetch(`/api/images/${imageId}/like`, { method: 'POST' });
            if (!res.ok) {
                const rollback = new Set(likedIds);
                if (wasLiked) rollback.add(imageId); else rollback.delete(imageId);
                likedIds = rollback;
                return;
            }
            const data: { liked: boolean } = await res.json();
            const confirmed = new Set(likedIds);
            if (data.liked) confirmed.add(imageId); else confirmed.delete(imageId);
            likedIds = confirmed;
        } catch { /* ignore */ }
    }

    function handleLikeChange(imageId: string, isLiked: boolean) {
        const next = new Set(likedIds);
        if (isLiked) next.add(imageId); else next.delete(imageId);
        likedIds = next;
    }

    function handleClose() {
        open = false;
    }

    function handleKeydown(e: KeyboardEvent) {
        if (open && e.key === 'Escape' && !imageModalOpen) {
            e.preventDefault();
            handleClose();
        }
    }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
    <div class="fixed inset-0 z-[100] bg-black flex flex-col">
        {#if loading}
            <div class="flex-1 flex items-center justify-center">
                <p class="text-white/60 text-sm">Loading…</p>
            </div>
        {:else if error}
            <div class="flex-1 flex flex-col items-center justify-center gap-3">
                <p class="text-white/80 text-sm">{error}</p>
                <button
                    type="button"
                    onclick={handleClose}
                    class="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors border border-white/20"
                >
                    Close
                </button>
            </div>
        {:else if detail}
            <SessionResultView
                stoppedEarly={detail.status === 'stopped'}
                targetCount={detail.targetCount}
                drawnImages={detail.drawnImages}
                skippedImages={detail.skippedImages}
                {likedIds}
                onToggleLike={toggleLike}
                onSelectImage={(img) => { selectedImage = img; imageModalOpen = true; }}
            >
                {#snippet headerActions()}
                    <button
                        type="button"
                        onclick={handleClose}
                        class="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors border border-white/20 shrink-0"
                    >
                        Close
                    </button>
                {/snippet}
            </SessionResultView>

            <ImageMetadataModal bind:open={imageModalOpen} image={selectedImage} onLikeChange={handleLikeChange} />
        {/if}
    </div>
{/if}
