<template>
  <AppLayout>
    <div class="console-data-page console-orders-page">
      <div class="console-page-heading">
        <div>
          <h1 class="page-title">{{ t('nav.myOrders') }}</h1>
          <p class="page-description">{{ t('payment.console.ordersDescription') }}</p>
        </div>
        <button type="button" class="btn btn-secondary console-orders-recharge" @click="router.push('/purchase')">
          <Icon name="creditCard" size="sm" />
          <span>{{ t('payment.console.goRecharge') }}</span>
        </button>
      </div>

      <!-- 一行筛选（Figma C6）：状态分段 + 类型胶囊，刷新在右侧；手机横滑，边缘渐隐提示还有内容。 -->
      <div class="console-filter-bar">
        <div
          ref="filterScrollRef"
          class="console-filter-scroll"
          :class="{ 'console-filter-scroll--more-left': filterFade.left, 'console-filter-scroll--more-right': filterFade.right }"
          role="group"
          :aria-label="t('payment.console.orderFilters')"
          data-test="orders-filter-scroll"
          @scroll.passive="updateFilterFade"
        >
          <div class="tabs console-orders-status" role="tablist" :aria-label="t('payment.orders.status')">
            <button
              v-for="option in statusFilters"
              :key="option.value"
              type="button"
              role="tab"
              class="tab"
              :class="{ 'tab-active': currentFilter === option.value }"
              :aria-selected="currentFilter === option.value"
              :data-status="option.value || 'all'"
              @click="selectStatus(option.value)"
            >{{ option.label }}</button>
          </div>
          <div class="console-filter-pill">
            <Select
              v-model="currentType"
              :options="typeFilters"
              :aria-label="t('payment.orders.orderType')"
              data-test="orders-type-filter"
              @change="handlePageChange(1)"
            />
          </div>
        </div>
        <div class="console-filter-tools">
          <button type="button" class="btn btn-secondary" :disabled="loading" :title="t('common.refresh')" :aria-label="t('common.refresh')" @click="fetchOrders">
            <Icon name="refresh" size="sm" :class="loading ? 'animate-spin' : ''" />
          </button>
        </div>
      </div>

      <section class="console-orders console-orders--page" data-testid="orders-card">
        <ConsoleRecordList :data="orders" :loading="false" :label="t('nav.myOrders')">
          <template #summary="{ row }">
            <span class="console-mobile-record-title">
              <strong>{{ orderTypeLabel(row) }}</strong>
              <span :class="['badge', consoleOrderBadgeClass(row.status)]">{{ statusLabel(row.status) }}</span>
              <Icon name="chevronDown" size="sm" />
            </span>
            <span class="console-mobile-record-meta console-orders-mobile-no">
              <span class="font-mono" data-testid="order-no">{{ row.out_trade_no }}</span>
              <span class="font-mono console-orders__amount console-orders-mobile-pay">{{ payAmountText(row) }}</span>
            </span>
            <span class="console-mobile-record-meta">
              <span><span class="font-mono">{{ formatDateTimeToMinute(row.created_at) }}</span> · {{ methodLabel(row) }}</span>
            </span>
          </template>
          <template #detail="{ row }">
            <dl class="console-mobile-fields" data-testid="order-mobile-fields">
              <div>
                <dt>{{ t('payment.console.colOrderNo') }}</dt>
                <dd class="console-mobile-copy">
                  <code>{{ row.out_trade_no }}</code>
                  <button type="button" class="console-inline-action" :aria-label="`${t('common.copy')} ${row.out_trade_no}`" data-testid="copy-order-no" @click="copyOrderNo(row.out_trade_no)">
                    <Icon :name="copiedOrderNo === row.out_trade_no ? 'check' : 'copy'" size="xs" />
                    <span>{{ copiedOrderNo === row.out_trade_no ? t('common.copied') : t('common.copy') }}</span>
                  </button>
                </dd>
              </div>
              <div>
                <dt>{{ t('payment.orders.creditedAmount') }}</dt>
                <dd class="font-mono">
                  {{ creditedText(row) }}
                  <span v-if="hasBonus(row)" class="console-orders-sub">{{ bonusText(row) }}</span>
                </dd>
              </div>
              <div>
                <dt>{{ t('payment.orders.payAmount') }}</dt>
                <dd class="font-mono">
                  {{ payAmountText(row) }}
                  <span v-if="row.fee_rate > 0" class="console-orders-sub">{{ t('payment.orders.fee') }} {{ row.fee_rate }}%</span>
                </dd>
              </div>
              <div><dt>{{ t('payment.orders.paymentMethod') }}</dt><dd>{{ methodLabel(row) }}</dd></div>
            </dl>
            <div v-if="row.status === 'PENDING' || canRequestRefund(row)" class="console-mobile-actions">
              <button v-if="row.status === 'PENDING'" type="button" class="console-inline-action" data-testid="cancel-order" @click="handleCancel(row.id)">
                {{ t('payment.orders.cancel') }}
              </button>
              <button v-if="canRequestRefund(row)" type="button" class="console-inline-action" data-testid="request-refund" @click="openRefundDialog(row)">
                {{ t('payment.orders.requestRefund') }}
              </button>
            </div>
          </template>
          <div v-if="orders.length" class="console-orders__scroll">
            <table>
              <thead>
                <tr>
                  <th>{{ t('payment.console.colOrderNo') }}</th>
                  <th>{{ t('payment.console.colType') }}</th>
                  <th>{{ t('payment.orders.creditedAmount') }}</th>
                  <th>{{ t('payment.orders.payAmount') }}</th>
                  <th>{{ t('payment.console.colMethod') }}</th>
                  <th>{{ t('payment.console.colStatus') }}</th>
                  <th>{{ t('payment.console.colCreated') }}</th>
                  <th class="console-orders__actions-col">{{ t('payment.orders.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="order in orders" :key="order.id" data-testid="order-row">
                  <td>
                    <span class="console-orders-no">
                      <span class="font-mono">{{ order.out_trade_no }}</span>
                      <button
                        type="button"
                        class="console-orders-copy"
                        :aria-label="`${t('common.copy')} ${order.out_trade_no}`"
                        :title="copiedOrderNo === order.out_trade_no ? t('common.copied') : t('common.copy')"
                        data-testid="copy-order-no"
                        @click="copyOrderNo(order.out_trade_no)"
                      >
                        <Icon :name="copiedOrderNo === order.out_trade_no ? 'check' : 'copy'" size="xs" />
                      </button>
                    </span>
                  </td>
                  <td>{{ orderTypeLabel(order) }}</td>
                  <td class="font-mono">
                    <span class="console-orders__amount">{{ creditedText(order) }}</span>
                    <span v-if="hasBonus(order)" class="console-orders-sub">{{ bonusText(order) }}</span>
                  </td>
                  <td class="font-mono">
                    <span class="console-orders__paid">{{ payAmountText(order) }}</span>
                    <span v-if="order.fee_rate > 0" class="console-orders-sub">{{ t('payment.orders.fee') }} {{ order.fee_rate }}%</span>
                  </td>
                  <td>{{ methodLabel(order) }}</td>
                  <td><span :class="['badge', consoleOrderBadgeClass(order.status)]">{{ statusLabel(order.status) }}</span></td>
                  <td class="font-mono">{{ formatDateTimeToMinute(order.created_at) }}</td>
                  <td class="console-orders__actions-col">
                    <span class="console-orders-actions">
                      <button v-if="order.status === 'PENDING'" type="button" class="console-orders-action" data-testid="cancel-order" @click="handleCancel(order.id)">
                        {{ t('payment.orders.cancel') }}
                      </button>
                      <button v-if="canRequestRefund(order)" type="button" class="console-orders-action console-orders-action--primary" data-testid="request-refund" @click="openRefundDialog(order)">
                        {{ t('payment.orders.requestRefund') }}
                      </button>
                      <span v-if="order.status !== 'PENDING' && !canRequestRefund(order)" class="console-orders-none" aria-hidden="true">—</span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </ConsoleRecordList>

        <div v-if="!orders.length" class="console-orders-state" data-testid="orders-state">
          <template v-if="loading">
            <span class="console-orders-spinner" aria-hidden="true"></span>
            <span>{{ t('common.loading') }}</span>
          </template>
          <template v-else-if="loadError">
            <span>{{ t('payment.console.ordersLoadFailed') }}</span>
            <button type="button" class="console-link" @click="fetchOrders">{{ t('common.refresh') }}</button>
          </template>
          <template v-else>
            <span>{{ currentFilter || currentType ? t('payment.console.ordersEmptyFiltered') : t('payment.orders.empty') }}</span>
            <router-link v-if="!currentFilter && !currentType" to="/purchase" class="console-link">{{ t('payment.console.goRecharge') }} <span aria-hidden="true">→</span></router-link>
          </template>
        </div>

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
    </div>

    <!-- Cancel Confirm Dialog -->
    <BaseDialog :show="!!cancelTargetId" :title="t('payment.orders.cancel')" width="narrow" @close="cancelTargetId = null">
      <p class="text-sm text-gray-600 dark:text-gray-300">{{ t('payment.confirmCancel') }}</p>
      <template #footer>
        <div class="flex justify-end gap-3">
          <button class="btn btn-secondary" @click="cancelTargetId = null">{{ t('common.cancel') }}</button>
          <button class="btn btn-danger" :disabled="actionLoading" @click="confirmCancel">{{ actionLoading ? t('common.processing') : t('payment.orders.cancel') }}</button>
        </div>
      </template>
    </BaseDialog>

    <!-- Refund Dialog -->
    <BaseDialog :show="!!refundTarget" :title="t('payment.orders.requestRefund')" @close="refundTarget = null">
      <div v-if="refundTarget" class="space-y-4">
        <dl class="console-refund-summary">
          <div>
            <dt>{{ t('payment.console.colOrderNo') }}</dt>
            <dd class="font-mono">{{ refundTarget.out_trade_no }}</dd>
          </div>
          <div>
            <dt>{{ t('payment.orders.creditedAmount') }}</dt>
            <dd class="font-mono">${{ refundTarget.amount.toFixed(2) }}</dd>
          </div>
        </dl>
        <div>
          <label class="input-label" for="refund-reason">{{ t('payment.refundReason') }}</label>
          <textarea id="refund-reason" v-model="refundReason" rows="3" class="input mt-1 w-full" :placeholder="t('payment.refundReasonPlaceholder')" />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <button class="btn btn-secondary" @click="refundTarget = null">{{ t('common.cancel') }}</button>
          <button class="btn btn-primary" :disabled="actionLoading || !refundReason.trim()" @click="confirmRefund">{{ actionLoading ? t('common.processing') : t('payment.orders.requestRefund') }}</button>
        </div>
      </template>
    </BaseDialog>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores'
import { paymentAPI } from '@/api/payment'
import { extractI18nErrorMessage } from '@/utils/apiError'
import { formatDateTimeToMinute } from '@/utils/format'
import { useClipboard } from '@/composables/useClipboard'
import type { PaymentOrder } from '@/types/payment'
import AppLayout from '@/components/layout/AppLayout.vue'
import Pagination from '@/components/common/Pagination.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Select from '@/components/common/Select.vue'
import Icon from '@/components/icons/Icon.vue'
import ConsoleRecordList from '@/components/user/ConsoleRecordList.vue'
import { currencySymbol } from '@/components/payment/currency'
import { consoleOrderBadgeClass } from '@/components/payment/consoleOrderStatus'
import '@/styles/console-data-pages.css'
import '@/styles/console-purchase-pages.css'

const { t } = useI18n()
const router = useRouter()
const appStore = useAppStore()

const loading = ref(false)
const loadError = ref(false)
const actionLoading = ref(false)
const orders = ref<PaymentOrder[]>([])
const refundEligibleProviders = ref<Set<string>>(new Set())
const currentFilter = ref('')
const currentType = ref('')
const cancelTargetId = ref<number | null>(null)
const refundTarget = ref<PaymentOrder | null>(null)
const refundReason = ref('')
const pagination = reactive({ page: 1, page_size: 20, total: 0 })

const statusFilters = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'PENDING', label: t('payment.status.pending') },
  { value: 'COMPLETED', label: t('payment.status.completed') },
  { value: 'FAILED', label: t('payment.status.failed') },
  { value: 'REFUNDED', label: t('payment.status.refunded') },
])

