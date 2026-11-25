<template>
  <AppLayout>
    <div class="console-redeem">
      <div class="console-page-heading">
        <div>
          <h1 class="page-title">{{ t('redeem.title') }}</h1>
          <p class="page-description">{{ t('redeem.console.description') }}</p>
        </div>
      </div>

      <div class="console-redeem-grid">
        <!-- 兑换（Figma C7「输入兑换码」）：输入框 + 按钮一行，结果直接放在卡片里 -->
        <section class="console-redeem-card console-redeem-form" aria-labelledby="redeem-form-title">
          <h2 id="redeem-form-title" class="console-redeem-card__title">{{ t('redeem.console.enterCode') }}</h2>
          <form class="console-redeem-row" @submit.prevent="handleRedeem">
            <div class="console-redeem-input">
              <Icon name="gift" size="sm" class="console-redeem-input__icon" aria-hidden="true" />
              <label for="code" class="sr-only">{{ t('redeem.redeemCodeLabel') }}</label>
              <input
                id="code"
                v-model="redeemCode"
                type="text"
                required
                autocomplete="off"
                spellcheck="false"
                :placeholder="t('redeem.redeemCodePlaceholder')"
                :disabled="submitting"
                aria-describedby="redeem-code-hint"
                class="input"
              />
            </div>
            <button
              type="submit"
              :disabled="!redeemCode || submitting"
              class="btn btn-primary console-redeem-submit"
            >
              <span v-if="submitting" class="console-redeem-spinner" aria-hidden="true"></span>
              {{ submitting ? t('redeem.redeeming') : t('redeem.redeemButton') }}
            </button>
          </form>
          <p id="redeem-code-hint" class="console-redeem-hint">{{ t('redeem.redeemCodeHint') }}</p>

          <transition name="fade">
            <div v-if="redeemResult" class="console-redeem-result console-redeem-result--ok" role="status" data-testid="redeem-success">
              <Icon name="check" size="sm" class="console-redeem-result__icon" aria-hidden="true" />
              <div class="console-redeem-result__body">
                <p><strong>{{ t('redeem.redeemSuccess') }}</strong> <span v-if="successMessage">{{ successMessage }}</span></p>
                <p v-if="successDetails.length" class="console-redeem-result__detail font-mono">{{ successDetails.join(' · ') }}</p>
              </div>
            </div>
          </transition>
          <transition name="fade">
            <div v-if="errorMessage" class="console-redeem-result console-redeem-result--error" role="alert" data-testid="redeem-error">
              <Icon name="exclamationCircle" size="sm" class="console-redeem-result__icon" aria-hidden="true" />
              <div class="console-redeem-result__body">
                <p><strong>{{ t('redeem.redeemFailed') }}</strong></p>
                <p class="console-redeem-result__detail">{{ errorMessage }}</p>
              </div>
            </div>
          </transition>
        </section>

        <!-- 当前余额：本页唯一一块夜空数据卡 -->
        <section class="console-redeem-balance" :aria-label="t('redeem.currentBalance')">
          <p class="console-redeem-balance__label">{{ t('redeem.currentBalance') }}</p>
          <p class="console-redeem-balance__value font-mono" data-testid="redeem-balance">
            <span class="console-redeem-balance__unit">$</span>{{ (user?.balance ?? 0).toFixed(2) }}
            <span v-if="balanceDelta" class="console-redeem-balance__delta">{{ balanceDelta }}</span>
          </p>
          <dl class="console-redeem-balance__rows">
            <div>
              <dt>{{ t('redeem.concurrency') }}</dt>
              <dd class="font-mono">{{ user?.concurrency ?? 0 }}</dd>
            </div>
          </dl>
        </section>

        <!-- 最近活动 -->
        <section class="console-redeem-card console-redeem-history" aria-labelledby="redeem-history-title">
          <header class="console-redeem-history__head">
            <h2 id="redeem-history-title" class="console-redeem-card__title">{{ t('redeem.recentActivity') }}</h2>
          </header>

          <div v-if="loadingHistory && history.length === 0" class="console-redeem-state">
            <span class="console-redeem-spinner console-redeem-spinner--muted" aria-hidden="true"></span>
            <span>{{ t('common.loading') }}</span>
          </div>

          <ul v-else-if="history.length > 0" class="console-redeem-activity" :aria-busy="loadingHistory">
            <li v-for="item in history" :key="item.id" class="console-redeem-activity__row" data-testid="redeem-activity">
              <span class="console-redeem-activity__icon" aria-hidden="true">
                <Icon :name="historyIcon(item)" size="sm" />
              </span>
              <span class="console-redeem-activity__main">
                <span class="console-redeem-activity__title">{{ getHistoryItemTitle(item) }}</span>
                <span
                  class="console-redeem-activity__sub"
                  :class="{ 'font-mono': hasCode(item) }"
                  :title="historySubtitle(item)"
                >{{ historySubtitle(item) }}</span>
              </span>
              <span class="console-redeem-activity__side">
                <span
                  class="console-redeem-activity__value font-mono"
                  :class="{ 'is-credit': isBalanceType(item.type) && item.value >= 0 }"
                >{{ formatHistoryValue(item) }}</span>
                <span class="console-redeem-activity__time font-mono">{{ formatDateTimeToMinute(item.used_at) }}</span>
              </span>
            </li>
          </ul>

          <div v-else class="console-redeem-state">
            <Icon name="clock" size="md" aria-hidden="true" />
            <span>{{ t('redeem.historyWillAppear') }}</span>
          </div>

          <div class="console-redeem-foot">
            <span class="console-redeem-foot__total">{{ t('common.total') }}: <span class="font-mono">{{ historyTotal }}</span> {{ t('pagination.results') }}</span>
            <div class="console-redeem-foot__controls">
              <label class="console-redeem-foot__size">
                <span>{{ t('pagination.perPage') }}</span>
                <select
                  v-model="historyPageSize"
                  class="input"
                  :disabled="loadingHistory || submitting"
                  @change="fetchHistory(1)"
                >
                  <option v-for="size in [20, 50, 100]" :key="size" :value="size">{{ size }}</option>
                </select>
              </label>
              <button
                class="btn btn-secondary"
                :disabled="loadingHistory || submitting || historyPage <= 1"
                @click="fetchHistory(historyPage - 1)"
              >{{ t('pagination.previous') }}</button>
              <button
                class="btn btn-secondary"
                :disabled="loadingHistory || submitting || historyPage * historyPageSize >= historyTotal"
                @click="fetchHistory(historyPage + 1)"
              >{{ t('pagination.next') }}</button>
            </div>
          </div>
        </section>

        <!-- 关于兑换码 -->
        <section class="console-redeem-about" aria-labelledby="redeem-about-title">
          <h2 id="redeem-about-title" class="console-redeem-card__title">{{ t('redeem.aboutCodes') }}</h2>
          <ul>
            <li>{{ t('redeem.codeRule1') }}</li>
            <li>{{ t('redeem.codeRule2') }}</li>
            <li>{{ t('redeem.codeRule4') }}</li>
            <li>
              {{ t('redeem.codeRule3') }}
              <span v-if="contactInfo" class="console-redeem-contact">{{ contactInfo }}</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useSubscriptionStore } from '@/stores/subscriptions'
