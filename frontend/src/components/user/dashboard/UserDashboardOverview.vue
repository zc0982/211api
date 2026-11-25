<template>
  <!--
    v3 夜空数据卡（Figma「211API · Console v3」C1「Overview / 夜空数据卡」）：
    单层 #0e1830、圆角 20、浮层阴影，每页至多一块。三栏：账户余额 / 配额用量 / 最近一次调用。
    金色只给「最近一次调用」这一条被追踪的线（One Star Rule）。
  -->
  <section class="night-card" data-testid="dashboard-overview">
    <!-- 账户余额 -->
    <div class="night-card__col night-card__col--balance">
      <p class="night-card__label">{{ t('dashboard.overview.balance') }}</p>
      <p class="night-card__balance">
        <span class="night-card__currency">$</span>
        <span>{{ formatMoney(balance) }}</span>
      </p>
      <p v-if="stats" class="night-card__meta">
        {{ t('dashboard.overview.spent', { total: `$${formatMoney(stats.total_actual_cost)}`, today: `$${formatMoney(stats.today_actual_cost)}` }) }}
      </p>
      <p v-if="stats" class="night-card__meta">
        {{ t('dashboard.overview.keys', { total: stats.total_api_keys, active: stats.active_api_keys }) }}
      </p>
      <div v-if="!isSimple" class="mt-2 flex flex-wrap gap-2">
        <router-link v-if="purchaseAction" to="/purchase" class="night-btn night-btn--moon" data-testid="overview-purchase">
          <Icon name="creditCard" size="xs" />
          {{ purchaseAction === 'subscribe' ? t('dashboard.overview.subscribe') : t('dashboard.overview.recharge') }}
        </router-link>
        <router-link to="/redeem" class="night-btn night-btn--ghost">
          {{ t('dashboard.overview.redeem') }}
        </router-link>
      </div>
    </div>

    <div class="night-card__divider" aria-hidden="true"></div>

    <!-- 配额用量（未配置限额时显示密钥概况） -->
    <div class="night-card__col night-card__col--quota">
      <template v-if="quotaPlatforms.length">
        <div class="flex items-center gap-2">
          <p class="night-card__label">{{ t('dashboard.overview.quota') }}</p>
          <div v-if="quotaPlatforms.length > 1" class="night-seg" role="tablist">
            <button
              v-for="q in quotaPlatforms"
              :key="q.platform"
              type="button"
              role="tab"
              class="night-seg__item"
              :class="{ 'is-active': q.platform === activeQuota?.platform }"
              :aria-selected="q.platform === activeQuota?.platform"
              @click="selectedPlatform = q.platform"
            >
              {{ platformLabel(q.platform) }}
            </button>
          </div>
          <span v-else class="font-mono text-xs text-[#7f8ca5]">{{ platformLabel(activeQuota!.platform) }}</span>
        </div>
        <div class="mt-3.5 space-y-3.5">
          <div v-for="row in quotaRows" :key="row.key" class="flex items-center gap-3" :data-quota-window="row.key">
            <span class="w-4 shrink-0 text-[13px] font-medium text-[#e9eef8]">{{ row.short }}</span>
            <div class="min-w-0 flex-1">
              <div class="night-bar">
                <div class="night-bar__fill" :class="{ 'is-warn': row.warn }" :style="{ width: `${row.pct}%` }"></div>
              </div>
              <p class="mt-1.5 truncate font-mono text-[11px]" :class="row.warn ? 'text-[#ecc978]' : 'text-[#7f8ca5]'">
                {{ row.detail }}
              </p>
            </div>
            <span class="w-10 shrink-0 text-right font-mono text-sm font-medium" :class="row.warn ? 'text-[#ecc978]' : 'text-[#e9eef8]'">
              {{ row.disabled ? '—' : `${row.pct}%` }}
            </span>
          </div>
        </div>
      </template>
      <template v-else>
        <p class="night-card__label">{{ t('dashboard.overview.keysTitle') }}</p>
        <p class="night-card__balance">
          <span>{{ stats?.total_api_keys ?? 0 }}</span>
        </p>
        <p class="night-card__meta">{{ t('dashboard.overview.keysActive', { count: stats?.active_api_keys ?? 0 }) }}</p>
        <router-link to="/keys" class="night-link mt-2">{{ t('dashboard.overview.manageKeys') }} →</router-link>
      </template>
    </div>

    <div class="night-card__divider" aria-hidden="true"></div>

    <!-- 最近一次调用（被追踪：月亮 → 金线 → 金点 → 金色描边的模型牌） -->
    <div class="night-card__col night-card__col--trace">
      <div class="flex items-center gap-2">
        <p class="night-card__label">{{ t('dashboard.overview.lastCall') }}</p>
        <router-link to="/usage" class="night-link ml-auto">{{ t('dashboard.overview.viewUsage') }} →</router-link>
      </div>

      <div v-if="lastCallState === 'loading'" class="mt-3" data-testid="last-call-loading">
        <p class="text-sm text-[#7f8ca5]">{{ t('dashboard.overview.lastCallLoading') }}</p>
      </div>
      <div v-else-if="lastCallState === 'error'" class="mt-3" data-testid="last-call-error">
        <p class="text-sm font-medium text-[#e9eef8]">{{ t('dashboard.overview.lastCallError') }}</p>
        <p class="mt-1.5 text-xs leading-5 text-[#7f8ca5]">{{ t('dashboard.overview.lastCallErrorHint') }}</p>
      </div>
      <template v-else-if="lastCall">
        <div class="trace" data-testid="last-call-trace">
          <span class="trace__moon" aria-hidden="true">
            <svg viewBox="240 184 565 762" width="17" height="23">
              <path fill="#CDD9EE" :d="MOON_FOX_PATH" />
            </svg>
          </span>
          <svg class="trace__line" viewBox="0 0 88 24" width="88" height="24" aria-hidden="true">
            <path d="M0 12C30 0 58 0 88 12" fill="none" stroke="#e3b95e" stroke-opacity="0.62" stroke-width="1.5" />
          </svg>
          <span class="trace__dot" aria-hidden="true"></span>
          <span class="trace__chip">
            <ModelIcon :model="lastCall.model" size="16px" />
            <span class="truncate font-mono text-[13px] text-[#e9eef8]">{{ lastCall.model }}</span>
            <span v-if="lastCall.duration_ms != null" class="font-mono text-[13px] text-[#ecc978]">{{ formatDuration(lastCall.duration_ms) }}</span>
          </span>
        </div>
        <div class="mt-3.5 flex flex-wrap items-center gap-2.5">
          <span v-if="isPolicyBlockedUsage(lastCall)" class="night-badge night-badge--warn" data-testid="last-call-blocked">{{ t('dashboard.overview.blocked') }}</span>
          <span class="truncate font-mono text-xs text-[#7f8ca5]">{{ lastCall.request_id }} · {{ formatClock(lastCall.created_at) }}</span>
        </div>
        <p class="mt-2.5 font-mono text-xs text-[#aab6cb]">
          {{ t('dashboard.overview.lastCallTokens', { input: formatInt(lastCall.input_tokens), output: formatInt(lastCall.output_tokens) }) }}
          <template v-if="lastCall.first_token_ms != null"> · {{ t('dashboard.overview.firstToken', { value: formatDuration(lastCall.first_token_ms) }) }}</template>
          · ${{ formatCost(lastCall.actual_cost) }}
        </p>
      </template>
      <div v-else class="mt-3">
        <p class="text-sm font-medium text-[#e9eef8]">{{ t('dashboard.overview.noCalls') }}</p>
        <p class="mt-1.5 text-xs leading-5 text-[#7f8ca5]">{{ t('dashboard.overview.noCallsHint') }}</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import ModelIcon from '@/components/common/ModelIcon.vue'
