<template>
  <AppLayout>
    <div class="console-data-page console-usage">
      <header class="console-page-heading">
        <div>
          <h1 class="page-title">{{ t('usage.title') }}</h1>
          <p class="page-description">{{ t('usage.description') }}</p>
        </div>
        <button v-if="activeTab !== 'errors'" type="button" @click="exportToCSV" :disabled="exporting" class="btn btn-primary">
          {{ exporting ? t('usage.exporting') : t('usage.exportCsv') }}
        </button>
      </header>
      <UsageStatsCards class="console-usage-stats" :stats="usageStats" :show-account-cost="false" :strike-standard-cost="true" />

      <div v-if="errorViewEnabled" class="tabs w-fit">
        <button class="tab" :class="{ 'tab-active': activeTab === 'usage' }" @click="activeTab = 'usage'">
          {{ t('usage.tabs.usage') }}
        </button>
        <button class="tab" :class="{ 'tab-active': activeTab === 'errors' }" @click="switchToErrors">
          {{ t('usage.tabs.errors') }}
        </button>
      </div>

      <!-- 一行胶囊筛选（Figma C3）：时间范围 + 密钥 / 模型 / 分组 / 类型，工具按钮在同一行右侧；手机横滑，边缘渐隐提示还有内容。 -->
      <div class="console-filter-bar">
        <div
          ref="filterScrollRef"
          class="console-filter-scroll"
          :class="{ 'console-filter-scroll--more-left': filterFade.left, 'console-filter-scroll--more-right': filterFade.right }"
          role="group"
          :aria-label="t('usage.filtersScrollHint')"
          data-test="usage-filter-scroll"
          @scroll.passive="updateFilterFade"
        >
          <div class="console-filter-pill console-filter-date">
            <span class="sr-only">{{ t('admin.dashboard.timeRange') }}</span>
            <DateRangePicker
              v-model:start-date="startDate"
              v-model:end-date="endDate"
              @change="onDateRangeChange"
            />
          </div>
          <template v-if="activeTab === 'errors'">
            <div class="console-filter-pill">
              <Select v-model="errorFilter.api_key_id" :options="errorKeyOptions" :aria-label="t('usage.errors.keyName')" @change="applyErrorFilters" />
            </div>
            <div class="console-filter-pill console-filter-pill--wide">
              <Select
                v-model="errorFilter.model"
                :options="errorModelOptions"
                searchable
                creatable
                clearable
                :aria-label="t('usage.errors.model')"
                :placeholder="t('usage.errors.modelPlaceholder')"
                @change="applyErrorFilters"
              />
            </div>
            <div class="console-filter-pill">
              <Select v-model="errorFilter.category" :options="errorCategoryOptions" :aria-label="t('usage.errors.category')" @change="applyErrorFilters" />
            </div>
            <div class="console-filter-pill">
              <Select v-model="errorFilter.status_code" :options="errorStatusOptions" :aria-label="t('usage.errors.status')" @change="applyErrorFilters" />
            </div>
          </template>
          <template v-else>
            <div class="console-filter-pill">
              <Select v-model="filters.api_key_id" :placeholder="t('usage.allApiKeys')" :options="apiKeyOptions" :aria-label="t('usage.apiKeyFilter')" @change="applyFilters" />
            </div>
            <div class="console-filter-pill console-filter-pill--wide">
              <Select v-model="filters.model" :placeholder="t('admin.usage.allModels')" :options="modelOptions" searchable :aria-label="t('usage.model')" @change="applyFilters" />
            </div>
            <div class="console-filter-pill">
              <Select v-model="filters.group_id" :placeholder="t('admin.usage.allGroups')" :options="groupOptions" searchable :aria-label="t('admin.usage.group')" @change="applyFilters" />
            </div>
            <div class="console-filter-pill">
              <Select v-model="filters.request_type" :placeholder="t('admin.usage.allTypes')" :options="requestTypeOptions" :aria-label="t('usage.type')" @change="applyFilters" />
            </div>
            <button
              type="button"
              class="console-filter-more"
              :aria-expanded="showMoreFilters"
              aria-controls="usage-more-filters"
              data-test="usage-more-filters"
              @click="showMoreFilters = !showMoreFilters"
            >
              <Icon name="filter" size="sm" />
              <span>{{ t('usage.moreFilters') }}</span>
              <span v-if="activeExtraFilterCount" class="console-filter-count">{{ activeExtraFilterCount }}</span>
            </button>
          </template>
        </div>

        <div class="console-filter-tools">
          <button type="button" @click="refreshData" :disabled="activeTab === 'errors' ? errorLoading : loading" class="btn btn-secondary">
            {{ t('common.refresh') }}
          </button>
          <button type="button" @click="resetFilters" class="btn btn-secondary">
            {{ t('common.reset') }}
          </button>
          <div class="relative" ref="columnDropdownRef">
            <button
              type="button"
              data-testid="usage-column-settings"
              @click="showColumnDropdown = !showColumnDropdown"
              class="btn btn-secondary px-2 md:px-3"
              :title="t('admin.users.columnSettings')"
              :aria-label="t('admin.users.columnSettings')"
            >
              <Icon name="grid" size="sm" />
              <span class="hidden md:inline">{{ t('admin.users.columnSettings') }}</span>
            </button>
            <div
              v-if="showColumnDropdown"
              class="absolute right-0 top-full z-50 mt-1 max-h-80 w-48 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-dark-600 dark:bg-dark-800"
            >
              <button
                v-for="col in currentToggleableColumns"
                :key="col.key"
                type="button"
                :data-testid="`usage-column-toggle-${col.key}`"
                @click="toggleCurrentColumn(col.key)"
                class="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-700"
              >
                <span>{{ col.label }}</span>
                <Icon v-if="isCurrentColumnVisible(col.key)" name="check" size="sm" class="text-primary-500" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-show="activeTab === 'usage' && showMoreFilters" id="usage-more-filters" class="console-extra-filter-fields">
        <div>
          <label class="input-label">{{ t('usage.compactionFilter') }}</label>
          <Select v-model="filters.native_compaction_v2" :options="compactionOptions" :aria-label="t('usage.compactionFilter')" @change="applyFilters" />
        </div>
        <div v-if="subscriptionFeatureEnabled">
          <label class="input-label">{{ t('admin.usage.billingType') }}</label>
          <Select v-model="filters.billing_type" :options="billingTypeOptions" :aria-label="t('admin.usage.billingType')" @change="applyFilters" />
        </div>
        <div>
          <label class="input-label">{{ t('admin.usage.billingMode') }}</label>
          <Select v-model="filters.billing_mode" :options="billingModeOptions" :aria-label="t('admin.usage.billingMode')" @change="applyFilters" />
        </div>
      </div>

      <section v-if="activeTab === 'usage'" class="console-records console-usage-records">
        <ConsoleRecordList :data="usageLogs" :loading="loading" :label="t('usage.title')">
          <template #summary="{ row }">
            <span class="console-mobile-record-title"><strong class="font-mono">{{ row.model }}</strong><span class="font-mono text-star-bronze dark:text-star-bronze-night">${{ row.actual_cost.toFixed(4) }}</span><Icon name="chevronDown" size="sm" /></span>
            <span class="console-mobile-record-meta"><span>{{ formatDateTime(row.created_at) }}</span><span>{{ row.api_key?.name || '—' }}</span></span>
            <span class="console-mobile-record-meta"><span :class="row.request_type === 'cyber' ? 'badge badge-warning' : ''">{{ getRequestTypeLabel(row) }}</span><span class="font-mono">{{ formatLatency(row.first_token_ms) }} / {{ formatLatency(row.duration_ms) }}</span></span>
          </template>
          <template #detail="{ row }">
            <dl class="console-mobile-fields" data-test="usage-mobile-fields">
              <div>
                <dt>{{ t('usage.requestId') }}</dt>
                <dd class="console-mobile-copy">
                  <code>{{ row.request_id || '—' }}</code>
                  <button v-if="row.request_id" type="button" class="console-inline-action" :aria-label="`${t('keys.copyToClipboard')} ${row.request_id}`" @click="copyRequestId(row.request_id)">
                    <Icon :name="copiedRequestId === row.request_id ? 'check' : 'copy'" size="xs" />
                    <span>{{ copiedRequestId === row.request_id ? t('common.copied') : t('common.copy') }}</span>
                  </button>
                </dd>
              </div>
              <div><dt>{{ t('usage.reasoningEffort') }}</dt><dd>{{ formatReasoningEffort(row.reasoning_effort) }}</dd></div>
              <div><dt>{{ t('usage.inputOutput') }}</dt><dd class="font-mono">{{ row.input_tokens.toLocaleString() }} / {{ row.output_tokens.toLocaleString() }}</dd></div>
              <div v-if="row.cache_read_tokens > 0"><dt>{{ t('usage.cacheReadTokensLabel') }}</dt><dd class="font-mono">{{ row.cache_read_tokens.toLocaleString() }}</dd></div>
              <div v-if="row.cache_creation_tokens > 0"><dt>{{ t('usage.cacheCreationTokensLabel') }}</dt><dd class="font-mono">{{ row.cache_creation_tokens.toLocaleString() }}</dd></div>
              <div><dt>{{ t('usage.cost') }}</dt><dd class="font-mono text-star-bronze dark:text-star-bronze-night">${{ row.actual_cost.toFixed(6) }}</dd></div>
              <div><dt>{{ t('usage.standardCost') }}</dt><dd class="font-mono">${{ row.total_cost.toFixed(6) }}</dd></div>
              <div><dt>{{ t('usage.latencyCompact') }}</dt><dd class="font-mono">{{ formatLatency(row.first_token_ms) }} / {{ formatLatency(row.duration_ms) }}</dd></div>
              <div><dt>{{ t('usage.outputTps') }}</dt><dd class="font-mono">{{ formatUsageOutputRate(row) }}</dd></div>
              <div><dt>{{ t('usage.cacheRate') }}</dt><dd class="font-mono">{{ formatCacheHitRate(row.cache_hit_rate) }}</dd></div>
              <div v-if="row.inbound_endpoint"><dt>{{ t('usage.endpoint') }}</dt><dd class="font-mono">{{ row.inbound_endpoint }}</dd></div>
              <div><dt>{{ t('admin.usage.billingMode') }}</dt><dd>{{ getBillingModeLabel(getDisplayBillingMode(row), t) }}</dd></div>
              <div v-if="row.native_compaction_v2"><dt>{{ t('usage.compactionFilter') }}</dt><dd>{{ t('usage.nativeCompactionV2') }}</dd></div>
            </dl>
          </template>
          <template #default="{ rows }">
            <UsageTable
              flat
              compact
              :data="rows"
              :loading="loading"
              :columns="visibleColumns"
              :server-side-sort="true"
              :show-account-billing="false"
              :show-upstream-endpoint="false"
              default-sort-key="created_at"
              default-sort-order="desc"
              @sort="handleSort"
              @ipGeoBatchFailed="handleIpGeoBatchFailed"
            />
          </template>
        </ConsoleRecordList>

        <div v-if="pagination.total > 0" class="console-table-foot">
          <Pagination
            :page="pagination.page"
            :total="pagination.total"
            :page-size="pagination.page_size"
            @update:page="handlePageChange"
            @update:pageSize="handlePageSizeChange"
          />
        </div>
      </section>

      <UserErrorRequestsTable
        v-else-if="errorViewEnabled"
        :rows="errorRows"
        :total="errorTotal"
        :loading="errorLoading"
        :page="errorPage"
        :page-size="errorPageSize"
        :visible-column-keys="errVisibleColumnKeys"
        @sort="onErrorSort"
        @update:page="onErrorPage"
        @update:pageSize="onErrorPageSize"
        @ipGeoBatchFailed="handleIpGeoBatchFailed"
      />

      <!-- 图表默认折叠：折叠时不请求趋势 / 分组快照，展开时再加载；图表在展开后才挂载，Chart.js 能量到真实尺寸。 -->
      <details class="console-usage-charts" data-test="usage-charts" @toggle="onChartsToggle">
        <summary>{{ t('usage.analytics') }}</summary>
        <div v-if="chartsOpen" class="space-y-6 pt-5">
          <div class="flex items-center justify-end gap-2">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('admin.dashboard.granularity') }}:</span>
            <div class="w-28">
              <Select v-model="granularity" :options="granularityOptions" :aria-label="t('admin.dashboard.granularity')" @change="loadChartData" />
            </div>
          </div>

          <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ModelDistributionChart
              v-model:metric="modelDistributionMetric"
              :model-stats="requestedModelStats"
              :loading="modelStatsLoading"
              :show-source-toggle="false"
              :show-metric-toggle="true"
              :enable-breakdown="false"
              :show-account-cost="false"
              :start-date="startDate"
              :end-date="endDate"
            />
            <GroupDistributionChart
              v-model:metric="groupDistributionMetric"
              :group-stats="groupStats"
              :loading="chartsLoading"
              :show-metric-toggle="true"
              :enable-breakdown="false"
              :show-account-cost="false"
              :start-date="startDate"
              :end-date="endDate"
            />
          </div>

          <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <EndpointDistributionChart
              v-model:source="endpointDistributionSource"
              v-model:metric="endpointDistributionMetric"
              :endpoint-stats="inboundEndpointStats"
              :upstream-endpoint-stats="upstreamEndpointStats"
              :endpoint-path-stats="endpointPathStats"
              :loading="endpointStatsLoading"
              :show-source-toggle="false"
              :show-metric-toggle="true"
              :enable-breakdown="false"
              :show-account-cost="false"
              :title="t('usage.endpointDistribution')"
              :start-date="startDate"
              :end-date="endDate"
            />
            <TokenUsageTrend :trend-data="trendData" :loading="chartsLoading" />
          </div>
        </div>
      </details>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import '@/styles/console-data-pages.css'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatCacheHitRate } from '@/utils/usageCacheHitRate'
