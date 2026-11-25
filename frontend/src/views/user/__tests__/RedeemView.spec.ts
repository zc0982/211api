import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import RedeemView from '../RedeemView.vue'

const { redeem, getHistory, refreshUser, fetchActiveSubscriptions, showError, showWarning, showSuccess } = vi.hoisted(() => ({
  redeem: vi.fn(),
  getHistory: vi.fn(),
  refreshUser: vi.fn(),
  fetchActiveSubscriptions: vi.fn(),
  showError: vi.fn(),
  showWarning: vi.fn(),
  showSuccess: vi.fn(),
}))

vi.mock('@/api', () => ({
  redeemAPI: { redeem, getHistory },
  authAPI: { getPublicSettings: vi.fn().mockResolvedValue({}) },
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { balance: 10, concurrency: 2 }, refreshUser }),
}))
vi.mock('@/stores/subscriptions', () => ({
  useSubscriptionStore: () => ({ fetchActiveSubscriptions }),
}))
vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError, showWarning, showSuccess }),
}))
vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

async function submitCode() {
  const wrapper = mount(RedeemView, {
    global: { stubs: { AppLayout: { template: '<div><slot /></div>' }, Icon: true } },
  })
  await flushPromises()
  await wrapper.get('input#code').setValue(' REDEEM-CODE ')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  return wrapper
}

