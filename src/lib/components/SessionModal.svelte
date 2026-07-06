<script lang="ts">
    import { Pause, Play, SkipForward, Square } from 'lucide-svelte';
    import { fade } from 'svelte/transition';
    import type { SessionImage } from '$lib/types';
    import ImageMetadataModal from '$lib/components/ImageMetadataModal.svelte';
    import SessionResultView from '$lib/components/SessionResultView.svelte';
    import { localDateString } from '$lib/utils/date';

    let {
        open = $bindable(false),
        images,
        targetCount,
        durationSeconds
    }: {
        open: boolean;
        images: SessionImage[];
        targetCount: number;
        durationSeconds: number;
    } = $props();

    // ── State ──────────────────────────────────────────────────────────────────
    let drawnCount = $state(0);
    let drawnImages = $state<SessionImage[]>([]);
    let skippedImages = $state<SessionImage[]>([]);
    let paused = $state(false);
    let complete = $state(false);
    let controlsVisible = $state(true);
    let elapsed = $state(0); // ms elapsed on current image
    let currentImage = $state<SessionImage | null>(null);
    let pauseIndicator = $state<'pause' | 'play' | null>(null);
    let stoppedEarly = $state(false);
    let imageModalOpen = $state(false);
    let selectedImage = $state<SessionImage | null>(null);
    let likedIds = $state(new Set<string>());
    let midnightGrace = $state(false);

    // ── Internal ───────────────────────────────────────────────────────────────
    let pool: SessionImage[] = [];
    let poolIndex = 0;
    let startedAt = new Date();
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let hideControlsTimer: ReturnType<typeof setTimeout> | null = null;
    let pauseIndicatorTimer: ReturnType<typeof setTimeout> | null = null;
    let mouseOverControls = false;
    const TICK_MS = 50;

    // ── Lifecycle ──────────────────────────────────────────────────────────────
    $effect(() => {
        if (open) {
            startSession();
        }
        return () => {
            stopTimer();
            if (hideControlsTimer !== null) { clearTimeout(hideControlsTimer); hideControlsTimer = null; }
            if (pauseIndicatorTimer !== null) { clearTimeout(pauseIndicatorTimer); pauseIndicatorTimer = null; }
        };
    });

    function shuffle<T>(arr: T[]): T[] {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function startSession() {
        drawnCount = 0;
        drawnImages = [];
        skippedImages = [];
        elapsed = 0;
        paused = false;
        complete = false;
        controlsVisible = true;
        pauseIndicator = null;
        stoppedEarly = false;
        imageModalOpen = false;
        selectedImage = null;
        likedIds = new Set();
        midnightGrace = false;
        pool = shuffle(images);
        poolIndex = 0;
        currentImage = pool[poolIndex] ?? null;
        startedAt = new Date();
        startTimer();
        scheduleHideControls();
    }

    function startTimer() {
        stopTimer();
        intervalId = setInterval(() => {
            if (paused) return;
            elapsed += TICK_MS;
            if (elapsed >= durationSeconds * 1000) {
                if (currentImage) drawnImages = [...drawnImages, currentImage];
                drawnCount++;
                if (drawnCount >= targetCount) {
                    endSession();
                } else {
                    advanceImage();
                }
            }
        }, TICK_MS);
    }

    function stopTimer() {
        if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
        }
    }

    function advanceImage() {
        elapsed = 0;
        poolIndex++;
        if (poolIndex >= pool.length) {
            pool = shuffle(images);
            poolIndex = 0;
        }
        currentImage = pool[poolIndex];
    }

    function handleSkip() {
        if (currentImage) skippedImages = [...skippedImages, currentImage];
        advanceImage();
    }

    function endSession() {
        stopTimer();
        stoppedEarly = false;
        complete = true;
        persistSession('completed');
        fetchLikedStatus();
        if (drawnImages.length > 0) scheduleDrawingDay();
    }

    function scheduleDrawingDay() {
        const now = new Date();
        if (now.getHours() < 2) {
            midnightGrace = true;
        } else {
            recordDrawingDay(localDateString(now));
        }
    }

    async function recordDrawingDay(date: string) {
        midnightGrace = false;
        try {
            await fetch('/api/streak/day', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date })
            });
        } catch { /* ignore */ }
    }

    async function persistSession(status: 'completed' | 'stopped') {
        const draws = drawnImages.map((img) => img.id);
        const skips = skippedImages.map((img) => img.id);
        if (draws.length === 0 && skips.length === 0) return;
        try {
            await fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    draws,
                    skips,
                    targetCount,
                    durationSeconds,
                    startedAt: startedAt.toISOString(),
                    status
                })
            });
        } catch { /* ignore */ }
    }

    async function fetchLikedStatus() {
        const ids = [...drawnImages, ...skippedImages].map((img) => img.id);
        if (ids.length === 0) return;
        try {
            const res = await fetch('/api/images/liked', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageIds: ids })
            });
            if (!res.ok) return;
            const data: Record<string, boolean> = await res.json();
            const next = new Set<string>();
            for (const [id, isLiked] of Object.entries(data)) {
                if (isLiked) next.add(id);
            }
            likedIds = next;
        } catch { /* ignore */ }
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

    function handlePauseResume() {
        paused = !paused;
        if (pauseIndicatorTimer !== null) clearTimeout(pauseIndicatorTimer);
        if (paused) {
            pauseIndicator = 'pause';
        } else {
            pauseIndicator = 'play';
            pauseIndicatorTimer = setTimeout(() => { pauseIndicator = null; }, 800);
        }
    }

    function handleStop() {
        if (complete) { open = false; return; }
        stopTimer();
        const completedDraws = drawnImages.length;
        if (currentImage) skippedImages = [...skippedImages, currentImage];
        if (drawnImages.length === 0 && skippedImages.length === 0) { open = false; return; }
        stoppedEarly = true;
        complete = true;
        persistSession('stopped');
        fetchLikedStatus();
        if (completedDraws > 0) scheduleDrawingDay();
    }

    function handleClose() {
        open = false;
    }

    function handleKeydown(e: KeyboardEvent) {
        if (!open) return;
        if (complete) {
            if (e.key === 'Escape' && !imageModalOpen) { e.preventDefault(); handleClose(); }
            return;
        }
        if (e.key === ' ') { e.preventDefault(); handlePauseResume(); }
        if (e.key === 'ArrowRight') { e.preventDefault(); handleSkip(); }
        if (e.key === 'Escape') { e.preventDefault(); handleStop(); }
    }

    function scheduleHideControls() {
        if (hideControlsTimer !== null) clearTimeout(hideControlsTimer);
        controlsVisible = true;
        if (mouseOverControls) return;
        hideControlsTimer = setTimeout(() => {
            controlsVisible = false;
        }, 2000);
    }

    function handleMouseMove() {
        scheduleHideControls();
    }

    function handleControlsMouseEnter() {
        mouseOverControls = true;
        scheduleHideControls();
    }

    function handleControlsMouseLeave() {
        mouseOverControls = false;
        scheduleHideControls();
    }

    // ── Derived ────────────────────────────────────────────────────────────────
    const progressPct = $derived(
        Math.min(100, (elapsed / (durationSeconds * 1000)) * 100)
    );

    const timeRemaining = $derived.by(() => {
        const ms = Math.max(0, durationSeconds * 1000 - elapsed);
        const totalSec = Math.ceil(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
    });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-[100] bg-black flex flex-col"
        onmousemove={handleMouseMove}
    >
        <!-- Progress bar -->
        <div class="w-full h-1 bg-white/10 shrink-0">
            <div
                class="h-full bg-terracotta transition-none"
                style="width: {progressPct}%"
            ></div>
        </div>

        {#if complete}
            <!-- Session complete screen -->
            <SessionResultView
                {stoppedEarly}
                {targetCount}
                {drawnImages}
                {skippedImages}
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
                {#snippet banner()}
                    {#if midnightGrace}
                        <div class="mx-6 mb-2 shrink-0 rounded-xl bg-white/10 border border-white/20 px-4 py-3 flex items-center justify-between gap-4">
                            <p class="text-white/80 text-sm">It's after midnight — count this session as yesterday?</p>
                            <div class="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onclick={() => recordDrawingDay(localDateString(new Date(), -1))}
                                    class="px-3 py-1.5 rounded-full bg-terracotta hover:bg-terracotta/80 text-white text-sm font-medium transition-colors"
                                >
                                    Yes, yesterday
                                </button>
                                <button
                                    type="button"
                                    onclick={() => recordDrawingDay(localDateString(new Date()))}
                                    class="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
                                >
                                    No, today
                                </button>
                            </div>
                        </div>
                    {/if}
                {/snippet}
            </SessionResultView>

            <ImageMetadataModal bind:open={imageModalOpen} image={selectedImage} onLikeChange={handleLikeChange} />
        {:else}
            <!-- Image display -->
            <div class="relative flex-1 flex items-center justify-center min-h-0 p-4">
                {#if currentImage}
                    <img
                        src="/api/images/file?path={encodeURIComponent(currentImage.filePath)}"
                        alt=""
                        class="max-w-full max-h-full object-contain select-none"
                        draggable="false"
                    />
                {/if}

                {#if pauseIndicator}
                    <div
                        transition:fade={{ duration: 200 }}
                        class="absolute top-4 right-4 p-2.5 rounded-full bg-black/50 backdrop-blur-sm text-white/70"
                    >
                        {#if pauseIndicator === 'pause'}
                            <Pause class="w-5 h-5" />
                        {:else}
                            <Play class="w-5 h-5" />
                        {/if}
                    </div>
                {/if}
            </div>

            <!-- Counter (bottom-left, always visible) -->
            <div class="absolute bottom-6 left-6 flex items-center gap-3 pointer-events-none">
                <span class="text-white/80 text-sm font-medium tabular-nums">
                    {drawnCount + 1} / {targetCount}
                </span>
                <span class="text-white/50 text-sm tabular-nums">
                    {timeRemaining}
                </span>
            </div>

            <!-- Controls (mouse-reveal) -->
            <div
                class="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 transition-opacity duration-300 {controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}"
                onmouseenter={handleControlsMouseEnter}
                onmouseleave={handleControlsMouseLeave}
            >
                <div class="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2">
                    <button
                        type="button"
                        onclick={handlePauseResume}
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white/90 hover:text-white hover:bg-white/10 transition-colors text-sm"
                        title={paused ? 'Resume (Space)' : 'Pause (Space)'}
                        aria-label={paused ? 'Resume' : 'Pause'}
                    >
                        {#if paused}
                            <Play class="w-4 h-4" />
                            <span>Resume</span>
                        {:else}
                            <Pause class="w-4 h-4" />
                            <span>Pause</span>
                        {/if}
                    </button>

                    <div class="w-px h-4 bg-white/20"></div>

                    <button
                        type="button"
                        onclick={handleSkip}
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white/90 hover:text-white hover:bg-white/10 transition-colors text-sm"
                        title="Skip (→)"
                        aria-label="Skip"
                    >
                        <SkipForward class="w-4 h-4" />
                        <span>Skip</span>
                    </button>

                    <div class="w-px h-4 bg-white/20"></div>

                    <button
                        type="button"
                        onclick={handleStop}
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white/90 hover:text-white hover:bg-white/10 transition-colors text-sm"
                        title="Stop (Esc)"
                        aria-label="Stop session"
                    >
                        <Square class="w-4 h-4" />
                        <span>Stop</span>
                    </button>
                </div>
            </div>
        {/if}
    </div>
{/if}
