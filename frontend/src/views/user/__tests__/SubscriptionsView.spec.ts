import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RouterLinkStub, flushPromises, mount } from '@vue/test-utils'
import SubscriptionsView from '../SubscriptionsView.vue'

const push = vi.hoisted(() => vi.fn())
const getMySubscriptions = vi.hoisted(() => vi.fn())

vi.mock('vue-router', async () => ({
  ...(await vi.importActual<typeof import('vue-router')>('vue-router')),
  useRouter: () => ({ push }),
}))
vi.mock('vue-i18n', async () => ({
  ...(await vi.importActual<typeof import('vue-i18n')>('vue-i18n')),
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${Object.values(params).join('|')}` : key,
  }),
}))
vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ cachedPublicSettings: undefined, showError: vi.fn() }),
}))
vi.mock('@/api/subscriptions', () => ({ default: { getMySubscriptions } }))

const day = 86400000
function sub(over: Record<string, unknown>) {
  return {
    id: 1,
    group_id: 3,
    status: 'active',
    daily_usage_usd: 0,
    weekly_usage_usd: 0,
    monthly_usage_usd: 0,
    daily_window_start: null,
    weekly_window_start: null,
    monthly_window_start: null,
    expires_at: new Date(Date.now() + 18 * day).toISOString(),
    group: { name: 'Claude 专线 · 月卡', platform: 'anthropic', rate_multiplier: 0.8, daily_limit_usd: 50, weekly_limit_usd: 200, monthly_limit_usd: 800 },
    ...over,
  }
}

async function mountView(list: unknown[]) {
  getMySubscriptions.mockReset().mockResolvedValue(list)
  push.mockReset()
  const wrapper = mount(SubscriptionsView, {
    global: { stubs: { AppLayout: { template: '<div><slot /></div>' }, RouterLink: RouterLinkStub } },
  })
  await flushPromises()
  return wrapper
}

describe('SubscriptionsView console v3', () => {
  beforeEach(() => vi.useRealTimers())

  it('has its own heading and a buy button that opens the subscription tab', async () => {
    const wrapper = await mountView([sub({})])
    expect(wrapper.get('h1.page-title').text()).toBe('userSubscriptions.title')
    await wrapper.get('[data-testid="buy-subscription"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ path: '/purchase', query: { tab: 'subscription' } })
  })

  it('renders one usage row per configured window with a labelled progress bar', async () => {
    const wrapper = await mountView([sub({ daily_usage_usd: 12.4, daily_window_start: new Date().toISOString() })])
    const rows = wrapper.findAll('.console-sub__row')
    expect(rows.map((r) => r.attributes('data-testid'))).toEqual(['usage-daily', 'usage-weekly', 'usage-monthly'])
    expect(rows[0].get('[role="progressbar"]').attributes('aria-valuenow')).toBe('25')
    expect(rows[0].text()).toContain('$12.40')
    expect(rows[1].text()).toContain('userSubscriptions.windowNotActive')
    expect(rows[1].text()).not.toContain('userSubscriptions.resetIn')
  })

  it('uses words for unlimited subscriptions: no bar, no $0.00', async () => {
    const wrapper = await mountView([
      sub({ expires_at: null, group: { name: 'Gemini', platform: 'gemini', rate_multiplier: 1 } }),
    ])
    const card = wrapper.get('[data-testid="subscription-card"]')
    expect(card.find('[role="progressbar"]').exists()).toBe(false)
    expect(card.get('[data-testid="usage-unlimited"]').text()).toContain('userSubscriptions.unlimitedDesc')
    expect(card.text()).toContain('userSubscriptions.longTerm')
    expect(card.text()).not.toContain('$0.00')
  })

  it('highlights usage ≥ 90% without red and offers re-buy for expired plans', async () => {
    const wrapper = await mountView([
      sub({ weekly_usage_usd: 190, group: { name: 'GPT', platform: 'openai', rate_multiplier: 0.9, weekly_limit_usd: 200 } }),
      sub({ id: 2, status: 'expired', group_id: 9, group: { name: 'Grok', platform: 'default', rate_multiplier: 1 } }),
    ])
    const [active, expired] = wrapper.findAll('[data-testid="subscription-card"]')
    expect(active.get('.console-sub__used').classes()).toContain('is-high')
    expect(active.html()).not.toMatch(/red-|orange-|green-/)
    expect(expired.classes()).toContain('is-inactive')
    expect(expired.text()).toContain('userSubscriptions.ended')
    const rebuy = expired.findAll('button').find((b) => b.text() === 'userSubscriptions.rebuy')!
    await rebuy.trigger('click')
    expect(push).toHaveBeenCalledWith({ path: '/purchase', query: { tab: 'subscription', group: '9' } })
  })

  it('counts down an unstarted one-time daily quota by its expiry instead of awaiting first use', async () => {
    const now = Date.now()
    const wrapper = await mountView([
      sub({
        starts_at: new Date(now - 2 * 3600000).toISOString(),
        expires_at: new Date(now + 22 * 3600000).toISOString(),
        daily_window_start: null,
        group: { name: 'Day pass', platform: 'anthropic', rate_multiplier: 1, daily_limit_usd: 10 },
      }),
    ])
    const daily = wrapper.get('[data-testid="usage-daily"]')
    expect(daily.text()).toContain('userSubscriptions.quotaEndsIn')
    expect(daily.text()).not.toContain('userSubscriptions.windowNotActive')
  })
})

