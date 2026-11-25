<template>
  <AppLayout>
    <div class="console-data-page console-affiliate">
      <header class="console-page-heading">
        <div>
          <h1 class="page-title">{{ t('affiliate.title') }}</h1>
          <p class="page-description">{{ t('affiliate.description') }}</p>
        </div>
      </header>

      <div v-if="loading" class="console-affiliate-state" :aria-label="t('common.loading')" aria-busy="true">
        <Icon name="refresh" class="animate-spin" />
        <span>{{ t('common.loading') }}</span>
      </div>

      <template v-else-if="detail">
        <section class="console-affiliate-overview" :aria-label="t('affiliate.title')">
          <div class="console-affiliate-sharing">
            <div class="console-affiliate-code">
              <p>{{ t('affiliate.yourCode') }}</p>
              <div class="console-affiliate-copy-row">
                <code class="min-w-0 break-all">{{ detail.aff_code }}</code>
                <button class="btn btn-sm console-night-secondary" @click="copyCode">
                  <Icon name="copy" size="sm" />
                  <span>{{ t('affiliate.copyCode') }}</span>
                </button>
              </div>
            </div>
            <div class="console-affiliate-link">
              <p>{{ t('affiliate.inviteLink') }}</p>
              <div class="console-affiliate-copy-row">
                <code class="min-w-0 break-all">{{ inviteLink }}</code>
                <button class="btn btn-sm console-night-secondary" @click="copyInviteLink">
                  <Icon name="link" size="sm" />
                  <span>{{ t('affiliate.copyLink') }}</span>
                </button>
              </div>
            </div>
          </div>
          <dl class="console-affiliate-metrics">
            <div>
              <dt>{{ t('affiliate.stats.rebateRate') }}</dt>
              <dd>
                {{ formattedRebateRate }}<span class="text-base">%</span>
                <p class="font-sans">{{ t('affiliate.stats.rebateRateHint') }}</p>
              </dd>
            </div>
            <div>
              <dt>{{ t('affiliate.stats.invitedUsers') }}</dt>
              <dd>{{ formatCount(detail.aff_count) }}</dd>
            </div>
            <div>
              <dt>{{ t('affiliate.stats.availableQuota') }}</dt>
              <dd class="console-affiliate-money">{{ formatCurrency(detail.aff_quota) }}</dd>
            </div>
            <div>
              <dt>{{ t('affiliate.stats.frozenQuota') }}</dt>
              <dd class="console-affiliate-money">{{ formatCurrency(detail.aff_frozen_quota) }}</dd>
            </div>
            <div>
              <dt>{{ t('affiliate.stats.totalQuota') }}</dt>
              <dd class="console-affiliate-money">{{ formatCurrency(detail.aff_history_quota) }}</dd>
            </div>
          </dl>
          <div class="console-affiliate-transfer">
            <div>
              <h2>{{ t('affiliate.transfer.title') }}</h2>
              <p>{{ t('affiliate.transfer.description') }}</p>
              <p v-if="detail.aff_quota <= 0" class="console-affiliate-money">{{ t('affiliate.transfer.empty') }}</p>
            </div>
            <button class="btn console-night-primary" :disabled="transferring || detail.aff_quota <= 0" @click="transferQuota">
              <Icon v-if="transferring" name="refresh" size="sm" class="animate-spin" />
              <Icon v-else name="dollar" size="sm" />
              <span>{{ transferring ? t('affiliate.transfer.transferring') : t('affiliate.transfer.button') }}</span>
            </button>
          </div>
        </section>

        <div class="console-affiliate-body">
          <section class="console-records">
            <header class="console-affiliate-record-heading">
              <h2>{{ t('affiliate.invitees.title') }}</h2>
            </header>
            <div v-if="detail.invitees.length === 0" class="console-affiliate-state">
              {{ t('affiliate.invitees.empty') }}
            </div>
            <template v-else>
              <ConsoleRecordList :data="detail.invitees.map(item => ({ ...item, id: item.user_id }))" :loading="loading" :label="t('affiliate.invitees.title')">
                <template #default>
                  <div class="console-affiliate-table">
                    <table>
                      <caption class="sr-only">{{ t('affiliate.invitees.title') }}</caption>
                      <thead><tr>
                        <th scope="col">{{ t('affiliate.invitees.columns.email') }}</th>
                        <th scope="col">{{ t('affiliate.invitees.columns.username') }}</th>
                        <th scope="col" class="text-right">{{ t('affiliate.invitees.columns.rebate') }}</th>
                        <th scope="col">{{ t('affiliate.invitees.columns.joinedAt') }}</th>
                      </tr></thead>
                      <tbody>
                        <tr v-for="item in detail.invitees" :key="item.user_id">
                          <td class="font-mono"><span :title="item.email">{{ item.email || '-' }}</span></td>
                          <td><span :title="item.username">{{ item.username || '-' }}</span></td>
                          <td class="text-right console-account-money">{{ formatCurrency(item.total_rebate) }}</td>
                          <td class="font-mono"><time :datetime="item.created_at">{{ formatDateTime(item.created_at) || '-' }}</time></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </template>
                <template #summary="{ row: item }">
                  <span class="console-record-primary">
                    <span class="console-affiliate-email font-mono">{{ item.email || '-' }}</span>
                    <span class="console-account-money">{{ formatCurrency(item.total_rebate) }}</span>
                  </span>
                  <span class="console-record-secondary">{{ item.username || '-' }} · {{ formatDateTime(item.created_at) || '-' }}</span>
                </template>
                <template #detail="{ row: item }">
                  <dl class="console-mobile-fields">
                    <div><dt>{{ t('affiliate.invitees.columns.email') }}</dt><dd>{{ item.email || '-' }}</dd></div>
                    <div><dt>{{ t('affiliate.invitees.columns.username') }}</dt><dd>{{ item.username || '-' }}</dd></div>
                    <div><dt>{{ t('affiliate.invitees.columns.rebate') }}</dt><dd class="console-account-money">{{ formatCurrency(item.total_rebate) }}</dd></div>
                    <div><dt>{{ t('affiliate.invitees.columns.joinedAt') }}</dt><dd>{{ formatDateTime(item.created_at) || '-' }}</dd></div>
                  </dl>
                </template>
              </ConsoleRecordList>
            </template>
          </section>
          <aside class="console-affiliate-tips">
            <h2>{{ t('affiliate.tips.title') }}</h2>
            <ol>
              <li>{{ t('affiliate.tips.line1') }}</li>
              <li>{{ t('affiliate.tips.line2', { rate: `${formattedRebateRate}%` }) }}</li>
              <li>{{ t('affiliate.tips.line3') }}</li>
              <li v-if="detail.aff_frozen_quota > 0">{{ t('affiliate.tips.line4') }}</li>
            </ol>
          </aside>
        </div>
      </template>
      <div v-else class="console-affiliate-state" role="alert">{{ t('affiliate.loadFailed') }}</div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import ConsoleRecordList from '@/components/user/ConsoleRecordList.vue'
