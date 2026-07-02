<script lang="ts">
    import { onMount } from 'svelte';
    import { ChartNoAxesColumn, ChevronLeft, ChevronRight, Eye, Flame, Heart, Pencil, SkipForward, Trophy } from 'lucide-svelte';
    import ImageMetadataModal from '$lib/components/ImageMetadataModal.svelte';
    import type { SessionImage } from '$lib/types';
    import { localDateString } from '$lib/utils/date';

    type StatsImage = { imageId: string; filePath: string; drawCount?: number; skipCount?: number };
    type StatsData = {
        totalDraws: number;
        totalSkips: number;
        totalLiked: number;
        totalSeen: number;
        mostDrawn: StatsImage[];
        mostSkipped: StatsImage[];
    };
    type StreakData = {
        currentStreak: number;
        longestStreak: number;
        drawnDates: string[];
    };

    let today = $state(localDateString(new Date()));
    let yesterday = $state(localDateString(new Date(), -1));

    let statsData = $state<StatsData | null>(null);
    let streakData = $state<StreakData | null>(null);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let selectedImage = $state<SessionImage | null>(null);
    let imageModalOpen = $state(false);
    const now = new Date();
    let calendarYear = $state(now.getFullYear());
    let calendarMonth = $state(now.getMonth());

    const MONTH_NAMES = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    function openModal(img: StatsImage) {
        selectedImage = { id: img.imageId, filePath: img.filePath };
        imageModalOpen = true;
    }

    function imageName(filePath: string) {
        return filePath.split('/').pop() ?? filePath;
    }

    async function loadData() {
        today = localDateString(new Date());
        yesterday = localDateString(new Date(), -1);
        try {
            const [statsRes, streakRes] = await Promise.all([
                fetch('/api/stats'),
                fetch(`/api/streak?today=${today}&yesterday=${yesterday}`)
            ]);
            if (!statsRes.ok || !streakRes.ok) throw new Error('Failed to load stats');
            statsData = await statsRes.json();
            streakData = await streakRes.json();
        } catch {
            error = 'Could not load stats. Please try again.';
        } finally {
            loading = false;
        }
    }

    onMount(loadData);

    function prevMonth() {
        if (calendarMonth === 0) { calendarMonth = 11; calendarYear--; }
        else calendarMonth--;
    }

    function nextMonth() {
        if (calendarMonth === 11) { calendarMonth = 0; calendarYear++; }
        else calendarMonth++;
    }

    const calendarDays = $derived.by(() => {
        const drawnSet = new Set(streakData?.drawnDates ?? []);
        const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
        const firstDow = new Date(calendarYear, calendarMonth, 1).getDay();
        type Cell = { day: number | null; dateStr: string | null; drawn: boolean; isToday: boolean; isFuture: boolean };
        const cells: Cell[] = [];

        for (let i = 0; i < firstDow; i++) {
            cells.push({ day: null, dateStr: null, drawn: false, isToday: false, isFuture: false });
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            cells.push({
                day: d,
                dateStr,
                drawn: drawnSet.has(dateStr),
                isToday: dateStr === today,
                isFuture: dateStr > today
            });
        }
        return cells;
    });

    const canGoNext = $derived(
        calendarYear < now.getFullYear() ||
        (calendarYear === now.getFullYear() && calendarMonth < now.getMonth())
    );
</script>

