import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AffiliateView from '../AffiliateView.vue'

const mocks = vi.hoisted(() => ({
  copyToClipboard: vi.fn(), getAffiliateDetail: vi.fn(), transferAffiliateQuota: vi.fn(),
  refreshUser: vi.fn(), showError: vi.fn(), showSuccess: vi.fn(),
}))
vi.mock('@/api/user', () => ({ default: mocks }))
vi.mock('@/stores/app', () => ({ useAppStore: () => mocks }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => mocks }))
vi.mock('@/composables/useClipboard', () => ({ useClipboard: () => mocks }))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-i18n')>(),
  useI18n: () => ({ t: (key: string) => key }),
}))
enableAutoUnmount(afterEach)

const affiliateCode = 'affiliate-code-that-is-long-enough-to-overflow-a-mobile-viewport'
const detail = () => ({
  user_id: 1, aff_code: affiliateCode, inviter_id: null, aff_count: 1, aff_quota: 36.8,
  aff_frozen_quota: 8.2, aff_history_quota: 128, effective_rebate_rate_percent: 12.5,
  invitees: [{ user_id: 2, email: 'long-invitee-address@example.test', username: 'alice', total_rebate: 12, created_at: '2026-11-20T08:00:00Z' }],
})
const render = () => mount(AffiliateView, { global: { stubs: { AppLayout: { template: '<main><slot /></main>' }, Icon: true } } })
const transferButton = (wrapper: ReturnType<typeof render>) => wrapper.get('.console-affiliate-transfer button')

beforeEach(() => {
  vi.resetAllMocks()
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
  mocks.copyToClipboard.mockResolvedValue(true)
  mocks.getAffiliateDetail.mockResolvedValue(detail())
  mocks.transferAffiliateQuota.mockResolvedValue({ transferred_quota: 36.8 })
  mocks.refreshUser.mockResolvedValue(undefined)
})

describe('AffiliateView Console v3', () => {
  it('preserves full code/link copying and actual percentage / dollar amounts', async () => {
    const wrapper = render()
    await flushPromises()
    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.get('.console-affiliate-metrics').text()).toContain('12.5%')
    expect(wrapper.get('.console-affiliate-metrics').text()).not.toContain('¥')
    const values = wrapper.findAll('code')
    expect(values).toHaveLength(2)
    expect(values[0].text()).toBe(affiliateCode)
    await wrapper.get('.console-affiliate-code button').trigger('click')
    await wrapper.get('.console-affiliate-link button').trigger('click')
    expect(mocks.copyToClipboard).toHaveBeenNthCalledWith(1, affiliateCode, 'affiliate.codeCopied')
    expect(mocks.copyToClipboard).toHaveBeenNthCalledWith(2, `${window.location.origin}/register?aff=${encodeURIComponent(affiliateCode)}`, 'affiliate.linkCopied')
  })

  it('uses a semantic desktop table with all original fields', async () => {
    const wrapper = render()
    await flushPromises()
    expect(wrapper.findAll('th[scope="col"]')).toHaveLength(4)
    expect(wrapper.get('tbody').text()).toContain('long-invitee-address@example.test')
    expect(wrapper.get('tbody').text()).toContain('alice')
    expect(wrapper.find('details').exists()).toBe(false)
  })

  it('renders mobile fields directly without a table or block elements inside summary', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    const wrapper = render()
    await flushPromises()
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.find('summary div').exists()).toBe(false)
    expect(wrapper.get('summary').text()).toContain('alice')
    expect(wrapper.findAll('details dl > div')).toHaveLength(4)
    expect(wrapper.get('details dd').text()).toBe('long-invitee-address@example.test')
  })

  it('keeps loading distinct from empty records', async () => {
    mocks.getAffiliateDetail.mockReturnValue(new Promise(() => {}))
    const wrapper = render()
    expect(wrapper.get('[aria-busy="true"]').text()).toBe('common.loading')
    expect(wrapper.text()).not.toContain('affiliate.invitees.empty')
  })

  it.each([403, 503])('shows the existing error toast and no fabricated balances after %s', async (status) => {
    mocks.getAffiliateDetail.mockRejectedValue({ status })
    const wrapper = render()
    await flushPromises()
    expect(mocks.showError).toHaveBeenCalledWith('affiliate.loadFailed')
    expect(wrapper.get('[role="alert"]').text()).toBe('affiliate.loadFailed')
    expect(wrapper.find('.console-affiliate-overview').exists()).toBe(false)
  })

  it('retains the empty-list state, frozen quota and disabled zero-balance transfer', async () => {
    mocks.getAffiliateDetail.mockResolvedValue({ ...detail(), aff_quota: 0, aff_count: 0, invitees: [] })
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('affiliate.invitees.empty')
    expect(wrapper.text()).toContain('affiliate.transfer.empty')
    expect(transferButton(wrapper).attributes('disabled')).toBeDefined()
    await transferButton(wrapper).trigger('click')
    expect(mocks.transferAffiliateQuota).not.toHaveBeenCalled()
  })

  it('transfers the full quota once and refreshes both detail and user without a client amount', async () => {
    let resolve!: (value: unknown) => void
    mocks.transferAffiliateQuota.mockReturnValue(new Promise(done => { resolve = done }))
    const wrapper = render()
    await flushPromises()
    await transferButton(wrapper).trigger('click')
    expect(transferButton(wrapper).attributes('disabled')).toBeDefined()
    await transferButton(wrapper).trigger('click')
    expect(mocks.transferAffiliateQuota).toHaveBeenCalledOnce()
    expect(mocks.transferAffiliateQuota).toHaveBeenCalledWith()
    mocks.getAffiliateDetail.mockResolvedValue({ ...detail(), aff_quota: 0 })
    resolve({ transferred_quota: 36.8 })
    await flushPromises()
    expect(mocks.getAffiliateDetail).toHaveBeenCalledTimes(2)
    expect(mocks.refreshUser).toHaveBeenCalledOnce()
    expect(mocks.showSuccess).toHaveBeenCalledWith('affiliate.transfer.success')
    expect(transferButton(wrapper).attributes('disabled')).toBeDefined()
  })

  it('keeps quota visible and re-enables transfer after submission failure', async () => {
    mocks.transferAffiliateQuota.mockRejectedValue({ message: 'transfer failed' })
    const wrapper = render()
    await flushPromises()
    await transferButton(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.showError).toHaveBeenCalledWith('transfer failed')
    expect(mocks.refreshUser).not.toHaveBeenCalled()
    expect(transferButton(wrapper).attributes('disabled')).toBeUndefined()
    expect(wrapper.find('.console-affiliate-overview').exists()).toBe(true)
  })
})
