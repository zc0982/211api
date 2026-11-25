import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import MonitorTrendChart from '../MonitorTrendChart.vue'
import type { MonitorHealth, MonitorMetric } from '@/api/channelMonitorV2'
vi.mock('vue-chartjs', () => ({ Line: { name: 'Line', props: ['data', 'options'], template: '<div />' } }))
vi.mock('vue-i18n', async () => ({ ...await vi.importActual<typeof import('vue-i18n')>('vue-i18n'), useI18n: () => ({ t: (key: string) => key, locale: { value: 'zh' } }) }))
afterEach(() => document.documentElement.classList.remove('dark'))
describe('Console trend theme', () => {
  it('updates the existing chart palette when the real document theme changes', async () => {
    const wrapper = mount(MonitorTrendChart, {
      props: { trend: [{ bucket_start: '2026-11-25T00:00:00Z', metrics: { error_rate: .01, cache_rate: .7, ttft: { p50_ms: 300 } } as MonitorMetric, health: {} as MonitorHealth }], coverage: null, loading: false },
      global: { stubs: { Icon: true } },
    })
    const line = wrapper.findComponent({ name: 'Line' })
    expect(line.props('data').datasets[2].borderColor).toBe('#2f5fd0')
    document.documentElement.classList.add('dark')
    await flushPromises()
    expect(line.props('data').datasets[2].borderColor).toBe('#7aa2ff')
    expect(line.props('options').plugins.tooltip.backgroundColor).toBe('#0e1830')
    wrapper.unmount()
  })
})
