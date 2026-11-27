import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const componentPath = resolve(dirname(fileURLToPath(import.meta.url)), '../AppSidebar.vue')
const componentSource = readFileSync(componentPath, 'utf8')
const stylePath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../style.css')
const styleSource = readFileSync(stylePath, 'utf8')

describe('AppSidebar custom SVG styles', () => {
  it('does not override uploaded SVG fill or stroke colors', () => {
    expect(componentSource).toContain('.sidebar-svg-icon {')
    expect(componentSource).toContain('color: currentColor;')
    expect(componentSource).toContain('display: block;')
    expect(componentSource).not.toContain('stroke: currentColor;')
    expect(componentSource).not.toContain('fill: none;')
  })
})

describe('AppSidebar scroll position persistence', () => {
  it('binds a template ref to the sidebar nav element', () => {
    expect(componentSource).toContain('ref="sidebarNavRef"')
    expect(componentSource).toContain('sidebar-nav')
  })

  it('declares sidebarNavRef in script setup', () => {
    expect(componentSource).toContain("const sidebarNavRef = ref<HTMLElement | null>(null)")
  })

  it('saves scroll position on beforeUnmount', () => {
    expect(componentSource).toContain('onBeforeUnmount')
    expect(componentSource).toContain('appStore.sidebarScrollTop')
    expect(componentSource).toContain('sidebarNavRef.value.scrollTop')
  })

  it('restores scroll position on mount', () => {
    expect(componentSource).toContain('onMounted')
    expect(componentSource).toContain('appStore.sidebarScrollTop')
    expect(componentSource).toContain('nextTick')
  })
})

describe('AppSidebar collapsible groups', () => {
  it('lets the user collapse a group even while a child route is active', () => {
    // The expand state must come from the user's override first, falling back
    // to the active-route heuristic only when the user has not clicked yet.
    expect(componentSource).toContain('const groupExpandOverrides = ref<Map<string, boolean>>(new Map())')
    expect(componentSource).not.toContain('expandedGroups.value.has(item.path) || isGroupActive(item)')
  })
})

describe('AppSidebar header styles', () => {
  it('does not clip the version badge dropdown', () => {
    const sidebarHeaderBlockMatch = styleSource.match(/\.sidebar-header\s*\{[\s\S]*?\n {2}\}/)
    const sidebarBrandBlockMatch = componentSource.match(/\.sidebar-brand\s*\{[\s\S]*?\n\}/)

    expect(sidebarHeaderBlockMatch).not.toBeNull()
    expect(sidebarBrandBlockMatch).not.toBeNull()
    expect(sidebarHeaderBlockMatch?.[0]).not.toContain('@apply overflow-hidden;')
    expect(sidebarBrandBlockMatch?.[0]).not.toContain('overflow: hidden;')
  })
})

describe('AppSidebar subscription feature flag', () => {
  it('gates the My Subscriptions entry behind the subscription public-settings flag', () => {
    expect(componentSource).toContain('const flagSubscription = makeSidebarFlag(FeatureFlags.subscription)')
    expect(componentSource).toMatch(/path: '\/subscriptions'[^\n]*featureFlag: flagSubscription/)
  })

  it('also hides the admin Subscription Management entry on recharge-only sites', () => {
    expect(componentSource).toMatch(/path: '\/admin\/subscriptions'[^\n]*featureFlag: flagSubscription/)
  })

  it('derives the purchase entry label from the site billing mode', () => {
    expect(componentSource).toContain("import { resolveSiteBillingMode } from '@/utils/siteBillingMode'")
    expect(componentSource).toMatch(/case 'recharge_only':\s*return t\('nav\.recharge'\)/)
    expect(componentSource).toMatch(/case 'subscription_only':\s*return t\('nav\.subscribe'\)/)
    expect(componentSource).toMatch(/path: '\/purchase'[^\n]*label: purchaseNavLabel\.value/)
  })
})

