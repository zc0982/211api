import { describe, expect, it } from 'vitest'
import { resolveHomeVariant } from '../composables/homeVariant'
import { resolveContact, resolveHomeLinks } from '../composables/homeLinks'
import { normalizeApiBaseUrl } from '../composables/baseUrl'

describe('resolveHomeVariant', () => {
  it('uses the upstream home when admin home_content is set', () => {
    expect(resolveHomeVariant({ home_content: '<h1>custom</h1>', compact_home_enabled: false }, {})).toBe('upstream')
  })

  it('ignores whitespace-only home_content', () => {
    expect(resolveHomeVariant({ home_content: '  \n\t ' }, {})).toBe('brand')
  })

  it('uses the upstream home when compact home is enabled', () => {
    expect(resolveHomeVariant({ home_content: '', compact_home_enabled: true }, {})).toBe('upstream')
  })

  it('honours the build-time emergency switch', () => {
    expect(resolveHomeVariant({ home_content: '' }, { VITE_BRAND_HOME: 'off' })).toBe('upstream')
  })

  it('defaults to the brand home, including unknown settings', () => {
    expect(resolveHomeVariant({ home_content: '', compact_home_enabled: false }, {})).toBe('brand')
    expect(resolveHomeVariant(null, {})).toBe('brand')
    expect(resolveHomeVariant(undefined, { VITE_BRAND_HOME: 'on' })).toBe('brand')
  })

  it('checks home_content before compact mode and the env switch', () => {
    expect(resolveHomeVariant({ home_content: 'x', compact_home_enabled: true }, { VITE_BRAND_HOME: 'off' })).toBe('upstream')
  })
})

describe('resolveHomeLinks', () => {
  const settings = {
    registration_enabled: true,
    model_plaza_enabled: true,
    model_plaza_require_auth: false,
    doc_url: 'https://docs.example.com/start',
    contact_info: ''
  }

  it('anonymous visitor: get key → /register, log in shown, no console', () => {
    const links = resolveHomeLinks(settings, { isAuthenticated: false, isAdmin: false })
    expect(links.getKey).toBe('/register')
    expect(links.console).toBeNull()
    expect(links.login).toBe('/login')
    expect(links.register).toBe('/register')
  })

  it('registration closed: get key → /login and no register link', () => {
    const links = resolveHomeLinks({ ...settings, registration_enabled: false }, { isAuthenticated: false, isAdmin: false })
    expect(links.getKey).toBe('/login')
    expect(links.register).toBeNull()
  })

  it('signed-in user: get key → /keys, console → /dashboard', () => {
    const links = resolveHomeLinks(settings, { isAuthenticated: true, isAdmin: false })
    expect(links.getKey).toBe('/keys')
    expect(links.console).toBe('/dashboard')
    expect(links.register).toBeNull()
  })

  it('admin: console → /admin/dashboard', () => {
    const links = resolveHomeLinks(settings, { isAuthenticated: true, isAdmin: true })
    expect(links.getKey).toBe('/keys')
    expect(links.console).toBe('/admin/dashboard')
  })

  it('model plaza link follows enabled + require_auth like HomeView', () => {
    const anon = { isAuthenticated: false, isAdmin: false }
    const user = { isAuthenticated: true, isAdmin: false }
    expect(resolveHomeLinks(settings, anon).modelPlaza).toBe('/model-plaza')
    expect(resolveHomeLinks({ ...settings, model_plaza_enabled: false }, user).modelPlaza).toBeNull()
    expect(resolveHomeLinks({ ...settings, model_plaza_require_auth: true }, anon).modelPlaza).toBeNull()
    expect(resolveHomeLinks({ ...settings, model_plaza_require_auth: true }, user).modelPlaza).toBe('/model-plaza')
    expect(resolveHomeLinks(null, anon).modelPlaza).toBeNull()
  })

  it('docs link only for a sanitised http(s) URL', () => {
    const anon = { isAuthenticated: false, isAdmin: false }
    expect(resolveHomeLinks(settings, anon).docs).toBe('https://docs.example.com/start')
    expect(resolveHomeLinks({ ...settings, doc_url: 'javascript:alert(1)' }, anon).docs).toBeNull()
    expect(resolveHomeLinks({ ...settings, doc_url: '' }, anon).docs).toBeNull()
  })

  it('usage links always point at /usage', () => {
    expect(resolveHomeLinks(settings, { isAuthenticated: false, isAdmin: false }).usage).toBe('/usage')
  })
})

describe('resolveContact', () => {
  it('returns null for empty contact info', () => {
    expect(resolveContact('  ')).toBeNull()
    expect(resolveContact(undefined)).toBeNull()
  })

  it('links http(s) URLs and e-mail addresses, keeps other text plain', () => {
    expect(resolveContact('https://t.me/support')).toEqual({ text: 'https://t.me/support', href: 'https://t.me/support' })
    expect(resolveContact('help@example.com')).toEqual({ text: 'help@example.com', href: 'mailto:help@example.com' })
    expect(resolveContact('微信：abc123')).toEqual({ text: '微信：abc123', href: null })
    expect(resolveContact('javascript:alert(1)')).toEqual({ text: 'javascript:alert(1)', href: null })
    expect(resolveContact('<img src=x onerror=alert(1)>')?.href).toBeNull()
  })
})

describe('normalizeApiBaseUrl', () => {
  const origin = 'https://gw.example.com'

  it('falls back to the page origin', () => {
    expect(normalizeApiBaseUrl('', origin)).toBe('https://gw.example.com/v1')
    expect(normalizeApiBaseUrl(null, origin)).toBe('https://gw.example.com/v1')
    expect(normalizeApiBaseUrl('   ', origin)).toBe('https://gw.example.com/v1')
  })

  it('strips trailing slashes and an existing /v1, then appends /v1', () => {
    expect(normalizeApiBaseUrl('https://api.example.com', origin)).toBe('https://api.example.com/v1')
    expect(normalizeApiBaseUrl('https://api.example.com/', origin)).toBe('https://api.example.com/v1')
    expect(normalizeApiBaseUrl('https://api.example.com/v1', origin)).toBe('https://api.example.com/v1')
    expect(normalizeApiBaseUrl('https://api.example.com/v1/', origin)).toBe('https://api.example.com/v1')
    expect(normalizeApiBaseUrl('https://api.example.com/proxy//', origin)).toBe('https://api.example.com/proxy/v1')
  })
})
