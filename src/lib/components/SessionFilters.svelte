<script lang="ts">
    import { ChevronDown, ChevronRight, Plus } from 'lucide-svelte';
    import DirectorySelector from '$lib/components/DirectorySelector.svelte';
    import SubjectFilterGroup from '$lib/components/SubjectFilterGroup.svelte';
    import Modal from '$lib/components/Modal.svelte';
    import type { Subject, SessionImageFilter } from '$lib/types';

    let {
        filter = $bindable(),
        matchCount,
        matchCountLoading,
        imageCount
    }: {
        filter: SessionImageFilter;
        matchCount: number | null;
        matchCountLoading: boolean;
        imageCount: number;
    } = $props();

    let open = $state(false);
    let allSubjects = $state<Subject[]>([]);
    let addSubjectOpen = $state(false);

    $effect(() => {
        fetch('/api/subjects')
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then((data: Subject[]) => {
                allSubjects = data;
            })
            .catch(() => {});
    });

    const availableSubjects = $derived(
        allSubjects.filter((s) => !filter.subjects.some((f) => f.subjectId === s.id))
    );

    function subjectById(id: string): Subject | undefined {
        return allSubjects.find((s) => s.id === id);
    }

    function addSubject(subjectId: string) {
        filter = { ...filter, subjects: [...filter.subjects, { subjectId, fields: [] }] };
        addSubjectOpen = false;
    }

    function removeSubject(subjectId: string) {
        filter = { ...filter, subjects: filter.subjects.filter((f) => f.subjectId !== subjectId) };
    }

    const summary = $derived(
        [
            filter.directories.length === 0 ? 'All directories' : `${filter.directories.length} directories`,
            filter.likedOnly ? 'Liked only' : 'All images',
            filter.subjects.length === 0
                ? 'All subjects'
                : `${filter.subjects.length} subject${filter.subjects.length > 1 ? 's' : ''}`
        ].join(' · ')
    );

    const showRepeatWarning = $derived(matchCount !== null && matchCount > 0 && matchCount < imageCount);
    const noMatches = $derived(matchCount === 0);
</script>

<div class="rounded-lg border border-muted bg-canvas overflow-hidden">
    <button
        type="button"
        onclick={() => (open = !open)}
        class="flex items-center gap-2 w-full py-3 px-4 text-left"
    >
        {#if open}
            <ChevronDown class="w-4 h-4 text-warm-gray shrink-0" />
        {:else}
            <ChevronRight class="w-4 h-4 text-warm-gray shrink-0" />
        {/if}
        <span class="text-sm font-medium text-ink flex-1">Filter images</span>
        <span class="text-xs text-warm-gray truncate max-w-[60%]">{summary}</span>
    </button>

    {#if open}
        <div class="flex flex-col gap-4 px-4 pb-4 border-t border-muted pt-4">
            <!-- Directories -->
            <div class="flex flex-col gap-1.5">
                <span class="text-sm font-medium text-ink">Directories</span>
                <DirectorySelector bind:selected={filter.directories} />
            </div>

            <!-- Liked -->
            <div class="flex flex-col gap-1.5">
                <span class="text-sm font-medium text-ink">Liked</span>
                <div class="flex gap-2">
                    <button
                        type="button"
                        onclick={() => (filter = { ...filter, likedOnly: false })}
                        class="btn text-sm {!filter.likedOnly ? 'btn-primary' : 'btn-terracotta-tint'}"
                    >
                        All images
                    </button>
                    <button
                        type="button"
                        onclick={() => (filter = { ...filter, likedOnly: true })}
                        class="btn text-sm {filter.likedOnly ? 'btn-primary' : 'btn-terracotta-tint'}"
                    >
                        Liked only
                    </button>
                </div>
            </div>

            <!-- Subjects -->
            <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-ink">Subjects</span>
                    <button
                        type="button"
                        onclick={() => (addSubjectOpen = true)}
                        class="flex items-center gap-1 text-xs text-terracotta hover:text-terracotta/80 transition-colors font-medium"
                    >
                        <Plus class="w-3.5 h-3.5" />
                        Add subject
                    </button>
                </div>

                {#if filter.subjects.length === 0}
                    <p class="text-xs text-warm-gray">No subject filters — all catalogued subjects included.</p>
                {:else}
                    <div class="flex flex-col gap-2">
                        {#each filter.subjects as subjectFilter, i (subjectFilter.subjectId)}
                            {@const subject = subjectById(subjectFilter.subjectId)}
                            {#if subject}
                                <SubjectFilterGroup
                                    {subject}
                                    bind:filter={filter.subjects[i]}
                                    onRemove={() => removeSubject(subjectFilter.subjectId)}
                                />
                            {/if}
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Match feedback -->
            <div class="flex flex-col gap-1 border-t border-muted pt-3">
                <p class="text-sm text-ink">
                    {#if matchCountLoading}
                        Counting matching images…
                    {:else if matchCount !== null}
                        Matching images: <span class="font-semibold">{matchCount}</span>
                    {/if}
                </p>
                {#if noMatches}
                    <p class="text-sm text-red-600">No images match these filters. Try widening your selection.</p>
                {:else if showRepeatWarning}
                    <p class="text-sm text-warm-gray">
                        Only {matchCount} image{matchCount === 1 ? '' : 's'} match — some images will repeat during this session.
                    </p>
                {/if}
            </div>
        </div>
    {/if}
</div>

<Modal bind:open={addSubjectOpen} title="Add subject filter" maxWidth="max-w-sm">
    {#if availableSubjects.length === 0}
        <p class="text-sm text-warm-gray py-4 text-center">
            {allSubjects.length === 0 ? 'No subjects have been created yet.' : 'All subjects are already added.'}
        </p>
    {:else}
        <div class="flex flex-col divide-y divide-muted -mx-2 max-h-72 overflow-y-auto">
            {#each availableSubjects as subject (subject.id)}
                <button
                    type="button"
                    onclick={() => addSubject(subject.id)}
                    class="py-2 px-2 text-left text-sm text-ink hover:bg-pressed transition-colors"
                >
                    {subject.name}
                </button>
            {/each}
        </div>
    {/if}
</Modal>
