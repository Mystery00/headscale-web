<script setup lang="ts" generic="T extends object">
import { computed, nextTick, onUpdated, ref, useAttrs, watch } from 'vue'
import { NDataTable } from 'naive-ui'
import type { DataTableColumns, DataTableRowKey } from 'naive-ui'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    columns: DataTableColumns<T>
    data: T[]
    loading?: boolean
    rowKey?: (row: T) => DataTableRowKey
    scrollX?: number | string
    ariaLabel?: string
  }>(),
  {
    loading: false,
  },
)

const attrs = useAttrs()
const root = ref<HTMLElement | null>(null)

const tableAttrs = computed(() => {
  const next = { ...attrs } as Record<string, unknown>
  const ariaLabel =
    props.ariaLabel ??
    (typeof next['aria-label'] === 'string' ? String(next['aria-label']) : undefined)
  delete next['aria-label']
  return {
    attrs: next,
    ariaLabel,
  }
})

async function applyAriaLabel() {
  await nextTick()
  const table = root.value?.querySelector('table')
  if (!table) return
  if (tableAttrs.value.ariaLabel) {
    table.setAttribute('aria-label', tableAttrs.value.ariaLabel)
  } else {
    table.removeAttribute('aria-label')
  }
}

watch(() => tableAttrs.value.ariaLabel, applyAriaLabel, { immediate: true })
onUpdated(() => {
  void applyAriaLabel()
})
</script>

<template>
  <div ref="root" class="app-data-table">
    <NDataTable
      v-bind="tableAttrs.attrs"
      :columns="columns"
      :data="data"
      :loading="loading"
      :row-key="rowKey"
      :scroll-x="scrollX"
      :bordered="false"
      :single-line="false"
      size="medium"
      style="--n-th-padding: 12px 14px; --n-td-padding: 12px 14px"
    >
      <template v-if="$slots.empty" #empty>
        <slot name="empty" />
      </template>
    </NDataTable>
  </div>
</template>

<style scoped>
.app-data-table {
  overflow: hidden;
  border: 1px solid var(--admin-border);
  border-radius: var(--admin-radius);
  background: var(--admin-surface);
  box-shadow: var(--admin-shadow);
}

.app-data-table :deep(.n-data-table) {
  --n-merged-th-color: var(--admin-surface-muted);
  --n-merged-td-color: var(--admin-surface);
  --n-merged-border-color: var(--admin-border);
  --n-th-text-color: var(--admin-muted);
  --n-td-text-color: var(--admin-text);
  --n-th-font-weight: 650;
}

.app-data-table :deep(.n-data-table-th) {
  font-size: 0.78rem;
  text-transform: none;
  letter-spacing: 0.01em;
}

.app-data-table :deep(.n-data-table-td) {
  font-size: 0.875rem;
}

.app-data-table :deep(.n-data-table-tr.is-focused > .n-data-table-td) {
  background: color-mix(in srgb, var(--admin-primary) 14%, var(--admin-surface)) !important;
}

.app-data-table :deep(.n-data-table-tr:hover > .n-data-table-td) {
  background: color-mix(in srgb, var(--admin-primary) 6%, var(--admin-surface)) !important;
}

.app-data-table :deep(.n-data-table-empty) {
  padding: 1.5rem 1rem;
}
</style>
