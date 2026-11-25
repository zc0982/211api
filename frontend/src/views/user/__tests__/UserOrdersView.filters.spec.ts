import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import UserOrdersView from '../UserOrdersView.vue'
import Select from '@/components/common/Select.vue'
import Pagination from '@/components/common/Pagination.vue'
import type { PaymentOrder } from '@/types/payment'

const api = vi.hoisted(() => ({
  getMyOrders: vi.fn(),
  getRefundEligibleProviders: vi.fn(),
  cancelOrder: vi.fn(),
  requestRefund: vi.fn(),
}))
const showError = vi.hoisted(() => vi.fn())
const push = vi.hoisted(() => vi.fn())
const copyToClipboard = vi.hoisted(() => vi.fn().mockResolvedValue(true))
vi.mock('@/api/payment', () => ({ paymentAPI: api }))
vi.mock('@/stores', () => ({ useAppStore: () => ({ showError, showSuccess: vi.fn() }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/composables/useClipboard', () => ({ useClipboard: () => ({ copyToClipboard }) }))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string, arg?: unknown) => (arg && typeof arg === 'object' && 'amount' in arg ? `${key}:${(arg as { amount: string }).amount}` : key) })
}))
enableAutoUnmount(afterEach)

const order = (overrides: Partial<PaymentOrder> = {}): PaymentOrder => ({
  id: 1,
  user_id: 9,
  amount: 28,
  pay_amount: 200,
  currency: 'CNY',
  fee_rate: 0,
  payment_type: 'alipay',
  out_trade_no: 'sub2_20261124aB3kX9mQ',
  status: 'PENDING',
  order_type: 'balance',
  created_at: '2026-11-24T06:22:00Z',
  expires_at: '2026-11-24T06:52:00Z',
  refund_amount: 0,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  api.getMyOrders.mockResolvedValue({ data: { items: [], total: 100 } })
  api.getRefundEligibleProviders.mockResolvedValue({ data: { provider_instance_ids: [] } })
  api.cancelOrder.mockResolvedValue({})
})

const stubs = {
  AppLayout: { template: '<div><slot /></div>' },
  BaseDialog: { props: ['show'], template: '<div v-if="show" data-testid="dialog"><slot /><slot name="footer" /></div>' },
  Icon: true,
  teleport: true,
  'router-link': { template: '<a><slot /></a>' },
}

async function mountOrders() {
  const wrapper = mount(UserOrdersView, { global: { stubs: { ...stubs, Pagination: true } } })
  await flushPromises()
  return wrapper
}

async function openOrders() {
  const wrapper = await mountOrders()
  wrapper.getComponent(Pagination).vm.$emit('update:page', 4)
  await flushPromises()
  return wrapper
}

describe('order status filtering', () => {
  it('loads the first page with the selected status from the segmented filter', async () => {
    const wrapper = await openOrders()
    await wrapper.get('[role="tab"][data-status="PENDING"]').trigger('click')
    await flushPromises()
    expect(api.getMyOrders).toHaveBeenLastCalledWith({ page: 1, page_size: 20, status: 'PENDING' })
    expect(wrapper.getComponent(Pagination).props('page')).toBe(1)
    expect(api.getMyOrders).toHaveBeenCalledTimes(3)
    expect(wrapper.get('[role="tab"][data-status="PENDING"]').attributes('aria-selected')).toBe('true')
  })

  it('does not refetch when the active status is clicked again', async () => {
    const wrapper = await mountOrders()
    await wrapper.get('[role="tab"][data-status="all"]').trigger('click')
    await flushPromises()
    expect(api.getMyOrders).toHaveBeenCalledTimes(1)
  })

  it('keeps the current page on manual refresh', async () => {
    const wrapper = await openOrders()
    await wrapper.get('[title="common.refresh"]').trigger('click')
    await flushPromises()
    expect(api.getMyOrders).toHaveBeenLastCalledWith({ page: 4, page_size: 20, status: undefined })
  })

  it('filters by order type on the server and resets to the first page', async () => {
    const wrapper = await openOrders()
    const select = wrapper.getComponent(Select)
    await select.get('button').trigger('click')
    await select.findAll('[role="option"]').find(option => option.text() === 'payment.console.typeSubscription')!.trigger('click')
    await flushPromises()
    expect(api.getMyOrders).toHaveBeenLastCalledWith({ page: 1, page_size: 20, status: undefined, order_type: 'subscription' })
  })
})

describe('orders table (console v3)', () => {
  it('shows full order numbers with copy, USD credited and order-currency paid amounts, and Chinese headers', async () => {
    api.getMyOrders.mockResolvedValue({ data: { total: 2, items: [
      order(),
      order({ id: 2, out_trade_no: 'sub2_20261120Zz9yX8wV', status: 'COMPLETED', amount: 15.4, pay_amount: 100, bonus_amount: 1.4, fee_rate: 2.5 }),
    ] } })
    const wrapper = await mountOrders()
    const rows = wrapper.findAll('[data-testid="order-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('sub2_20261124aB3kX9mQ')
    expect(rows[0].text()).toContain('$28.00')
    expect(rows[0].text()).toContain('¥200.00')
    expect(rows[1].text()).toContain('payment.orders.bonusIncluded:$1.40')
    expect(rows[1].text()).toContain('payment.orders.fee 2.5%')
    expect(wrapper.findAll('th').map(th => th.text())).toEqual([
      'payment.console.colOrderNo', 'payment.console.colType', 'payment.orders.creditedAmount', 'payment.orders.payAmount',
      'payment.console.colMethod', 'payment.console.colStatus', 'payment.console.colCreated', 'payment.orders.actions',
    ])
    await rows[1].get('[data-testid="copy-order-no"]').trigger('click')
    await flushPromises()
    expect(copyToClipboard).toHaveBeenCalledWith('sub2_20261120Zz9yX8wV', 'common.copied')
    // 绿色只给「已完成」状态，金额不用绿色
    expect(rows[0].get('.badge').classes()).toContain('badge-warning')
    expect(rows[1].get('.badge').classes()).toContain('badge-success')
    expect(wrapper.html()).not.toMatch(/(bg|text)-(green|emerald|purple|yellow)-/)
  })

  it('maps terminal statuses to neutral badges instead of unstyled classes', async () => {
    api.getMyOrders.mockResolvedValue({ data: { total: 3, items: [
      order({ id: 1, status: 'CANCELLED' }),
      order({ id: 2, status: 'EXPIRED' }),
      order({ id: 3, status: 'REFUNDED' }),
    ] } })
    const wrapper = await mountOrders()
    const classes = wrapper.findAll('[data-testid="order-row"] .badge').map(b => b.classes())
    expect(classes[0]).toContain('console-badge-muted')
    expect(classes[1]).toContain('console-badge-muted')
    expect(classes[2]).toContain('badge-gray')
    expect(wrapper.html()).not.toMatch(/badge-(info|secondary)/)
  })

  it('keeps cancel for pending orders and refund only for eligible completed orders', async () => {
    api.getRefundEligibleProviders.mockResolvedValue({ data: { provider_instance_ids: ['p1'] } })
    api.getMyOrders.mockResolvedValue({ data: { total: 3, items: [
      order({ id: 11 }),
      order({ id: 12, status: 'COMPLETED', provider_instance_id: 'p1' }),
      order({ id: 13, status: 'COMPLETED', provider_instance_id: 'p2' }),
    ] } })
    const wrapper = await mountOrders()
    const rows = wrapper.findAll('[data-testid="order-row"]')
    expect(rows[0].find('[data-testid="cancel-order"]').exists()).toBe(true)
    expect(rows[0].find('[data-testid="request-refund"]').exists()).toBe(false)
    expect(rows[1].find('[data-testid="request-refund"]').exists()).toBe(true)
    expect(rows[2].find('[data-testid="request-refund"]').exists()).toBe(false)
    expect(rows[2].find('[data-testid="cancel-order"]').exists()).toBe(false)

    await rows[0].get('[data-testid="cancel-order"]').trigger('click')
    const dialog = wrapper.get('[data-testid="dialog"]')
    await dialog.findAll('button').find(b => b.text() === 'payment.orders.cancel')!.trigger('click')
    await flushPromises()
    expect(api.cancelOrder).toHaveBeenCalledWith(11)
  })

  it('puts pagination inside the orders card', async () => {
    api.getMyOrders.mockResolvedValue({ data: { total: 30, items: [order()] } })
    const wrapper = await mountOrders()
    expect(wrapper.find('[data-testid="orders-card"] .console-table-foot').exists()).toBe(true)
  })

  it('shows loading, empty, filtered-empty and failed states without an empty table', async () => {
    let resolve!: (value: unknown) => void
    api.getMyOrders.mockImplementationOnce(() => new Promise((r) => { resolve = r }))
    const wrapper = mount(UserOrdersView, { global: { stubs: { ...stubs, Pagination: true } } })
    await flushPromises()
    expect(wrapper.get('[data-testid="orders-state"]').text()).toContain('common.loading')
    resolve({ data: { items: [], total: 0 } })
    await flushPromises()
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.get('[data-testid="orders-state"]').text()).toContain('payment.orders.empty')
    expect(wrapper.find('.console-table-foot').exists()).toBe(false)

    await wrapper.get('[role="tab"][data-status="FAILED"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="orders-state"]').text()).toContain('payment.console.ordersEmptyFiltered')

    api.getMyOrders.mockRejectedValueOnce(new Error('boom'))
    await wrapper.get('[title="common.refresh"]').trigger('click')
    await flushPromises()
    expect(showError).toHaveBeenCalled()
    expect(wrapper.get('[data-testid="orders-state"]').text()).toContain('payment.console.ordersLoadFailed')
  })

  it('renders phone orders as field lists with copy and actions, not a table', async () => {
    const width = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    try {
      api.getMyOrders.mockResolvedValue({ data: { total: 1, items: [order({ fee_rate: 1 })] } })
      const wrapper = await mountOrders()
      expect(wrapper.find('table').exists()).toBe(false)
      const item = wrapper.get('.console-mobile-record')
      expect(item.get('summary').text()).toContain('sub2_20261124aB3kX9mQ')
      expect(item.get('summary').text()).toContain('¥200.00')
      expect(item.get('summary .badge').classes()).toContain('badge-warning')
      expect(item.find('summary div').exists()).toBe(false)
      const fields = item.get('[data-testid="order-mobile-fields"]')
      expect(fields.get('code').text()).toBe('sub2_20261124aB3kX9mQ')
      expect(fields.text()).toContain('$28.00')
      expect(fields.text()).toContain('payment.orders.fee 1%')
      await fields.get('[data-testid="copy-order-no"]').trigger('click')
      await flushPromises()
      expect(copyToClipboard).toHaveBeenCalledWith('sub2_20261124aB3kX9mQ', 'common.copied')
      expect(item.find('[data-testid="cancel-order"]').exists()).toBe(true)
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
    }
  })
})
