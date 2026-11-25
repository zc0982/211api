import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, reactive } from 'vue'

const { usageAPI, getMyPlatformQuotas } = vi.hoisted(() => ({
  usageAPI: {
    getDashboardStats: vi.fn(),
    getDashboardTrend: vi.fn(),
    getDashboardModels: vi.fn(),
    getByDateRange: vi.fn(),
    query: vi.fn()
  },
  getMyPlatformQuotas: vi.fn()
}))

const authStore = reactive({ user: { username: 'lumi', balance: 10 }, isSimpleMode: false, refreshUser: vi.fn() })
const appStore = reactive({ cachedPublicSettings: { payment_enabled: true, payment_balance_disabled: true, subscription_enabled: true } })

vi.mock('@/api/usage', () => ({ usageAPI }))
vi.mock('@/api/user', () => ({ getMyPlatformQuotas }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => authStore }))
vi.mock('@/stores/app', () => ({ useAppStore: () => appStore }))
vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

import DashboardView from '../DashboardView.vue'

const Overview = defineComponent({
  name: 'UserDashboardOverview',
  props: ['lastCall', 'lastCallState', 'purchaseAction', 'balance', 'stats', 'platformQuotas', 'isSimple'],
  template: '<div />'
})

function mountView() {
  return mount(DashboardView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        UserDashboardOverview: Overview,
        UserDashboardStats: true,
        UserDashboardCharts: true,
        UserDashboardRecentUsage: true,
        UserDashboardQuickActions: true,
        LoadingSpinner: true,
        Icon: true,
        RouterLink: { template: '<a><slot /></a>' }
      }
    }
  })
}

describe('DashboardView latest call', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usageAPI.getDashboardStats.mockResolvedValue({ today_requests: 0, today_actual_cost: 0 })
    usageAPI.getDashboardTrend.mockResolvedValue({ trend: [] })
    usageAPI.getDashboardModels.mockResolvedValue({ models: [] })
    getMyPlatformQuotas.mockResolvedValue({ platform_quotas: [] })
  })

  it('queries the newest record on its own, without the trend date range', async () => {
    const old = { id: 9, request_id: 'req_old', created_at: '2026-11-10T00:00:00Z' }
    usageAPI.getByDateRange.mockResolvedValue({ items: [] }) // 近 7 天没有调用
    usageAPI.query.mockResolvedValue({ items: [old] })
    const w = mountView()
    await flushPromises()

    expect(usageAPI.query).toHaveBeenCalledWith({ page: 1, page_size: 1, sort_by: 'created_at', sort_order: 'desc' })
    const overview = w.findComponent(Overview)
    expect(overview.props('lastCall')).toEqual(old)
    expect(overview.props('lastCallState')).toBe('ready')
  })

  it('reports a failed read instead of "no calls yet"', async () => {
    usageAPI.getByDateRange.mockResolvedValue({ items: [] })
    usageAPI.query.mockRejectedValue(new Error('boom'))
    const w = mountView()
    await flushPromises()
    expect(w.findComponent(Overview).props('lastCallState')).toBe('error')
  })

  it('passes the subscription-only purchase action to the overview', async () => {
    usageAPI.getByDateRange.mockResolvedValue({ items: [] })
    usageAPI.query.mockResolvedValue({ items: [] })
    const w = mountView()
    await flushPromises()
    expect(w.findComponent(Overview).props('purchaseAction')).toBe('subscribe')
  })
})
