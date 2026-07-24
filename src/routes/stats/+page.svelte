<script lang="ts">
    import { onMount } from 'svelte';
    import { ChartNoAxesColumn, ChevronLeft, ChevronRight, Clock, Eye, Flame, Heart, History, Pencil, SkipForward, Target, Trophy, TriangleAlert } from 'lucide-svelte';
    import ImageMetadataModal from '$lib/components/ImageMetadataModal.svelte';
    import SessionHistoryDialog from '$lib/components/SessionHistoryDialog.svelte';
    import type { SessionImage, SessionStatus, SessionSummary } from '$lib/types';
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
        dailyGoalMinutes: number;
        todaySeconds: number;
    };

    const LOW_GOAL_WARNING_THRESHOLD_MINUTES = 9;
    const MIN_GOAL_MINUTES = 1;

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

    // ── Daily goal ─────────────────────────────────────────────────────────
    let goalInput = $state(30);
    let goalSaving = $state(false);
    let goalError = $state<string | null>(null);
    const showLowGoalWarning = $derived(goalInput >= MIN_GOAL_MINUTES && goalInput <= LOW_GOAL_WARNING_THRESHOLD_MINUTES);

    async function saveGoal() {
        if (!Number.isInteger(goalInput) || goalInput < MIN_GOAL_MINUTES) {
            goalError = `Goal must be at least ${MIN_GOAL_MINUTES} minute.`;
            return;
        }
        goalSaving = true;
        goalError = null;
        try {
            const res = await fetch('/api/goal', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dailyGoalMinutes: goalInput })
            });
            if (!res.ok) throw new Error('Failed to save goal');
            await loadData();
        } catch {
            goalError = 'Could not save your goal. Please try again.';
        } finally {
            goalSaving = false;
        }
    }

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
            const streak: StreakData = await streakRes.json();
            streakData = streak;
            goalInput = streak.dailyGoalMinutes;
        } catch {
            error = 'Could not load stats. Please try again.';
        } finally {
            loading = false;
        }
    }

    // ── Session history ─────────────────────────────────────────────────────
    const SESSIONS_PAGE_SIZE = 8;

    let sessions = $state<SessionSummary[]>([]);
    let sessionsTotal = $state(0);
    let sessionsPage = $state(0);
    let sessionsLoading = $state(true);
    let sessionsError = $state<string | null>(null);
    let statusFilter = $state<'all' | SessionStatus>('all');

    let historyDialogOpen = $state(false);
    let selectedSessionId = $state<string | null>(null);

    const sessionsTotalPages = $derived(Math.max(1, Math.ceil(sessionsTotal / SESSIONS_PAGE_SIZE)));

    async function loadSessions() {
        sessionsLoading = true;
        sessionsError = null;
        try {
            const params = new URLSearchParams({
                limit: String(SESSIONS_PAGE_SIZE),
                offset: String(sessionsPage * SESSIONS_PAGE_SIZE)
            });
            if (statusFilter !== 'all') params.set('status', statusFilter);
            const res = await fetch(`/api/sessions?${params}`);
            if (!res.ok) throw new Error('Failed to load sessions');
            const data: { sessions: SessionSummary[]; total: number } = await res.json();
            sessions = data.sessions;
            sessionsTotal = data.total;
        } catch {
            sessionsError = 'Could not load session history.';
        } finally {
            sessionsLoading = false;
        }
    }

    function setStatusFilter(value: 'all' | SessionStatus) {
        if (statusFilter === value) return;
        statusFilter = value;
        sessionsPage = 0;
        loadSessions();
    }

    function goToSessionsPage(page: number) {
        if (page < 0 || page >= sessionsTotalPages || page === sessionsPage) return;
        sessionsPage = page;
        loadSessions();
    }

    function openSession(id: string) {
        selectedSessionId = id;
        historyDialogOpen = true;
    }

    function formatSessionDate(iso: string) {
        return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    function formatSessionTime(iso: string) {
        return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }

    onMount(() => {
        loadData();
        loadSessions();
    });

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

        <!-- Daily goal -->
        <div class="bg-canvas border border-muted rounded-xl p-4 flex flex-col gap-3">
            <div class="flex items-center justify-between gap-3 flex-wrap">
                <div class="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <Target class="w-4 h-4 text-terracotta" />
                    Daily Goal
                </div>
                <form
                    onsubmit={(e) => { e.preventDefault(); saveGoal(); }}
                    class="flex items-center gap-2"
                >
                    <input
                        type="number"
                        min={MIN_GOAL_MINUTES}
                        step="1"
                        bind:value={goalInput}
                        class="rounded-lg border-muted w-20 text-center text-sm"
                        aria-label="Daily goal in minutes"
                    />
                    <span class="text-xs text-warm-gray">minutes / day</span>
                    <button
                        type="submit"
                        disabled={goalSaving || goalInput === streakData.dailyGoalMinutes}
                        class="btn btn-primary text-xs px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {goalSaving ? 'Saving…' : 'Save'}
                    </button>
                </form>
            </div>

            {#if showLowGoalWarning}
                <p class="flex items-center gap-1.5 text-xs text-amber-600">
                    <TriangleAlert class="w-3.5 h-3.5 shrink-0" />
                    A goal this low won't build much of a drawing habit. Consider aiming higher.
                </p>
            {/if}
            {#if goalError}
                <p class="text-xs text-red-600">{goalError}</p>
            {/if}

            <div class="flex flex-col gap-1">
                <div class="flex items-center justify-between text-xs text-warm-gray">
                    <span>Today's progress</span>
                    <span class="tabular-nums">
                        {Math.floor(streakData.todaySeconds / 60)}m{streakData.todaySeconds % 60 > 0 ? ` ${streakData.todaySeconds % 60}s` : ''} / {streakData.dailyGoalMinutes}m
                    </span>
                </div>
                <div class="h-2 rounded-full bg-pressed overflow-hidden">
                    <div
                        class="h-full bg-terracotta transition-all"
                        style="width: {Math.min(100, (streakData.todaySeconds / (streakData.dailyGoalMinutes * 60)) * 100)}%"
                    ></div>
                </div>
            </div>
        </div>

        <!-- Main content: calendar left, session history right -->
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

            <!-- Session history -->
            <div class="flex flex-col flex-1 min-w-0 w-full bg-canvas border border-muted rounded-xl overflow-hidden">
                <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-muted">
                    <h2 class="text-sm font-semibold text-ink flex items-center gap-1.5">
                        <History class="w-3.5 h-3.5 text-terracotta" />
                        Session History
                    </h2>
                    <select
                        value={statusFilter}
                        onchange={(e) => setStatusFilter(e.currentTarget.value as 'all' | SessionStatus)}
                        class="rounded-lg border-muted text-xs py-1.5"
                        aria-label="Filter sessions by status"
                    >
                        <option value="all">All sessions</option>
                        <option value="completed">Completed</option>
                        <option value="stopped">Stopped early</option>
                    </select>
                </div>

                {#if sessionsLoading}
                    <div class="flex flex-col gap-2 p-4">
                        {#each Array(4) as _, i (i)}
                            <div class="h-12 bg-pressed rounded-lg animate-pulse" style="opacity: {1 - i * 0.15}"></div>
                        {/each}
                    </div>
                {:else if sessionsError}
                    <p class="text-sm text-red-600 p-4">{sessionsError}</p>
                {:else if sessions.length === 0}
                    <div class="p-8 text-center">
                        <ChartNoAxesColumn class="w-8 h-8 text-muted mx-auto mb-2" />
                        <p class="text-ink font-medium text-sm">
                            {statusFilter === 'all' ? 'No sessions yet' : 'No sessions match this filter'}
                        </p>
                        <p class="text-warm-gray text-xs mt-1">Start a draw session to begin tracking your history.</p>
                    </div>
                {:else}
                    <div class="flex flex-col divide-y divide-muted/60">
                        {#each sessions as session (session.id)}
                            <button
                                type="button"
                                onclick={() => openSession(session.id)}
                                class="flex items-center gap-3 px-4 py-3 text-left hover:bg-pressed transition-colors"
                            >
                                <div class="flex flex-col shrink-0 w-16">
                                    <span class="text-sm font-medium text-ink">{formatSessionDate(session.completedAt)}</span>
                                    <span class="text-xs text-warm-gray">{formatSessionTime(session.completedAt)}</span>
                                </div>
                                <div class="flex items-center gap-3 flex-1 min-w-0 text-sm text-warm-gray">
                                    <span class="flex items-center gap-1 text-ink shrink-0">
                                        <Pencil class="w-3.5 h-3.5 text-terracotta shrink-0" />
                                        {session.drawnCount}
                                    </span>
                                    {#if session.skippedCount > 0}
                                        <span class="flex items-center gap-1 shrink-0">
                                            <SkipForward class="w-3.5 h-3.5 shrink-0" />
                                            {session.skippedCount}
                                        </span>
                                    {/if}
                                    <span class="hidden sm:flex items-center gap-1 text-xs shrink-0">
                                        <Clock class="w-3 h-3 shrink-0" />
                                        {session.durationSeconds}s/img
                                    </span>
                                </div>
                                <span
                                    class="shrink-0 text-xs font-medium px-2 py-1 rounded-full
                                        {session.status === 'completed' ? 'bg-terracotta-tint text-terracotta' : 'bg-pressed text-warm-gray'}"
                                >
                                    {session.status === 'completed' ? 'Completed' : 'Stopped early'}
                                </span>
                            </button>
                        {/each}
                    </div>

                    <!-- Pagination -->
                    <div class="flex items-center justify-between px-4 py-3 border-t border-muted mt-auto">
                        <p class="text-xs text-warm-gray">
                            {sessionsPage * SESSIONS_PAGE_SIZE + 1}–{Math.min(sessionsTotal, (sessionsPage + 1) * SESSIONS_PAGE_SIZE)} of {sessionsTotal}
                        </p>
                        <div class="flex items-center gap-1">
                            <button
                                type="button"
                                onclick={() => goToSessionsPage(sessionsPage - 1)}
                                disabled={sessionsPage === 0}
                                class="p-1.5 rounded text-warm-gray hover:text-ink hover:bg-pressed transition-colors disabled:opacity-30 disabled:cursor-default"
                                aria-label="Previous page"
                            >
                                <ChevronLeft class="w-4 h-4" />
                            </button>
                            <span class="text-xs text-warm-gray px-1 tabular-nums">{sessionsPage + 1} / {sessionsTotalPages}</span>
                            <button
                                type="button"
                                onclick={() => goToSessionsPage(sessionsPage + 1)}
                                disabled={sessionsPage >= sessionsTotalPages - 1}
                                class="p-1.5 rounded text-warm-gray hover:text-ink hover:bg-pressed transition-colors disabled:opacity-30 disabled:cursor-default"
                                aria-label="Next page"
                            >
                                <ChevronRight class="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                {/if}
            </div>
        </div>

        <!-- Top images (secondary) -->
        {#if statsData.mostDrawn.length > 0 || statsData.mostSkipped.length > 0}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {#if statsData.mostDrawn.length > 0}
                    <div class="flex flex-col gap-2">
                        <h2 class="text-xs font-semibold text-warm-gray uppercase tracking-wide flex items-center gap-1.5">
                            <Pencil class="w-3 h-3 text-terracotta" />
                            Most Drawn
                        </h2>
                        <div class="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                            {#each statsData.mostDrawn.slice(0, 6) as img (img.imageId)}
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
                                    <div class="absolute bottom-1 right-1 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm rounded px-1 py-0.5 text-white text-[10px] font-medium tabular-nums">
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
                        <h2 class="text-xs font-semibold text-warm-gray uppercase tracking-wide flex items-center gap-1.5">
                            <SkipForward class="w-3 h-3 text-terracotta" />
                            Most Skipped
                        </h2>
                        <div class="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                            {#each statsData.mostSkipped.slice(0, 6) as img (img.imageId)}
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
                                    <div class="absolute bottom-1 right-1 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm rounded px-1 py-0.5 text-white text-[10px] font-medium tabular-nums">
                                        <SkipForward class="w-2 h-2" />
                                        {img.skipCount}
                                    </div>
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
        {/if}
    {/if}
</div>

<ImageMetadataModal bind:open={imageModalOpen} image={selectedImage} />
<SessionHistoryDialog bind:open={historyDialogOpen} sessionId={selectedSessionId} />