import { useAppStore } from '@/stores/app'
import { FeatureFlags, resolveFeatureFlag } from '@/utils/featureFlags'
import { keysAPI, usageAPI, userGroupsAPI } from '@/api'
import AppLayout from '@/components/layout/AppLayout.vue'
import ConsoleRecordList from '@/components/user/ConsoleRecordList.vue'
import Pagination from '@/components/common/Pagination.vue'
import Select, { type SelectOption } from '@/components/common/Select.vue'
import DateRangePicker from '@/components/common/DateRangePicker.vue'
import UsageStatsCards from '@/components/admin/usage/UsageStatsCards.vue'
import UsageTable from '@/components/admin/usage/UsageTable.vue'
import ModelDistributionChart from '@/components/charts/ModelDistributionChart.vue'
import GroupDistributionChart from '@/components/charts/GroupDistributionChart.vue'
import EndpointDistributionChart from '@/components/charts/EndpointDistributionChart.vue'
import TokenUsageTrend from '@/components/charts/TokenUsageTrend.vue'
import Icon from '@/components/icons/Icon.vue'
import UserErrorRequestsTable from '@/components/user/UserErrorRequestsTable.vue'
import { getPersistedPageSize } from '@/composables/usePersistedPageSize'
import { useClipboard } from '@/composables/useClipboard'
import { formatUsageOutputRate } from '@/utils/latencyHealth'
import { formatReasoningEffort, formatDateTime } from '@/utils/format'
import { getBillingModeLabel, getDisplayBillingMode as resolveDisplayBillingMode } from '@/utils/billingMode'
import { resolveUsageRequestType, requestTypeToLegacyStream } from '@/utils/usageRequestType'
import type {
  ApiKey,
  EndpointStat,
  Group,
  GroupStat,
  ModelStat,
  TrendDataPoint,
  UsageLog,
  UsageQueryParams,
  UsageStatsResponse,
  UserErrorRequest,
} from '@/types'
import type { Column } from '@/components/common/types'
import { COMMON_ERROR_STATUS_CODES } from '@/utils/errorBadges'

