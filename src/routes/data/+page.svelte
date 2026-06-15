<script lang="ts">
    import { Plus, Pencil, Trash2, GripVertical, ChevronRight } from 'lucide-svelte';
    import Modal from '$lib/components/Modal.svelte';

    type Subject = { id: string; name: string };
    type FieldType = 'text' | 'number' | 'boolean' | 'select';
    type SubjectField = {
        id: string;
        subjectId: string;
        name: string;
        type: FieldType;
        options: string[] | null;
        required: boolean;
        sortOrder: number;
    };

    // ── State ──────────────────────────────────────────────────────────────────
    let subjects = $state<Subject[]>([]);
    let selectedSubject = $state<Subject | null>(null);
    let fields = $state<SubjectField[]>([]);

    let subjectsLoading = $state(true);
    let fieldsLoading = $state(false);
    let subjectsError = $state<string | null>(null);
    let fieldsError = $state<string | null>(null);

    // ── Subject modal ──────────────────────────────────────────────────────────
    let subjectModalOpen = $state(false);
    let subjectModalEdit = $state<Subject | null>(null);
    let subjectName = $state('');
    let subjectSaving = $state(false);
    let subjectModalError = $state<string | null>(null);

    // ── Field modal ────────────────────────────────────────────────────────────
    let fieldModalOpen = $state(false);
    let fieldModalEdit = $state<SubjectField | null>(null);
    let fieldName = $state('');
    let fieldType = $state<FieldType>('text');
    let fieldOptions = $state<string[]>(['']);
    let fieldRequired = $state(false);
    let fieldSaving = $state(false);
    let fieldModalError = $state<string | null>(null);

    // ── Delete confirmation ────────────────────────────────────────────────────
    let deletingSubjectId = $state<string | null>(null);
    let deletingFieldId = $state<string | null>(null);

    // ── Drag-and-drop (fields) ────────────────────────────────────────────────
    let dragSourceIndex = $state<number | null>(null);
    let dragOverIndex = $state<number | null>(null);

    // ── Drag-and-drop (options) ───────────────────────────────────────────────
    let optionDragSource = $state<number | null>(null);
    let optionDragOver = $state<number | null>(null);

    // ── Load subjects on mount ─────────────────────────────────────────────────
    $effect(() => {
        loadSubjects();
    });

    async function loadSubjects() {
        subjectsLoading = true;
        subjectsError = null;
        try {
            const res = await fetch('/api/subjects');
            if (!res.ok) throw new Error();
            subjects = await res.json();
        } catch {
            subjectsError = 'Failed to load subjects.';
        } finally {
            subjectsLoading = false;
        }
    }

    async function loadFields(subjectId: string) {
        fieldsLoading = true;
        fieldsError = null;
        try {
            const res = await fetch(`/api/subjects/${subjectId}/fields`);
            if (!res.ok) throw new Error();
            fields = await res.json();
        } catch {
            fieldsError = 'Failed to load fields.';
        } finally {
            fieldsLoading = false;
        }
    }

    function selectSubject(subject: Subject) {
        selectedSubject = subject;
        deletingFieldId = null;
        loadFields(subject.id);
    }

    // ── Subject modal helpers ──────────────────────────────────────────────────
    function openCreateSubject() {
        subjectModalEdit = null;
        subjectName = '';
        subjectModalError = null;
        subjectModalOpen = true;
    }

    function openEditSubject(subject: Subject, e: MouseEvent) {
        e.stopPropagation();
        subjectModalEdit = subject;
        subjectName = subject.name;
        subjectModalError = null;
        subjectModalOpen = true;
    }

    async function saveSubject() {
        subjectSaving = true;
        subjectModalError = null;
        try {
            const url = subjectModalEdit ? `/api/subjects/${subjectModalEdit.id}` : '/api/subjects';
            const res = await fetch(url, {
                method: subjectModalEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: subjectName })
            });
            if (!res.ok) {
                const err = await res.json();
                subjectModalError = err.error ?? 'Failed to save.';
                return;
            }
            const result: Subject = await res.json();
            if (subjectModalEdit) {
                subjects = subjects
                    .map((s) => (s.id === result.id ? result : s))
                    .sort((a, b) => a.name.localeCompare(b.name));
                if (selectedSubject?.id === result.id) selectedSubject = result;
            } else {
                subjects = [...subjects, result].sort((a, b) => a.name.localeCompare(b.name));
            }
            subjectModalOpen = false;
        } finally {
            subjectSaving = false;
        }
    }

    function confirmDeleteSubject(id: string, e: MouseEvent) {
        e.stopPropagation();
        if (deletingSubjectId === id) {
            doDeleteSubject(id);
        } else {
            deletingSubjectId = id;
        }
    }

    async function doDeleteSubject(id: string) {
        const res = await fetch(`/api/subjects/${id}`, { method: 'DELETE' });
        if (!res.ok) return;
        subjects = subjects.filter((s) => s.id !== id);
        if (selectedSubject?.id === id) {
            selectedSubject = null;
            fields = [];
        }
        deletingSubjectId = null;
    }

    // ── Field modal helpers ────────────────────────────────────────────────────
    function openCreateField() {
        fieldModalEdit = null;
        fieldName = '';
        fieldType = 'text';
        fieldOptions = [''];
        fieldRequired = false;
        fieldModalError = null;
        fieldModalOpen = true;
    }

    function openEditField(field: SubjectField) {
        fieldModalEdit = field;
        fieldName = field.name;
        fieldType = field.type;
        fieldOptions = field.options?.length ? [...field.options, ''] : [''];
        fieldRequired = field.required;
        fieldModalError = null;
        fieldModalOpen = true;
    }

    function addOption() {
        fieldOptions = [...fieldOptions, ''];
    }

    function removeOption(i: number) {
        fieldOptions = fieldOptions.filter((_, idx) => idx !== i);
        if (fieldOptions.length === 0) fieldOptions = [''];
    }

    function onOptionDragStart(index: number) {
        optionDragSource = index;
    }

    function onOptionDragOver(e: DragEvent, index: number) {
        e.preventDefault();
        optionDragOver = index;
    }

    function onOptionDrop(index: number) {
        if (optionDragSource === null || optionDragSource === index) {
            optionDragSource = null;
            optionDragOver = null;
            return;
        }
        const reordered = [...fieldOptions];
        const [moved] = reordered.splice(optionDragSource, 1);
        reordered.splice(index, 0, moved);
        fieldOptions = reordered;
        optionDragSource = null;
        optionDragOver = null;
    }

    function onOptionDragEnd() {
        optionDragSource = null;
        optionDragOver = null;
    }

    function cleanedOptions(): string[] {
        return fieldOptions.map((o) => o.trim()).filter(Boolean);
    }

    async function saveField() {
        if (!selectedSubject) return;
        fieldSaving = true;
        fieldModalError = null;
        const payload = {
            name: fieldName,
            type: fieldType,
            options: fieldType === 'select' ? cleanedOptions() : null,
            required: fieldRequired
        };
        try {
            const baseUrl = `/api/subjects/${selectedSubject.id}/fields`;
            const url = fieldModalEdit ? `${baseUrl}/${fieldModalEdit.id}` : baseUrl;
            const res = await fetch(url, {
                method: fieldModalEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const err = await res.json();
                fieldModalError = err.error ?? 'Failed to save.';
                return;
            }
            const result: SubjectField = await res.json();
            if (fieldModalEdit) {
                fields = fields.map((f) => (f.id === result.id ? result : f));
            } else {
                fields = [...fields, result];
            }
            fieldModalOpen = false;
        } finally {
            fieldSaving = false;
        }
    }

    function confirmDeleteField(id: string) {
        if (deletingFieldId === id) {
            doDeleteField(id);
        } else {
            deletingFieldId = id;
        }
    }

    async function doDeleteField(id: string) {
        if (!selectedSubject) return;
        const res = await fetch(`/api/subjects/${selectedSubject.id}/fields/${id}`, { method: 'DELETE' });
        if (!res.ok) return;
        fields = fields.filter((f) => f.id !== id);
        deletingFieldId = null;
    }

    // ── Drag-and-drop ──────────────────────────────────────────────────────────
    function onDragStart(index: number) {
        dragSourceIndex = index;
    }

    function onDragOver(e: DragEvent, index: number) {
        e.preventDefault();
        dragOverIndex = index;
    }

    function onDrop(index: number) {
        if (dragSourceIndex === null || dragSourceIndex === index) {
            dragSourceIndex = null;
            dragOverIndex = null;
            return;
        }
        const snapshot = [...fields];
        const reordered = [...fields];
        const [moved] = reordered.splice(dragSourceIndex, 1);
        reordered.splice(index, 0, moved);
        const withOrder = reordered.map((f, i) => ({ ...f, sortOrder: i }));
        fields = withOrder;
        dragSourceIndex = null;
        dragOverIndex = null;
        persistOrder(withOrder, snapshot);
    }

    function onDragEnd() {
        dragSourceIndex = null;
        dragOverIndex = null;
    }

    async function persistOrder(ordered: SubjectField[], snapshot: SubjectField[]) {
        if (!selectedSubject) return;
        try {
            const res = await fetch(`/api/subjects/${selectedSubject.id}/fields/reorder`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order: ordered.map((f) => ({ id: f.id, sortOrder: f.sortOrder }))
                })
            });
            if (!res.ok) fields = snapshot;
        } catch {
            fields = snapshot;
        }
    }

    const FIELD_TYPES: Record<FieldType, { label: string; color: string }> = {
        text:    { label: 'Text',      color: 'bg-blue-50 text-blue-700' },
        number:  { label: 'Number',    color: 'bg-purple-50 text-purple-700' },
        boolean: { label: 'Yes / No',  color: 'bg-green-50 text-green-700' },
        select:  { label: 'Select',    color: 'bg-terracotta-tint text-terracotta' }
    };