import type { UserDashboardStats } from '@/api/usage'
import type { PlatformQuotaItem, UsageLog } from '@/types'
import { PLATFORM_LABELS } from './platformLabels'
import { isPolicyBlockedUsage } from './usageStatus'

const props = defineProps<{
  balance: number
  stats: UserDashboardStats | null
  platformQuotas?: PlatformQuotaItem[] | null
  lastCall?: UsageLog | null
  /** 最近一次调用的读取状态：加载中 / 失败 / 已读取（lastCall 为空才是真的没有调用） */
  lastCallState?: 'loading' | 'error' | 'ready'
  isSimple: boolean
  /** 余额卡的购买入口：充值余额、只能订阅，或不显示 */
  purchaseAction: 'recharge' | 'subscribe' | null
}>()

const { t } = useI18n()

/** 月中星狐剪影（与首页首屏月亮同一图形，设计源 logo-gen/round7-vectorcraft-fox/211api-star-fox-moon-silhouette.svg） */
const MOON_FOX_PATH =
  'M246.073 188.76 C245.507 185.836 248.235 183.336 251.099 184.154 C314.757 202.342 378.218 244.919 411.298 308.904 C418.669 308.3 426.248 308 434 308 C441.752 308 449.331 308.3 456.702 308.904 C489.782 244.919 553.243 202.342 616.901 184.154 C619.765 183.336 622.493 185.836 621.927 188.76 C610.292 248.875 596.779 314.622 579.568 389.639 L579.568 389.639 C597.178 389.539 614.642 392.448 631.343 398.005 C661.81 408.136 683.943 430.74 691.862 453.748 C692.41 455.34 691.902 457.105 690.592 458.163 C689.282 459.22 687.449 459.344 686.009 458.472 C670.052 448.813 656.28 445.038 644.026 445.365 C650.241 458.371 654.692 473.01 657.16 488.52 C702.555 486.321 750.478 506.053 783.209 548.56 C802.426 573.523 808.029 604.052 801.844 627.126 C801.407 628.753 799.999 629.932 798.321 630.075 C796.642 630.219 795.054 629.296 794.348 627.766 C786.716 611.233 777.634 600.64 767.544 594.189 C764.814 612.452 758.112 631.324 747.972 649.161 C778.23 671.923 799.774 708.485 802.552 752.719 C804.37 781.748 792.903 808.014 776.245 822.499 C774.974 823.604 773.147 823.794 771.675 822.975 C770.203 822.156 769.402 820.503 769.671 818.841 C772.3 802.608 770.915 790.05 766.713 780.075 C752.888 795.038 734.297 807.726 713.086 816.467 C720.343 845.505 716.717 878.387 699.14 908.354 C699.14 908.354 699.14 908.355 699.139 908.355 C686.251 930.305 665.075 943.747 645.858 946.11 C644.186 946.316 642.565 945.452 641.803 943.95 C641.041 942.448 641.301 940.629 642.455 939.401 C651.895 929.353 656.945 919.971 658.876 911.063 C624.929 918.797 582.251 911.372 548.445 887.622 C541.618 889.281 534.881 889.004 529.171 886.691 C522.922 884.16 517.986 879.222 515.562 871.992 C497.908 853.82 483.319 833.146 471.897 812 L471.897 812 C463.243 811.989 455.254 810.611 448.865 808.289 C444.394 806.664 440.698 804.578 438 802.118 C435.302 804.578 431.606 806.664 427.135 808.289 C420.721 810.621 412.694 812 404 812 C393.756 812 384.451 810.089 377.588 806.952 C372.759 804.744 367.604 801.211 365.712 796 L350 796 C348.741 796 347.555 795.407 346.8 794.4 C309.848 745.131 311.773 663.677 348.288 598.442 C332.696 589.447 319.461 578.246 308.722 564.855 C294.189 570.64 272.606 576 244 576 C240.866 576 238.947 572.538 240.608 569.88 C245.839 561.51 251.091 554.72 257.677 549.187 C263.206 544.543 269.64 540.82 277.676 537.884 C275.407 535.059 272.583 532.456 268.88 530.142 C263.319 526.666 255.776 523.843 245.284 521.935 C242.263 521.386 240.963 517.761 242.946 515.416 C253.733 502.669 264.599 488.868 272.695 473.167 C280.653 457.734 286 440.362 286 420 C286 410.178 287.061 401.017 289.092 392.512 C271.566 316.299 257.856 249.641 246.073 188.76 Z'