const { t } = useI18n()
const appStore = useAppStore()
const { copyToClipboard } = useClipboard()

type DistributionMetric = 'tokens' | 'actual_cost'
type EndpointSource = 'inbound' | 'upstream' | 'path'

const usageStats = ref<UsageStatsResponse | null>(null)
const usageLogs = ref<UsageLog[]>([])
const trendData = ref<TrendDataPoint[]>([])
const requestedModelStats = ref<ModelStat[]>([])
const groupStats = ref<GroupStat[]>([])
const inboundEndpointStats = ref<EndpointStat[]>([])
const upstreamEndpointStats = ref<EndpointStat[]>([])
const endpointPathStats = ref<EndpointStat[]>([])

const loading = ref(false)
const chartsLoading = ref(false)
const modelStatsLoading = ref(false)
const endpointStatsLoading = ref(false)
const exporting = ref(false)
const errorRows = ref<UserErrorRequest[]>([])
const errorLoading = ref(false)
const errorPage = ref(1)
const errorPageSize = ref(20)
const errorSortBy = ref('created_at')
const errorSortOrder = ref<'asc' | 'desc'>('desc')
const errorTotal = ref(0)
const errorFilter = ref<{ model: string | null; category: string; api_key_id: number | null; status_code: number | null }>({
  model: '',
  category: '',
  api_key_id: null,
  status_code: null,
})

const errorKeyOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('usage.errors.allKeys') },
  ...apiKeys.value.map((k) => ({ value: k.id, label: k.name })),
])

// 模型候选取自当前已加载错误中出现过的模型；creatable 允许输入任意片段做后端模糊。
const errorModelOptions = computed<SelectOption[]>(() => {
  const seen = new Set<string>()
  const opts: SelectOption[] = []
  for (const r of errorRows.value) {
    if (r.model && !seen.has(r.model)) {
      seen.add(r.model)
      opts.push({ value: r.model, label: r.model })
    }
  }
  return opts
})

const errorCategoryCodes = ['auth', 'rate_limit', 'quota', 'invalid_request', 'service_unavailable', 'upstream', 'internal', 'cyber']

const errorCategoryOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('usage.errors.allCategories') },
  ...errorCategoryCodes.map((c) => ({ value: c, label: t('usage.errors.categories.' + c) })),
])

// 状态码候选用固定常用列表(与管理端 UsageFilters 共用常量),不受当前页数据限制:
// 后端 status_code 过滤对全量生效,若只列当前页出现过的码,用户就选不到仅在后续页的码。
const errorStatusOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('usage.errors.allStatuses') },
  ...COMMON_ERROR_STATUS_CODES.map((c) => ({ value: c, label: String(c) })),
])

const applyErrorFilters = () => {
  errorPage.value = 1
  void loadErrors()
}

let abortController: AbortController | null = null
let chartReqSeq = 0
let statsReqSeq = 0
let modelStatsReqSeq = 0

const formatLocalDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const getLast24HoursRangeDates = () => {
  const end = new Date()
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000)
  return { start: formatLocalDate(start), end: formatLocalDate(end) }
}

const getGranularityForRange = (start: string, end: string): 'day' | 'hour' => {
  const startTime = new Date(`${start}T00:00:00`).getTime()
  const endTime = new Date(`${end}T00:00:00`).getTime()
  return Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24)) <= 1 ? 'hour' : 'day'
}

const defaultRange = getLast24HoursRangeDates()
const startDate = ref(defaultRange.start)
const endDate = ref(defaultRange.end)
const granularity = ref<'day' | 'hour'>(getGranularityForRange(startDate.value, endDate.value))

const modelDistributionMetric = ref<DistributionMetric>('tokens')
const groupDistributionMetric = ref<DistributionMetric>('tokens')
const endpointDistributionMetric = ref<DistributionMetric>('tokens')
const endpointDistributionSource = ref<EndpointSource>('inbound')
const activeTab = ref<'usage' | 'errors'>('usage')
const errorViewEnabled = computed(() => appStore.cachedPublicSettings?.allow_user_view_error_requests ?? false)

const filters = ref<UsageQueryParams>({
  start_date: startDate.value,
  end_date: endDate.value,
  request_type: undefined,
  native_compaction_v2: null,
  billing_type: null,
  billing_mode: null,
})

const pagination = reactive({
  page: 1,
  page_size: getPersistedPageSize(),
  total: 0,
})
const sortState = reactive({
  sort_by: 'created_at',
  sort_order: 'desc' as 'asc' | 'desc',
})

const granularityOptions = computed<SelectOption[]>(() => [
  { value: 'day', label: t('admin.dashboard.day') },
  { value: 'hour', label: t('admin.dashboard.hour') },
])
const requestTypeOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('admin.usage.allTypes') },
  { value: 'ws_v2', label: t('usage.ws') },
  { value: 'live', label: t('usage.live') },
  { value: 'stream', label: t('usage.stream') },
  { value: 'sync', label: t('usage.sync') },
])
const compactionOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('usage.allCompactionTypes') },
  { value: true, label: t('usage.compactionOnly') },
])
// 订阅功能关闭后只剩余额计费，「计费类型」筛选（余额/订阅）失去意义，整块隐藏。
const subscriptionFeatureEnabled = computed(() => resolveFeatureFlag(appStore.cachedPublicSettings, FeatureFlags.subscription))
const billingTypeOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('admin.usage.allBillingTypes') },
  { value: 0, label: t('admin.usage.billingTypeBalance') },
  { value: 1, label: t('admin.usage.billingTypeSubscription') },
])
const billingModeOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('admin.usage.allBillingModes') },
  { value: 'token', label: t('admin.usage.billingModeToken') },
  { value: 'per_request', label: t('admin.usage.billingModePerRequest') },
  { value: 'image', label: t('admin.usage.billingModeImage') },
  { value: 'video', label: t('admin.usage.billingModeVideo') },
])

