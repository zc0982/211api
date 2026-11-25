import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import AvailableChannelsView from '../AvailableChannelsView.vue'
import AvailableChannelsTable from '@/components/channels/AvailableChannelsTable.vue'

const mocks = vi.hoisted(() => ({ list: vi.fn(), rates: vi.fn(), showError: vi.fn() }))
vi.mock('@/api/channels', () => ({ default: { getAvailable: mocks.list } }))
vi.mock('@/api/groups', () => ({ default: { getUserGroupRates: mocks.rates } }))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ showError: mocks.showError }) }))
vi.mock('vue-i18n', async () => ({ ...await vi.importActual<typeof import('vue-i18n')>('vue-i18n'), useI18n: () => ({ t: (key: string) => key }) }))
enableAutoUnmount(afterEach)
const channels = [{ name: 'Multi', description: 'Fast route', platforms: [
  { platform: 'anthropic', groups: [{ id: 1, name: 'Exclusive' }], supported_models: [{ name: 'claude-test' }] },
  { platform: 'openai', groups: [{ id: 2, name: 'Public' }], supported_models: [{ name: 'gpt-test' }] },
] }, { name: 'Gemini', description: 'Vision', platforms: [{ platform: 'gemini', groups: [], supported_models: [] }] }]
beforeEach(() => { vi.clearAllMocks(); mocks.list.mockResolvedValue(channels); mocks.rates.mockResolvedValue({ 1: .8 }) })
async function open() {
  const wrapper = mount(AvailableChannelsView, { global: { stubs: { AppLayout: { template: '<div><slot /></div>' }, Icon: true, PlatformIcon: true, AvailableChannelsTable: true } } })
  await flushPromises()
  return wrapper
}
describe('Available channels Console', () => {
  it('uses one page heading and opts both real routes into pageHeading', async () => {
    const wrapper = await open()
    expect(wrapper.findAll('h1')).toHaveLength(1)
    const source = readFileSync(resolve(__dirname, '../../../router/index.ts'), 'utf8')
    for (const path of ['/available-channels', '/monitor']) {
      expect(source.slice(source.indexOf(`path: '${path}'`)).split('\n  },')[0]).toContain('pageHeading: true')
    }
  })
  it('intersects platform pills with channel, platform, group and model search without refetch', async () => {
    const wrapper = await open()
    const table = () => wrapper.getComponent(AvailableChannelsTable)
    await wrapper.get('.console-channel-platforms button:nth-child(3)').trigger('click')
    expect(table().props('rows')[0].platforms.map((p: { platform: string }) => p.platform)).toEqual(['openai'])
    for (const query of ['Multi', 'Fast', 'openai', 'Public', 'gpt-test']) {
      await wrapper.get('input').setValue(query)
      expect(table().props('rows')).toHaveLength(1)
      expect(table().props('rows')[0].platforms).toHaveLength(1)
    }
    await wrapper.get('input').setValue('claude-test')
    expect(table().props('rows')).toHaveLength(0)
    expect(table().props('emptyLabel')).toBe('availableChannels.noMatch')
    await wrapper.get('.console-channel-platforms button').trigger('click')
    expect(table().props('rows')[0].platforms[0].platform).toBe('anthropic')
    expect(mocks.list).toHaveBeenCalledTimes(1)
  })
  it('distinguishes no channels, failure and successful retry', async () => {
    mocks.list.mockRejectedValueOnce(new Error('offline'))
    const wrapper = await open()
    expect(wrapper.findComponent(AvailableChannelsTable).exists()).toBe(false)
    expect(wrapper.get('[role="alert"] button').text()).toBe('common.tryAgain')
    mocks.list.mockResolvedValueOnce([])
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.getComponent(AvailableChannelsTable).props('emptyLabel')).toBe('availableChannels.empty')
  })
  it('degrades a failed rates request to regular rates without hiding channels', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.rates.mockRejectedValueOnce(new Error('rates unavailable'))
    const wrapper = await open()
    expect(wrapper.getComponent(AvailableChannelsTable).props('rows')).toHaveLength(2)
    expect(wrapper.getComponent(AvailableChannelsTable).props('userGroupRates')).toEqual({})
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    log.mockRestore()
  })
})