describe('AppSidebar MCP entry', () => {
  it('uses the MCP logo and shows the entry only when the deployment enables MCP', () => {
    expect(componentSource).toContain("render: () => h(Icon, { name: 'mcp' })")
    expect(componentSource).toContain('const flagMCP = makeSidebarFlag(FeatureFlags.mcp)')
    expect(componentSource).toMatch(/path: '\/settings\/mcp'[^\n]*icon: MCPIcon, featureFlag: flagMCP/)
    expect(componentSource).toMatch(/if \(flagMCP\(\)\) filtered\.push\(\{ path: '\/settings\/mcp'[^\n]*icon: MCPIcon/)
    expect(componentSource).not.toMatch(/path: '\/settings\/mcp'[^\n]*PluginIcon/)
  })
})

describe('AppSidebar v3 night sidebar', () => {
  it('groups the user menu as 概览 / 调用 / 账户 / 设置 in that order', () => {
    expect(componentSource).toContain("const NAV_GROUP_ORDER: NavGroupKey[] = ['overview', 'calls', 'account', 'settings']")
    expect(componentSource).toMatch(/path: '\/dashboard'[^\n]*group: 'overview'/)
    expect(componentSource).toMatch(/path: '\/keys'[^\n]*group: 'calls'/)
    expect(componentSource).toMatch(/path: '\/purchase'[^\n]*group: 'account'/)
    expect(componentSource).toMatch(/path: '\/profile'[^\n]*group: 'settings'/)
  })

  it('marks the current item with a moon bar and blue glow, never gold', () => {
    const active = componentSource.match(/\.sidebar-link-active::before\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(active).toContain('background: #dbe6fb;')
    expect(active).toContain('rgb(122 162 255 / 0.85)')
    expect(componentSource).not.toMatch(/#d4a84b|#e3b95e/i)
  })

  it('collapses to the icon rail on tablets and in the collapsed desktop state', () => {
    expect(componentSource).toContain('const isRail = computed(() => (isTablet.value && !mobileOpen.value) || (isDesktop.value && sidebarCollapsed.value))')
    expect(componentSource).toContain('const isHidden = computed(() => isPhone.value && !mobileOpen.value)')
  })

  it('no longer owns the theme toggle (it lives in the top bar)', () => {
    expect(componentSource).not.toContain('toggleTheme')
  })
})

describe('AppSidebar width by mode', () => {
  it('uses stable expanded widths by language and preserves the rail and overlay sizes', () => {
    expect(componentSource).toMatch(/\.sidebar--full \{\s*width: 236px;/)
    expect(componentSource).toMatch(/@media \(min-width: 1280px\) \{\s*\.sidebar--full:lang\(zh\) \{\s*width: 184px;/)
    expect(componentSource).toMatch(/\.sidebar--rail \{\s*width: 72px;/)
    expect(componentSource).toMatch(/\.sidebar--overlay \{\s*width: min\(304px, 86vw\);/)
  })

  it('truncates menu labels to a single line while letting the flex items shrink', () => {
    expect(componentSource).toMatch(/\.sidebar-label \{[^}]*min-width: 0;[^}]*overflow: hidden;\s*text-overflow: ellipsis;\s*white-space: nowrap;/)
    expect(componentSource).toContain('<span class="min-w-0 truncate">{{ item.label }}</span>')
  })

  it('keeps the vignette out of the intrinsic width and reports the measured width to the layout', () => {
    expect(componentSource).toMatch(/\.sidebar-vignette \{[^}]*width: 0;\s*min-width: 100%;/)
    expect(componentSource).toContain('consoleSidebarWidth.value =')
    expect(componentSource).toContain('new ResizeObserver(')
  })
})

describe('AppSidebar pixel student vignette', () => {
  const vignetteBlock = componentSource.match(/\.sidebar-vignette \{[\s\S]*?\n\}/)?.[0] ?? ''

  it('drops the static whole-picture PNG for an SVG backdrop plus the async student stage', () => {
    expect(componentSource).not.toContain('sidebar-vignette.png')
    expect(componentSource).toContain("defineAsyncComponent(() => import('./SidebarStudent.vue'))")
    expect(vignetteBlock).toContain("url('./assets/sidebar-scenery.svg')")
    expect(vignetteBlock).toContain('height: 122px;')
  })

  it('unmounts the student in the icon rail and pauses it while the phone drawer is closed', () => {
    expect(componentSource).toMatch(/<div v-if="!isRail" class="sidebar-vignette"[^>]*>\s*<SidebarStudent :active="!isHidden" \/>/)
  })

  it('keeps every vignette layer at fixed pixels so it never stretches with the sidebar width', () => {
    expect(vignetteBlock).toContain('144px 106px')
    expect(vignetteBlock).not.toMatch(/object-fit|background-size:\s*(cover|contain)/)
    // 抽屉不再单独改 vignette 宽度（原来是 width: 100%）
    expect(componentSource).not.toMatch(/\.sidebar--overlay \.sidebar-vignette/)
  })
})
