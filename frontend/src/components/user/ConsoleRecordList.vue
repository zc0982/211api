<template>
  <div class="console-record-list" :aria-label="label" role="region" tabindex="0" @keydown="scrollTable">
    <!--
      手机：每行一个原生 details，摘要是主要字段，展开后由 #detail 直接渲染带标签的字段与操作；
      不复用桌面 DataTable（每行一张完整表格太重，也会重复表头和选择列）。
    -->
    <template v-if="viewport === 'phone' && !loading && data.length">
      <div v-if="selectable" class="console-mobile-select-all">
        <label>
          <input
            type="checkbox"
            :checked="allSelected"
            :indeterminate.prop="someSelected && !allSelected"
            data-test="mobile-select-all"
            @change="toggleAll"
          />
          <span>{{ selectAllLabel }}</span>
        </label>
      </div>
      <ul class="console-mobile-records">
        <li
          v-for="row in data"
          :key="row.id"
          class="console-mobile-record"
          :class="{ 'console-mobile-record--selected': selectable && isSelected(row) }"
        >
          <label v-if="selectable" class="console-mobile-select">
            <input
              type="checkbox"
              :checked="isSelected(row)"
              :aria-label="selectionLabel?.(row)"
              data-test="mobile-select-row"
              @change="toggleRow(row)"
            />
          </label>
          <details class="console-mobile-record-body">
            <summary><slot name="summary" :row="row" /></summary>
            <div class="console-mobile-record-detail"><slot name="detail" :row="row" /></div>
          </details>
        </li>
      </ul>
    </template>
    <template v-else><slot :rows="data" /></template>
  </div>
</template>

<script setup lang="ts" generic="T extends { id: number }">
import { computed } from 'vue'
import { useConsoleViewport } from '@/composables/useConsoleViewport'

const props = withDefaults(defineProps<{
  data: T[]
  loading: boolean
  label: string
  selectable?: boolean
  selectedIds?: number[]
  selectionLabel?: (row: T) => string
  selectAllLabel?: string
}>(), {
  selectable: false,
  selectedIds: () => [],
  selectionLabel: undefined,
  selectAllLabel: '',
})
const emit = defineEmits<{ 'update:selectedIds': [ids: number[]] }>()
const { viewport } = useConsoleViewport()

const isSelected = (row: T) => props.selectedIds.includes(row.id)
const allSelected = computed(() => props.data.length > 0 && props.data.every(isSelected))
const someSelected = computed(() => props.data.some(isSelected))

function toggleRow(row: T) {
  emit('update:selectedIds', isSelected(row)
    ? props.selectedIds.filter((id) => id !== row.id)
    : [...props.selectedIds, row.id])
}

function toggleAll() {
  const pageIds = props.data.map((row) => row.id)
  emit('update:selectedIds', allSelected.value
    ? props.selectedIds.filter((id) => !pageIds.includes(id))
    : Array.from(new Set([...props.selectedIds, ...pageIds])))
}

// The upstream table owns its scroll wrapper; keep keyboard access local to these user pages.
function scrollTable(event: KeyboardEvent) {
  if (event.target !== event.currentTarget || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
  const table = (event.currentTarget as HTMLElement).querySelector<HTMLElement>('.table-wrapper')
  if (!table || table.scrollWidth <= table.clientWidth) return
  event.preventDefault()
  table.scrollBy({ left: event.key === 'ArrowRight' ? 120 : -120 })
}
</script>
