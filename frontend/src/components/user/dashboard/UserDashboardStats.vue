<template>
  <!--
    v3 指标卡（Figma C1「KPI tiles」）：一行四块，图标瓷砖 28 + 等宽数字 28px。
    余额与 API 密钥数量移到上方夜空数据卡。
  -->
  <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
    <div v-for="tile in kpiTiles" :key="tile.key" class="card kpi-tile" :data-kpi="tile.key">
      <div class="flex items-center gap-2.5">
        <span class="kpi-tile__icon"><Icon :name="tile.icon" size="sm" /></span>
        <span class="truncate text-[13px] text-gray-600 dark:text-dark-300">{{ tile.label }}</span>
      </div>
      <p class="kpi-tile__value" :title="tile.title">{{ tile.value }}</p>
      <p class="truncate font-mono text-xs text-gray-500 dark:text-dark-400" :title="tile.sub">{{ tile.sub }}</p>
    </div>
  </div>

  <!-- 按平台拆分：一张卡，各平台用竖线分栏，不再卡片套卡片 -->
  <div v-if="!isSimple && platformCards.length > 0" class="card overflow-hidden">
    <div class="flex items-center justify-between px-5 pt-[18px]">
      <h3 class="text-[15px] font-semibold text-gray-900 dark:text-dark-100">{{ t('dashboard.platformBreakdown') }}</h3>
      <span class="text-xs text-gray-500 dark:text-dark-400">
        {{ t('dashboard.platformCount', { count: platformCount }) }}
      </span>
    </div>
    <div class="platform-grid">
      <div
        v-for="item in platformCards"
        :key="item.platform"
        data-testid="platform-card"
        :data-platform="item.platform"
        class="platform-col"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm font-semibold" :class="item.isOther ? 'text-gray-500 dark:text-dark-400' : 'text-gray-900 dark:text-dark-100'">
            {{ item.isOther ? t('dashboard.platformOther') : platformLabel(item.platform) }}
          </span>
          <span class="font-mono text-sm text-star-bronze dark:text-star-bronze-night" :title="t('dashboard.actual')">
            ${{ formatCost(item.total_actual_cost) }}
          </span>
        </div>
        <dl class="mt-2.5 space-y-1.5 text-xs">
          <div class="flex items-center justify-between">
            <dt class="text-gray-500 dark:text-dark-400">{{ t('dashboard.todayCost') }}</dt>
            <dd class="font-mono text-gray-900 dark:text-dark-100">${{ formatCost(item.today_actual_cost) }}</dd>
          </div>
          <div class="flex items-center justify-between">
            <dt class="text-gray-500 dark:text-dark-400">{{ t('dashboard.requests') }}</dt>
            <dd class="font-mono text-gray-700 dark:text-gray-200">
              {{ item.total_requests > 0 ? formatNumber(item.total_requests) : '-' }}
            </dd>
          </div>
          <div class="flex items-center justify-between">
            <dt class="text-gray-500 dark:text-dark-400">{{ t('dashboard.tokens') }}</dt>
            <dd class="font-mono text-gray-700 dark:text-gray-200">
              {{ item.total_tokens > 0 ? formatTokens(item.total_tokens) : '-' }}
            </dd>
          </div>
        </dl>

        <!-- Quota 区：仅当 quota 配置存在、非 __other__ 且至少有一个窗口配了 limit 时显示 -->
        <div v-if="hasAnyLimit(item.quota) && !item.isOther" class="mt-3 space-y-2 border-t border-[color:var(--c-row-line)] pt-2.5">
          <p class="text-[11px] font-medium text-gray-500 dark:text-dark-400">
            {{ t('dashboard.platformQuota.title') }}
          </p>
          <template v-for="w in (['daily', 'weekly', 'monthly'] as const)" :key="w">
            <div v-if="quotaVal(item.quota, `${w}_limit_usd`) != null" class="space-y-1">
              <!-- limit=0：完全禁用 -->
              <template v-if="(quotaVal(item.quota, `${w}_limit_usd`) as number) === 0">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-gray-600 dark:text-dark-300">{{ t(`dashboard.platformQuota.${w}`) }}</span>
                  <span class="font-mono text-star-bronze dark:text-star-bronze-night">{{ t('dashboard.platformQuota.disabled') }}</span>
                </div>
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-dark-700">
                  <div class="h-full w-full rounded-full bg-star-bronze dark:bg-star-bronze-night" />
                </div>
              </template>
              <!-- limit>0：正常用量进度条 -->
              <template v-else>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-gray-600 dark:text-dark-300">{{ t(`dashboard.platformQuota.${w}`) }}</span>
                  <span class="font-mono text-gray-700 dark:text-gray-200">
                    ${{ formatUsd((quotaVal(item.quota, `${w}_usage_usd`) as number) ?? 0) }} / ${{ formatUsd(quotaVal(item.quota, `${w}_limit_usd`) as number) }}
                  </span>
                </div>
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-dark-700">
                  <div
                    class="h-full rounded-full transition-all"
                    :class="quotaBarClass(calcPercent((quotaVal(item.quota, `${w}_usage_usd`) as number) ?? 0, quotaVal(item.quota, `${w}_limit_usd`) as number))"
                    :style="{ width: calcPercent((quotaVal(item.quota, `${w}_usage_usd`) as number) ?? 0, quotaVal(item.quota, `${w}_limit_usd`) as number) + '%' }"
                  />
                </div>
                <p v-if="quotaVal(item.quota, `${w}_window_resets_at`)" class="font-mono text-[10px] text-gray-400 dark:text-dark-400">
                  {{ t('dashboard.platformQuota.resetsAt', { time: formatResetTime(quotaVal(item.quota, `${w}_window_resets_at`) as string) }) }}
                </p>
              </template>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { PLATFORM_LABELS } from './platformLabels'