</script>

<!-- ── Subject modal ─────────────────────────────────────────────────────────── -->
<Modal bind:open={subjectModalOpen} title={subjectModalEdit ? 'Edit Subject' : 'New Subject'}>
    <form onsubmit={(e) => { e.preventDefault(); saveSubject(); }} class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
            <label for="subject-name" class="text-sm font-medium text-warm-gray">Name</label>
            <input
                id="subject-name"
                type="text"
                bind:value={subjectName}
                placeholder="e.g. Person, Animal…"
                class="rounded-lg border-muted w-full"
                required
            />
        </div>
        {#if subjectModalError}
            <p class="text-sm text-red-600">{subjectModalError}</p>
        {/if}
        <div class="flex justify-end gap-2">
            <button type="button" onclick={() => (subjectModalOpen = false)} class="btn btn-terracotta-tint text-ink">
                Cancel
            </button>
            <button type="submit" disabled={subjectSaving || !subjectName.trim()} class="btn btn-primary">
                {subjectSaving ? 'Saving…' : 'Save'}
            </button>
        </div>
    </form>
</Modal>

<!-- ── Field modal ───────────────────────────────────────────────────────────── -->
<Modal bind:open={fieldModalOpen} title={fieldModalEdit ? 'Edit Field' : 'New Field'}>
    <form onsubmit={(e) => { e.preventDefault(); saveField(); }} class="flex flex-col gap-4">
        <!-- Subject (read-only) -->
        <div class="flex flex-col gap-1">
            <span class="text-sm font-medium text-warm-gray">Subject</span>
            <span class="text-ink font-medium">{selectedSubject?.name}</span>
        </div>

        <!-- Name -->
        <div class="flex flex-col gap-1">
            <label for="field-name" class="text-sm font-medium text-warm-gray">Name</label>
            <input
                id="field-name"
                type="text"
                bind:value={fieldName}
                placeholder="e.g. Age, Gender…"
                class="rounded-lg border-muted w-full"
                required
            />
        </div>

        <!-- Type -->
        <div class="flex flex-col gap-1">
            <label for="field-type" class="text-sm font-medium text-warm-gray">Type</label>
            <select id="field-type" bind:value={fieldType} class="rounded-lg border-muted w-full">
                {#each Object.entries(FIELD_TYPES) as [value, { label }]}
                    <option {value}>{label}</option>
                {/each}
            </select>
        </div>

        <!-- Options (select only) -->
        {#if fieldType === 'select'}
            <div class="flex flex-col gap-2">
                <span class="text-sm font-medium text-warm-gray">Options</span>
                <div class="flex flex-col gap-2">
                    {#each fieldOptions as _, i (i)}
                        <div
                            class="flex items-center gap-2 rounded-lg transition-colors
                                {optionDragOver === i && optionDragSource !== i ? 'bg-terracotta-tint' : ''}"
                            role="listitem"
                            draggable="true"
                            ondragstart={() => onOptionDragStart(i)}
                            ondragover={(e) => onOptionDragOver(e, i)}
                            ondrop={() => onOptionDrop(i)}
                            ondragend={onOptionDragEnd}
                        >
                            <span class="cursor-grab text-muted hover:text-warm-gray transition-colors shrink-0" aria-hidden="true">
                                <GripVertical class="w-4 h-4" />
                            </span>
                            <input
                                type="text"
                                bind:value={fieldOptions[i]}
                                placeholder="Option {i + 1}"
                                class="rounded-lg border-muted flex-1 text-sm"
                            />
                            <button
                                type="button"
                                onclick={() => removeOption(i)}
                                class="text-warm-gray hover:text-red-600 transition-colors p-1 shrink-0"
                                aria-label="Remove option"
                            >
                                <Trash2 class="w-4 h-4" />
                            </button>
                        </div>
                    {/each}
                </div>
                <button
                    type="button"
                    onclick={addOption}
                    class="btn btn-terracotta-tint text-sm self-start flex items-center gap-1"
                >
                    <Plus class="w-4 h-4" />
                    Add option
                </button>
            </div>
        {/if}

        <!-- Required -->
        <label class="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" bind:checked={fieldRequired} class="rounded border-muted" />
            <span class="text-sm font-medium text-warm-gray">Required</span>
        </label>

        {#if fieldModalError}
            <p class="text-sm text-red-600">{fieldModalError}</p>
        {/if}

        <div class="flex justify-end gap-2">
            <button type="button" onclick={() => (fieldModalOpen = false)} class="btn btn-terracotta-tint text-ink">
                Cancel
            </button>
            <button type="submit" disabled={fieldSaving || !fieldName.trim()} class="btn btn-primary">
                {fieldSaving ? 'Saving…' : 'Save'}
            </button>
        </div>
    </form>
</Modal>

<!-- ── Page layout ───────────────────────────────────────────────────────────── -->
<div class="p-4 flex gap-4 h-[calc(100vh-var(--header-height))]">

    <!-- Subjects panel -->
    <div class="flex flex-col gap-3 w-64 shrink-0 bg-canvas border border-muted rounded-lg p-4 min-h-0">
        <div class="flex items-center justify-between">
            <h2 class="font-semibold text-ink">Subjects</h2>
            <button
                type="button"
                onclick={openCreateSubject}
                class="btn btn-primary p-1.5"
                aria-label="New subject"
            >
                <Plus class="w-4 h-4" />
            </button>
        </div>

        <div class="flex-1 overflow-y-auto min-h-0 flex flex-col gap-1">
            {#if subjectsLoading}
                {#each Array(4) as _, i (i)}
                    <div class="h-10 bg-pressed rounded-lg animate-pulse" style="opacity: {1 - i * 0.15}"></div>
                {/each}
            {:else if subjectsError}
                <p class="text-sm text-warm-gray text-center py-4">{subjectsError}</p>
            {:else if subjects.length === 0}
                <p class="text-sm text-warm-gray text-center py-4">No subjects yet</p>
            {:else}
                {#each subjects as subject (subject.id)}
                    <div
                        class="group flex items-center gap-1 rounded-lg px-2 py-2 cursor-pointer transition-colors
                            {selectedSubject?.id === subject.id
                                ? 'bg-terracotta-tint border border-terracotta/30'
                                : 'hover:bg-pressed'}"
                        onclick={() => { selectSubject(subject); deletingSubjectId = null; }}
                        onkeydown={(e) => e.key === 'Enter' && selectSubject(subject)}
                        role="button"
                        tabindex="0"
                        aria-pressed={selectedSubject?.id === subject.id}
                    >
                        <span class="flex-1 text-sm text-ink truncate">{subject.name}</span>
                        <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                                type="button"
                                onclick={(e) => openEditSubject(subject, e)}
                                class="p-1 text-warm-gray hover:text-ink transition-colors rounded"
                                aria-label="Edit subject"
                            >
                                <Pencil class="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onclick={(e) => confirmDeleteSubject(subject.id, e)}
                                class="p-1 transition-colors rounded
                                    {deletingSubjectId === subject.id
                                        ? 'text-red-600 bg-red-50'
                                        : 'text-warm-gray hover:text-red-600'}"
                                aria-label="Delete subject"
                                title={deletingSubjectId === subject.id ? 'Click again to confirm' : 'Delete'}
                            >
                                <Trash2 class="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <ChevronRight class="w-3.5 h-3.5 text-muted shrink-0 {selectedSubject?.id === subject.id ? 'opacity-100' : 'opacity-0'}" />
                    </div>
                {/each}
            {/if}
        </div>
    </div>

    <!-- Fields panel -->
    <div class="flex flex-col gap-3 flex-1 bg-canvas border border-muted rounded-lg p-4 min-h-0">
        {#if !selectedSubject}
            <div class="flex-1 flex items-center justify-center">
                <p class="text-warm-gray text-sm">Select a subject to view its fields</p>
            </div>
        {:else}
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="font-semibold text-ink">{selectedSubject.name}</h2>
                    <p class="text-xs text-warm-gray">Fields</p>
                </div>
                <button
                    type="button"
                    onclick={openCreateField}
                    class="btn btn-primary flex items-center gap-1.5 text-sm"
                >
                    <Plus class="w-4 h-4" />
                    Add Field
                </button>
            </div>

            <div class="flex-1 overflow-y-auto min-h-0">
                {#if fieldsLoading}
                    <div class="flex flex-col gap-2">
                        {#each Array(3) as _, i (i)}
                            <div class="h-14 bg-pressed rounded-lg animate-pulse" style="opacity: {1 - i * 0.2}"></div>
                        {/each}
                    </div>
                {:else if fieldsError}
                    <p class="text-sm text-warm-gray text-center py-4">{fieldsError}</p>
                {:else if fields.length === 0}
                    <p class="text-sm text-warm-gray text-center py-8">No fields yet — add one above</p>
                {:else}
                    <div class="flex flex-col divide-y divide-muted">
                        {#each fields as field, i (field.id)}
                            <div
                                class="group flex items-center gap-3 py-3 px-2 rounded-lg transition-colors
                                    {dragOverIndex === i && dragSourceIndex !== i ? 'bg-terracotta-tint' : 'hover:bg-pressed'}"
                                role="listitem"
                                draggable="true"
                                ondragstart={() => onDragStart(i)}
                                ondragover={(e) => onDragOver(e, i)}
                                ondrop={() => onDrop(i)}
                                ondragend={onDragEnd}
                            >
                                <!-- Drag handle -->
                                <span class="cursor-grab text-muted hover:text-warm-gray transition-colors shrink-0" aria-hidden="true">
                                    <GripVertical class="w-4 h-4" />
                                </span>

                                <!-- Field info -->
                                <div class="flex-1 flex items-center gap-3 min-w-0">
                                    <span class="text-sm text-ink font-medium truncate">{field.name}</span>
                                    <span class="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 {FIELD_TYPES[field.type].color}">
                                        {FIELD_TYPES[field.type].label}
                                    </span>
                                    {#if field.required}
                                        <span class="text-xs text-terracotta font-medium shrink-0">Required</span>
                                    {/if}
                                    {#if field.type === 'select' && field.options?.length}
                                        <span class="text-xs text-warm-gray truncate hidden sm:block">
                                            {field.options.join(', ')}
                                        </span>
                                    {/if}
                                </div>

                                <!-- Actions -->
                                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    <button
                                        type="button"
                                        onclick={() => openEditField(field)}
                                        class="p-1.5 text-warm-gray hover:text-ink transition-colors rounded"
                                        aria-label="Edit field"
                                    >
                                        <Pencil class="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onclick={() => confirmDeleteField(field.id)}
                                        class="p-1.5 transition-colors rounded
                                            {deletingFieldId === field.id
                                                ? 'text-red-600 bg-red-50'
                                                : 'text-warm-gray hover:text-red-600'}"
                                        aria-label="Delete field"
                                        title={deletingFieldId === field.id ? 'Click again to confirm' : 'Delete'}
                                    >
                                        <Trash2 class="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>