const apiKeys = ref<ApiKey[]>([])
const groups = ref<Group[]>([])
const modelOptionValues = ref<string[]>([])

const apiKeyOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('usage.allApiKeys') },
  ...apiKeys.value.map((key) => ({ value: key.id, label: key.name })),
])
const groupOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('admin.usage.allGroups') },
  ...groups.value.map((group) => ({ value: group.id, label: group.name })),
])
const modelOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('admin.usage.allModels') },
  ...modelOptionValues.value.map((model) => ({ value: model, label: model })),
])

const normalizedFilters = computed<UsageQueryParams>(() => {
  const requestType = filters.value.request_type
  const legacyStream = requestType ? requestTypeToLegacyStream(requestType) : filters.value.stream
  return {
    ...filters.value,
    start_date: startDate.value,
    end_date: endDate.value,
    stream: legacyStream === null ? undefined : legacyStream,
  }
})

const buildUsageListParams = (page: number, pageSize: number): UsageQueryParams => ({
  page,
  page_size: pageSize,
  ...normalizedFilters.value,
  sort_by: sortState.sort_by,
  sort_order: sortState.sort_order,
})

const loadLogs = async () => {
  abortController?.abort()
  const controller = new AbortController()
  abortController = controller
  loading.value = true
  try {
    const res = await usageAPI.query(buildUsageListParams(pagination.page, pagination.page_size), {
      signal: controller.signal,
    })
    if (!controller.signal.aborted) {
      usageLogs.value = res.items
      pagination.total = res.total
    }
  } catch (error: any) {
    if (error?.name !== 'AbortError' && error?.code !== 'ERR_CANCELED') {
      appStore.showError(t('usage.failedToLoad'))
    }
  } finally {
    if (abortController === controller) loading.value = false
  }
}

const loadStats = async () => {
  const seq = ++statsReqSeq
  endpointStatsLoading.value = true
  try {
    const stats = await usageAPI.getStats(normalizedFilters.value)
    if (seq !== statsReqSeq) return
    usageStats.value = stats
    inboundEndpointStats.value = stats.endpoints || []
    upstreamEndpointStats.value = []
    endpointPathStats.value = []
  } catch (error) {
    if (seq !== statsReqSeq) return
    console.error('Failed to load usage stats:', error)
    inboundEndpointStats.value = []
    upstreamEndpointStats.value = []
    endpointPathStats.value = []
  } finally {
    if (seq === statsReqSeq) endpointStatsLoading.value = false
  }
}

const loadModelStats = async () => {
  const seq = ++modelStatsReqSeq
  modelStatsLoading.value = true
  try {
    const response = await usageAPI.getDashboardModels({
      ...normalizedFilters.value,
      model_source: 'requested',
    })
    if (seq !== modelStatsReqSeq) return
    requestedModelStats.value = response.models || []
    refreshModelOptions(response.models || [])
  } catch (error) {
    if (seq !== modelStatsReqSeq) return
    console.error('Failed to load model stats:', error)
    requestedModelStats.value = []
  } finally {
    if (seq === modelStatsReqSeq) modelStatsLoading.value = false
  }
}

// 图表区默认折叠：折叠时筛选变化只标记过期，展开时再请求趋势 / 分组快照。
const chartsOpen = ref(false)
let chartsStale = true

const requestChartData = () => {
  if (chartsOpen.value) void loadChartData()
  else chartsStale = true
}

const onChartsToggle = (event: Event) => {
  chartsOpen.value = (event.target as HTMLDetailsElement).open
  if (chartsOpen.value && chartsStale) void loadChartData()
}

const loadChartData = async () => {
  chartsStale = false
  const seq = ++chartReqSeq
  chartsLoading.value = true
  try {
    const snapshot = await usageAPI.getDashboardSnapshotV2({
      ...normalizedFilters.value,
      granularity: granularity.value,
      include_trend: true,
      include_model_stats: false,
      include_group_stats: true,
    })
    if (seq !== chartReqSeq) return
    trendData.value = snapshot.trend || []
    groupStats.value = snapshot.groups || []
  } catch (error) {
    if (seq !== chartReqSeq) return
    console.error('Failed to load chart data:', error)
    trendData.value = []
    groupStats.value = []
  } finally {
    if (seq === chartReqSeq) chartsLoading.value = false
  }
}

const refreshModelOptions = (models: ModelStat[]) => {
  const current = filters.value.model
  const set = new Set(modelOptionValues.value)
  models.forEach((item) => {
    if (item.model) set.add(item.model)
  })
  if (current) set.add(current)
  modelOptionValues.value = Array.from(set).sort()
}

const applyFilters = () => {
  pagination.page = 1
  void loadLogs()
  void loadStats()
  void loadModelStats()
  requestChartData()
  resetErrorRows()
}

const refreshData = () => {
  void loadLogs()
  void loadStats()
  void loadModelStats()
  requestChartData()
  if (activeTab.value === 'errors') void loadErrors()
}