import { redeemAPI, authAPI, type RedeemHistoryItem } from '@/api'
import type { RedeemResult } from '@/api/redeem'
import { extractApiErrorCode } from '@/utils/apiError'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import { formatDateTimeToMinute } from '@/utils/format'
import '@/styles/console-purchase-pages.css'

const { t } = useI18n()
const authStore = useAuthStore()
const appStore = useAppStore()
const subscriptionStore = useSubscriptionStore()

const user = computed(() => authStore.user)

const redeemCode = ref('')
const submitting = ref(false)
const redeemResult = ref<RedeemResult | null>(null)
const errorMessage = ref('')
// 只有账户余额刷新成功后才在余额旁标「+$x」，否则旧余额旁的增量会让人误读。
const balanceRefreshed = ref(false)

// History data
const history = ref<RedeemHistoryItem[]>([])
const loadingHistory = ref(false)
const historyPage = ref(1)
const historyPageSize = ref(20)
const historyTotal = ref(0)
let historyRequest = 0
let loadedHistoryPageSize = 20
const contactInfo = ref('')

// Helper functions for history display
const isBalanceType = (type: string) => {
  return type === 'balance' || type === 'admin_balance' || type === 'affiliate_balance'
}

const isSubscriptionType = (type: string) => {
  return type === 'subscription'
}

