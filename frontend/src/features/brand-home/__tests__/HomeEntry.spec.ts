import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { appStore } = vi.hoisted(() => ({
  appStore: {
    cachedPublicSettings: null as Record<string, unknown> | null,
    publicSettingsLoaded: true,
    fetchPublicSettings: vi.fn()
  }
}))

vi.mock('@/stores', () => ({ useAppStore: () => appStore }))
vi.mock('@/views/HomeView.vue', () => ({ __esModule: true, default: { name: 'UpstreamHome', template: '<div data-testid="upstream-home" />' } }))
vi.mock('../BrandHome.vue', () => ({ __esModule: true, default: { name: 'BrandHome', template: '<div data-testid="brand-home" />' } }))

import HomeEntry from '../HomeEntry.vue'

async function mountEntry() {
  const wrapper = mount(HomeEntry)
  await flushPromises()
  await flushPromises()
  return wrapper
}

describe('HomeEntry', () => {
  beforeEach(() => {
    appStore.publicSettingsLoaded = true
    appStore.cachedPublicSettings = { home_content: '', compact_home_enabled: false }
    appStore.fetchPublicSettings.mockReset()
  })

  it('renders the brand home by default', async () => {
    const wrapper = await mountEntry()
    expect(wrapper.find('[data-testid="brand-home"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="upstream-home"]').exists()).toBe(false)
  })

  it('renders the upstream home when admin home content exists', async () => {
    appStore.cachedPublicSettings = { home_content: 'https://example.com', compact_home_enabled: false }
    const wrapper = await mountEntry()
    expect(wrapper.find('[data-testid="upstream-home"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="brand-home"]').exists()).toBe(false)
  })

  it('waits for public settings before choosing, without rendering either page first', async () => {
    appStore.publicSettingsLoaded = false
    appStore.cachedPublicSettings = null
    let resolve!: () => void
    appStore.fetchPublicSettings.mockImplementation(
      () =>
        new Promise<void>((r) => {
          resolve = () => {
            appStore.publicSettingsLoaded = true
            appStore.cachedPublicSettings = { home_content: '', compact_home_enabled: true }
            r()
          }
        })
    )
    const wrapper = mount(HomeEntry)
    await flushPromises()
    expect(appStore.fetchPublicSettings).toHaveBeenCalledTimes(1)
    expect(wrapper.html()).not.toContain('data-testid')
    resolve()
    await flushPromises()
    await flushPromises()
    expect(wrapper.find('[data-testid="upstream-home"]').exists()).toBe(true)
  })

  it('treats a failed settings fetch as unknown and shows the brand home', async () => {
    appStore.publicSettingsLoaded = false
    appStore.cachedPublicSettings = null
    appStore.fetchPublicSettings.mockRejectedValue(new Error('offline'))
    const wrapper = await mountEntry()
    expect(wrapper.find('[data-testid="brand-home"]').exists()).toBe(true)
  })
})