const typeFilters = computed(() => [
  { value: '', label: t('payment.console.allTypes') },
  { value: 'balance', label: t('payment.console.typeBalance') },
  { value: 'subscription', label: t('payment.console.typeSubscription') },
])

// 支付金额按订单币种（生产为人民币）；到账 / 赠送是余额，固定美元。换算以后端为准。
const usd = currencySymbol('USD')
const payAmountText = (order: PaymentOrder) => `${currencySymbol(order.currency)}${order.pay_amount.toFixed(2)}`
const creditedText = (order: PaymentOrder) => `${usd}${order.amount.toFixed(2)}`
const hasBonus = (order: PaymentOrder) => (order.bonus_amount ?? 0) > 0
const bonusText = (order: PaymentOrder) => t('payment.orders.bonusIncluded', { amount: `${usd}${(order.bonus_amount ?? 0).toFixed(2)}` })
const orderTypeLabel = (order: PaymentOrder) => order.order_type === 'subscription' ? t('payment.console.typeSubscription') : t('payment.console.typeBalance')
const methodLabel = (order: PaymentOrder) => t('payment.methods.' + order.payment_type, order.payment_type)
const statusLabel = (status: string) => t('payment.status.' + status.toLowerCase(), status)

const { copyToClipboard } = useClipboard()
const copiedOrderNo = ref<string | null>(null)
let copiedOrderTimer: number | undefined
async function copyOrderNo(orderNo: string) {
  if (!(await copyToClipboard(orderNo, t('common.copied')))) return
  copiedOrderNo.value = orderNo
  window.clearTimeout(copiedOrderTimer)
  copiedOrderTimer = window.setTimeout(() => { copiedOrderNo.value = null }, 1800)
}

