<script lang="ts">
    import { ChevronDown, ChevronRight, Plus, X } from 'lucide-svelte';
    import DirectorySelector from '$lib/components/DirectorySelector.svelte';
    import SubjectFilterGroup from '$lib/components/SubjectFilterGroup.svelte';
    import Modal from '$lib/components/Modal.svelte';
    import ItemPickerList from '$lib/components/ItemPickerList.svelte';
    import type { Subject, Tag, SessionImageFilter } from '$lib/types';

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
    let allTags = $state<Tag[]>([]);
    let addSubjectOpen = $state(false);
    let addTagOpen = $state(false);

    $effect(() => {
        fetch('/api/subjects')
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then((data: Subject[]) => {
                allSubjects = data;
            })
            .catch(() => {});
    });

    $effect(() => {
        fetch('/api/tags')
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then((data: Tag[]) => {
                allTags = data;
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

    const selectedTags = $derived(
        filter.tagIds.map((id) => allTags.find((t) => t.id === id)).filter((t): t is Tag => !!t)
    );
    const availableTags = $derived(allTags.filter((t) => !filter.tagIds.includes(t.id)));

    function addTagFilter(tagId: string) {
        filter = { ...filter, tagIds: [...filter.tagIds, tagId] };
        addTagOpen = false;
    }

    function removeTagFilter(tagId: string) {
        filter = { ...filter, tagIds: filter.tagIds.filter((id) => id !== tagId) };
    }

    const summary = $derived(
        [
            filter.directories.length === 0 ? 'All directories' : `${filter.directories.length} directories`,
            filter.likedOnly ? 'Liked only' : 'All images',
            filter.subjects.length === 0
                ? 'All subjects'
                : `${filter.subjects.length} subject${filter.subjects.length > 1 ? 's' : ''}`,
            filter.tagIds.length === 0
                ? 'All tags'
                : `${filter.tagIds.length} tag${filter.tagIds.length > 1 ? 's' : ''}`
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

            <!-- Tags -->
            <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-ink">Tags</span>
                    <button
                        type="button"
                        onclick={() => (addTagOpen = true)}
                        class="flex items-center gap-1 text-xs text-terracotta hover:text-terracotta/80 transition-colors font-medium"
                    >
                        <Plus class="w-3.5 h-3.5" />
                        Add tag
                    </button>
                </div>

                {#if selectedTags.length === 0}
                    <p class="text-xs text-warm-gray">No tag filters — all tagged (and untagged) images included.</p>
                {:else}
                    <div class="flex flex-wrap gap-1.5">
                        {#each selectedTags as tag (tag.id)}
                            <span class="flex items-center gap-1 text-xs bg-terracotta-tint text-terracotta rounded-full pl-2.5 pr-1 py-1">
                                {tag.name}
                                <button
                                    type="button"
                                    onclick={() => removeTagFilter(tag.id)}
                                    class="p-0.5 rounded-full hover:bg-terracotta/20 transition-colors"
                                    aria-label="Remove {tag.name} filter"
                                >
                                    <X class="w-3 h-3" />
                                </button>
                            </span>
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
    <ItemPickerList
        items={availableSubjects}
        onSelect={addSubject}
        emptyMessage={allSubjects.length === 0 ? 'No subjects have been created yet.' : 'All subjects are already added.'}
        searchPlaceholder="Search subjects…"
        variant="list"
    />
</Modal>

<Modal bind:open={addTagOpen} title="Add tag filter" maxWidth="max-w-sm">
    <ItemPickerList
        items={availableTags}
        onSelect={addTagFilter}
        emptyMessage={allTags.length === 0 ? 'No tags have been created yet.' : 'All tags are already added.'}
        searchPlaceholder="Search tags…"
        variant="list"
    />
</Modal>
