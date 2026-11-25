import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

import UserDashboardRecentUsage from '../UserDashboardRecentUsage.vue'
import type { UsageLog } from '@/types'

function log(id: number, over: Partial<UsageLog> = {}): UsageLog {
  return {
    id,
    request_id: `req_${id}`,
    model: 'claude-fable-5-2',
    api_key_id: 1,
    input_tokens: 100,
    output_tokens: 20,
    duration_ms: 800,
    actual_cost: 0.001,
    total_cost: 0.002,
    created_at: '2026-11-24T06:21:08Z',
    ...over
  } as UsageLog
}

function mountRecent(data: UsageLog[]) {
  return mount(UserDashboardRecentUsage, {
    props: { data, loading: false },
    global: { stubs: { ModelIcon: true, LoadingSpinner: true, EmptyState: true, RouterLink: { template: '<a><slot /></a>' } } }
  })
}

describe('UserDashboardRecentUsage status', () => {
  it('does not invent a 200 OK for records without a status code', () => {
    const w = mountRecent([log(1), log(2)])
    expect(w.text()).not.toContain('200 OK')
    expect(w.find('[data-testid="recent-usage-blocked"]').exists()).toBe(false)
  })

  it('marks policy-blocked calls in both the table and the phone list', () => {
    const w = mountRecent([log(1), log(2, { request_type: 'cyber' })])
    const rows = w.findAll('[data-testid="recent-usage-row"]')
    expect(rows[0].find('[data-testid="recent-usage-blocked"]').exists()).toBe(false)
    expect(rows[1].find('[data-testid="recent-usage-blocked"]').text()).toBe('dashboard.overview.blocked')
    const items = w.findAll('[data-testid="recent-usage-item"]')
    expect(items[1].find('[data-testid="recent-usage-blocked"]').exists()).toBe(true)
  })
})