async function fetchOrders() {
  loading.value = true
  try {
    const res = await paymentAPI.getMyOrders({
      page: pagination.page,
      page_size: pagination.page_size,
      status: currentFilter.value || undefined,
      ...(currentType.value ? { order_type: currentType.value } : {}),
    })
    orders.value = res.data.items || []
    pagination.total = res.data.total || 0
    loadError.value = false
  } catch (err: unknown) {
    loadError.value = true
    appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error')))
  } finally {
    loading.value = false
  }
}

function selectStatus(value: string) {
  if (currentFilter.value === value) return
  currentFilter.value = value
  handlePageChange(1)
}
function handlePageChange(page: number) { pagination.page = page; fetchOrders() }
function handlePageSizeChange(size: number) { pagination.page_size = size; pagination.page = 1; fetchOrders() }

function handleCancel(orderId: number) { cancelTargetId.value = orderId }

async function confirmCancel() {
  if (!cancelTargetId.value) return
  actionLoading.value = true
  try {
    await paymentAPI.cancelOrder(cancelTargetId.value)
    appStore.showSuccess(t('common.success'))
    cancelTargetId.value = null
    await fetchOrders()
  } catch (err: unknown) {
    appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error')))
  } finally {
    actionLoading.value = false
  }
}

function openRefundDialog(order: PaymentOrder) { refundTarget.value = order; refundReason.value = '' }

