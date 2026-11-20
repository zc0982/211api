import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import type { ModelPlazaResponse } from '@/api/modelPlaza'

const { appStore, authStore, getModelPlaza } = vi.hoisted(() => ({
  appStore: {
    cachedPublicSettings: {} as Record<string, unknown>,
    publicSettingsLoaded: true,
    fetchPublicSettings: vi.fn()
  },
  authStore: {
    isAuthenticated: false,
    isAdmin: false,
    checkAuth: vi.fn()
  },
  getModelPlaza: vi.fn()
}))

vi.mock('@/stores', () => ({
  useAppStore: () => appStore,
  useAuthStore: () => authStore
}))

vi.mock('@/api/modelPlaza', () => ({ getModelPlaza }))

vi.mock('@/i18n', () => ({ setLocale: vi.fn() }))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key, locale: { value: 'zh' } })
  }
})

import BrandHome from '../BrandHome.vue'
import { resetModelPlazaCache } from '../composables/useModelPlazaCards'

const perM = (usd: number) => usd / 1_000_000

const PLAZA: ModelPlazaResponse = {
  description: '',
  groups: [
    {
      id: 1,
      name: 'claude',
      description: '',
      platform: 'anthropic',
      subscription_type: 'standard',
      rate_multiplier: 1,
      peak_rate_enabled: false,
      peak_start: '',
      peak_end: '',
      peak_rate_multiplier: 1,
      is_exclusive: false,
      image_rate_independent: false,
      image_rate_multiplier: 1,
      video_rate_independent: false,
      video_rate_multiplier: 1,
      long_context_pricing_enabled: false,
      models: [
        {
          name: 'claude-test',
          platform: 'anthropic',
          pricing: {
            billing_mode: 'token',
            input_price: perM(3),
            output_price: perM(15),
            cache_write_price: null,
            cache_read_price: null,
            image_input_price: null,
            image_output_price: null,
            per_request_price: null,
            intervals: []
          },
          official_pricing: { input_price: perM(3), output_price: perM(15), cache_write_price: null, cache_read_price: null }
        }
      ]
    }
  ]
}

const BASE_SETTINGS = {
  site_name: 'Test Site',
  registration_enabled: true,
  model_plaza_enabled: true,
  model_plaza_require_auth: false,
  doc_url: 'https://docs.example.com',
  contact_info: '',
  api_base_url: 'https://api.example.com/'
}

function mountHome(settings: Record<string, unknown> = {}) {
  appStore.cachedPublicSettings = { ...BASE_SETTINGS, ...settings }
  return mount(BrandHome, {
    attachTo: document.body,
    global: {
      stubs: {
        RouterLink: RouterLinkStub,
        'i18n-t': { template: '<span><slot name="emphasis" /></span>' }
      }
    }
  })
}

function routeTargets(wrapper: ReturnType<typeof mountHome>, selector: string): string[] {
  return wrapper.find(selector).findAllComponents(RouterLinkStub).map((link) => String(link.props('to')))
}

