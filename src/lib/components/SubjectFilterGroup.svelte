<script lang="ts">
    import { ChevronDown, ChevronRight, X } from 'lucide-svelte';
    import type { Subject, SubjectField, SessionSubjectFilter } from '$lib/types';

    let {
        subject,
        filter = $bindable(),
        onRemove
    }: {
        subject: Subject;
        filter: SessionSubjectFilter;
        onRemove: () => void;
    } = $props();

    // Only `select` and `boolean` fields have a naturally bounded set of
    // values, so only those are surfaced here to avoid an overwhelming or
    // unbounded filter UI. `text`/`number` fields are omitted for now.
    let fields = $state<SubjectField[]>([]);
    let fieldsLoading = $state(true);
    let expanded = $state(false);

    $effect(() => {
        fieldsLoading = true;
        fetch(`/api/subjects/${subject.id}/fields`)
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then((data: SubjectField[]) => {
                fields = data.filter((f) => f.type === 'select' || f.type === 'boolean');
            })
            .catch(() => {})
            .finally(() => {
                fieldsLoading = false;
            });
    });

    function getFieldValues(fieldId: string): string[] {
        return filter.fields.find((f) => f.fieldId === fieldId)?.values ?? [];
    }

    function setFieldValues(fieldId: string, values: string[]) {
        const rest = filter.fields.filter((f) => f.fieldId !== fieldId);
        filter = { ...filter, fields: values.length > 0 ? [...rest, { fieldId, values }] : rest };
    }

    function toggleSelectValue(fieldId: string, value: string) {
        const current = getFieldValues(fieldId);
        setFieldValues(
            fieldId,
            current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
        );
    }

    function setBooleanValue(fieldId: string, value: 'true' | 'false') {
        const current = getFieldValues(fieldId);
        setFieldValues(fieldId, current.includes(value) ? [] : [value]);
    }

    const activeFieldCount = $derived(filter.fields.length);
</script>

<div class="rounded-lg border border-muted overflow-hidden">
    <div class="flex items-center gap-2 py-2 px-3 bg-pressed">
        <button
            type="button"
            onclick={() => (expanded = !expanded)}
            class="flex items-center gap-1.5 flex-1 min-w-0 text-left"
        >
            {#if expanded}
                <ChevronDown class="w-3.5 h-3.5 text-warm-gray shrink-0" />
            {:else}
                <ChevronRight class="w-3.5 h-3.5 text-warm-gray shrink-0" />
            {/if}
            <span class="text-sm font-medium text-ink truncate">{subject.name}</span>
            {#if activeFieldCount > 0}
                <span class="text-xs px-1.5 py-0.5 bg-terracotta-tint text-terracotta rounded-full font-medium shrink-0">
                    {activeFieldCount}
                </span>
            {/if}
        </button>
        <button
            type="button"
            onclick={onRemove}
            class="p-1 rounded text-warm-gray hover:text-red-600 transition-colors shrink-0"
            aria-label="Remove {subject.name} filter"
        >
            <X class="w-3.5 h-3.5" />
        </button>
    </div>

    {#if expanded}
        <div class="p-3 flex flex-col gap-3">
            {#if fieldsLoading}
                <p class="text-xs text-warm-gray">Loading fields…</p>
            {:else if fields.length === 0}
                <p class="text-xs text-warm-gray">No filterable fields for this subject.</p>
            {:else}
                {#each fields as field (field.id)}
                    <div class="flex flex-col gap-1.5">
                        <span class="text-xs font-medium text-warm-gray">{field.name}</span>
                        {#if field.type === 'boolean'}
                            <div class="flex gap-2">
                                {#each (['true', 'false'] as const) as boolValue (boolValue)}
                                    <button
                                        type="button"
                                        onclick={() => setBooleanValue(field.id, boolValue)}
                                        class="btn text-xs {getFieldValues(field.id).includes(boolValue) ? 'btn-primary' : 'btn-terracotta-tint'}"
                                    >
                                        {boolValue === 'true' ? 'Yes' : 'No'}
                                    </button>
                                {/each}
                            </div>
                        {:else}
                            <div class="flex flex-wrap gap-1.5">
                                {#each field.options ?? [] as option (option)}
                                    <button
                                        type="button"
                                        onclick={() => toggleSelectValue(field.id, option)}
                                        class="btn text-xs {getFieldValues(field.id).includes(option) ? 'btn-primary' : 'btn-terracotta-tint'}"
                                    >
                                        {option}
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/each}
            {/if}
        </div>
    {/if}
</div>