async function confirmRefund() {
  if (!refundTarget.value || !refundReason.value.trim()) return
  actionLoading.value = true
  try {
    await paymentAPI.requestRefund(refundTarget.value.id, { reason: refundReason.value.trim() })
    appStore.showSuccess(t('common.success'))
    refundTarget.value = null
    refundReason.value = ''
    await fetchOrders()
  } catch (err: unknown) {
    appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error')))
  } finally {
    actionLoading.value = false
  }
}

function canRequestRefund(order: PaymentOrder): boolean {
  if (order.status !== 'COMPLETED') return false
  if (!order.provider_instance_id) return false
  return refundEligibleProviders.value.has(order.provider_instance_id)
}

async function loadRefundEligibility() {
  try {
    const res = await paymentAPI.getRefundEligibleProviders()
    refundEligibleProviders.value = new Set(res.data.provider_instance_ids || [])
  } catch { /* ignore — default to hiding refund button */ }
}

// 手机筛选条横滑：按滚动位置给左右边缘加渐隐，提示两侧还有筛选项。
const filterScrollRef = ref<HTMLElement | null>(null)
const filterFade = reactive({ left: false, right: false })
function updateFilterFade() {
  const el = filterScrollRef.value
  if (!el) return
  filterFade.left = el.scrollLeft > 1
  filterFade.right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}
let filterResizeObserver: ResizeObserver | null = null

onMounted(() => {
  fetchOrders()
  loadRefundEligibility()
  if (typeof ResizeObserver !== 'undefined' && filterScrollRef.value) {
    filterResizeObserver = new ResizeObserver(updateFilterFade)
    filterResizeObserver.observe(filterScrollRef.value)
  }
  updateFilterFade()
})

onUnmounted(() => {
  filterResizeObserver?.disconnect()
  window.clearTimeout(copiedOrderTimer)
})
</script>