<div class="p-6 flex flex-col gap-6">
    <div>
        <h1 class="text-2xl font-bold text-ink">Stats</h1>
        <p class="text-warm-gray text-sm mt-1">Your drawing activity at a glance.</p>
    </div>

    {#if loading}
        <p class="text-warm-gray text-sm">Loading…</p>
    {:else if error}
        <p class="text-sm text-red-600">{error}</p>
    {:else if statsData && streakData}
        <!-- Metrics row -->
        <div class="grid grid-cols-3 sm:grid-cols-6 gap-3">
            <div class="bg-canvas border border-muted rounded-xl p-3 flex flex-col gap-0.5">
                <div class="flex items-center gap-1.5 text-warm-gray text-xs font-medium">
                    <Flame class="w-3.5 h-3.5 text-terracotta" />
                    Streak
                </div>
                <span class="text-2xl font-bold text-ink tabular-nums">{streakData.currentStreak}</span>
                <span class="text-xs text-warm-gray">days</span>
            </div>
            <div class="bg-canvas border border-muted rounded-xl p-3 flex flex-col gap-0.5">
                <div class="flex items-center gap-1.5 text-warm-gray text-xs font-medium">
                    <Trophy class="w-3.5 h-3.5 text-terracotta" />
                    Best
                </div>
                <span class="text-2xl font-bold text-ink tabular-nums">{streakData.longestStreak}</span>
                <span class="text-xs text-warm-gray">days</span>
            </div>
            <div class="bg-canvas border border-muted rounded-xl p-3 flex flex-col gap-0.5">
                <div class="flex items-center gap-1.5 text-warm-gray text-xs font-medium">
                    <Pencil class="w-3.5 h-3.5" />
                    Draws
                </div>
                <span class="text-2xl font-bold text-terracotta tabular-nums">{statsData.totalDraws}</span>
            </div>
            <div class="bg-canvas border border-muted rounded-xl p-3 flex flex-col gap-0.5">
                <div class="flex items-center gap-1.5 text-warm-gray text-xs font-medium">
                    <SkipForward class="w-3.5 h-3.5" />
                    Skips
                </div>
                <span class="text-2xl font-bold text-terracotta tabular-nums">{statsData.totalSkips}</span>
            </div>
            <div class="bg-canvas border border-muted rounded-xl p-3 flex flex-col gap-0.5">
                <div class="flex items-center gap-1.5 text-warm-gray text-xs font-medium">
                    <Heart class="w-3.5 h-3.5" />
                    Liked
                </div>
                <span class="text-2xl font-bold text-terracotta tabular-nums">{statsData.totalLiked}</span>
            </div>
            <div class="bg-canvas border border-muted rounded-xl p-3 flex flex-col gap-0.5">
                <div class="flex items-center gap-1.5 text-warm-gray text-xs font-medium">
                    <Eye class="w-3.5 h-3.5" />
                    Seen
                </div>
                <span class="text-2xl font-bold text-terracotta tabular-nums">{statsData.totalSeen}</span>
            </div>
        </div>

        <!-- Main content: calendar left, images right -->
        <div class="flex flex-col lg:flex-row gap-6 items-start">
            <!-- Calendar panel -->
            <div class="flex flex-col gap-2 w-full lg:w-64 shrink-0">
                <div class="bg-canvas border border-muted rounded-xl p-3 flex flex-col gap-2">
                    <!-- Month nav -->
                    <div class="flex items-center justify-between">
                        <button
                            type="button"
                            onclick={prevMonth}
                            class="p-1 rounded text-warm-gray hover:text-ink hover:bg-pressed transition-colors"
                            aria-label="Previous month"
                        >
                            <ChevronLeft class="w-3.5 h-3.5" />
                        </button>
                        <p class="text-xs font-semibold text-ink">{MONTH_NAMES[calendarMonth]} {calendarYear}</p>
                        <button
                            type="button"
                            onclick={nextMonth}
                            disabled={!canGoNext}
                            class="p-1 rounded text-warm-gray hover:text-ink hover:bg-pressed transition-colors disabled:opacity-30 disabled:cursor-default"
                            aria-label="Next month"
                        >
                            <ChevronRight class="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <!-- Day grid -->
                    <div class="grid grid-cols-7 gap-px">
                        {#each DAY_LABELS as label}
                            <p class="text-center text-[10px] font-medium text-muted py-0.5">{label[0]}</p>
                        {/each}
                        {#each calendarDays as cell}
                            {#if cell.day === null}
                                <div></div>
                            {:else}
                                <div
                                    class="aspect-square rounded flex items-center justify-center text-[11px] font-medium relative select-none
                                        {cell.drawn ? 'bg-terracotta text-white' : ''}
                                        {!cell.drawn && !cell.isFuture ? 'text-warm-gray hover:bg-pressed' : ''}
                                        {cell.isFuture ? 'text-muted/50' : ''}
                                        {cell.isToday && !cell.drawn ? 'ring-1 ring-terracotta ring-offset-1 ring-offset-canvas text-terracotta font-bold' : ''}
                                        {cell.isToday && cell.drawn ? 'ring-1 ring-terracotta/40 ring-offset-1 ring-offset-canvas' : ''}"
                                >
                                    {cell.day}
                                </div>
                            {/if}
                        {/each}
                    </div>

                    <!-- Legend -->
                    <div class="flex items-center gap-3 pt-1 border-t border-muted/30">
                        <div class="flex items-center gap-1 text-[10px] text-warm-gray">
                            <span class="w-2.5 h-2.5 rounded-sm bg-terracotta inline-block shrink-0"></span>
                            Drawn
                        </div>
                    </div>
                </div>

            </div>

            <!-- Image grids -->
            <div class="flex flex-col gap-6 flex-1 min-w-0">
                {#if statsData.totalDraws === 0 && statsData.totalSkips === 0}
                    <div class="bg-canvas border border-muted rounded-xl p-8 text-center">
                        <ChartNoAxesColumn class="w-10 h-10 text-muted mx-auto mb-3" />
                        <p class="text-ink font-medium">No sessions yet</p>
                        <p class="text-warm-gray text-sm mt-1">Start a draw session to begin tracking your activity.</p>
                    </div>
                {:else}
                    {#if statsData.mostDrawn.length > 0}
                        <div class="flex flex-col gap-2">
                            <h2 class="text-sm font-semibold text-ink flex items-center gap-1.5">
                                <Pencil class="w-3.5 h-3.5 text-terracotta" />
                                Most Drawn
                            </h2>
                            <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-2">
                                {#each statsData.mostDrawn as img (img.imageId)}
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
                                        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <div class="absolute top-1 right-1 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm rounded px-1 py-0.5 text-white text-[10px] font-medium tabular-nums">
                                            <Pencil class="w-2 h-2" />
                                            {img.drawCount}
                                        </div>
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    {#if statsData.mostSkipped.length > 0}
                        <div class="flex flex-col gap-2">
                            <h2 class="text-sm font-semibold text-ink flex items-center gap-1.5">
                                <SkipForward class="w-3.5 h-3.5 text-terracotta" />
                                Most Skipped
                            </h2>
                            <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-2">
                                {#each statsData.mostSkipped as img (img.imageId)}
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
                                        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <div class="absolute top-1 right-1 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm rounded px-1 py-0.5 text-white text-[10px] font-medium tabular-nums">
                                            <SkipForward class="w-2 h-2" />
                                            {img.skipCount}
                                        </div>
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {/if}
                {/if}
            </div>
        </div>
    {/if}
</div>

<ImageMetadataModal bind:open={imageModalOpen} image={selectedImage} />