describe('BrandHome', () => {
  beforeEach(() => {
    authStore.isAuthenticated = false
    authStore.isAdmin = false
    getModelPlaza.mockReset()
    getModelPlaza.mockResolvedValue(PLAZA)
    resetModelPlazaCache()
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as unknown as MediaQueryList)
  })

  it('header logo follows the admin-uploaded site_logo', () => {
    const wrapper = mountHome({ site_logo: 'data:image/png;base64,AAAA' })
    const img = wrapper.find('.bh-header__brand img.bh-logo__img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('data:image/png;base64,AAAA')
    expect(wrapper.find('.bh-header__brand svg.bh-logo__mark').exists()).toBe(false)
    wrapper.unmount()
  })

  it('header logo falls back to the built-in mark when site_logo is empty or unsafe', () => {
    for (const site_logo of ['', 'javascript:alert(1)']) {
      const wrapper = mountHome({ site_logo })
      expect(wrapper.find('.bh-header__brand img').exists()).toBe(false)
      expect(wrapper.find('.bh-header__brand svg.bh-logo__mark').exists()).toBe(true)
      wrapper.unmount()
    }
  })

  it('header logo falls back to the built-in mark when the uploaded image fails to load', async () => {
    const wrapper = mountHome({ site_logo: '/broken.png' })
    await wrapper.find('.bh-header__brand img').trigger('error')
    expect(wrapper.find('.bh-header__brand img').exists()).toBe(false)
    expect(wrapper.find('.bh-header__brand svg.bh-logo__mark').exists()).toBe(true)
    wrapper.unmount()
  })

  it('anonymous visitor: CTAs go to /register and the header offers log in', () => {
    const wrapper = mountHome()
    expect(routeTargets(wrapper, '.bh-hero__ctas')).toEqual(['/register'])
    expect(routeTargets(wrapper, '.bh-header__actions')).toEqual(['/login', '/register'])
    expect(routeTargets(wrapper, '.bh-footer__links')).toEqual(['/register', '/model-plaza', '/keys', '/login'])
    wrapper.unmount()
  })

  it('registration closed: CTAs go to /login and the footer hides sign-up', () => {
    const wrapper = mountHome({ registration_enabled: false })
    expect(routeTargets(wrapper, '.bh-hero__ctas')).toEqual(['/login'])
    expect(routeTargets(wrapper, '.bh-footer__links')).toEqual(['/model-plaza', '/keys', '/login'])
    wrapper.unmount()
  })

  it('signed-in user: CTA → /keys, console → /dashboard', () => {
    authStore.isAuthenticated = true
    const wrapper = mountHome()
    expect(routeTargets(wrapper, '.bh-hero__ctas')).toEqual(['/keys'])
    expect(routeTargets(wrapper, '.bh-header__actions')).toEqual(['/dashboard', '/keys'])
    wrapper.unmount()
  })

  it('admin: console → /admin/dashboard', () => {
    authStore.isAuthenticated = true
    authStore.isAdmin = true
    const wrapper = mountHome()
    expect(routeTargets(wrapper, '.bh-header__actions')).toEqual(['/admin/dashboard', '/keys'])
    expect(routeTargets(wrapper, '.bh-footer__links')).toContain('/admin/dashboard')
    wrapper.unmount()
  })

  it('does not render operational stats while liveStats is off', () => {
    const wrapper = mountHome()
    expect(wrapper.find('.bh-status').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('brandHome.status.allOperational')
    expect(wrapper.text()).not.toContain('99.98')
    wrapper.unmount()
  })

  it('uses the normalised runtime base_url in code samples and the FAQ', () => {
    const wrapper = mountHome()
    expect(wrapper.find('.bh-qs__url').text()).toBe('https://api.example.com/v1')
    expect(wrapper.find('.bh-code-card').text()).toContain('"https://api.example.com/v1"')
    wrapper.unmount()
  })

  it('hides docs links when doc_url is not a safe URL', () => {
    const wrapper = mountHome({ doc_url: 'javascript:alert(1)' })
    expect(wrapper.findAll('a[href^="javascript"]').length).toBe(0)
    expect(wrapper.find('.bh-hero__ctas').text()).not.toContain('brandHome.hero.ctaDocs')
    wrapper.unmount()
  })

  it('renders contact info as text, never as HTML', async () => {
    const wrapper = mountHome({ contact_info: '<img src=x onerror=alert(1)>' })
    const contactButton = wrapper.findAll('.bh-faq__actions button').at(-1)!
    await contactButton.trigger('click')
    expect(wrapper.find('#bh-faq-contact img').exists()).toBe(false)
    expect(wrapper.find('#bh-faq-contact').text()).toContain('<img src=x onerror=alert(1)>')
    wrapper.unmount()
  })

  it('never toggles the html.dark class', () => {
    document.documentElement.classList.add('dark')
    const wrapper = mountHome()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    wrapper.unmount()
    document.documentElement.classList.remove('dark')
  })
})

class ImmediateIntersectionObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe() {
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
  disconnect() {}
  unobserve() {}
}

describe('BrandHome model cards', () => {
  const NeverIntersecting = globalThis.IntersectionObserver

  beforeEach(() => {
    authStore.isAuthenticated = false
    authStore.isAdmin = false
    getModelPlaza.mockReset()
    resetModelPlazaCache()
    globalThis.IntersectionObserver = ImmediateIntersectionObserver as unknown as typeof IntersectionObserver
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as unknown as MediaQueryList)
  })

  afterEach(() => {
    globalThis.IntersectionObserver = NeverIntersecting
  })

  it('waits until the section nears the viewport before requesting', async () => {
    globalThis.IntersectionObserver = NeverIntersecting
    getModelPlaza.mockResolvedValue(PLAZA)
    const wrapper = mountHome()
    await flushPromises()
    expect(getModelPlaza).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('requests the plaza when visible and shows "from" prices per 1M tokens', async () => {
    getModelPlaza.mockResolvedValue(PLAZA)
    const wrapper = mountHome()
    await flushPromises()
    expect(getModelPlaza).toHaveBeenCalledTimes(1)
    const card = wrapper.find('.bh-plaza__card')
    expect(card.text()).toContain('claude-test')
    expect(card.findAll('dd').map((d) => d.text())).toEqual(['brandHome.plaza.priceFrom', 'brandHome.plaza.priceFrom'])
    wrapper.unmount()
  })

  it('caches the plaza response for the page session', async () => {
    getModelPlaza.mockResolvedValue(PLAZA)
    const first = mountHome()
    await flushPromises()
    first.unmount()
    const second = mountHome()
    await flushPromises()
    expect(getModelPlaza).toHaveBeenCalledTimes(1)
    expect(second.findAll('.bh-plaza__card').length).toBe(1)
    second.unmount()
  })

  it.each([
    ['plaza disabled', { model_plaza_enabled: false }, false],
    ['login required, anonymous', { model_plaza_require_auth: true }, false]
  ])('does not request when %s', async (_label, settings, _auth) => {
    getModelPlaza.mockResolvedValue(PLAZA)
    const wrapper = mountHome(settings)
    await flushPromises()
    expect(getModelPlaza).not.toHaveBeenCalled()
    expect(wrapper.findAll('.bh-plaza__card').length).toBe(0)
    expect(wrapper.find('.bh-plaza__all').exists()).toBe(false)
    wrapper.unmount()
  })

  it('requests when login is required and the visitor is signed in', async () => {
    authStore.isAuthenticated = true
    getModelPlaza.mockResolvedValue(PLAZA)
    const wrapper = mountHome({ model_plaza_require_auth: true })
    await flushPromises()
    expect(getModelPlaza).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('.bh-plaza__card').length).toBe(1)
    wrapper.unmount()
  })

  it.each([
    ['404', { status: 404, message: 'not found' }],
    ['401', { status: 401, message: 'unauthorized' }],
    ['network error', { status: 0, code: 'ERR_NETWORK' }]
  ])('hides the cards silently on %s', async (_label, error) => {
    getModelPlaza.mockRejectedValue(error)
    const wrapper = mountHome()
    await flushPromises()
    expect(getModelPlaza).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('.bh-plaza__card').length).toBe(0)
    expect(wrapper.find('.bh-plaza__toolbar').exists()).toBe(false)
    expect(wrapper.find('#bh-plaza-title').exists()).toBe(true)
    wrapper.unmount()
  })
})
