import { getCurrentScope, onScopeDispose, readonly, ref, type Ref } from 'vue'
import { onMediaChange } from './mediaQuery'

/**
 * 品牌首页主题：跟随系统 / 浅色 / 深色。
 *
 * 复用上游的主题状态，首页和控制台的选择互相同步：
 * - html 上的 `.dark` 类：上游 main.ts 在挂载前按同一规则写入（首次绘制前就确定主题），
 *   控制台的 AppSidebar 等组件也读写它；
 * - localStorage 键 `theme`：`'dark'` / `'light'` 表示手动选择，没有值表示跟随系统。
 *   上游只有浅 / 深两态，「跟随系统」就是「没有手动值」，所以选回跟随系统时删除这个键，
 *   不新增存储键，也不改上游文件。
 *
 * 跟随系统时监听 prefers-color-scheme 的 change 实时切换；其他标签页改了 `theme`
 * 时通过 storage 事件同步。
 */
export type ThemePreference = 'system' | 'light' | 'dark'

/** Shared with upstream main.ts / AppSidebar.vue / HomeView.vue. */
export const THEME_STORAGE_KEY = 'theme'
export const THEME_TRANSITION_CLASS = 'bh-theming'
const TRANSITION_MS = 250
const DARK_QUERY = '(prefers-color-scheme: dark)'
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function parsePreference(value: string | null | undefined): ThemePreference {
  return value === 'dark' || value === 'light' ? value : 'system'
}

export function readPreference(): ThemePreference {
  try {
    return parsePreference(storage()?.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

export function writePreference(preference: ThemePreference) {
  try {
    const store = storage()
    if (!store) return
    if (preference === 'system') store.removeItem(THEME_STORAGE_KEY)
    else store.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Private mode / blocked storage: the choice still applies for this page view.
  }
}

export function resolveDark(preference: ThemePreference, systemDark: boolean): boolean {
  return preference === 'dark' || (preference === 'system' && systemDark)
}

function matchMediaSafe(query: string): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null
}

export interface BrandTheme {
  preference: Readonly<Ref<ThemePreference>>
  isDark: Readonly<Ref<boolean>>
  setPreference: (preference: ThemePreference) => void
}

/**
 * @param root the .brand-home element; while it exists, a theme change adds
 *   `.bh-theming` for a moment so colours cross-fade (skipped under reduced motion).
 */
export function useBrandTheme(root?: Ref<HTMLElement | null | undefined>): BrandTheme {
  const darkQuery = matchMediaSafe(DARK_QUERY)
  const preference = ref<ThemePreference>(readPreference())
  const isDark = ref(false)
  let transitionTimer: ReturnType<typeof setTimeout> | null = null

  function crossFade() {
    const el = root?.value
    if (!el || matchMediaSafe(REDUCED_QUERY)?.matches) return
    el.classList.add(THEME_TRANSITION_CLASS)
    if (transitionTimer) clearTimeout(transitionTimer)
    transitionTimer = setTimeout(() => {
      el.classList.remove(THEME_TRANSITION_CLASS)
      transitionTimer = null
    }, TRANSITION_MS)
  }

  function apply(animate: boolean) {
    const next = resolveDark(preference.value, darkQuery?.matches === true)
    const changed = next !== document.documentElement.classList.contains('dark')
    if (changed && animate) crossFade()
    isDark.value = next
    document.documentElement.classList.toggle('dark', next)
  }

  function setPreference(next: ThemePreference) {
    preference.value = next
    writePreference(next)
    apply(true)
  }

  const onSystemChange = () => {
    if (preference.value === 'system') apply(true)
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return
    preference.value = parsePreference(event.key === null ? null : event.newValue)
    apply(true)
  }

  // The class is already set by upstream main.ts before mount; re-applying keeps
  // it right if the system theme changed while the user was in the console.
  apply(false)
  const stopSystem = darkQuery ? onMediaChange(darkQuery, onSystemChange) : null
  window.addEventListener('storage', onStorage)

  if (getCurrentScope()) {
    onScopeDispose(() => {
      stopSystem?.()
      window.removeEventListener('storage', onStorage)
      if (transitionTimer) clearTimeout(transitionTimer)
      root?.value?.classList.remove(THEME_TRANSITION_CLASS)
    })
  }

  return { preference: readonly(preference), isDark: readonly(isDark), setPreference }
}
