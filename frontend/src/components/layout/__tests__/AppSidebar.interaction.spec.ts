import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { h, reactive, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory, isNavigationFailure, NavigationFailureType, useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'

const viewport = { isPhone: ref(false), isTablet: ref(false), isDesktop: ref(true) }
let appStore: ReturnType<typeof useAppStore>
const authStore = reactive({ isAdmin: true, isSimpleMode: false, user: { role: 'admin' } })
const adminSettingsStore = reactive({ opsMonitoringEnabled: true, paymentEnabled: true, customMenuItems: [], fetch: vi.fn() })
const onboardingStore = reactive({ isCurrentStep: () => false, nextStep: vi.fn() })

vi.mock('@/stores', () => ({
  useAppStore: () => appStore,
  useAuthStore: () => authStore,
  useAdminSettingsStore: () => adminSettingsStore,
  useOnboardingStore: () => onboardingStore
}))
vi.mock('@/stores/adminSettings', () => ({ useAdminSettingsStore: () => adminSettingsStore }))
vi.mock('@/composables/useConsoleViewport', () => ({ useConsoleViewport: () => viewport }))
vi.mock('@/composables/useBatchImageAccess', () => ({
  useBatchImageAccess: () => ({ canUseBatchImage: ref(false), refreshBatchImageAccess: vi.fn() })
}))
vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

import AppSidebar from '../AppSidebar.vue'
import AppHeader from '../AppHeader.vue'

enableAutoUnmount(afterEach)

beforeEach(() => {
  setActivePinia(createPinia())
  appStore = useAppStore()
  appStore.siteName = '211API'
  appStore.publicSettingsLoaded = true
})

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
    await vi.waitFor(() => expect(appStore.mobileOpen).toBe(false))
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

describe('phone drawer focus', () => {
  const nativeInert = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'inert')

  beforeEach(() => {
    setViewport('phone')
    // jsdom lacks native inert; reflect the DOM property for the native-path assertions.
    Object.defineProperty(HTMLElement.prototype, 'inert', {
      configurable: true,
      get(this: HTMLElement) { return this.hasAttribute('inert') },
      set(this: HTMLElement, value: boolean) { this.toggleAttribute('inert', value) }
    })
  })

  afterEach(() => {
    if (nativeInert) Object.defineProperty(HTMLElement.prototype, 'inert', nativeInert)
    else Reflect.deleteProperty(HTMLElement.prototype, 'inert')
  })

  async function mountPhoneShell() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
    })
    await router.push('/admin/dashboard')
    const wrapper = mount({
      setup() {
        const route = useRoute()
        // Console pages remount the shell when navigating between routes.
        return () => h('div', { key: route.path }, [h(AppSidebar), h(AppHeader)])
      }
    }, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: { VersionBadge: true, Icon: true, AnnouncementBell: true, LocaleSwitcher: true, SubscriptionProgressMini: true }
      }
    })
    return { wrapper, router }
  }

  it.each(['.sidebar-close', '.sidebar-backdrop', '.sidebar-footer button', '.console-topbar__menu'])(
    'returns focus to the phone menu after closing with %s',
    async (closeSelector) => {
      const { wrapper } = await mountPhoneShell()
      const drawer = wrapper.get('aside.sidebar')
      const menu = wrapper.get('.console-topbar__menu')
      expect(drawer.attributes('inert')).toBeDefined()
      expect(drawer.attributes('aria-hidden')).toBe('true')
      expect(document.activeElement).toBe(document.body)

      await menu.trigger('click')
      expect(drawer.attributes('inert')).toBeUndefined()
      expect(drawer.attributes('aria-hidden')).toBeUndefined()
      expect(document.activeElement).toBe(drawer.element)

      await wrapper.get(closeSelector).trigger('click')
      expect(drawer.attributes('inert')).toBeDefined()
      expect(document.activeElement).toBe(menu.element)
    }
  )

  it.each([false, true])('returns focus to the remounted menu (closed during navigation: %s)', async (closeDuringNavigation) => {
    const { wrapper, router } = await mountPhoneShell()
    const oldMenu = wrapper.get('.console-topbar__menu')
    await oldMenu.trigger('click')

    let finishNavigation!: () => void
    const pending = new Promise<void>((resolve) => { finishNavigation = resolve })
    router.beforeEach(() => pending)
    await wrapper.get('.sidebar-nav a[href="/keys"]').trigger('click')
    expect(appStore.mobileOpen).toBe(true)
    if (closeDuringNavigation) {
      await wrapper.get('.sidebar-close').trigger('click')
      expect(appStore.mobileOpen).toBe(false)
      expect(router.currentRoute.value.path).toBe('/admin/dashboard')
      expect(document.activeElement).toBe(oldMenu.element)
    }
    finishNavigation()
    await flushPromises()

    const newMenu = wrapper.get('.console-topbar__menu')
    expect(router.currentRoute.value.path).toBe('/keys')
    expect(newMenu.element).not.toBe(oldMenu.element)
    expect(oldMenu.element.isConnected).toBe(false)
    expect(wrapper.get('aside.sidebar').attributes('inert')).toBeDefined()
    expect(document.activeElement).toBe(newMenu.element)
  })

  it.each([true, false])('keeps a reopened drawer independent of the old navigation (superseded: %s)', async (superseded) => {
    const { wrapper, router } = await mountPhoneShell()
    let releaseKeys!: () => void
    const keysPending = new Promise<void>((resolve) => { releaseKeys = resolve })
    const keysStarted = vi.fn()
    const keysFinished = vi.fn()
    router.beforeEach((to) => {
      if (to.path !== '/keys') return
      keysStarted()
      return keysPending
    })
    router.afterEach((to, _, failure) => {
      if (to.path === '/keys') keysFinished(failure)
    })

    const firstMenu = wrapper.get('.console-topbar__menu')
    await firstMenu.trigger('click')
    await wrapper.get('.sidebar-nav a[href="/keys"]').trigger('click')
    await flushPromises()
    expect(keysStarted).toHaveBeenCalledOnce()
    if (superseded) {
      await wrapper.get('.sidebar-nav a[href="/usage"]').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.path).toBe('/usage')
    } else {
      await wrapper.get('.sidebar-close').trigger('click')
      expect(router.currentRoute.value.path).toBe('/admin/dashboard')
    }

    const menu = wrapper.get('.console-topbar__menu')
    expect(document.activeElement).toBe(menu.element)
    await menu.trigger('click')
    const logo = wrapper.get<HTMLAnchorElement>('.sidebar-logo').element
    logo.focus()
    const previousFocusRequest = appStore.mobileMenuFocusRequest
    releaseKeys()
    await flushPromises()

    expect(keysFinished).toHaveBeenCalledOnce()
    expect(router.currentRoute.value.path).toBe(superseded ? '/usage' : '/keys')
    expect(wrapper.get('.console-topbar__menu').attributes('aria-expanded')).toBe('true')
    expect(appStore.mobileMenuFocusRequest).toBe(previousFocusRequest)
    if (superseded) {
      expect(isNavigationFailure(keysFinished.mock.calls[0][0], NavigationFailureType.cancelled)).toBe(true)
      expect(document.activeElement).toBe(logo)
    } else {
      expect(logo.isConnected).toBe(false)
      expect(keysFinished).toHaveBeenCalledWith(undefined)
      const newLogo = wrapper.get('.sidebar-logo').element
      expect(newLogo).not.toBe(logo)
      expect(document.activeElement).toBe(newLogo)
    }
  })

  it.each([
    ['.sidebar-logo', '.sidebar-logo'],
    ['.sidebar-close', '.sidebar-close'],
    ['.sidebar-nav a[href="/usage"]', '.sidebar-nav a[href="/usage"]'],
    ['.sidebar-footer button', '.sidebar-footer button'],
    ['.console-topbar button:not(.console-topbar__menu)', '.sidebar-logo'],
    ['aside.sidebar', '.sidebar-logo']
  ])('hands focus on %s to %s in the remounted open drawer', async (focusedSelector, expectedSelector) => {
    const { wrapper, router } = await mountPhoneShell()
    await wrapper.get('.console-topbar__menu').trigger('click')
    const focused = wrapper.get<HTMLElement>(focusedSelector).element
    focused.focus()
    expect(document.activeElement).toBe(focused)

    await router.push('/keys')
    await flushPromises()

    expect(focused.isConnected).toBe(false)
    expect(appStore.mobileOpen).toBe(true)
    const expected = wrapper.get(expectedSelector).element
    expect(expected).not.toBe(focused)
    expect(document.activeElement).toBe(expected)
  })

  it('focuses the remounted drawer itself when it has no focusable control', async () => {
    const { wrapper, router } = await mountPhoneShell()
    await wrapper.get('.console-topbar__menu').trigger('click')
    wrapper.get<HTMLElement>('.sidebar-close').element.focus()
    // Simulate a drawer whose controls are all unavailable so only the container can take focus.
    const noControls = vi.spyOn(Element.prototype, 'querySelectorAll').mockImplementation(
      () => document.createDocumentFragment().querySelectorAll('*')
    )

    try {
      await router.push('/keys')
      await flushPromises()
    } finally {
      noControls.mockRestore()
    }

    expect(document.activeElement).toBe(wrapper.get('aside.sidebar').element)
  })

  it('leaves focus alone when the new page already focused a control', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
    })
    await router.push('/admin/dashboard')
    const wrapper = mount({
      setup() {
        const route = useRoute()
        return () => h('div', { key: route.path }, [
          h(AppSidebar),
          h(AppHeader),
          route.path === '/keys' ? h('input', { class: 'page-autofocus', onVnodeMounted: ({ el }: { el: HTMLInputElement }) => el.focus() }) : null
        ])
      }
    }, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: { VersionBadge: true, Icon: true, AnnouncementBell: true, LocaleSwitcher: true, SubscriptionProgressMini: true }
      }
    })
    await wrapper.get('.console-topbar__menu').trigger('click')
    wrapper.get<HTMLElement>('.sidebar-logo').element.focus()

    await router.push('/keys')
    await flushPromises()

    expect(document.activeElement).toBe(wrapper.get('.page-autofocus').element)
  })

  it('does not move focus into a drawer that was closed when the shell remounted', async () => {
    const { wrapper, router } = await mountPhoneShell()
    const menu = wrapper.get<HTMLElement>('.console-topbar__menu').element
    menu.focus()

    await router.push('/keys')
    await flushPromises()

    expect(appStore.mobileOpen).toBe(false)
    expect(wrapper.get('aside.sidebar').element.contains(document.activeElement)).toBe(false)
    expect(document.activeElement).toBe(document.body)
  })

  it('lets a newer pending drawer navigation return focus after the older one settles', async () => {
    const { wrapper, router } = await mountPhoneShell()
    let releaseKeys!: () => void
    let releaseUsage!: () => void
    const keysPending = new Promise<void>((resolve) => { releaseKeys = resolve })
    const usagePending = new Promise<void>((resolve) => { releaseUsage = resolve })
    router.beforeEach((to) => to.path === '/keys' ? keysPending : usagePending)

    await wrapper.get('.console-topbar__menu').trigger('click')
    await wrapper.get('.sidebar-nav a[href="/keys"]').trigger('click')
    await flushPromises()
    await wrapper.get('.sidebar-nav a[href="/usage"]').trigger('click')
    await flushPromises()
    releaseKeys()
    await flushPromises()
    expect(appStore.mobileOpen).toBe(true)
    releaseUsage()
    await flushPromises()

    const menu = wrapper.get('.console-topbar__menu')
    expect(router.currentRoute.value.path).toBe('/usage')
    expect(menu.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(menu.element)
  })

  it('hides the whole closed phone drawer when native inert is unavailable', async () => {
    Reflect.deleteProperty(HTMLElement.prototype, 'inert')
    const { wrapper } = await mountPhoneShell()
    const drawer = wrapper.get<HTMLElement>('aside.sidebar')
    const menu = wrapper.get('.console-topbar__menu')
    expect(drawer.element.style.display).toBe('none')
    expect(drawer.attributes('aria-hidden')).toBe('true')
    expect(drawer.attributes('inert')).toBeUndefined()

    const focusDrawer = drawer.element.focus.bind(drawer.element)
    vi.spyOn(drawer.element, 'focus').mockImplementation((options) => {
      expect(drawer.element.style.display).not.toBe('none')
      focusDrawer(options)
    })
    await menu.trigger('click')
    expect(drawer.element.style.display).toBe('')
    expect(drawer.attributes('aria-hidden')).toBeUndefined()
    expect(document.activeElement).toBe(drawer.element)

    await wrapper.get('.sidebar-close').trigger('click')
    expect(drawer.element.style.display).toBe('none')
    expect(document.activeElement).toBe(menu.element)
  })

  it.each(['tablet', 'desktop'] as const)('leaves focus on the page when switching to %s', async (viewportKind) => {
    const { wrapper } = await mountPhoneShell()
    await wrapper.get('.console-topbar__menu').trigger('click')
    const pageButton = wrapper.get<HTMLButtonElement>('.console-topbar button:not(.console-topbar__menu)')
    pageButton.element.focus()

    setViewport(viewportKind)
    appStore.mobileOpen = false
    await flushPromises()
    expect(wrapper.find('.console-topbar__menu').exists()).toBe(false)
    expect(wrapper.get('aside.sidebar').attributes('inert')).toBeUndefined()
    expect(document.activeElement).toBe(pageButton.element)
  })
})
