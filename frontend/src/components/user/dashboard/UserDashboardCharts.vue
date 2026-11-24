<template>
  <!-- v3：趋势图（工具条在卡片标题行）+ 模型分布（按费用的条形列表，Figma C1「Row / 趋势 + 模型分布」） -->
  <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
    <TokenUsageTrend :trend-data="trend" :loading="loading">
      <template #actions>
        <DateRangePicker
          :start-date="startDate"
          :end-date="endDate"
          @update:startDate="$emit('update:startDate', $event)"
          @update:endDate="$emit('update:endDate', $event)"
          @change="$emit('dateRangeChange', $event)"
        />
        <div class="tabs" role="tablist" :aria-label="t('dashboard.granularity')">
          <button
            v-for="g in granularities"
            :key="g.value"
            type="button"
            role="tab"
            class="tab"
            :class="{ 'tab-active': granularity === g.value }"
            :aria-selected="granularity === g.value"
            @click="selectGranularity(g.value)"
          >
            {{ g.label }}
          </button>
        </div>
        <button
          type="button"
          class="btn btn-secondary btn-icon !p-2"
          :disabled="loading"
          :title="t('common.refresh')"
          :aria-label="t('common.refresh')"
          @click="$emit('refresh')"
        >
          <Icon name="refresh" size="sm" />
        </button>
      </template>
    </TokenUsageTrend>

    <div class="card relative flex flex-col gap-3.5 p-5" data-testid="model-distribution">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-[15px] font-semibold text-gray-900 dark:text-dark-100">{{ t('dashboard.modelDistribution') }}</h3>
        <span class="text-xs text-gray-500 dark:text-dark-400">{{ t('dashboard.byCost') }}</span>
      </div>
      <div v-if="loading" class="flex flex-1 items-center justify-center py-10">
        <LoadingSpinner size="md" />
      </div>
      <p v-else-if="!rows.length" class="py-10 text-center text-sm text-gray-500 dark:text-dark-400">
        {{ t('dashboard.noDataAvailable') }}
      </p>
      <template v-else>
        <div v-for="row in rows" :key="row.key" class="space-y-1.5" data-testid="model-row">
          <div class="flex items-center gap-2">
            <ModelIcon v-if="!row.isOther" :model="row.label" size="16px" />
            <span v-else class="h-4 w-4 shrink-0 rounded bg-gray-100 dark:bg-dark-900" aria-hidden="true"></span>
            <span
              class="min-w-0 flex-1 truncate text-[13px]"
              :class="row.isOther ? 'text-gray-600 dark:text-dark-300' : 'font-mono text-gray-900 dark:text-dark-100'"
              :title="row.label"
            >
              {{ row.label }}
            </span>
            <span class="font-mono text-[13px] font-medium text-gray-900 dark:text-dark-100">{{ row.pct }}%</span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-dark-700">
            <div
              class="h-full rounded-full"
              :class="row.isOther ? 'bg-primary-300 dark:bg-[#2b4170]' : 'bg-primary-800 dark:bg-primary-400'"
              :style="{ width: `${Math.max(row.pct, 1)}%` }"
            ></div>
          </div>
          <p class="font-mono text-[11px] text-gray-500 dark:text-dark-400">
            {{ t('dashboard.modelRequestsCost', { count: formatNumber(row.requests), cost: `$${formatCost(row.cost)}` }) }}
          </p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import DateRangePicker from '@/components/common/DateRangePicker.vue'
import ModelIcon from '@/components/common/ModelIcon.vue'
import Icon from '@/components/icons/Icon.vue'
import TokenUsageTrend from '@/components/charts/TokenUsageTrend.vue'
import type { TrendDataPoint, ModelStat } from '@/types'
import { formatCostFixed as formatCost, formatNumberLocaleString as formatNumber } from '@/utils/format'

const props = defineProps<{ loading: boolean, startDate: string, endDate: string, granularity: string, trend: TrendDataPoint[], models: ModelStat[] }>()
const emit = defineEmits(['update:startDate', 'update:endDate', 'update:granularity', 'dateRangeChange', 'granularityChange', 'refresh'])
const { t } = useI18n()

const granularities = computed(() => [
  { value: 'day', label: t('dashboard.day') },
  { value: 'hour', label: t('dashboard.hour') }
])

function selectGranularity(value: string) {
  if (value === props.granularity) return
  emit('update:granularity', value)
  emit('granularityChange')
}

/** 前 4 个模型单列，其余合并为「其他 N 个模型」；占比按实际费用，费用全为 0 时按请求数。 */
const TOP_MODELS = 4
const rows = computed(() => {
  const models = [...(props.models ?? [])]
  if (!models.length) return []
  const byCost = models.some((m) => m.actual_cost > 0)
  const weight = (m: ModelStat) => (byCost ? m.actual_cost : m.requests)
  models.sort((a, b) => weight(b) - weight(a))
  const total = models.reduce((sum, m) => sum + weight(m), 0) || 1
  const top = models.slice(0, TOP_MODELS).map((m) => ({
    key: m.model,
    label: m.model,
    isOther: false,
    requests: m.requests,
    cost: m.actual_cost,
    pct: Math.round((weight(m) / total) * 100)
  }))
  const rest = models.slice(TOP_MODELS)
  if (rest.length) {
    top.push({
      key: '__other__',
      label: t('dashboard.otherModels', { count: rest.length }),
      isOther: true,
      requests: rest.reduce((sum, m) => sum + m.requests, 0),
      cost: rest.reduce((sum, m) => sum + m.actual_cost, 0),
      pct: Math.round((rest.reduce((sum, m) => sum + weight(m), 0) / total) * 100)
    })
  }
  return top
})
</script>
