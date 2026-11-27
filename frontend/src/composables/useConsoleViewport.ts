import { computed, onBeforeUnmount, ref } from 'vue'

/**
 * Console shell breakpoints (DESIGN.md · Console; Figma「211API · Console v3」C13–C15):
 * - phone   (< 768):  night app bar + 304px drawer
 * - tablet  (768–1279): 72px icon rail, the expand button opens the full sidebar as an overlay
 * - desktop (≥ 1280): 184px (Simplified Chinese) or 236px sidebar, collapsible to the rail
 *
 * Kept in sync with Tailwind's `md` (768) and `xl` (1280) so templates can mirror it in CSS.
 */
export const CONSOLE_TABLET_MIN = 768
export const CONSOLE_DESKTOP_MIN = 1280

export type ConsoleViewport = 'phone' | 'tablet' | 'desktop'

export function resolveConsoleViewport(width: number): ConsoleViewport {
  if (width >= CONSOLE_DESKTOP_MIN) return 'desktop'
  if (width >= CONSOLE_TABLET_MIN) return 'tablet'
  return 'phone'
}

export function useConsoleViewport() {
  const read = () => (typeof window === 'undefined' ? CONSOLE_DESKTOP_MIN : window.innerWidth)
  const viewport = ref<ConsoleViewport>(resolveConsoleViewport(read()))

  let tablet: MediaQueryList | null = null
  let desktop: MediaQueryList | null = null
  const update = () => {
    viewport.value = resolveConsoleViewport(read())
  }

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    tablet = window.matchMedia(`(min-width: ${CONSOLE_TABLET_MIN}px)`)
    desktop = window.matchMedia(`(min-width: ${CONSOLE_DESKTOP_MIN}px)`)
    tablet.addEventListener?.('change', update)
    desktop.addEventListener?.('change', update)
  }

  onBeforeUnmount(() => {
    tablet?.removeEventListener?.('change', update)
    desktop?.removeEventListener?.('change', update)
  })

  return {
    viewport,
    isPhone: computed(() => viewport.value === 'phone'),
    isTablet: computed(() => viewport.value === 'tablet'),
    isDesktop: computed(() => viewport.value === 'desktop')
  }
}

/**
 * 桌面侧栏的实测宽度（AppSidebar 用 ResizeObserver 写入，AppLayout 读来定主内容区的左边距）。
 * 桌面收起或展开时逐帧跟随。没量到时（首帧、jsdom）回退到 248 / 72。
 */
export const consoleSidebarWidth = ref<number | null>(null)

export const CONSOLE_SIDEBAR_FALLBACK = { full: 248, rail: 72 } as const

export function resolveConsoleMainOffset(options: {
  viewport: ConsoleViewport
  collapsed: boolean
  measured: number | null
}): number {
  if (options.viewport === 'phone') return 0
  if (options.viewport === 'tablet') return CONSOLE_SIDEBAR_FALLBACK.rail
  if (options.measured != null && options.measured > 0) return options.measured
  return options.collapsed ? CONSOLE_SIDEBAR_FALLBACK.rail : CONSOLE_SIDEBAR_FALLBACK.full
}
