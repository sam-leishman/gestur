<script lang="ts">
    import SessionModal from '$lib/components/SessionModal.svelte';
    import { Play } from 'lucide-svelte';
    import type { SessionImage } from '$lib/types';

    const DURATION_PRESETS = [
        { label: '1m',  seconds: 60 },
        { label: '2m',  seconds: 120 },
        { label: '3m',  seconds: 180 },
        { label: '5m',  seconds: 300 },
        { label: '10m', seconds: 600 }
    ];

    let imageCount = $state(10);
    let selectedPreset = $state<number | null>(60);
    let customMinutes = $state(0);
    let customSeconds = $state(30);
    let isCustom = $state(false);

    let sessionOpen = $state(false);
    let sessionImages = $state<SessionImage[]>([]);
    let sessionTarget = $state(0);
    let sessionDuration = $state(0);
    let loading = $state(false);
    let error = $state<string | null>(null);

    const effectiveDuration = $derived(
        isCustom
            ? customMinutes * 60 + customSeconds
            : (selectedPreset ?? 60)
    );

    const canStart = $derived(
        imageCount >= 1 && effectiveDuration >= 1
    );

    function selectPreset(seconds: number) {
        selectedPreset = seconds;
        isCustom = false;
    }

    function selectCustom() {
        isCustom = true;
        selectedPreset = null;
    }

    function clampTime(value: string): number {
        return Math.min(59, Math.max(0, Math.floor(Number(value) || 0)));
    }

    async function startSession() {
        if (!canStart) return;
        error = null;
        loading = true;
        try {
            const res = await fetch('/api/images/session');
            if (!res.ok) throw new Error('Failed to load images');
            const data: { images: SessionImage[] } = await res.json();
            if (data.images.length === 0) {
                error = 'No catalogued images found. Add some images in the Browse section first.';
                loading = false;
                return;
            }
            sessionImages = data.images;
            sessionTarget = imageCount;
            sessionDuration = effectiveDuration;
            sessionOpen = true;
        } catch {
            error = 'Could not load images. Please try again.';
        } finally {
            loading = false;
        }
    }
</script>

<div class="p-4 flex flex-col gap-6 max-w-lg">
    <div>
        <h1 class="text-2xl font-bold text-ink">Draw Session</h1>
        <p class="text-warm-gray text-sm mt-1">Configure your gesture drawing session and hit Start.</p>
    </div>

    <!-- Image count -->
    <div class="flex flex-col gap-2">
        <label for="image-count" class="text-sm font-medium text-ink">Number of images</label>
        <input
            id="image-count"
            type="number"
            min="1"
            bind:value={imageCount}
            class="rounded-lg border-muted w-32"
        />
    </div>

    <!-- Duration per image -->
    <div class="flex flex-col gap-2">
        <span class="text-sm font-medium text-ink">Time per image</span>
        <div class="flex flex-wrap gap-2">
            {#each DURATION_PRESETS as preset (preset.seconds)}
                <button
                    type="button"
                    onclick={() => selectPreset(preset.seconds)}
                    class="btn text-sm {!isCustom && selectedPreset === preset.seconds ? 'btn-primary' : 'btn-terracotta-tint'}"
                >
                    {preset.label}
                </button>
            {/each}
            <button
                type="button"
                onclick={selectCustom}
                class="btn text-sm {isCustom ? 'btn-primary' : 'btn-terracotta-tint'}"
            >
                Custom
            </button>
        </div>
        {#if isCustom}
            <div class="flex items-center gap-2 mt-1">
                <input
                    type="number"
                    min="0"
                    max="59"
                    step="1"
                    bind:value={customMinutes}
                    oninput={(e) => customMinutes = clampTime(e.currentTarget.value)}
                    class="rounded-lg border-muted w-20 text-center"
                    aria-label="Minutes"
                />
                <span class="text-sm text-warm-gray">m</span>
                <input
                    type="number"
                    min="0"
                    max="59"
                    step="1"
                    bind:value={customSeconds}
                    oninput={(e) => customSeconds = clampTime(e.currentTarget.value)}
                    class="rounded-lg border-muted w-20 text-center"
                    aria-label="Seconds"
                />
                <span class="text-sm text-warm-gray">s</span>
            </div>
        {/if}
    </div>

    {#if error}
        <p class="text-sm text-red-600">{error}</p>
    {/if}

    <button
        type="button"
        onclick={startSession}
        disabled={!canStart || loading}
        class="btn btn-primary flex items-center gap-2 w-fit disabled:opacity-50 disabled:cursor-not-allowed"
    >
        <Play class="w-4 h-4" />
        {loading ? 'Loading…' : 'Start Session'}
    </button>
</div>

<SessionModal
    bind:open={sessionOpen}
    images={sessionImages}
    targetCount={sessionTarget}
    durationSeconds={sessionDuration}
/>
