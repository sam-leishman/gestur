<script lang="ts">
    import Modal from '$lib/components/Modal.svelte';
    import { Heart, Plus, Trash2 } from 'lucide-svelte';
    import type { SessionImage } from '$lib/types';

    type FieldType = 'text' | 'number' | 'boolean' | 'select';
    type SubjectField = {
        id: string;
        subjectId: string;
        name: string;
        type: FieldType;
        options: string[] | null;
        required: boolean;
        sortOrder: number;
        value: string | null;
    };
    type LinkedSubject = {
        imageSubjectId: string;
        subjectId: string;
        subjectName: string;
        label: string | null;
        fields: SubjectField[];
    };
    type ImageData = {
        id: string;
        title: string;
        filePath: string;
        liked: boolean;
        subjects: LinkedSubject[];
    };
    type AvailableSubject = { id: string; name: string };

    let {
        open = $bindable(false),
        image,
        onLikeChange
    }: {
        open: boolean;
        image: SessionImage | null;
        onLikeChange?: (imageId: string, liked: boolean) => void;
    } = $props();

    let imageData = $state<ImageData | null>(null);
    let liked = $state(false);
    let loading = $state(false);
    let titleDraft = $state('');
    let titleDirty = $state(false);
    let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
    let allSubjects = $state<AvailableSubject[]>([]);
    let addSubjectOpen = $state(false);
    let removingSubjectId = $state<string | null>(null);

    const fieldTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const labelTimers = new Map<string, ReturnType<typeof setTimeout>>();

    $effect(() => {
        const img = image;
        if (!open || !img) return;

        loading = true;
        imageData = null;
        titleDirty = false;
        addSubjectOpen = false;
        removingSubjectId = null;
        saveStatus = 'idle';

        fetch(`/api/images?path=${encodeURIComponent(img.filePath)}`)
            .then((r) => r.json())
            .then((data: { image: ImageData | null }) => {
                imageData = data.image;
                liked = data.image?.liked ?? false;
                titleDraft = data.image?.title ?? img.filePath.split('/').pop() ?? '';
                loading = false;
            })
            .catch(() => { loading = false; });

        return () => {
            for (const timer of fieldTimers.values()) clearTimeout(timer);
            fieldTimers.clear();
            for (const timer of labelTimers.values()) clearTimeout(timer);
            labelTimers.clear();
        };
    });

    $effect(() => {
        fetch('/api/subjects')
            .then((r) => r.json())
            .then((data: AvailableSubject[]) => { allSubjects = data; })
            .catch(() => {});
    });

    $effect(() => {
        const draft = titleDraft;
        if (!image || !titleDirty || !draft.trim()) return;
        const timer = setTimeout(() => saveTitle(draft), 500);
        return () => clearTimeout(timer);
    });

    async function saveTitle(title: string) {
        if (!image || !title.trim()) return;
        saveStatus = 'saving';
        try {
            if (!imageData) {
                const res = await fetch('/api/images', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filePath: image.filePath, title: title.trim() })
                });
                if (!res.ok) { saveStatus = 'error'; return; }
                imageData = await res.json();
            } else {
                const res = await fetch(`/api/images/${imageData.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: title.trim() })
                });
                if (!res.ok) { saveStatus = 'error'; return; }
            }
            saveStatus = 'saved';
            setTimeout(() => { saveStatus = 'idle'; }, 1500);
        } catch {
            saveStatus = 'error';
        }
    }

    async function ensureImage(): Promise<ImageData | null> {
        if (imageData) return imageData;
        if (!image) return null;
        const res = await fetch('/api/images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: image.filePath, title: titleDraft.trim() || image.filePath.split('/').pop() })
        });
        if (!res.ok) return null;
        imageData = await res.json();
        return imageData;
    }

    async function addSubject(subjectId: string) {
        addSubjectOpen = false;
        const img = await ensureImage();
        if (!img) return;
        const res = await fetch(`/api/images/${img.id}/subjects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subjectId })
        });
        if (!res.ok) return;
        imageData = await res.json();
    }

    async function removeSubject(imageSubjectId: string) {
        if (!imageData) return;
        if (removingSubjectId !== imageSubjectId) {
            removingSubjectId = imageSubjectId;
            return;
        }
        removingSubjectId = null;
        const res = await fetch(`/api/images/${imageData.id}/subjects/${imageSubjectId}`, { method: 'DELETE' });
        if (!res.ok) return;
        imageData = {
            ...imageData,
            subjects: imageData.subjects.filter((s) => s.imageSubjectId !== imageSubjectId)
        };
    }

    function onFieldChange(
        linkedSubject: LinkedSubject,
        field: SubjectField,
        value: string | null,
        immediate = false
    ) {
        if (!imageData) return;
        const imageId = imageData.id;
        const key = `${linkedSubject.imageSubjectId}:${field.id}`;

        imageData = {
            ...imageData,
            subjects: imageData.subjects.map((s) =>
                s.imageSubjectId === linkedSubject.imageSubjectId
                    ? { ...s, fields: s.fields.map((f) => (f.id === field.id ? { ...f, value } : f)) }
                    : s
            )
        };

        if (fieldTimers.has(key)) clearTimeout(fieldTimers.get(key)!);
        const delay = immediate ? 0 : 500;
        const timer = setTimeout(async () => {
            fieldTimers.delete(key);
            await fetch(
                `/api/images/${imageId}/subjects/${linkedSubject.imageSubjectId}/fields/${field.id}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ value })
                }
            );
        }, delay);
        fieldTimers.set(key, timer);
    }

    function onLabelChange(linkedSubject: LinkedSubject, value: string) {
        if (!imageData) return;
        const imageId = imageData.id;
        const key = linkedSubject.imageSubjectId;

        imageData = {
            ...imageData,
            subjects: imageData.subjects.map((s) =>
                s.imageSubjectId === key ? { ...s, label: value || null } : s
            )
        };

        if (labelTimers.has(key)) clearTimeout(labelTimers.get(key)!);
        const timer = setTimeout(async () => {
            labelTimers.delete(key);
            await fetch(`/api/images/${imageId}/subjects/${key}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: value || null })
            });
        }, 500);
        labelTimers.set(key, timer);
    }

    async function toggleLike() {
        if (!imageData) return;
        const id = imageData.id;
        const next = !liked;
        liked = next;
        try {
            const res = await fetch(`/api/images/${id}/like`, { method: 'POST' });
            if (!res.ok) { liked = !next; return; }
            const data: { liked: boolean } = await res.json();
            liked = data.liked;
            onLikeChange?.(id, data.liked);
        } catch { liked = !next; }
    }

    const fileName = $derived(image?.filePath.split('/').pop() ?? '');
