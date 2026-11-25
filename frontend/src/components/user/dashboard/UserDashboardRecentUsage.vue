<template>
  <!-- v3 最近使用（Figma C1「Card / 最近使用」）：表格，表头 #faf8f3、行高 52；手机改成列表行 -->
  <div class="card overflow-hidden">
    <div class="flex items-center gap-2.5 px-5 py-[18px]">
      <h2 class="text-[15px] font-semibold text-gray-900 dark:text-dark-100">{{ t('dashboard.recentUsage') }}</h2>
      <span class="badge badge-gray">{{ t('dashboard.last7Days') }}</span>
      <router-link
        v-if="!loading && data.length"
        to="/usage"
        class="ml-auto text-[13px] font-medium text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300"
      >
        {{ t('dashboard.viewAllUsage') }} →
      </router-link>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>
    <div v-else-if="data.length === 0" class="px-5 pb-8">
      <EmptyState :title="t('dashboard.noUsageRecords')" :description="t('dashboard.startUsingApi')" />
    </div>
    <template v-else>
      <!-- ≥ 768：表格 -->
      <div class="hidden overflow-x-auto md:block">
        <table class="recent-table">
          <thead>
            <tr>
              <th>{{ t('dashboard.recentTable.time') }}</th>
              <th>{{ t('dashboard.recentTable.model') }}</th>
              <th>{{ t('dashboard.recentTable.key') }}</th>
              <th>{{ t('dashboard.recentTable.tokens') }}</th>
              <th>{{ t('dashboard.recentTable.duration') }}</th>
              <th>{{ t('dashboard.recentTable.cost') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in data" :key="log.id" data-testid="recent-usage-row">
              <td class="font-mono text-gray-600 dark:text-dark-300" :title="formatDateTime(log.created_at)">{{ formatClock(log.created_at) }}</td>
              <td>
                <span class="inline-flex max-w-[13rem] items-center gap-2">
                  <ModelIcon :model="log.model" size="16px" />
                  <span class="truncate font-mono text-gray-900 dark:text-dark-100" :title="log.model">{{ log.model }}</span>
                  <span v-if="isPolicyBlockedUsage(log)" class="badge badge-warning flex-none" data-testid="recent-usage-blocked">{{ t('dashboard.overview.blocked') }}</span>
                </span>
              </td>
              <td class="max-w-[8rem] truncate text-gray-600 dark:text-dark-300">{{ log.api_key?.name || `#${log.api_key_id}` }}</td>
              <td class="font-mono text-gray-900 dark:text-dark-100">{{ formatInt(log.input_tokens) }} / {{ formatInt(log.output_tokens) }}</td>
              <td class="font-mono text-gray-900 dark:text-dark-100">{{ log.duration_ms != null ? formatDuration(log.duration_ms) : '-' }}</td>
              <td class="font-mono text-star-bronze dark:text-star-bronze-night" :title="`${t('dashboard.standard')} $${formatCost(log.total_cost)}`">${{ formatCost(log.actual_cost) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- < 768：列表行 -->
      <ul class="md:hidden">
        <li v-for="log in data" :key="log.id" class="recent-item" data-testid="recent-usage-item">
          <ModelIcon :model="log.model" size="18px" />
          <div class="min-w-0 flex-1">
            <p class="flex min-w-0 items-center gap-1.5">
              <span class="truncate font-mono text-[13px] text-gray-900 dark:text-dark-100">{{ log.model }}</span>
              <span v-if="isPolicyBlockedUsage(log)" class="badge badge-warning flex-none" data-testid="recent-usage-blocked">{{ t('dashboard.overview.blocked') }}</span>
            </p>
            <p class="mt-0.5 truncate font-mono text-[11px] text-gray-500 dark:text-dark-400">
              {{ formatClock(log.created_at) }} · {{ formatInt(log.input_tokens) }} / {{ formatInt(log.output_tokens) }}
            </p>
          </div>
          <span class="font-mono text-[13px] text-star-bronze dark:text-star-bronze-night">${{ formatCost(log.actual_cost) }}</span>
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ModelIcon from '@/components/common/ModelIcon.vue'
import { formatDateTime } from '@/utils/format'
import type { UsageLog } from '@/types'
import { isPolicyBlockedUsage } from './usageStatus'

defineProps<{
  data: UsageLog[]
  loading: boolean
}>()
const { t } = useI18n()
const formatCost = (c: number) => (Number.isFinite(c) ? c.toFixed(4) : '0.0000')
const formatInt = (n: number) => (Number.isFinite(n) ? n.toLocaleString('en-US') : '0')
const formatDuration = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`)
function formatClock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-GB', { hour12: false })
}
</script>

<style scoped>
.recent-table {
  width: 100%;
  font-size: 13px;
  white-space: nowrap;
}

.recent-table th {
  height: 36px;
  padding: 0 12px;
  border-top: 1px solid rgb(var(--c-gray-200));
  border-bottom: 1px solid rgb(var(--c-gray-200));
  background: var(--c-thead);
  color: #66738c;
  font-size: 12px;
  font-weight: 500;
  text-align: left;
}

.recent-table th:first-child,
.recent-table td:first-child {
  padding-left: 20px;
}

.recent-table th:last-child,
.recent-table td:last-child {
  padding-right: 20px;
}

.recent-table td {
  height: 52px;
  padding: 0 12px;
  border-bottom: 1px solid var(--c-row-line);
}

.recent-table tbody tr:last-child td {
  border-bottom: 0;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-top: 1px solid var(--c-row-line);
}
</style>

<style>
.dark .recent-table th {
  border-color: #1f2d48;
  color: #7f8ca5;
}
</style>