import type { PlatformDashboardStats, UserDashboardStats as UserStatsType } from '@/api/usage'
import type { PlatformQuotaItem } from '@/types'

interface FusedPlatformCard {
  platform: string
  total_actual_cost: number
  today_actual_cost: number
  total_requests: number
  total_tokens: number
  isOther?: boolean
  quota?: PlatformQuotaItem
}

const props = defineProps<{
  stats: UserStatsType
  balance: number
  isSimple: boolean
  platformQuotas?: PlatformQuotaItem[] | null
}>()
const { t } = useI18n()

const platformLabel = (p: string) => PLATFORM_LABELS[p] ?? p

// 处理"各平台之和 < 总值"的差值：后端按平台聚合时过滤了无法归属平台的行
// （group 与 account 都缺 platform）。这里把差值作为"其他"卡片显式展示，
// 避免 Row 1 总值与 Row 3 平台拆分加总对不上、用户困惑。
const OTHER_THRESHOLD = 0.0001
const platformCards = computed<FusedPlatformCard[]>(() => {
  // 建立 by_platform Map
  const byPlat = new Map<string, PlatformDashboardStats>()
  for (const item of props.stats?.by_platform ?? []) byPlat.set(item.platform, item)

  // 建立 quota Map。三档全空的记录不产生卡片，挂到卡片上也不渲染配额区。
  const byQuota = new Map<string, PlatformQuotaItem>()
  for (const q of props.platformQuotas ?? []) byQuota.set(q.platform, q)

  // 卡片集合 = 有用量的平台 ∪ 至少配置了一档限额的平台。
  // 三档全空的限额记录等价于不限额，不单独产生卡片。
  // 后端 by_platform / quota 接口均不会返回 platform='__other__'，
  // 无需显式排除；__other__ 由下方差值补差逻辑单独追加。
  const platforms = new Set<string>(byPlat.keys())
  for (const [platform, q] of byQuota) {
    if (hasAnyLimit(q)) platforms.add(platform)
  }

  const PLATFORM_ORDER = ['anthropic', 'openai', 'gemini', 'antigravity', 'grok', 'typesafe']
  const cards: FusedPlatformCard[] = []

  for (const p of platforms) {
    const stat = byPlat.get(p)
    cards.push({
      platform: p,
      total_actual_cost: stat?.total_actual_cost ?? 0,
      today_actual_cost: stat?.today_actual_cost ?? 0,
      total_requests: stat?.total_requests ?? 0,
      total_tokens: stat?.total_tokens ?? 0,
      quota: byQuota.get(p),
    })
  }

  // 排序：按 PLATFORM_ORDER，未知平台按名称排序
  cards.sort((a, b) => {
    const ai = PLATFORM_ORDER.indexOf(a.platform)
    const bi = PLATFORM_ORDER.indexOf(b.platform)
    if (ai === -1 && bi === -1) return a.platform.localeCompare(b.platform)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  // __other__ 补差逻辑：只对 by_platform 有 usage 数据的总和计算
  const total = props.stats?.total_actual_cost ?? 0
  const today = props.stats?.today_actual_cost ?? 0
  const sumTotal = cards.reduce((s, c) => s + c.total_actual_cost, 0)
  const sumToday = cards.reduce((s, c) => s + c.today_actual_cost, 0)
  const diffTotal = Math.max(0, total - sumTotal)
  const diffToday = Math.max(0, today - sumToday)

  if (diffTotal > OTHER_THRESHOLD || diffToday > OTHER_THRESHOLD) {
    cards.push({
      platform: '__other__',
      total_actual_cost: diffTotal,
      today_actual_cost: diffToday,
      total_requests: 0,
      total_tokens: 0,
      isOther: true,
    })
  }

  return cards
})

// 标题右侧的平台计数 = 实际渲染的平台卡片数，不含"其他"差额卡。
const platformCount = computed(() => platformCards.value.filter((c) => !c.isOther).length)

// Quota helpers

type QuotaWindow = 'daily' | 'weekly' | 'monthly'
type QuotaField = `${QuotaWindow}_limit_usd` | `${QuotaWindow}_usage_usd` | `${QuotaWindow}_window_resets_at`

function quotaVal(q: PlatformQuotaItem | undefined, key: QuotaField): PlatformQuotaItem[QuotaField] {
  return q?.[key]
}

function hasAnyLimit(q: PlatformQuotaItem | undefined): boolean {
  if (!q) return false
  return q.daily_limit_usd != null || q.weekly_limit_usd != null || q.monthly_limit_usd != null
}

function calcPercent(usage: number, limit: number): number {
  if (!limit || limit <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((usage / limit) * 100)))
}

// 额度 ≥ 90% 用古铜提示，不引入红色（DESIGN.md · Console「数字与颜色」）
function quotaBarClass(p: number): string {
  if (p >= 90) return 'bg-star-bronze dark:bg-star-bronze-night'
  return 'bg-primary-800 dark:bg-primary-400'
}

// 与 formatBalance 一致使用 Intl.NumberFormat 做半偶舍入，避免 toFixed 在不同 JS 引擎
// 下偶发截断而非四舍五入（与后端展示精度不一致）。
const usdFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '0.00'
  return usdFormatter.format(n)
}

function formatResetTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

const formatNumber = (n: number) => n.toLocaleString()
const formatCost = (c: number) => c.toFixed(4)
const formatTokens = (t: number) => {
  if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(1)}M`
  if (t >= 1000) return `${(t / 1000).toFixed(1)}K`
  return t.toString()
}
const formatDuration = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(0)}ms`
const formatMoney = (n: number) => usdFormatter.format(Number.isFinite(n) ? n : 0)

const kpiTiles = computed(() => {
  const s = props.stats
  const actual = s?.today_actual_cost ?? 0
  const standard = s?.today_cost ?? 0
  const saved = standard > 0 && actual < standard ? Math.round((1 - actual / standard) * 100) : 0
  const costSub = [
    t('dashboard.kpi.costStandard', { standard: `$${formatMoney(standard)}` }),
    saved > 0 ? t('dashboard.kpi.costSaved', { pct: saved }) : ''
  ].filter(Boolean).join(' · ')
  return [
    {
      key: 'requests',
      icon: 'chart' as const,
      label: t('dashboard.todayRequests'),
      value: formatNumber(s?.today_requests || 0),
      sub: t('dashboard.kpi.requestsTotal', { count: formatNumber(s?.total_requests || 0) }),
      title: undefined as string | undefined
    },
    {
      key: 'cost',
      icon: 'dollar' as const,
      label: t('dashboard.todayCost'),
      value: `$${actual >= 1 ? formatMoney(actual) : formatCost(actual)}`,
      sub: costSub,
      title: `${t('dashboard.actual')} $${formatCost(actual)} / ${t('dashboard.standard')} $${formatCost(standard)}`
    },
    {
      key: 'tokens',
      icon: 'cube' as const,
      label: t('dashboard.todayTokens'),
      value: formatTokens(s?.today_tokens || 0),
      sub: t('dashboard.kpi.tokensSplit', { input: formatTokens(s?.today_input_tokens || 0), output: formatTokens(s?.today_output_tokens || 0) }),
      title: `${t('dashboard.totalTokens')}: ${formatTokens(s?.total_tokens || 0)}`
    },
    {
      key: 'latency',
      icon: 'bolt' as const,
      label: t('dashboard.avgResponse'),
      value: formatDuration(s?.average_duration_ms || 0),
      sub: t('dashboard.kpi.rpmTpm', { rpm: formatTokens(s?.rpm || 0), tpm: formatTokens(s?.tpm || 0) }),
      title: undefined
    }
  ]
})
</script>

<style scoped>
.kpi-tile {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px;
}

.kpi-tile__icon {
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #e8f0fc;
  color: #14306b;
}

.kpi-tile__value {
  overflow: hidden;
  color: rgb(12 24 48);
  font-family: theme('fontFamily.mono');
  font-size: 28px;
  font-weight: 500;
  line-height: 34px;
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 639px) {
  .kpi-tile {
    gap: 8px;
    padding: 14px 16px;
  }

  .kpi-tile__value {
    font-size: 22px;
    line-height: 28px;
  }
}

.platform-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  padding: 4px 0 6px;
}

.platform-col {
  padding: 12px 20px 14px;
  border-bottom: 1px solid var(--c-row-line);
}

@media (min-width: 640px) {
  .platform-col {
    border-bottom: 0;
    border-right: 1px solid var(--c-row-line);
  }

  .platform-col:last-child {
    border-right: 0;
  }
}
</style>

<style>
.dark .kpi-tile__icon {
  background: #15223f;
  color: #7aa2ff;
}

.dark .kpi-tile__value {
  color: #e9eef8;
}
</style>