</script>

<Modal bind:open title={titleDraft || fileName} maxWidth="max-w-3xl">
    {#snippet headerActions()}
        {#if imageData}
            <button
                type="button"
                onclick={toggleLike}
                class="p-1.5 rounded-lg transition-colors {liked ? 'text-terracotta' : 'text-warm-gray hover:text-terracotta hover:bg-pressed'}"
                aria-label={liked ? 'Unlike' : 'Like'}
                title={liked ? 'Unlike' : 'Like'}
            >
                <Heart class="w-4 h-4 {liked ? 'fill-current' : ''}" />
            </button>
        {/if}
    {/snippet}
    <div class="flex flex-col md:flex-row gap-5">
        <!-- Image preview -->
        <div class="md:w-72 md:shrink-0 flex items-center justify-center bg-pressed rounded-lg overflow-hidden h-52 md:h-80">
            {#if image}
                <img
                    src="/api/images/file?path={encodeURIComponent(image.filePath)}"
                    alt={fileName}
                    class="max-w-full max-h-full object-contain"
                />
            {/if}
        </div>

        <!-- Metadata panel -->
        <div class="flex-1 flex flex-col gap-4 overflow-y-auto md:max-h-80">
            {#if loading}
                <div class="flex flex-col gap-3">
                    {#each Array(3) as _, i (i)}
                        <div class="h-10 bg-pressed rounded-lg animate-pulse" style="opacity: {1 - i * 0.25}"></div>
                    {/each}
                </div>
            {:else}
                <!-- Title -->
                <div class="flex flex-col gap-1.5">
                    <div class="flex items-center justify-between">
                        <label for="modal-image-title" class="text-sm font-medium text-warm-gray">Title</label>
                        {#if saveStatus === 'saving'}
                            <span class="text-xs text-warm-gray">Saving…</span>
                        {:else if saveStatus === 'saved'}
                            <span class="text-xs text-terracotta">Saved</span>
                        {:else if saveStatus === 'error'}
                            <span class="text-xs text-red-600">Error saving</span>
                        {/if}
                    </div>
                    <input
                        id="modal-image-title"
                        type="text"
                        bind:value={titleDraft}
                        oninput={() => { titleDirty = true; }}
                        placeholder="Image title…"
                        class="rounded-lg border-muted w-full"
                    />
                </div>

                <!-- Subjects -->
                <div class="flex flex-col gap-3">
                    <div class="flex items-center justify-between">
                        <h3 class="text-sm font-semibold text-ink">Subjects</h3>
                        <div class="relative">
                            <button
                                type="button"
                                onclick={() => { addSubjectOpen = !addSubjectOpen; }}
                                class="btn btn-primary flex items-center gap-1 text-sm py-1.5 px-3"
                            >
                                <Plus class="w-3.5 h-3.5" />
                                Add Subject
                            </button>
                            {#if addSubjectOpen}
                                <div
                                    class="fixed inset-0 z-10"
                                    onclick={() => { addSubjectOpen = false; }}
                                    aria-hidden="true"
                                ></div>
                                <div class="absolute right-0 z-20 mt-1 w-52 bg-canvas border border-muted rounded-lg shadow-lg overflow-hidden">
                                    {#if allSubjects.length === 0}
                                        <p class="text-sm text-warm-gray px-3 py-2">No subjects defined</p>
                                    {:else}
                                        <div class="max-h-48 overflow-y-auto">
                                            {#each allSubjects as subject (subject.id)}
                                                <button
                                                    type="button"
                                                    onclick={() => addSubject(subject.id)}
                                                    class="w-full text-left px-3 py-2 text-sm text-ink hover:bg-pressed transition-colors"
                                                >
                                                    {subject.name}
                                                </button>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    </div>

                    {#if !imageData || imageData.subjects.length === 0}
                        <p class="text-sm text-warm-gray py-1">No subjects linked — add one above</p>
                    {:else}
                        <div class="flex flex-col gap-3">
                            {#each imageData.subjects as linkedSubject (linkedSubject.imageSubjectId)}
                                {@const instanceCount = imageData.subjects.filter((s) => s.subjectId === linkedSubject.subjectId).length}
                                {@const instanceOrdinal = instanceCount > 1 ? imageData.subjects.filter((s) => s.subjectId === linkedSubject.subjectId).findIndex((s) => s.imageSubjectId === linkedSubject.imageSubjectId) + 1 : null}
                                <div class="border border-muted rounded-lg overflow-hidden">
                                    <div class="flex items-center gap-2 px-3 py-2 bg-pressed">
                                        <span class="text-xs font-medium text-warm-gray shrink-0 bg-canvas border border-muted rounded px-1.5 py-0.5">
                                            {linkedSubject.subjectName}{instanceOrdinal ? ` #${instanceOrdinal}` : ''}
                                        </span>
                                        <input
                                            type="text"
                                            value={linkedSubject.label ?? ''}
                                            oninput={(e) => onLabelChange(linkedSubject, e.currentTarget.value)}
                                            placeholder="Add label…"
                                            class="flex-1 min-w-0 text-sm font-medium text-ink bg-transparent border-0 p-0 focus:ring-0 placeholder:text-muted"
                                        />
                                        <button
                                            type="button"
                                            onclick={() => removeSubject(linkedSubject.imageSubjectId)}
                                            class="p-1 rounded transition-colors shrink-0
                                                {removingSubjectId === linkedSubject.imageSubjectId
                                                    ? 'text-red-600 bg-red-50'
                                                    : 'text-warm-gray hover:text-red-600'}"
                                            title={removingSubjectId === linkedSubject.imageSubjectId ? 'Click again to confirm' : 'Remove subject'}
                                            aria-label="Remove subject"
                                        >
                                            <Trash2 class="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    {#if linkedSubject.fields.length === 0}
                                        <p class="text-xs text-warm-gray px-3 py-2">No fields defined for this subject</p>
                                    {:else}
                                        <div class="flex flex-col gap-3 p-3">
                                            {#each linkedSubject.fields as field (field.id)}
                                                <div class="flex flex-col gap-1">
                                                    <label
                                                        for="modal-field-{linkedSubject.imageSubjectId}-{field.id}"
                                                        class="text-xs font-medium text-warm-gray flex items-center gap-1"
                                                    >
                                                        {field.name}
                                                        {#if field.required}<span class="text-terracotta">*</span>{/if}
                                                    </label>

                                                    {#if field.type === 'boolean'}
                                                        <label class="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                id="modal-field-{linkedSubject.imageSubjectId}-{field.id}"
                                                                type="checkbox"
                                                                checked={field.value === 'true'}
                                                                onchange={(e) => onFieldChange(linkedSubject, field, e.currentTarget.checked ? 'true' : 'false', true)}
                                                                class="rounded border-muted"
                                                            />
                                                            <span class="text-sm text-ink">Yes</span>
                                                        </label>
                                                    {:else if field.type === 'select'}
                                                        <select
                                                            id="modal-field-{linkedSubject.imageSubjectId}-{field.id}"
                                                            value={field.value ?? ''}
                                                            onchange={(e) => onFieldChange(linkedSubject, field, e.currentTarget.value || null, true)}
                                                            class="rounded-lg border-muted text-sm w-full"
                                                        >
                                                            <option value="">— Select —</option>
                                                            {#each field.options ?? [] as option (option)}
                                                                <option value={option}>{option}</option>
                                                            {/each}
                                                        </select>
                                                    {:else if field.type === 'number'}
                                                        <input
                                                            id="modal-field-{linkedSubject.imageSubjectId}-{field.id}"
                                                            type="number"
                                                            value={field.value ?? ''}
                                                            oninput={(e) => onFieldChange(linkedSubject, field, e.currentTarget.value || null)}
                                                            placeholder="Enter number…"
                                                            class="rounded-lg border-muted text-sm w-full"
                                                        />
                                                    {:else}
                                                        <input
                                                            id="modal-field-{linkedSubject.imageSubjectId}-{field.id}"
                                                            type="text"
                                                            value={field.value ?? ''}
                                                            oninput={(e) => onFieldChange(linkedSubject, field, e.currentTarget.value || null)}
                                                            placeholder="Enter text…"
                                                            class="rounded-lg border-muted text-sm w-full"
                                                        />
                                                    {/if}
                                                </div>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
</Modal>