const isAdminAdjustment = (type: string) => {
  return type === 'admin_balance' || type === 'admin_concurrency'
}

const getHistoryItemTitle = (item: RedeemHistoryItem) => {
  if (item.type === 'balance') {
    return t('redeem.balanceAddedRedeem')
  } else if (item.type === 'affiliate_balance') {
    return t('redeem.balanceAddedAffiliate')
  } else if (item.type === 'admin_balance') {
    return item.value >= 0 ? t('redeem.balanceAddedAdmin') : t('redeem.balanceDeductedAdmin')
  } else if (item.type === 'concurrency') {
    return t('redeem.concurrencyAddedRedeem')
  } else if (item.type === 'admin_concurrency') {
    return item.value >= 0 ? t('redeem.concurrencyAddedAdmin') : t('redeem.concurrencyReducedAdmin')
  } else if (item.type === 'subscription') {
    return t('redeem.subscriptionAssigned')
  }
  return t('common.unknown')
}

// 兑换码类记录副标题显示完整兑换码；管理员调整 / 返利转入没有可用的兑换码，改显示来源（管理员备注一并显示）。
const hasCode = (item: RedeemHistoryItem) => !isAdminAdjustment(item.type) && item.type !== 'affiliate_balance' && !!item.code

const historySubtitle = (item: RedeemHistoryItem) => {
  if (item.type === 'affiliate_balance') return t('redeem.console.affiliateSource')
  if (isAdminAdjustment(item.type)) {
    return item.notes ? `${t('redeem.adminAdjustment')} · ${item.notes}` : t('redeem.adminAdjustment')
  }
  return item.code
}

const historyIcon = (item: RedeemHistoryItem) => {
  if (item.type === 'affiliate_balance') return 'users'
  if (isAdminAdjustment(item.type)) return 'inbox'
  if (isSubscriptionType(item.type)) return 'creditCard'
  return 'gift'
}

// 兑换结果一行：余额 / 并发 / 订阅 + 新余额 / 新并发；余额一律美元。
const successDetails = computed(() => {
  const result = redeemResult.value
  if (!result) return []
  const parts: string[] = []
  if (result.type === 'balance') {
    parts.push(`${t('redeem.added')} +$${result.value.toFixed(2)}`)
  } else if (result.type === 'concurrency') {
    parts.push(`${t('redeem.added')} +${result.value} ${t('redeem.concurrentRequests')}`)
  } else if (result.type === 'subscription') {
    let text = t('redeem.subscriptionAssigned')
    const groupName = result.group_name || result.group?.name
    if (groupName) text += ` ${groupName}`
    if (result.validity_days) text += ` (${t('redeem.subscriptionDays', { days: result.validity_days })})`
    parts.push(text)
  }
  if (result.new_balance !== undefined) parts.push(`${t('redeem.newBalance')} $${result.new_balance.toFixed(2)}`)
  if (result.new_concurrency !== undefined) parts.push(`${t('redeem.newConcurrency')} ${result.new_concurrency} ${t('redeem.requests')}`)
  return parts
})

// 后端消息只在和标题不同时补充显示（旧版会回一句「兑换成功」，和标题重复）。
const normalizeNotice = (text: string) => text.replace(/[\s!！。.]/g, '').toLowerCase()
const successMessage = computed(() => {
  const message = redeemResult.value?.message?.trim()
  if (!message) return ''
  const titles = [t('redeem.redeemSuccess'), t('redeem.codeRedeemSuccess')].map(normalizeNotice)
  return titles.includes(normalizeNotice(message)) ? '' : message
})