import '@/styles/console-data-pages.css'
import '@/styles/console-account-pages.css'
import Icon from '@/components/icons/Icon.vue'
import userAPI from '@/api/user'
import type { UserAffiliateDetail } from '@/types'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useClipboard } from '@/composables/useClipboard'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { extractApiErrorMessage } from '@/utils/apiError'

const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()
const { copyToClipboard } = useClipboard()

const loading = ref(true)
const transferring = ref(false)
const detail = ref<UserAffiliateDetail | null>(null)

const inviteLink = computed(() => {
  if (!detail.value) return ''
  if (typeof window === 'undefined') return `/register?aff=${encodeURIComponent(detail.value.aff_code)}`
  return `${window.location.origin}/register?aff=${encodeURIComponent(detail.value.aff_code)}`
})

// Rebate rate is a percentage in the range [0, 100]; backend already clamps it.
// We trim trailing zeros (e.g. 20.00 → "20", 12.50 → "12.5") for a cleaner UI.
const formattedRebateRate = computed(() => {
  const v = detail.value?.effective_rebate_rate_percent ?? 0
  const rounded = Math.round(v * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString()
})

function formatCount(value: number): string {
  return value.toLocaleString()
}

async function loadAffiliateDetail(silent = false): Promise<void> {
  if (!silent) {
    loading.value = true
  }
  try {
    detail.value = await userAPI.getAffiliateDetail()
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('affiliate.loadFailed')))
  } finally {
    if (!silent) {
      loading.value = false
    }
  }
}

async function copyCode(): Promise<void> {
  if (!detail.value?.aff_code) return
  await copyToClipboard(detail.value.aff_code, t('affiliate.codeCopied'))
}

async function copyInviteLink(): Promise<void> {
  if (!inviteLink.value) return
  await copyToClipboard(inviteLink.value, t('affiliate.linkCopied'))
}

async function transferQuota(): Promise<void> {
  if (!detail.value || detail.value.aff_quota <= 0 || transferring.value) return
  transferring.value = true
  try {
    const resp = await userAPI.transferAffiliateQuota()
    appStore.showSuccess(t('affiliate.transfer.success', { amount: formatCurrency(resp.transferred_quota) }))
    await Promise.all([
      loadAffiliateDetail(true),
      authStore.refreshUser().catch(() => undefined),
    ])
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('affiliate.transferFailed')))
  } finally {
    transferring.value = false
  }
}

onMounted(() => {
  void loadAffiliateDetail()
})
</script>
