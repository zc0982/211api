<template>
  <AppLayout>
    <div class="console-subscriptions">
      <div class="console-page-heading">
        <div>
          <h1 class="page-title">{{ t('userSubscriptions.title') }}</h1>
          <p class="page-description">{{ t('userSubscriptions.console.description') }}</p>
        </div>
        <button type="button" class="btn btn-primary" data-testid="buy-subscription" @click="goPurchase()">
          <Icon name="plus" size="sm" class="mr-1.5" />
          {{ t('userSubscriptions.buy') }}
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center py-12">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
      </div>

      <!-- Empty State -->
      <div v-else-if="subscriptions.length === 0" class="card p-12 text-center">
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-dark-700">
          <Icon name="creditCard" size="xl" class="text-gray-400" />
        </div>
        <h3 class="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('userSubscriptions.noActiveSubscriptions') }}
        </h3>
        <p class="text-gray-500 dark:text-dark-400">
          {{ t('userSubscriptions.noActiveSubscriptionsDesc') }}
        </p>
      </div>

      <!-- Subscriptions Grid -->
      <div v-else class="console-sub-grid">
        <article
          v-for="subscription in subscriptions"
          :key="subscription.id"
          class="console-sub"
          :class="{ 'is-inactive': subscription.status !== 'active' }"
          data-testid="subscription-card"
        >
          <header class="console-sub__head">
            <div class="console-sub__title">
              <h2 :title="subscription.group?.name">{{ subscription.group?.name || `Group #${subscription.group_id}` }}</h2>
              <span :class="['badge', statusBadgeClass(subscription.status)]">{{ t(`userSubscriptions.status.${subscription.status}`) }}</span>
            </div>
            <span class="console-sub__remain font-mono">{{ remainingText(subscription) }}</span>
          </header>
          <p class="console-sub__meta">
            <span class="console-sub__platform">{{ platformText(subscription.group?.platform || '') }}</span>
            <span class="font-mono">{{ t('userSubscriptions.rate') }} ×{{ subscription.group?.rate_multiplier ?? 1 }}</span>
            <span v-if="subscriptionHasPeakRate(subscription)" class="text-star-bronze dark:text-star-bronze-night">
              {{ t('payment.planCard.peakRate') }}: {{ subscriptionPeakRateLabel(subscription) }}
            </span>
            <span class="font-mono">{{ subscription.expires_at ? t('userSubscriptions.expiresOn', { date: formatDateOnly(subscription.expires_at) }) : t('userSubscriptions.noExpiration') }}</span>
          </p>

          <div class="console-sub__usage">
            <div v-for="row in usageRows(subscription)" :key="row.key" class="console-sub__row" :data-testid="`usage-${row.key}`">
              <span class="console-sub__label">{{ row.label }}</span>
              <span class="console-sub__bar" role="progressbar" :aria-valuenow="Math.round(row.pct)" aria-valuemin="0" aria-valuemax="100" :aria-label="row.label">
                <span :class="{ 'is-high': row.pct >= 90 }" :style="{ width: row.pct + '%' }"></span>
              </span>
              <span class="console-sub__used font-mono" :class="{ 'is-high': row.pct >= 90 }">{{ t('userSubscriptions.usageOf', { used: '$' + row.used.toFixed(2), limit: '$' + row.limit.toFixed(2) }) }}</span>
              <span class="console-sub__reset">{{ row.reset }}</span>
            </div>
            <p v-if="usageRows(subscription).length === 0" class="console-sub__unlimited" data-testid="usage-unlimited">
              <Icon name="check" size="sm" />
              {{ t('userSubscriptions.unlimitedDesc') }}
            </p>
          </div>

          <footer class="console-sub__actions">
            <button
              v-if="subscription.status === 'active'"
              type="button"
              class="btn btn-secondary btn-sm"
              @click="goPurchase(subscription.group_id)"
            >{{ t('payment.renewNow') }}</button>
            <button
              v-else-if="subscription.status === 'expired'"
              type="button"
              class="btn btn-secondary btn-sm"
              @click="goPurchase(subscription.group_id)"
            >{{ t('userSubscriptions.rebuy') }}</button>
            <router-link to="/usage" class="console-link">{{ t('userSubscriptions.viewUsage') }}</router-link>
          </footer>
        </article>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import subscriptionsAPI from '@/api/subscriptions'
import type { UserSubscription } from '@/types'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import '@/styles/console-purchase-pages.css'
import { formatDateOnly } from '@/utils/format'
import { hasPeakRate, formatPeakRateWindow, serverTimezoneLabel } from '@/utils/peak-rate'
import { platformLabel } from '@/utils/platformColors'
import {
  getRemainingDurationParts,
  isOneTimeDailyQuota,
  type RemainingDurationParts
} from '@/utils/subscriptionQuota'

const { t } = useI18n()
const router = useRouter()
const appStore = useAppStore()