const resetFilters = () => {
  const range = getLast24HoursRangeDates()
  startDate.value = range.start
  endDate.value = range.end
  filters.value = {
    start_date: range.start,
    end_date: range.end,
    request_type: undefined,
    native_compaction_v2: null,
    billing_type: null,
    billing_mode: null,
  }
  granularity.value = getGranularityForRange(range.start, range.end)
  applyFilters()
  if (activeTab.value === 'errors') {
    errorFilter.value = { model: '', category: '', api_key_id: null, status_code: null }
    applyErrorFilters()
  }
}

const onDateRangeChange = (range: { startDate: string; endDate: string; preset: string | null }) => {
  startDate.value = range.startDate
  endDate.value = range.endDate
  filters.value.start_date = range.startDate
  filters.value.end_date = range.endDate
  granularity.value = getGranularityForRange(range.startDate, range.endDate)
  applyFilters()
}

const handlePageChange = (page: number) => {
  pagination.page = page
  void loadLogs()
}

const handlePageSizeChange = (pageSize: number) => {
  pagination.page_size = pageSize
  pagination.page = 1
  void loadLogs()
}

const handleSort = (key: string, order: 'asc' | 'desc') => {
  sortState.sort_by = key
  sortState.sort_order = order
  pagination.page = 1
  void loadLogs()
}

const handleIpGeoBatchFailed = () => {
  appStore.showError(t('usage.ipGeo.batchFailed'))
}

const getRequestTypeLabel = (log: UsageLog): string => {
  const type = resolveUsageRequestType(log)
  if (type === 'ws_v2') return t('usage.ws')
  return type ? t(`usage.${type}`) : '—'
}

const formatLatency = (ms: number | null | undefined): string => {
  if (ms == null) return '-'
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

const copiedRequestId = ref<string | null>(null)
let copiedResetTimer: number | undefined
const copyRequestId = async (requestId: string) => {
  if (!(await copyToClipboard(requestId, t('common.copied')))) return
  copiedRequestId.value = requestId
  window.clearTimeout(copiedResetTimer)
  copiedResetTimer = window.setTimeout(() => { copiedRequestId.value = null }, 1800)
}

// 「更多筛选」里的条件在收起时也要看得出已生效。
const showMoreFilters = ref(false)
const activeExtraFilterCount = computed(() => [
  filters.value.native_compaction_v2,
  subscriptionFeatureEnabled.value ? filters.value.billing_type : null,
  filters.value.billing_mode,
].filter((value) => value != null && value !== '').length)

// 手机筛选条横滑：按滚动位置给左右边缘加渐隐，提示两侧还有筛选项。
const filterScrollRef = ref<HTMLElement | null>(null)
const filterFade = reactive({ left: false, right: false })
const updateFilterFade = () => {
  const el = filterScrollRef.value
  if (!el) return
  filterFade.left = el.scrollLeft > 1
  filterFade.right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}
let filterResizeObserver: ResizeObserver | null = null

const getRequestTypeExportText = (log: UsageLog): string => {
  const requestType = resolveUsageRequestType(log)
  if (requestType === 'cyber') return 'Cyber'
  if (requestType === 'live') return 'Live'
  if (requestType === 'ws_v2') return 'WS'
  if (requestType === 'stream') return 'Stream'
  if (requestType === 'sync') return 'Sync'
  return 'Unknown'
}

const getDisplayBillingMode = (
  row: Pick<UsageLog, 'billing_mode' | 'image_count'> | null | undefined
): string | null | undefined => resolveDisplayBillingMode(row)

const escapeCSVValue = (value: unknown): string => {
  if (value == null) return ''
  const str = String(value)
  const escaped = str.replace(/"/g, '""')
  if (str === '-') return str
  if (/^[=+\-@\t\r]/.test(str)) return `"\'${escaped}"`
  if (/[,"\n\r]/.test(str)) return `"${escaped}"`
  return str
}

const EXPORT_PAGE_SIZE = 1000
const EXPORT_RATE_LIMIT_MAX_RETRIES = 3
const EXPORT_RATE_LIMIT_MAX_WAIT_SECONDS = 60

// 导出逐页请求计入按用户的重查询限流；429 时按 Retry-After 等待后重试同一页。
const queryExportPage = async (params: UsageQueryParams) => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await usageAPI.query(params)
    } catch (error: any) {
      if (error?.status !== 429 || attempt >= EXPORT_RATE_LIMIT_MAX_RETRIES) throw error
      const waitSeconds = Math.min(
        Math.max(error.retry_after_seconds ?? EXPORT_RATE_LIMIT_MAX_WAIT_SECONDS, 1),
        EXPORT_RATE_LIMIT_MAX_WAIT_SECONDS
      )
      appStore.showInfo(t('usage.exportRateLimited', { seconds: waitSeconds }))
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000))
    }
  }
}

