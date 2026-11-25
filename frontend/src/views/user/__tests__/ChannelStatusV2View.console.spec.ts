import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ChannelStatusV2View from '../ChannelStatusV2View.vue'
import MetricCell from '@/features/channel-monitor-v2/MetricCell.vue'

const mocks = vi.hoisted(() => ({
  admin: false, hideThroughput: false, hideRanking: false,
  getDimensions: vi.fn(), getSnapshot: vi.fn(), getMatrix: vi.fn(), getModels: vi.fn(), getErrors: vi.fn(), getUsers: vi.fn(), showError: vi.fn(),
}))
vi.mock('@/api/channelMonitorV2', () => mocks)
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ get isAdmin() { return mocks.admin } }) }))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ showError: mocks.showError }) }))
vi.mock('@/utils/featureFlags', () => ({ isChannelMonitorThroughputHidden: () => mocks.hideThroughput, isChannelMonitorUserRankingHidden: () => mocks.hideRanking }))
vi.mock('vue-i18n', async () => ({ ...await vi.importActual<typeof import('vue-i18n')>('vue-i18n'), useI18n: () => ({ t: (key: string) => key, te: () => true, locale: { value: 'zh' } }) }))
enableAutoUnmount(afterEach)
afterEach(() => vi.useRealTimers())
const metric = { success_requests: 99, error_requests: 1, request_count: 100, token_count: 9999, rpm: 23, tpm: 1200, error_rate: .01, cache_rate: .7, cache_rate_numerator: 70, cache_rate_denominator: 100, ttft: { sample_count: 100, p50_ms: 300, p95_ms: 600, avg_ms: 400 }, duration: { sample_count: 100, p50_ms: 500, p95_ms: 800, avg_ms: 600 } }
const health = { overall: 'healthy', error_rate: 'healthy', ttft: 'healthy', cache: 'healthy', score: 95, minimum_sample: 10 }
const coverage = { requested_start: '2026-11-25T00:00:00Z', requested_end: '2026-11-25T01:30:00Z', coverage_start: '2026-11-25T00:00:00Z', data_through: '2026-11-25T01:30:00Z', computed_at: '2026-11-25T01:30:00Z', aggregation_lag_seconds: 0, coverage_complete: true, bucket_seconds: 300 }
const row = { platform: 'openai', model: 'gpt-test', metrics: metric, health }
const snapshot = () => ({ config: { refresh_interval_seconds: 60 }, coverage: { ...coverage }, metrics: metric, health, trend: [] })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.admin = mocks.hideThroughput = mocks.hideRanking = false
  mocks.getDimensions.mockResolvedValue({ platforms: [{ value: 'openai', label: 'OpenAI' }], groups: [{ id: 1, name: 'Default', platform: 'openai' }], models: [{ value: 'gpt-test', label: 'gpt-test', platform: 'openai' }] })
  mocks.getSnapshot.mockResolvedValue(snapshot())
  mocks.getMatrix.mockResolvedValue({ coverage, group_by: 'platform_group', items: [] })
  mocks.getModels.mockResolvedValue({ coverage, items: [row] })
  mocks.getErrors.mockResolvedValue({ coverage, items: [{ category: 'upstream_5xx', rate: .01, count: 1, details: [{ message: 'ADMIN ONLY', count: 1 }] }] })
  mocks.getUsers.mockResolvedValue({ coverage, items: [{ rank: 1, display_label: 'Anonymous', is_self: true, metrics: metric }] })
})
async function open(query = '') {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/monitor', component: ChannelStatusV2View }] })
  await router.push('/monitor' + query)
  await router.isReady()
  const wrapper = mount(ChannelStatusV2View, { global: { plugins: [router], stubs: { AppLayout: { template: '<div><slot /></div>' }, Icon: true, LoadingSpinner: true, FilterMultiSelect: true, Select: true, RelayPulseMatrix: true, MonitorTrendChart: true, MonitorRankBadge: true } } })
  await flushPromises()
  return { wrapper, router }
}
describe('Console monitor preserves V2 behavior', () => {
  it('disables manual refresh throughout initial and silent loads, deduplicates clicks and recovers after failure', async () => {
    let finish!: (value: unknown) => void
    mocks.getSnapshot.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const { wrapper, router } = await open()
    const button = wrapper.get<HTMLButtonElement>('.monitor-refresh')
    expect(button.element.disabled).toBe(true)
    expect(button.attributes('aria-busy')).toBe('true')
    await button.trigger('click')
    await button.trigger('click')
    expect(mocks.getSnapshot).toHaveBeenCalledTimes(1)
    finish(snapshot())
    await flushPromises()
    expect(button.element.disabled).toBe(false)
    mocks.getSnapshot.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await router.push('/monitor?range=24h')
    await flushPromises()
    expect(button.element.disabled).toBe(true)
    await button.trigger('click')
    expect(mocks.getSnapshot).toHaveBeenCalledTimes(2)
    finish(snapshot())
    await flushPromises()
    expect(button.element.disabled).toBe(false)
    mocks.getSnapshot.mockRejectedValueOnce(new Error('refresh failed'))
    await button.trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('common.tryAgain')
    expect(button.element.disabled).toBe(false)
    await button.trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(button.attributes('aria-label')).toBe('common.refresh')
  })
  it.each([false, true])('honors throughput privacy with 5/4 KPIs (hidden=%s)', async hidden => {
    mocks.hideThroughput = hidden
    const { wrapper } = await open()
    expect(wrapper.findAllComponents(MetricCell)).toHaveLength(hidden ? 4 : 5)
    expect(wrapper.findAll('thead th')).toHaveLength(hidden ? 4 : 6)
    expect(wrapper.find('thead').text().includes('channelMonitorV2.metrics.tps')).toBe(!hidden)
    expect(wrapper.findComponent({ name: 'RelayPulseMatrix' }).props('showThroughput')).toBe(!hidden)
  })
  it.each([
    ['models', false], ['models', true], ['users', false], ['users', true],
  ] as const)('mobile %s renders all formatted fields without a table (hidden=%s)', async (tab, hidden) => {
    mocks.hideThroughput = hidden
    const { wrapper } = await open(`?tab=${tab}`)
    const mobile = wrapper.get(`[data-testid="mobile-${tab === 'models' ? 'model' : 'user'}-details"]`)
    expect(mobile.classes()).toContain('md:hidden')
    expect(mobile.find('table').exists()).toBe(false)
    expect(mobile.find('dl').element.closest('table')).toBeNull()
    expect(mobile.findAll('[data-field]').map(field => field.attributes('data-field'))).toEqual(hidden ? ['success', 'ttft', 'cache'] : ['success', 'ttft', 'tps', 'cache', 'rpm'])
    expect(mobile.get('[data-field="success"] dd').text()).toContain('99.0%')
    expect(mobile.get('[data-field="ttft"] dd').text()).toBe('300msAVG 400ms · P50 300ms · P95 600ms')
    expect(mobile.get('[data-field="cache"] dd').text()).toBe('70.0%')
    if (!hidden) {
      expect(mobile.get('[data-field="tps"] dd').text()).toBe('20')
      expect(mobile.get('[data-field="rpm"] dd').text()).toBe('23')
    }
    expect(wrapper.get('.monitor-detail-desktop').classes()).toEqual(expect.arrayContaining(['hidden', 'md:block']))
    expect(wrapper.get('.monitor-detail-desktop table').exists()).toBe(true)
    if (tab === 'users') {
      expect(mobile.text()).toContain('Anonymous')
      expect(mobile.text()).toContain('channelMonitorV2.currentUser')
      expect(mocks.getUsers).toHaveBeenCalledTimes(1)
    } else expect(mocks.getModels).toHaveBeenCalledTimes(1)
  })
  it('mobile model has a native keyboard-accessible trigger using the existing drill action', async () => {
    mocks.getDimensions.mockResolvedValue({ platforms: [{ value: 'openai', label: 'OpenAI' }], groups: [], models: [{ value: 'very-long-model-name-'.repeat(8), label: 'Long model', platform: 'openai' }] })
    mocks.getModels.mockResolvedValue({ coverage, items: [{ ...row, model: 'very-long-model-name-'.repeat(8) }] })
    const { wrapper, router } = await open()
    const trigger = wrapper.get('[data-testid="mobile-model-details"] button')
    expect(trigger.attributes('type')).toBe('button')
    expect(trigger.text()).toContain('very-long-model-name-'.repeat(8))
    await trigger.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.platform).toBe('openai')
    expect(router.currentRoute.value.query.model).toBe('very-long-model-name-'.repeat(8))
  })
  it('error list retains admin sample fields and native expand state with long content', async () => {
    mocks.admin = true
    mocks.getErrors.mockResolvedValue({ coverage, items: [{ category: 'long-category-'.repeat(10), rate: .012, count: 12, details: [{ platform: 'openai', model: 'long-model-'.repeat(12), status_code: 502, upstream_status_code: 503, message: 'unbroken-error-'.repeat(20), count: 12 }] }] })
    const { wrapper } = await open('?tab=errors')
    expect(wrapper.get('.monitor-error-details').find('table').exists()).toBe(false)
    const trigger = wrapper.get('.monitor-error-row button')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    const detail = wrapper.get('.monitor-error-sample')
    expect(detail.text()).toContain('openai')
    expect(detail.text()).toContain('long-model-'.repeat(12))
    expect(detail.text()).toContain('unbroken-error-'.repeat(20))
    expect(detail.text()).toContain('channelMonitorV2.errorDetail.http')
    expect(detail.text()).toContain('channelMonitorV2.errorDetail.upstream')
    expect(detail.text()).toContain('×12')
  })
  it('hides ranking and normalizes a requested users tab without requesting users', async () => {
    mocks.hideRanking = true
    const { wrapper, router } = await open('?tab=users')
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(2)
    expect(router.currentRoute.value.query.tab).toBe('models')
    expect(mocks.getUsers).not.toHaveBeenCalled()
  })
  it('admins retain throughput, ranking, details and admin requests despite privacy flags', async () => {
    mocks.admin = mocks.hideRanking = mocks.hideThroughput = true
    const { wrapper } = await open('?tab=users')
    expect(wrapper.findAllComponents(MetricCell)).toHaveLength(5)
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(3)
    expect(mocks.getUsers.mock.calls[0][1]).toBe(true)
    await wrapper.findAll('[role="tab"]')[1].trigger('click')
    await flushPromises()
    await wrapper.get('.monitor-error-row button').trigger('click')
    expect(wrapper.text()).toContain('ADMIN ONLY')
    expect(mocks.getErrors.mock.calls[0][1]).toBe(true)
  })
  it('ordinary users never render upstream detail even if returned in a payload', async () => {
    const { wrapper } = await open('?tab=errors')
    await wrapper.get('.monitor-error-row button').trigger('click')
    expect(wrapper.text()).not.toContain('ADMIN ONLY')
    expect(mocks.getErrors.mock.calls[0][1]).toBe(false)
  })
  it('restores query, drills a model and follows browser query changes in both directions', async () => {
    const { wrapper, router } = await open('?range=7d&platform=openai&group=1&model=gpt-test&group_by=platform_model&health_mode=cache&trend_view=line')
    expect(mocks.getSnapshot.mock.calls[0][0]).toEqual({ range: '7d', platforms: ['openai'], groupIds: [1], models: ['gpt-test'] })
    expect(wrapper.findComponent({ name: 'MonitorTrendChart' }).exists()).toBe(true)
    await router.push('/monitor?range=24h&tab=models')
    await flushPromises()
    expect(mocks.getSnapshot.mock.lastCall?.[0].range).toBe('24h')
    expect(wrapper.findComponent({ name: 'RelayPulseMatrix' }).exists()).toBe(true)
    await wrapper.get('tbody tr').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.platform).toBe('openai')
    expect(router.currentRoute.value.query.model).toBe('gpt-test')
  })
  it('keeps bootstrap progress and polls at ten seconds, then clears the timer on unmount', async () => {
    vi.useFakeTimers()
    mocks.getSnapshot.mockResolvedValue({ ...snapshot(), coverage: { ...coverage, coverage_complete: false, bootstrap: { active: true, progress_percent: 46 } } })
    const { wrapper } = await open()
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('46')
    await vi.advanceTimersByTimeAsync(10000)
    expect(mocks.getSnapshot).toHaveBeenCalledTimes(2)
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(10000)
    expect(mocks.getSnapshot).toHaveBeenCalledTimes(2)
  })
  it('keeps partial coverage and distinguishes empty data from retryable errors', async () => {
    mocks.getSnapshot.mockResolvedValue({ ...snapshot(), coverage: { ...coverage, coverage_complete: false } })
    mocks.getModels.mockResolvedValue({ coverage, items: [] })
    const { wrapper } = await open()
    expect(wrapper.text()).toContain('channelMonitorV2.partialCoverage')
    expect(wrapper.text()).toContain('channelMonitorV2.empty.title')
    mocks.getSnapshot.mockRejectedValueOnce(new Error('offline'))
    await wrapper.get('[aria-label="common.refresh"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('common.tryAgain')
    expect(wrapper.find('.empty-state').exists()).toBe(false)
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
  it('detail errors have their own retry and do not masquerade as empty', async () => {
    mocks.getModels.mockRejectedValueOnce(new Error('detail offline'))
    const { wrapper } = await open()
    expect(wrapper.get('[role="alert"]').text()).toContain('common.tryAgain')
    expect(wrapper.find('.empty-state').exists()).toBe(false)
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('tbody').text()).toContain('gpt-test')
  })
  it('ignores a stale tab response after a filter reload even if transport ignores abort', async () => {
    let resolveOld!: (value: unknown) => void
    mocks.getModels.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    const { wrapper, router } = await open()
    const oldSignal = mocks.getModels.mock.calls[0][2]
    await router.push('/monitor?range=24h')
    await flushPromises()
    expect(oldSignal.aborted).toBe(true)
    resolveOld({ items: [{ ...row, model: 'STALE' }] })
    await flushPromises()
    expect(wrapper.text()).not.toContain('STALE')
    expect(wrapper.text()).toContain('gpt-test')
  })
})
