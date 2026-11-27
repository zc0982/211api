import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'

const viewport = { isPhone: ref(false), isTablet: ref(false), isDesktop: ref(true) }

const appStore = reactive({
  sidebarCollapsed: false,
  mobileOpen: false,
  backendModeEnabled: false,
  siteName: '211API',
  siteLogo: '',
  siteVersion: '',
  publicSettingsLoaded: true,
  cachedPublicSettings: {} as Record<string, unknown>,
  sidebarScrollTop: 0,
  toggleSidebar() {
    appStore.sidebarCollapsed = !appStore.sidebarCollapsed
  },
  setMobileOpen(open: boolean) {
    appStore.mobileOpen = open
  }
})
const authStore = reactive({ isAdmin: true, isSimpleMode: false, user: { role: 'admin' } })
const adminSettingsStore = reactive({ opsMonitoringEnabled: true, paymentEnabled: true, customMenuItems: [], fetch: vi.fn() })
const onboardingStore = reactive({ isCurrentStep: () => false, nextStep: vi.fn() })

vi.mock('@/stores', () => ({
  useAppStore: () => appStore,
  useAuthStore: () => authStore,
  useAdminSettingsStore: () => adminSettingsStore,
  useOnboardingStore: () => onboardingStore
}))
vi.mock('@/stores/app', () => ({ useAppStore: () => appStore }))
vi.mock('@/composables/useConsoleViewport', () => ({ useConsoleViewport: () => viewport }))
vi.mock('@/composables/useBatchImageAccess', () => ({
  useBatchImageAccess: () => ({ canUseBatchImage: ref(false), refreshBatchImageAccess: vi.fn() })
}))
vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

import AppSidebar from '../AppSidebar.vue'

function setViewport(kind: 'phone' | 'tablet' | 'desktop') {
  viewport.isPhone.value = kind === 'phone'
  viewport.isTablet.value = kind === 'tablet'
  viewport.isDesktop.value = kind === 'desktop'
}

async function mountSidebar() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
  })
  await router.push('/admin/dashboard')
  const wrapper = mount(AppSidebar, {
    global: { plugins: [router], stubs: { VersionBadge: true, Icon: true } }
  })
  await flushPromises()
  return { wrapper, router }
}

function groupButton(wrapper: Awaited<ReturnType<typeof mountSidebar>>['wrapper'], label: string) {
  const button = wrapper.findAll('button').find((b) => b.text().includes(label))
  if (!button) throw new Error(`group ${label} not rendered`)
  return button
}

describe('AppSidebar groups across viewports', () => {
  beforeEach(() => {
    appStore.sidebarCollapsed = false
    appStore.mobileOpen = false
    setViewport('desktop')
  })

  it('expands admin groups in the tablet overlay after the sidebar was collapsed on desktop', async () => {
    const { wrapper, router } = await mountSidebar()

    // 桌面收起成图标栏：分组不展开
    appStore.sidebarCollapsed = true
    await flushPromises()
    expect(wrapper.text()).not.toContain('nav.channelManagement')

    // 切到平板并打开浮层：整栏显示，sidebarCollapsed 仍为 true
    setViewport('tablet')
    appStore.mobileOpen = true
    await flushPromises()

    const channelChildren = () => wrapper.findAll('.sidebar-children').find((c) => c.text().includes('nav.channelPricing'))!
    expect(channelChildren().classes()).toContain('sidebar-children--collapsed')
    await groupButton(wrapper, 'nav.channelManagement').trigger('click')
    await flushPromises()
    expect(channelChildren().classes()).not.toContain('sidebar-children--collapsed')
    expect(channelChildren().attributes('inert')).toBeUndefined()

    // 订单管理：展开后进入子页
    await groupButton(wrapper, 'nav.orderManagement').trigger('click')
    await flushPromises()
    const plans = wrapper.findAll('a').find((a) => a.text().includes('nav.paymentPlans'))
    expect(plans).toBeTruthy()
    await plans!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/admin/orders/plans')
  })

  it('keeps collapsed groups in the DOM and makes their links inert', async () => {
    const { wrapper } = await mountSidebar()
    const collapsed = wrapper.findAll('.sidebar-children.sidebar-children--collapsed')
    expect(collapsed.length).toBeGreaterThan(0)
    for (const group of collapsed) {
      expect(group.attributes('inert')).toBeDefined()
      expect(group.attributes('aria-hidden')).toBe('true')
    }
  })

  it('keeps the complete label and hover title on links and group buttons', async () => {
    const { wrapper } = await mountSidebar()
    const group = groupButton(wrapper, 'nav.channelManagement')
    expect(group.attributes('title')).toBe('nav.channelManagement')
    expect(group.attributes('aria-expanded')).toBe('false')
    await group.trigger('click')
    expect(group.attributes('aria-expanded')).toBe('true')
    for (const [path, label] of [
      ['/admin/dashboard', 'nav.dashboard'],
      ['/admin/channels/pricing', 'nav.channelPricing'],
      ['/keys', 'nav.apiKeys'],
    ]) {
      const link = wrapper.get(`.sidebar-nav a[href="${path}"]`)
      expect(link.attributes('title')).toBe(label)
      expect(link.text()).toBe(label)
    }
    wrapper.unmount()
  })

  it('keeps group clicks inert while the sidebar is an icon rail', async () => {
    const { wrapper } = await mountSidebar()
    setViewport('tablet')
    await flushPromises()
    expect(wrapper.find('.sidebar--rail').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('nav.channelPricing')
  })
})