const quotaPlatforms = computed(() =>
  (props.platformQuotas ?? []).filter(
    (q) => q.daily_limit_usd != null || q.weekly_limit_usd != null || q.monthly_limit_usd != null
  )
)
const selectedPlatform = ref<string | null>(null)
const activeQuota = computed(
  () => quotaPlatforms.value.find((q) => q.platform === selectedPlatform.value) ?? quotaPlatforms.value[0] ?? null
)

type QuotaWindow = 'daily' | 'weekly' | 'monthly'
const WINDOW_SHORT: Record<QuotaWindow, string> = { daily: 'D', weekly: 'W', monthly: 'M' }

const quotaRows = computed(() => {
  const q = activeQuota.value
  if (!q) return []
  return (['daily', 'weekly', 'monthly'] as const)
    .filter((w) => q[`${w}_limit_usd`] != null)
    .map((w) => {
      const limit = q[`${w}_limit_usd`] as number
      const usage = (q[`${w}_usage_usd`] as number | null | undefined) ?? 0
      const disabled = limit === 0
      const pct = disabled ? 100 : Math.min(100, Math.max(0, Math.round((usage / limit) * 100)))
      const resets = q[`${w}_window_resets_at`] as string | null | undefined
      const detail = disabled
        ? t('dashboard.platformQuota.disabled')
        : [
            t('dashboard.overview.quotaDetail', { usage: `$${formatMoney(usage)}`, limit: `$${formatMoney(limit)}` }),
            resets ? t('dashboard.platformQuota.resetsAt', { time: formatReset(resets) }) : ''
          ]
            .filter(Boolean)
            .join(' · ')
      return {
        key: w,
        short: shortWindow(w),
        pct,
        disabled,
        // 额度 ≥ 90% 用古铜提示，不引入红色（DESIGN.md · Console「数字与颜色」）
        warn: disabled || pct >= 90,
        detail
      }
    })
})