const exportToCSV = async () => {
  if (pagination.total === 0) {
    appStore.showWarning(t('usage.noDataToExport'))
    return
  }
  exporting.value = true
  appStore.showInfo(t('usage.preparingExport'))
  try {
    const allLogs: UsageLog[] = []
    const exportParams = buildUsageListParams(1, EXPORT_PAGE_SIZE)
    const totalPages = Math.ceil(pagination.total / EXPORT_PAGE_SIZE)
    for (let page = 1; page <= totalPages; page++) {
      const response = await queryExportPage({ ...exportParams, page })
      allLogs.push(...response.items)
    }
    if (allLogs.length === 0) {
      appStore.showWarning(t('usage.noDataToExport'))
      return
    }
    const headers = [
      'Time',
      'API Key Name',
      'Model',
      'Reasoning Effort',
      'Inbound Endpoint',
      'IP Address',
      'Type',
      'Billing Mode',
      'Input Tokens',
      'Output Tokens',
      'Cache Read Tokens',
      'Cache Creation Tokens',
      'Rate Multiplier',
      'Billed Cost',
      'Original Cost',
      'First Token (ms)',
      'Duration (ms)',
      'Cache Hit Rate',
    ]
    const rows = allLogs.map((log) => [
      log.created_at,
      log.api_key?.name || '',
      log.model,
      formatReasoningEffort(log.reasoning_effort),
      log.inbound_endpoint || '',
      log.ip_address || '',
      getRequestTypeExportText(log),
      getBillingModeLabel(getDisplayBillingMode(log), t),
      log.input_tokens,
      log.output_tokens,
      log.cache_read_tokens,
      log.cache_creation_tokens,
      log.rate_multiplier,
      log.actual_cost.toFixed(8),
      log.total_cost.toFixed(8),
      log.first_token_ms ?? '',
      log.duration_ms ?? '',
      formatCacheHitRate(log.cache_hit_rate, ''),
    ].map(escapeCSVValue))
    const csvContent = [
      headers.map(escapeCSVValue).join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `usage_${exportParams.start_date}_to_${exportParams.end_date}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
    appStore.showSuccess(t('usage.exportSuccess'))
  } catch (error) {
    console.error('CSV Export failed:', error)
    appStore.showError(t('usage.exportFailed'))
  } finally {
    exporting.value = false
  }
}

const ALWAYS_VISIBLE = ['created_at']
const DEFAULT_HIDDEN_COLUMNS = ['user_agent', 'endpoint', 'ip_address', 'group', 'billing_mode']
const HIDDEN_COLUMNS_KEY = 'user-usage-hidden-columns'

const allColumns = computed<Column[]>(() => [
  { key: 'created_at', label: t('usage.time'), sortable: true },
  { key: 'request_id', label: t('usage.requestId'), sortable: false },
  { key: 'api_key', label: t('usage.apiKeyFilter'), sortable: false },
  { key: 'model', label: t('usage.model'), sortable: true },
  { key: 'reasoning_effort', label: t('usage.reasoningEffort'), sortable: false },
  { key: 'endpoint', label: t('usage.endpoint'), sortable: false },
  { key: 'ip_address', label: 'IP', sortable: false },
  { key: 'group', label: t('admin.usage.group'), sortable: false },
  { key: 'stream', label: t('usage.type'), sortable: false },
  { key: 'billing_mode', label: t('admin.usage.billingMode'), sortable: false },
  { key: 'tokens', label: t('usage.inputOutput'), sortable: false },
  { key: 'cost', label: t('usage.cost'), sortable: false },
  { key: 'latency', label: t('usage.latencyCompact'), sortable: false },
  { key: 'user_agent', label: t('usage.userAgent'), sortable: false },
])

const hiddenColumns = reactive<Set<string>>(new Set())
const toggleableColumns = computed(() => allColumns.value.filter((col) => !ALWAYS_VISIBLE.includes(col.key)))
const visibleColumns = computed(() =>
  allColumns.value.filter((col) => ALWAYS_VISIBLE.includes(col.key) || !hiddenColumns.has(col.key))
)
const isColumnVisible = (key: string) => !hiddenColumns.has(key)
const toggleColumn = (key: string) => {
  if (hiddenColumns.has(key)) hiddenColumns.delete(key)
  else hiddenColumns.add(key)
  localStorage.setItem(HIDDEN_COLUMNS_KEY, JSON.stringify([...hiddenColumns]))
}
const loadSavedColumns = () => {
  try {
    const saved = localStorage.getItem(HIDDEN_COLUMNS_KEY)
    const values = saved ? JSON.parse(saved) as string[] : DEFAULT_HIDDEN_COLUMNS
    values.forEach((key) => hiddenColumns.add(key))
  } catch {
    DEFAULT_HIDDEN_COLUMNS.forEach((key) => hiddenColumns.add(key))
  }
}

// 错误请求 tab 独立列设置(机制同用量列设置,存储互不影响)
const ERR_ALWAYS_VISIBLE = ['status', 'created_at']
const ERR_DEFAULT_HIDDEN_COLUMNS = ['user_agent']
const ERR_HIDDEN_COLUMNS_KEY = 'user-usage-error-hidden-columns'

// key 须与 UserErrorRequestsTable 的 allColumns 一致
const errAllColumns = computed<Column[]>(() => [
  { key: 'key_name', label: t('usage.errors.keyName') },
  { key: 'model', label: t('usage.errors.model') },
  { key: 'endpoint', label: t('usage.errors.endpoint') },
  { key: 'client_ip', label: 'IP' },
  { key: 'group', label: t('admin.usage.group') },
  { key: 'type', label: t('usage.type') },
  { key: 'platform', label: t('usage.errors.platform') },
  { key: 'category', label: t('usage.errors.category') },
  { key: 'status', label: t('usage.errors.status') },
  { key: 'message', label: t('usage.errors.message') },
  { key: 'created_at', label: t('usage.errors.time') },
  { key: 'user_agent', label: t('usage.userAgent') },
])

const errHiddenColumns = reactive<Set<string>>(new Set())
const errToggleableColumns = computed(() =>
  errAllColumns.value.filter((col) => !ERR_ALWAYS_VISIBLE.includes(col.key))
)
const errVisibleColumnKeys = computed(() =>
  errAllColumns.value
    .filter((col) => ERR_ALWAYS_VISIBLE.includes(col.key) || !errHiddenColumns.has(col.key))
    .map((col) => col.key)
)
const isErrColumnVisible = (key: string) => !errHiddenColumns.has(key)
const toggleErrColumn = (key: string) => {
  if (errHiddenColumns.has(key)) errHiddenColumns.delete(key)
  else errHiddenColumns.add(key)
  localStorage.setItem(ERR_HIDDEN_COLUMNS_KEY, JSON.stringify([...errHiddenColumns]))
}
const loadSavedErrColumns = () => {
  try {
    const saved = localStorage.getItem(ERR_HIDDEN_COLUMNS_KEY)
    const values = saved ? (JSON.parse(saved) as string[]) : ERR_DEFAULT_HIDDEN_COLUMNS
    values.forEach((key) => errHiddenColumns.add(key))
  } catch {
    ERR_DEFAULT_HIDDEN_COLUMNS.forEach((key) => errHiddenColumns.add(key))
  }
}

// 列设置下拉按当前 tab 分发
const currentToggleableColumns = computed(() =>
  activeTab.value === 'errors' ? errToggleableColumns.value : toggleableColumns.value
)
const isCurrentColumnVisible = (key: string) =>
  activeTab.value === 'errors' ? isErrColumnVisible(key) : isColumnVisible(key)
const toggleCurrentColumn = (key: string) => {
  if (activeTab.value === 'errors') toggleErrColumn(key)
  else toggleColumn(key)
}

const showColumnDropdown = ref(false)
const columnDropdownRef = ref<HTMLElement | null>(null)
const handleColumnClickOutside = (event: MouseEvent) => {
  if (columnDropdownRef.value && !columnDropdownRef.value.contains(event.target as HTMLElement)) {
    showColumnDropdown.value = false
  }
}

const loadApiKeys = async () => {
  const firstPage = await keysAPI.list(1, 100)
  const keys = [...firstPage.items]
  for (let page = 2; page <= firstPage.pages && keys.length > 0; page++) {
    const response = await keysAPI.list(page, 100)
    if (response.items.length === 0) break
    keys.push(...response.items)
  }
  return keys
}

const loadFilterOptions = async () => {
  try {
    const [keys, availableGroups] = await Promise.all([
      loadApiKeys(),
      userGroupsAPI.getAvailable(),
    ])
    apiKeys.value = keys
    groups.value = availableGroups
  } catch (error) {
    console.error('Failed to load usage filter options:', error)
  }
}

const resetErrorRows = () => {
  errorPage.value = 1
  if (activeTab.value === 'errors') {
    void loadErrors()
  } else {
    errorRows.value = []
    errorTotal.value = 0
  }
}

const loadErrors = async () => {
  errorLoading.value = true
  try {
    const resp = await usageAPI.listMyErrorRequests({
      page: errorPage.value,
      page_size: errorPageSize.value,
      start_date: startDate.value,
      end_date: endDate.value,
      model: (errorFilter.value.model ?? '').trim() || undefined,
      category: errorFilter.value.category || undefined,
      api_key_id: errorFilter.value.api_key_id ?? undefined,
      status_code: errorFilter.value.status_code ?? undefined,
      sort_by: errorSortBy.value,
      sort_order: errorSortOrder.value,
    })
    errorRows.value = resp.items
    errorTotal.value = resp.total
  } catch (error) {
    console.error('[UsageView] loadErrors failed:', error)
    appStore.showError(t('usage.errors.failedToLoad'))
  } finally {
    errorLoading.value = false
  }
}

const onErrorSort = (sortBy: string, sortOrder: 'asc' | 'desc') => {
  errorSortBy.value = sortBy
  errorSortOrder.value = sortOrder
  errorPage.value = 1
  void loadErrors()
}

const onErrorPage = (page: number) => {
  errorPage.value = page
  void loadErrors()
}

const onErrorPageSize = (pageSize: number) => {
  errorPageSize.value = pageSize
  errorPage.value = 1
  void loadErrors()
}

const switchToErrors = () => {
  activeTab.value = 'errors'
  if (errorRows.value.length === 0) void loadErrors()
}

onMounted(() => {
  loadSavedColumns()
  loadSavedErrColumns()
  document.addEventListener('click', handleColumnClickOutside)
  void loadFilterOptions()
  refreshData()
  if (typeof ResizeObserver !== 'undefined' && filterScrollRef.value) {
    filterResizeObserver = new ResizeObserver(updateFilterFade)
    filterResizeObserver.observe(filterScrollRef.value)
  }
  updateFilterFade()
})

onUnmounted(() => {
  abortController?.abort()
  document.removeEventListener('click', handleColumnClickOutside)
  filterResizeObserver?.disconnect()
  window.clearTimeout(copiedResetTimer)
})

watch(activeTab, () => nextTick(updateFilterFade))

watch(endpointDistributionSource, () => {
  // Endpoint source switching is handled by the chart component using already loaded stats.
})
</script>