const subscriptions = ref<UserSubscription[]>([])
const loading = ref(true)

function subscriptionHasPeakRate(subscription: UserSubscription): boolean {
  return hasPeakRate(subscription.group)
}

function subscriptionPeakRateLabel(subscription: UserSubscription): string {
  return formatPeakRateWindow(subscription.group, serverTimezoneLabel(appStore.cachedPublicSettings?.server_utc_offset))
}

async function loadSubscriptions() {
  try {
    loading.value = true
    subscriptions.value = await subscriptionsAPI.getMySubscriptions()
  } catch (error) {
    console.error('Failed to load subscriptions:', error)
    appStore.showError(t('userSubscriptions.failedToLoad'))
  } finally {
    loading.value = false
  }
}

// 未归入具体平台（platform 为空或 default）的订阅写「默认」，不露出内部取值
function platformText(platform: string): string {
  return !platform || platform === 'default' ? t('userSubscriptions.defaultPlatform') : platformLabel(platform)
}

function statusBadgeClass(status: UserSubscription['status']): string {
  return status === 'active' ? 'badge-success' : 'badge-gray'
}

function remainingText(subscription: UserSubscription): string {
  if (subscription.status !== 'active') return t('userSubscriptions.ended')
  if (!subscription.expires_at) return t('userSubscriptions.longTerm')
  const days = Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / 86400000))
  return t('userSubscriptions.daysRemaining', { days })
}

interface UsageRow {
  key: 'daily' | 'weekly' | 'monthly'
  label: string
  used: number
  limit: number
  pct: number
  reset: string
}

// 只列出设置了限额的周期；没有任何限额的订阅用文字说明，不画空进度条
function usageRows(subscription: UserSubscription): UsageRow[] {
  const group = subscription.group
  const rows: UsageRow[] = []
  const add = (
    key: UsageRow['key'],
    limit: number | null | undefined,
    used: number | undefined,
    reset: string
  ) => {
    if (!limit) return
    const value = used || 0
    rows.push({
      key,
      label: t(`userSubscriptions.${key}`),
      used: value,
      limit,
      pct: Math.min((value / limit) * 100, 100),
      reset: subscription.status !== 'active' ? t('userSubscriptions.ended') : reset
    })
  }
  add('daily', group?.daily_limit_usd, subscription.daily_usage_usd, formatDailyUsageWindow(subscription))
  add('weekly', group?.weekly_limit_usd, subscription.weekly_usage_usd, formatResetLabel(subscription.weekly_window_start, 168))
  add('monthly', group?.monthly_limit_usd, subscription.monthly_usage_usd, formatResetLabel(subscription.monthly_window_start, 720))
  return rows
}

function goPurchase(groupId?: number) {
  router.push({
    path: '/purchase',
    query: groupId ? { tab: 'subscription', group: String(groupId) } : { tab: 'subscription' }
  })
}

function formatDurationParts(parts: RemainingDurationParts): string {
  if (parts.days > 0) {
    return `${parts.days}d ${parts.hours}h`
  }

  if (parts.hours > 0) {
    return `${parts.hours}h ${parts.minutes}m`
  }

  return `${parts.minutes}m`
}

function formatDailyUsageWindow(subscription: UserSubscription): string {
  // 一次性日额度（有效期 ≤ 1 天）按到期时间倒计时，即使还没开始用也已经在走
  if (isOneTimeDailyQuota(subscription) && subscription.expires_at) {
    const parts = getRemainingDurationParts(subscription.expires_at)
    if (!parts) return t('userSubscriptions.windowNotActive')
    return t('userSubscriptions.quotaEndsIn', { time: formatDurationParts(parts) })
  }
  if (!subscription.daily_window_start) return t('userSubscriptions.windowNotActive')

  return t('userSubscriptions.resetIn', {
    time: formatResetTime(subscription.daily_window_start, 24)
  })
}

// 未开始计时的窗口直接写「等待首次使用」，不拼成「等待首次使用 后重置」
function formatResetLabel(windowStart: string | null, windowHours: number): string {
  if (!windowStart) return t('userSubscriptions.windowNotActive')
  const parts = getRemainingDurationParts(new Date(new Date(windowStart).getTime() + windowHours * 3600000))
  return parts ? t('userSubscriptions.resetIn', { time: formatDurationParts(parts) }) : t('userSubscriptions.windowNotActive')
}

function formatResetTime(windowStart: string | null, windowHours: number): string {
  if (!windowStart) return t('userSubscriptions.windowNotActive')

  const start = new Date(windowStart)
  const end = new Date(start.getTime() + windowHours * 60 * 60 * 1000)
  const parts = getRemainingDurationParts(end)

  return parts ? formatDurationParts(parts) : t('userSubscriptions.windowNotActive')
}

onMounted(() => {
  loadSubscriptions()
})
</script>