function shortWindow(w: QuotaWindow): string {
  // 中文用「日 / 周 / 月」，英文用 D / W / M
  const label = t(`dashboard.platformQuota.${w}`)
  return /[一-鿿]/.test(label) ? label.charAt(0) : WINDOW_SHORT[w]
}

const platformLabel = (p: string) => PLATFORM_LABELS[p] ?? p

const moneyFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function formatMoney(n: number | null | undefined): string {
  return Number.isFinite(n) ? moneyFormatter.format(n as number) : '0.00'
}
const formatCost = (c: number) => (Number.isFinite(c) ? c.toFixed(4) : '0.0000')
const formatInt = (n: number) => (Number.isFinite(n) ? n.toLocaleString('en-US') : '0')
const formatDuration = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`)

function formatClock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-GB', { hour12: false })
}

function formatReset(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}
</script>

<style scoped>
.night-card {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 22px 20px;
  border-radius: 20px;
  background: #0e1830;
  box-shadow: var(--c-shadow-float);
  color: #e9eef8;
}

@media (min-width: 1280px) {
  .night-card {
    flex-direction: row;
    align-items: flex-start;
    gap: 28px;
    padding: 24px 28px;
  }
}

.night-card__col {
  min-width: 0;
}

@media (min-width: 1280px) {
  .night-card__col--balance {
    width: 220px;
    flex: none;
  }

  .night-card__col--quota {
    width: 300px;
    flex: none;
  }

  .night-card__col--trace {
    flex: 1 1 auto;
  }
}

.night-card__divider {
  height: 1px;
  background: #1f2d48;
}

@media (min-width: 1280px) {
  .night-card__divider {
    width: 1px;
    height: auto;
    align-self: stretch;
  }
}

.night-card__label {
  color: #aab6cb;
  font-size: 13px;
}

.night-card__balance {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  margin-top: 10px;
  color: #e9eef8;
  font-family: theme('fontFamily.mono');
  font-size: 40px;
  font-weight: 500;
  line-height: 48px;
  letter-spacing: -0.02em;
}

.night-card__currency {
  font-size: 22px;
  font-weight: 400;
  line-height: 36px;
}

.night-card__meta {
  margin-top: 6px;
  color: #7f8ca5;
  font-family: theme('fontFamily.mono');
  font-size: 12px;
}

.night-btn {
  display: inline-flex;
  height: 32px;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  transition: background-color 0.15s ease;
}

.night-btn--moon {
  background: #dbe6fb;
  color: #0e1830;
}

.night-btn--moon:hover {
  background: #c8d7f4;
}

.night-btn--ghost {
  border: 1px solid rgb(255 255 255 / 0.22);
  background: rgb(219 230 251 / 0.06);
  color: #dbe6fb;
}

.night-btn--ghost:hover {
  background: rgb(219 230 251 / 0.12);
}

.night-link {
  display: inline-block;
  color: #7aa2ff;
  font-size: 13px;
  font-weight: 500;
}

.night-link:hover {
  color: #a3bfff;
}

.night-seg {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: 999px;
  background: #0b1427;
}

.night-seg__item {
  padding: 2px 9px;
  border-radius: 999px;
  color: #7f8ca5;
  font-family: theme('fontFamily.mono');
  font-size: 11px;
}

.night-seg__item.is-active {
  background: #15223f;
  color: #e9eef8;
}

.night-bar {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: #1f2d48;
}

.night-bar__fill {
  height: 100%;
  min-width: 6px;
  border-radius: 999px;
  background: #7aa2ff;
}

.night-bar__fill.is-warn {
  background: #ecc978;
}

/* ---- trace ---- */
.trace {
  position: relative;
  display: flex;
  align-items: center;
  margin-top: 14px;
  min-height: 56px;
}

.trace__moon {
  position: relative;
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 999px;
  background: #f2f5fb;
  box-shadow: 0 0 0 8px rgb(242 245 251 / 0.06);
}

.trace__line {
  flex: none;
  margin-left: 4px;
  margin-top: -6px;
}

.trace__dot {
  position: absolute;
  left: 88px;
  top: 19px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #e3b95e;
  box-shadow: 0 0 0 5px rgb(227 185 94 / 0.22);
}

.trace__chip {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  margin-left: 4px;
  padding: 7px 14px;
  border: 1.25px solid #e3b95e;
  border-radius: 999px;
  background: rgb(219 230 251 / 0.06);
}

.night-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgb(61 214 140 / 0.12);
  color: #3dd68c;
  font-family: theme('fontFamily.mono');
  font-size: 12px;
  line-height: 16px;
}

.night-badge--warn {
  background: rgb(236 201 120 / 0.12);
  color: #ecc978;
  font-family: inherit;
}

/* 深色主题：夜空卡补 1px line 描边（:global(.dark) 不能写在 scoped 里，见 style.css） */
</style>

<style>
.dark .night-card {
  border: 1px solid #1f2d48;
}

/* OpenAI 等黑色单色图标在夜空卡上一律用墨色 */
.night-card .model-icon path[fill='#000000'] {
  fill: #e9eef8;
}
</style>