describe('RedeemView refresh after redemption', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    redeem.mockResolvedValue({ type: 'balance', value: 20, message: 'Code applied' })
    getHistory.mockResolvedValue({ items: [], total: 0 })
    refreshUser.mockResolvedValue({ balance: 30, concurrency: 2 })
    fetchActiveSubscriptions.mockResolvedValue([])
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each(['balance', 'concurrency', 'subscription'])(
    'keeps a successful %s redemption when profile refresh fails', async (type) => {
      redeem.mockResolvedValue({ type, value: 20, message: 'Code applied' })
      refreshUser.mockRejectedValue({ status: 503, message: 'Service unavailable' })
      getHistory.mockResolvedValueOnce({ items: [], total: 0 }).mockResolvedValueOnce({ total: 1, items: [{
        id: 1, code: 'REDEEM-CODE', type, value: 20, used_at: '2026-03-08T00:00:00Z',
      }] })

      const wrapper = await submitCode()

      expect(redeem).toHaveBeenCalledWith('REDEEM-CODE')
      expect(showError).not.toHaveBeenCalled()
      expect(showWarning).toHaveBeenCalledWith('redeem.userRefreshFailed')
      expect(showSuccess).toHaveBeenCalledWith('redeem.codeRedeemSuccess')
      expect(wrapper.text()).toContain('Code applied')
      expect(wrapper.text()).not.toContain('redeem.failedToRedeem')
      expect((wrapper.get('input#code').element as HTMLInputElement).value).toBe('')
      expect((wrapper.get('input#code').element as HTMLInputElement).disabled).toBe(false)
      expect(getHistory).toHaveBeenCalledTimes(2)
      expect(wrapper.get('[data-testid="redeem-activity"]').text()).toContain('REDEEM-CODE')
      // 余额没刷新成功时，不在旧余额旁标增量
      expect(wrapper.get('[data-testid="redeem-balance"]').text()).not.toContain('+$')
      if (type === 'subscription') {
        expect(fetchActiveSubscriptions).toHaveBeenCalledWith(true)
      } else {
        expect(fetchActiveSubscriptions).not.toHaveBeenCalled()
      }
      wrapper.unmount()
    }
  )

  it('pages on the server, changes size, and resets page and total after redeeming', async () => {
    getHistory.mockResolvedValue({ items: [], total: 101 })
    const wrapper = mount(RedeemView, {
      global: { stubs: { AppLayout: { template: '<div><slot /></div>' }, Icon: true } },
    })
    await flushPromises()
    const button = (text: string) => wrapper.findAll('button').find(b => b.text() === text)!
    expect(getHistory).toHaveBeenLastCalledWith(1, 20)
    expect(button('pagination.previous').attributes('disabled')).toBeDefined()
    await button('pagination.next').trigger('click')
    await flushPromises()
    expect(getHistory).toHaveBeenLastCalledWith(2, 20)
    await button('pagination.previous').trigger('click')
    await flushPromises()
    expect(getHistory).toHaveBeenLastCalledWith(1, 20)
    expect(wrapper.findAll('select option').map(o => o.text())).toEqual(['20', '50', '100'])
    await wrapper.get('select').setValue('50')
    await flushPromises()
    expect(getHistory).toHaveBeenLastCalledWith(1, 50)
    await wrapper.get('select').setValue('100')
    await flushPromises()
    await button('pagination.next').trigger('click')
    await flushPromises()
    expect(getHistory).toHaveBeenLastCalledWith(2, 100)
    expect(button('pagination.next').attributes('disabled')).toBeDefined()
    getHistory.mockResolvedValue({ items: [], total: 102 })
    await wrapper.get('input#code').setValue('NEW-CODE')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(getHistory).toHaveBeenLastCalledWith(1, 100)
    expect(wrapper.text()).toContain('102')
    expect(button('pagination.previous').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('restores the loaded size and keeps rows and navigation usable after a size request fails', async () => {
    const item = { id: 1, code: 'OLD-ROWS', type: 'balance', value: 20, used_at: '2026-03-08T00:00:00Z' }
    getHistory.mockResolvedValue({ items: [item], total: 61 })
    const wrapper = mount(RedeemView, {
      global: { stubs: { AppLayout: { template: '<div><slot /></div>' }, Icon: true } },
    })
    await flushPromises()
    const button = (text: string) => wrapper.findAll('button').find(b => b.text() === text)!
    await button('pagination.next').trigger('click')
    await flushPromises()
    let rejectRequest!: (error: Error) => void
    getHistory.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRequest = reject }))
    await wrapper.get('select').setValue('50')
    expect(getHistory).toHaveBeenLastCalledWith(1, 50)
    expect(button('pagination.next').attributes('disabled')).toBeDefined()
    rejectRequest(new Error('Network error'))
    await flushPromises()
    expect(wrapper.get('select').element.value).toBe('20')
    expect(wrapper.text()).toContain('OLD-ROWS')
    expect(wrapper.text()).toContain('61')
    expect(button('pagination.previous').attributes('disabled')).toBeUndefined()
    expect(button('pagination.next').attributes('disabled')).toBeUndefined()
    expect(showError).toHaveBeenCalledWith('redeem.historyLoadFailed')
    await button('pagination.next').trigger('click')
    await flushPromises()
    expect(getHistory).toHaveBeenLastCalledWith(3, 20)
    await wrapper.get('select').setValue('50')
    await flushPromises()
    expect(getHistory).toHaveBeenLastCalledWith(1, 50)
    expect(wrapper.get('select').element.value).toBe('50')
    expect(button('pagination.previous').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it.each(['success', 'failure'])('ignores a stale history %s after a newer size request succeeds', async (outcome) => {
    let resolveOld!: (value: unknown) => void
    let rejectOld!: (error: Error) => void
    getHistory.mockImplementationOnce(() => new Promise((resolve, reject) => {
      resolveOld = resolve
      rejectOld = reject
    }))
    const wrapper = mount(RedeemView, {
      global: { stubs: { AppLayout: { template: '<div><slot /></div>' }, Icon: true } },
    })
    getHistory.mockResolvedValue({ items: [{
      id: 2, code: 'NEW-ROWS', type: 'balance', value: 30, used_at: '2026-03-08T00:00:00Z',
    }], total: 61 })
    // Force overlapping requests to exercise responses arriving out of order.
    await wrapper.get('select').setValue('50')
    await flushPromises()
    const button = (text: string) => wrapper.findAll('button').find(b => b.text() === text)!
    await button('pagination.next').trigger('click')
    await flushPromises()
    expect(getHistory).toHaveBeenLastCalledWith(2, 50)
    if (outcome === 'success') {
      resolveOld({ items: [], total: 0 })
    } else {
      rejectOld(new Error('Stale network error'))
    }
    await flushPromises()
    expect(wrapper.get('select').element.value).toBe('50')
    expect(wrapper.text()).toContain('NEW-ROWS')
    expect(wrapper.text()).toContain('61')
    expect(button('pagination.previous').attributes('disabled')).toBeUndefined()
    expect(button('pagination.next').attributes('disabled')).toBeDefined()
    expect(wrapper.get('select').attributes('disabled')).toBeUndefined()
    expect(showError).not.toHaveBeenCalled()
    await button('pagination.previous').trigger('click')
    await flushPromises()
    expect(getHistory).toHaveBeenLastCalledWith(1, 50)
    wrapper.unmount()
  })

  it('disables both paging buttons for empty history', async () => {
    const wrapper = await submitCode()
    for (const button of wrapper.findAll('button').filter(b => b.text().startsWith('pagination.'))) {
      expect(button.attributes('disabled')).toBeDefined()
    }
    wrapper.unmount()
  })

  it('finishes normally without a warning when profile refresh succeeds', async () => {
    const wrapper = await submitCode()

    expect(refreshUser).toHaveBeenCalledOnce()
    expect(showWarning).not.toHaveBeenCalled()
    expect(showError).not.toHaveBeenCalled()
    expect(showSuccess).toHaveBeenCalledWith('redeem.codeRedeemSuccess')
    expect((wrapper.get('input#code').element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })

  it('preserves the existing subscription refresh warning after successful redemption', async () => {
    redeem.mockResolvedValue({ type: 'subscription', value: 20, message: 'Code applied' })
    fetchActiveSubscriptions.mockRejectedValue(new Error('Network Error'))
    const wrapper = await submitCode()

    expect(showWarning).toHaveBeenCalledWith('redeem.subscriptionRefreshFailed')
    expect(showError).not.toHaveBeenCalled()
    expect(showSuccess).toHaveBeenCalledWith('redeem.codeRedeemSuccess')
    expect(getHistory).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('keeps the code and reports failure when the redemption request itself fails', async () => {
    redeem.mockRejectedValue({ status: 404, code: 404, reason: 'REDEEM_CODE_NOT_FOUND', message: 'redeem code not found' })
    const wrapper = await submitCode()

    expect(showError).toHaveBeenCalledWith('redeem.redeemFailed')
    expect(wrapper.text()).toContain('redeem.errors.REDEEM_CODE_NOT_FOUND')
    expect(wrapper.text()).not.toContain('redeem code not found')
    expect(wrapper.text()).not.toContain('Code applied')
    expect((wrapper.get('input#code').element as HTMLInputElement).value).toBe(' REDEEM-CODE ')
    expect(refreshUser).not.toHaveBeenCalled()
    expect(fetchActiveSubscriptions).not.toHaveBeenCalled()
    expect(getHistory).toHaveBeenCalledOnce()
    expect(showSuccess).not.toHaveBeenCalled()
    expect(showWarning).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

describe('RedeemView console v3 layout', () => {
  const mountView = async () => {
    const wrapper = mount(RedeemView, {
      global: { stubs: { AppLayout: { template: '<div><slot /></div>' }, Icon: true } },
    })
    await flushPromises()
    return wrapper
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getHistory.mockResolvedValue({ items: [], total: 0 })
    refreshUser.mockResolvedValue({ balance: 30, concurrency: 2 })
    fetchActiveSubscriptions.mockResolvedValue([])
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lists activity rows with full codes, readable sources and bronze only for credited balance', async () => {
    getHistory.mockResolvedValue({ total: 5, items: [
      { id: 1, code: 'SPRING-2026-XK7Q-LONG-CODE', type: 'balance', value: 50, used_at: '2026-11-24T06:30:00Z' },
      { id: 2, code: 'AFF-INTERNAL', type: 'affiliate_balance', value: 36.8, used_at: '2026-10-28T12:12:00Z' },
      { id: 3, code: 'ADMIN-INTERNAL', type: 'admin_balance', value: -5, notes: '手动扣回', used_at: '2026-10-20T01:00:00Z' },
      { id: 4, code: 'TEAM-CC-2F8D', type: 'concurrency', value: 2, used_at: '2026-11-12T02:05:00Z' },
      { id: 5, code: 'SUB-CODE', type: 'subscription', value: 30, validity_days: 30, group: { id: 1, name: 'Claude 专线' }, used_at: '2026-11-02T10:41:00Z' },
    ] })
    const wrapper = await mountView()
    const rows = wrapper.findAll('[data-testid="redeem-activity"]')
    expect(rows).toHaveLength(5)
    expect(rows[0].text()).toContain('SPRING-2026-XK7Q-LONG-CODE')
    expect(rows[0].get('.console-redeem-activity__value').classes()).toContain('is-credit')
    expect(rows[0].text()).toContain('+$50.00')
    expect(rows[1].text()).toContain('redeem.balanceAddedAffiliate')
    expect(rows[1].text()).toContain('redeem.console.affiliateSource')
    expect(rows[1].text()).not.toContain('AFF-INTERNAL')
    expect(rows[1].text()).not.toContain('common.unknown')
    expect(rows[2].text()).toContain('redeem.adminAdjustment · 手动扣回')
    expect(rows[2].get('.console-redeem-activity__value').classes()).not.toContain('is-credit')
    expect(rows[2].text()).toContain('-$5.00')
    expect(rows[3].text()).toContain('+2 redeem.requests')
    expect(rows[4].text()).toContain('Claude 专线')
    expect(wrapper.html()).not.toMatch(/(bg|text)-(red|emerald|purple|orange)-/)
  })

  it('shows a loading state, then the empty state, with paging controls still in the card', async () => {
    let resolveHistory!: (value: unknown) => void
    getHistory.mockImplementationOnce(() => new Promise((resolve) => { resolveHistory = resolve }))
    const wrapper = mount(RedeemView, {
      global: { stubs: { AppLayout: { template: '<div><slot /></div>' }, Icon: true } },
    })
    await flushPromises()
    expect(wrapper.get('.console-redeem-history .console-redeem-state').text()).toContain('common.loading')
    resolveHistory({ items: [], total: 0 })
    await flushPromises()
    expect(wrapper.get('.console-redeem-history .console-redeem-state').text()).toContain('redeem.historyWillAppear')
    expect(wrapper.find('.console-redeem-history .console-redeem-foot').exists()).toBe(true)
  })

  it('shows the success line and the balance delta once the account balance has refreshed', async () => {
    redeem.mockResolvedValue({ type: 'balance', value: 50, message: 'Code applied', new_balance: 60 })
    const wrapper = await mountView()
    await wrapper.get('input#code').setValue('SPRING-2026')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    const success = wrapper.get('[data-testid="redeem-success"]')
    expect(success.attributes('role')).toBe('status')
    expect(success.text()).toContain('redeem.added +$50.00 · redeem.newBalance $60.00')
    expect(wrapper.get('[data-testid="redeem-balance"]').text()).toContain('+$50.00')
    expect(wrapper.find('[data-testid="redeem-error"]').exists()).toBe(false)
  })

  it('shows a non-red alert for a used or expired code and keeps the input for correction', async () => {
    redeem.mockRejectedValue({ status: 409, code: 409, reason: 'REDEEM_CODE_USED', message: 'redeem code already used' })
    const wrapper = await mountView()
    await wrapper.get('input#code').setValue('USED-CODE')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    const alert = wrapper.get('[data-testid="redeem-error"]')
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toContain('redeem.errors.REDEEM_CODE_USED')
    expect(alert.html()).not.toMatch(/red-/)
    expect((wrapper.get('input#code').element as HTMLInputElement).value).toBe('USED-CODE')
    expect(wrapper.find('[data-testid="redeem-success"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="redeem-balance"]').text()).not.toContain('+$')
  })

  it('disables the button for an empty code and while submitting', async () => {
    let resolveRedeem!: (value: unknown) => void
    redeem.mockImplementationOnce(() => new Promise((resolve) => { resolveRedeem = resolve }))
    const wrapper = await mountView()
    const submit = wrapper.get('button[type="submit"]')
    expect(submit.attributes('disabled')).toBeDefined()
    await wrapper.get('input#code').setValue('ABC')
    expect(submit.attributes('disabled')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(submit.attributes('disabled')).toBeDefined()
    expect(submit.text()).toContain('redeem.redeeming')
    expect(wrapper.get('input#code').attributes('disabled')).toBeDefined()
    resolveRedeem({ type: 'concurrency', value: 2, message: 'ok' })
    await flushPromises()
    expect(submit.text()).toContain('redeem.redeemButton')
  })
})

describe('RedeemView failure reasons and success notice', () => {
  const submit = async (code = 'SOME-CODE') => {
    const wrapper = mount(RedeemView, {
      global: { stubs: { AppLayout: { template: '<div><slot /></div>' }, Icon: true } },
    })
    await flushPromises()
    await wrapper.get('input#code').setValue(code)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    return wrapper
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getHistory.mockResolvedValue({ items: [], total: 0 })
    refreshUser.mockResolvedValue({ balance: 30, concurrency: 2 })
    fetchActiveSubscriptions.mockResolvedValue([])
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // 与 backend/internal/service/redeem_service.go 的错误码一一对应（apiClient 把它放在 reason 上）
  it.each([
    ['REDEEM_CODE_NOT_FOUND', 404],
    ['REDEEM_CODE_USED', 409],
    ['REDEEM_CODE_EXPIRED', 409],
    ['REDEEM_CODE_LOCKED', 409],
    ['REDEEM_RATE_LIMITED', 429],
    ['REDEEM_CODE_INVALID', 400],
    ['REDEEM_CODE_UNSUPPORTED_TYPE', 400],
  ])('shows the specific reason for %s', async (reason, status) => {
    redeem.mockRejectedValue({ status, code: status, reason, message: 'english backend message' })
    const wrapper = await submit()
    const alert = wrapper.get('[data-testid="redeem-error"]')
    expect(alert.text()).toContain(`redeem.errors.${reason}`)
    expect(alert.text()).not.toContain('english backend message')
    expect(alert.text()).not.toContain('redeem.failedToRedeem')
    expect(showError).toHaveBeenCalledWith('redeem.redeemFailed')
    expect((wrapper.get('input#code').element as HTMLInputElement).value).toBe('SOME-CODE')
  })

  it.each([
    ['an unknown reason', { status: 400, code: 400, reason: 'SOMETHING_NEW', message: 'boom' }],
    ['a request without reason', { status: 400, code: 400, message: 'Invalid request: code required' }],
    ['a network error', { status: 0, code: 'ERR_NETWORK', message: 'Network error. Please check your connection.' }],
    ['a legacy response shape', { response: { data: { detail: 'Invalid code' } } }],
    ['a non-object rejection', 'boom'],
  ])('falls back to the generic message for %s', async (_label, error) => {
    redeem.mockRejectedValue(error)
    const wrapper = await submit()
    const alert = wrapper.get('[data-testid="redeem-error"]')
    expect(alert.text()).toContain('redeem.failedToRedeem')
    expect(alert.text()).not.toMatch(/redeem\.errors\./)
    expect(alert.text()).not.toContain('boom')
    expect(alert.text()).not.toContain('Invalid code')
  })

  it.each([
    ['missing (current backend shape)', undefined],
    ['the same as the title', 'redeem.redeemSuccess'],
    ['the same as the toast text with punctuation', ' redeem.codeRedeemSuccess！ '],
  ])('does not repeat the title when the backend message is %s', async (_label, message) => {
    redeem.mockResolvedValue({ type: 'balance', value: 5, ...(message === undefined ? {} : { message }) })
    const wrapper = await submit()
    const notice = wrapper.get('[data-testid="redeem-success"]')
    expect(notice.text().match(/redeem\.redeemSuccess/g)).toHaveLength(1)
    expect(notice.text()).not.toContain('redeem.codeRedeemSuccess')
    expect(notice.text()).toContain('redeem.added +$5.00')
  })

  it('keeps a distinct backend message and reads the subscription group from the code record', async () => {
    redeem.mockResolvedValue({ type: 'subscription', value: 30, validity_days: 30, group: { id: 3, name: 'Claude 专线' }, message: 'Welcome aboard' })
    const wrapper = await submit()
    const notice = wrapper.get('[data-testid="redeem-success"]')
    expect(notice.text()).toContain('Welcome aboard')
    expect(notice.text()).toContain('redeem.subscriptionAssigned Claude 专线 (redeem.subscriptionDays)')
  })
})