// 兑换失败：按后端错误码（apiClient 归一化后的 reason）给出具体原因，未知错误回退通用提示。
// 错误码见 backend/internal/service/redeem_service.go。
const REDEEM_ERROR_CODES = [
  'REDEEM_CODE_NOT_FOUND',
  'REDEEM_CODE_USED',
  'REDEEM_CODE_EXPIRED',
  'REDEEM_CODE_LOCKED',
  'REDEEM_RATE_LIMITED',
  'REDEEM_CODE_INVALID',
  'REDEEM_CODE_UNSUPPORTED_TYPE',
] as const
const redeemErrorMessage = (error: unknown) => {
  const code = extractApiErrorCode(error)
  return code && (REDEEM_ERROR_CODES as readonly string[]).includes(code)
    ? t(`redeem.errors.${code}`)
    : t('redeem.failedToRedeem')
}

const balanceDelta = computed(() => {
  const result = redeemResult.value
  if (!result || !balanceRefreshed.value || result.type !== 'balance' || !(result.value > 0)) return ''
  return `+$${result.value.toFixed(2)}`
})

const formatHistoryValue = (item: RedeemHistoryItem) => {
  if (isBalanceType(item.type)) {
    const sign = item.value >= 0 ? '+' : '-'
    return `${sign}$${Math.abs(item.value).toFixed(2)}`
  } else if (isSubscriptionType(item.type)) {
    // 订阅类型显示有效天数和分组名称
    const days = item.validity_days || Math.round(item.value)
    const groupName = item.group?.name || ''
    return groupName ? `${days}${t('redeem.days')} - ${groupName}` : `${days}${t('redeem.days')}`
  } else {
    const sign = item.value >= 0 ? '+' : ''
    return `${sign}${item.value} ${t('redeem.requests')}`
  }
}

const fetchHistory = async (page = 1) => {
  const request = ++historyRequest
  const pageSize = historyPageSize.value
  loadingHistory.value = true
  try {
    const result = await redeemAPI.getHistory(page, pageSize)
    if (request !== historyRequest) return
    history.value = result.items
    historyTotal.value = result.total
    historyPage.value = page
    historyPageSize.value = pageSize
    loadedHistoryPageSize = pageSize
  } catch (error) {
    if (request !== historyRequest) return
    historyPageSize.value = loadedHistoryPageSize
    appStore.showError(t('redeem.historyLoadFailed'))
    console.error('Failed to fetch history:', error)
  } finally {
    if (request === historyRequest) loadingHistory.value = false
  }
}

const handleRedeem = async () => {
  if (!redeemCode.value.trim()) {
    appStore.showError(t('redeem.pleaseEnterCode'))
    return
  }

  submitting.value = true
  errorMessage.value = ''
  redeemResult.value = null
  balanceRefreshed.value = false

  try {
    const result = await redeemAPI.redeem(redeemCode.value.trim())

    redeemResult.value = result

    // Refresh user data to get updated balance/concurrency
    try {
      await authStore.refreshUser()
      balanceRefreshed.value = true
    } catch (error) {
      console.error('Failed to refresh user after redeem:', error)
      appStore.showWarning(t('redeem.userRefreshFailed'))
    }

    // If subscription type, immediately refresh subscription status
    if (result.type === 'subscription') {
      try {
        await subscriptionStore.fetchActiveSubscriptions(true) // force refresh
      } catch (error) {
        console.error('Failed to refresh subscriptions after redeem:', error)
        appStore.showWarning(t('redeem.subscriptionRefreshFailed'))
      }
    }

    // Clear the input
    redeemCode.value = ''

    // Refresh history
    await fetchHistory()

    // Show success toast
    appStore.showSuccess(t('redeem.codeRedeemSuccess'))
  } catch (error: unknown) {
    errorMessage.value = redeemErrorMessage(error)

    appStore.showError(t('redeem.redeemFailed'))
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  fetchHistory()
  try {
    const settings = await authAPI.getPublicSettings()
    contactInfo.value = settings.contact_info || ''
  } catch (error) {
    console.error('Failed to load contact info:', error)
  }
})
</script>
