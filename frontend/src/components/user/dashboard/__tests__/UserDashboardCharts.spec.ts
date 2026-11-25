import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
    })
  }
})

import UserDashboardCharts from '../UserDashboardCharts.vue'
import type { ModelStat } from '@/types'

function model(name: string, requests: number, cost: number): ModelStat {
  return {
    model: name,
    requests,
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_tokens: 0,
    cache_read_tokens: 0,
    total_tokens: 0,
    cost,
    actual_cost: cost
  }
}

function mountCharts(models: ModelStat[], granularity = 'day') {
  return mount(UserDashboardCharts, {
    props: { loading: false, startDate: '2026-11-18', endDate: '2026-11-24', granularity, trend: [], models },
    global: { stubs: { TokenUsageTrend: { template: '<div><slot name="actions" /></div>' }, DateRangePicker: true, ModelIcon: true, Icon: true } }
  })
}

describe('UserDashboardCharts model distribution', () => {
  it('lists the top four models by cost and folds the rest into one row', () => {
    const w = mountCharts([
      model('a', 10, 1),
      model('b', 10, 50),
      model('c', 10, 20),
      model('d', 10, 10),
      model('e', 10, 9),
      model('f', 10, 10)
    ])
    const rows = w.findAll('[data-testid="model-row"]')
    expect(rows).toHaveLength(5)
    expect(rows[0].text()).toContain('b')
    expect(rows[0].text()).toContain('50%')
    expect(rows[4].text()).toContain('dashboard.otherModels:{"count":2}')
  })

  it('weights by requests when nothing has a cost yet', () => {
    const w = mountCharts([model('a', 30, 0), model('b', 70, 0)])
    const rows = w.findAll('[data-testid="model-row"]')
    expect(rows[0].text()).toContain('b')
    expect(rows[0].text()).toContain('70%')
  })

  it('switches granularity through the segmented control', async () => {
    const w = mountCharts([])
    const tabs = w.findAll('[role="tab"]')
    expect(tabs[0].classes()).toContain('tab-active')
    await tabs[1].trigger('click')
    expect(w.emitted('update:granularity')?.[0]).toEqual(['hour'])
    expect(w.emitted('granularityChange')).toHaveLength(1)
    await tabs[0].trigger('click')
    expect(w.emitted('update:granularity')).toHaveLength(1)
  })
})
