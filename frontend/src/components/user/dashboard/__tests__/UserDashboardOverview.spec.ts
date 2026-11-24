import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

// t() 回显 key；带参数时附上 JSON，便于断言
vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
    })
  }
})

import UserDashboardOverview from '../UserDashboardOverview.vue'
import type { UserDashboardStats } from '@/api/usage'
import type { PlatformQuotaItem, UsageLog } from '@/types'

const stats = {
  total_api_keys: 4,
  active_api_keys: 3,
  total_actual_cost: 371.6,
  today_actual_cost: 12.86
} as UserDashboardStats

function quota(over: Partial<PlatformQuotaItem> & { platform: string }): PlatformQuotaItem {
  return {
    daily_limit_usd: null,
    weekly_limit_usd: null,
    monthly_limit_usd: null,
    daily_usage_usd: 0,
    weekly_usage_usd: 0,
    monthly_usage_usd: 0,
    ...over
  } as PlatformQuotaItem
}

const lastCall = {
  id: 1,
  request_id: 'req_7f3a9c',
  model: 'claude-fable-5-2',
  input_tokens: 1284,
  output_tokens: 356,
  duration_ms: 1240,
  first_token_ms: 312,
  actual_cost: 0.0042,
  created_at: '2026-11-24T06:21:08Z'
} as UsageLog

function mountOverview(props: Partial<InstanceType<typeof UserDashboardOverview>['$props']> = {}) {
  return mount(UserDashboardOverview, {
    props: { balance: 128.4, stats, platformQuotas: null, lastCall: null, isSimple: false, paymentEnabled: true, ...props },
    global: { stubs: { Icon: true, ModelIcon: true, RouterLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } } }
  })
}

describe('UserDashboardOverview', () => {
  it('shows the balance with two decimals and the recharge / redeem actions', () => {
    const w = mountOverview()
    expect(w.text()).toContain('128.40')
    expect(w.find('a[href="/purchase"]').exists()).toBe(true)
    expect(w.find('a[href="/redeem"]').exists()).toBe(true)
  })

  it('hides recharge when payment is disabled and all actions in simple mode', () => {
    expect(mountOverview({ paymentEnabled: false }).find('a[href="/purchase"]').exists()).toBe(false)
    const simple = mountOverview({ isSimple: true })
    expect(simple.find('a[href="/purchase"]').exists()).toBe(false)
    expect(simple.find('a[href="/redeem"]').exists()).toBe(false)
  })

  it('traces the latest call with the gold line and chip — gold appears only there (One Star Rule)', () => {
    const w = mountOverview({ lastCall })
    const trace = w.find('[data-testid="last-call-trace"]')
    expect(trace.exists()).toBe(true)
    expect(trace.text()).toContain('claude-fable-5-2')
    expect(trace.text()).toContain('1.24s')
    expect(trace.html()).toMatch(/#e3b95e/i)
    expect(w.text()).toContain('req_7f3a9c')
    expect(w.text()).toContain('0.0042')
    // 月亮里是淡色星狐剪影，不放彩色 Logo
    expect(trace.find('.trace__moon path').attributes('fill')).toBe('#CDD9EE')
  })

  it('has no gold and shows the empty hint before the first call', () => {
    const w = mountOverview({ lastCall: null })
    expect(w.find('[data-testid="last-call-trace"]').exists()).toBe(false)
    expect(w.html()).not.toMatch(/#e3b95e/i)
    expect(w.text()).toContain('dashboard.overview.noCalls')
  })

  it('falls back to the API key summary when no quota is configured', () => {
    const w = mountOverview({ platformQuotas: [quota({ platform: 'openai' })] })
    expect(w.text()).toContain('dashboard.overview.keysTitle')
    expect(w.find('[data-quota-window]').exists()).toBe(false)
  })

  it('renders configured quota windows and flags ≥ 90% (and disabled) in bronze', () => {
    const w = mountOverview({
      platformQuotas: [
        quota({ platform: 'anthropic', daily_limit_usd: 50, daily_usage_usd: 18.2, monthly_limit_usd: 500, monthly_usage_usd: 480, weekly_limit_usd: 0 })
      ]
    })
    const rows = w.findAll('[data-quota-window]')
    expect(rows.map((r) => r.attributes('data-quota-window'))).toEqual(['daily', 'weekly', 'monthly'])
    expect(rows[0].text()).toContain('36%')
    expect(rows[0].find('.night-bar__fill').classes()).not.toContain('is-warn')
    expect(rows[1].text()).toContain('dashboard.platformQuota.disabled')
    expect(rows[1].find('.night-bar__fill').classes()).toContain('is-warn')
    expect(rows[2].text()).toContain('96%')
    expect(rows[2].find('.night-bar__fill').classes()).toContain('is-warn')
  })

  it('lets the user switch between several platforms with quotas', async () => {
    const w = mountOverview({
      platformQuotas: [
        quota({ platform: 'anthropic', daily_limit_usd: 50, daily_usage_usd: 5 }),
        quota({ platform: 'openai', daily_limit_usd: 10, daily_usage_usd: 9.5 })
      ]
    })
    const tabs = w.findAll('[role="tab"]')
    expect(tabs.map((tab) => tab.text())).toEqual(['Claude', 'OpenAI'])
    expect(w.find('[data-quota-window="daily"]').text()).toContain('10%')
    await tabs[1].trigger('click')
    expect(w.find('[data-quota-window="daily"]').text()).toContain('95%')
  })
})
