import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import {
  parsePreference,
  resolveDark,
  THEME_STORAGE_KEY,
  THEME_TRANSITION_CLASS,
  useBrandTheme
} from '../composables/useBrandTheme'

type Listener = (event: MediaQueryListEvent) => void

/** Minimal controllable matchMedia: `system.dark` drives prefers-color-scheme. */
function installMatchMedia(initial: { dark: boolean; reduced?: boolean }) {
  const system = { dark: initial.dark, reduced: initial.reduced ?? false }
  const listeners = new Set<Listener>()
  const darkQuery = {
    get matches() {
      return system.dark
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, fn: Listener) => listeners.add(fn),
    removeEventListener: (_: string, fn: Listener) => listeners.delete(fn)
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) =>
      query.includes('prefers-color-scheme')
        ? darkQuery
        : { matches: system.reduced, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }
    )
  )
  return {
    setSystemDark(dark: boolean) {
      system.dark = dark
      listeners.forEach((fn) => fn({ matches: dark } as MediaQueryListEvent))
    },
    listenerCount: () => listeners.size
  }
}

function mountTheme(root = ref<HTMLElement | null>(null)) {
  const scope = effectScope()
  const theme = scope.run(() => useBrandTheme(root))!
  return { theme, stop: () => scope.stop() }
}

const html = () => document.documentElement

describe('useBrandTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    html().classList.remove('dark')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    localStorage.clear()
    html().classList.remove('dark')
  })

  it('parses the shared upstream storage values', () => {
    expect(parsePreference('dark')).toBe('dark')
    expect(parsePreference('light')).toBe('light')
    expect(parsePreference(null)).toBe('system')
    expect(parsePreference('auto')).toBe('system')
    expect(resolveDark('system', true)).toBe(true)
    expect(resolveDark('system', false)).toBe(false)
    expect(resolveDark('light', true)).toBe(false)
    expect(resolveDark('dark', false)).toBe(true)
  })

  it('follows the system by default', () => {
    installMatchMedia({ dark: true })
    const { theme, stop } = mountTheme()
    expect(theme.preference.value).toBe('system')
    expect(theme.isDark.value).toBe(true)
    expect(html().classList.contains('dark')).toBe(true)
    stop()
  })

  it('tracks system changes live while following the system', () => {
    const media = installMatchMedia({ dark: false })
    const { theme, stop } = mountTheme()
    expect(html().classList.contains('dark')).toBe(false)

    media.setSystemDark(true)
    expect(theme.isDark.value).toBe(true)
    expect(html().classList.contains('dark')).toBe(true)

    media.setSystemDark(false)
    expect(html().classList.contains('dark')).toBe(false)
    stop()
    expect(media.listenerCount()).toBe(0)
  })

  it('tracks system changes on legacy Safari that only has addListener', () => {
    const system = { dark: false }
    const listeners = new Set<Listener>()
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        get matches() {
          return query.includes('prefers-color-scheme') ? system.dark : false
        },
        media: query,
        addListener: (fn: Listener) => query.includes('prefers-color-scheme') && listeners.add(fn),
        removeListener: (fn: Listener) => listeners.delete(fn)
      }))
    )
    const { theme, stop } = mountTheme()
    expect(theme.isDark.value).toBe(false)
    system.dark = true
    listeners.forEach((fn) => fn({ matches: true } as MediaQueryListEvent))
    expect(theme.isDark.value).toBe(true)
    stop()
    expect(listeners.size).toBe(0)
  })

  it('persists a manual choice under the shared `theme` key and ignores the system', () => {
    const media = installMatchMedia({ dark: false })
    const { theme, stop } = mountTheme()

    theme.setPreference('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(html().classList.contains('dark')).toBe(true)

    media.setSystemDark(false)
    expect(html().classList.contains('dark')).toBe(true)

    theme.setPreference('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    media.setSystemDark(true)
    expect(html().classList.contains('dark')).toBe(false)
    stop()
  })

  it('restores the stored manual choice on load', () => {
    installMatchMedia({ dark: true })
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    const { theme, stop } = mountTheme()
    expect(theme.preference.value).toBe('light')
    expect(html().classList.contains('dark')).toBe(false)
    stop()
  })

  it('clears the manual value when switching back to the system', () => {
    installMatchMedia({ dark: true })
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    const { theme, stop } = mountTheme()

    theme.setPreference('system')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    expect(theme.isDark.value).toBe(true)
    expect(html().classList.contains('dark')).toBe(true)
    stop()
  })

  it('picks up a choice made in another tab', () => {
    installMatchMedia({ dark: false })
    const { theme, stop } = mountTheme()
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: 'dark' }))
    expect(theme.preference.value).toBe('dark')
    expect(html().classList.contains('dark')).toBe(true)
    stop()
  })

  it('cross-fades on change, but not under reduced motion', () => {
    vi.useFakeTimers()
    installMatchMedia({ dark: false })
    const root = ref<HTMLElement | null>(document.createElement('div'))
    const { theme, stop } = mountTheme(root)
    theme.setPreference('dark')
    expect(root.value!.classList.contains(THEME_TRANSITION_CLASS)).toBe(true)
    vi.advanceTimersByTime(300)
    expect(root.value!.classList.contains(THEME_TRANSITION_CLASS)).toBe(false)
    stop()

    installMatchMedia({ dark: false, reduced: true })
    const reduced = mountTheme(root)
    reduced.theme.setPreference('light')
    expect(root.value!.classList.contains(THEME_TRANSITION_CLASS)).toBe(false)
    reduced.stop()
  })

  it('keeps working when storage is blocked', () => {
    installMatchMedia({ dark: false })
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { theme, stop } = mountTheme()
    expect(theme.preference.value).toBe('system')
    theme.setPreference('dark')
    expect(html().classList.contains('dark')).toBe(true)
    stop()
    getItem.mockRestore()
    setItem.mockRestore()
  })
})
