import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../AppHeader.vue'), 'utf8')
const routerSource = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../router/index.ts'), 'utf8')
const routeBlock = (path: string) => routerSource.slice(routerSource.indexOf(`path: '${path}'`), routerSource.indexOf('}', routerSource.indexOf(`path: '${path}'`)) + 1)

describe('AppHeader console v3 top bar', () => {
  it('keeps the announcement bell on phones — silent announcements open only from it', () => {
    const bell = source.match(/<div[^>]*>\s*<AnnouncementBell \/>/)
    expect(bell).not.toBeNull()
    expect(bell?.[0]).not.toMatch(/hidden|isPhone/)
  })

  it('shows the balance top-up only when balance recharge is actually available', () => {
    expect(source).toContain("import { resolveBalancePurchaseAction, resolveSiteBillingMode } from '@/utils/siteBillingMode'")
    expect(source).toMatch(/resolveBalancePurchaseAction\(appStore\.cachedPublicSettings,[\s\S]*?\) === 'recharge'/)
  })

  it('does not repeat the page title in the top bar for pages that render their own heading', () => {
    expect(source).toMatch(/v-else-if="!route\.meta\.pageHeading \|\| monitorV1Heading"[^>]*data-test="topbar-page-title"/)
    expect(source).toContain("route.name === 'ChannelStatus' && isChannelMonitorV1Mode()")
    expect(source).toContain('v-if="isPhone && monitorV1Heading"')
    expect(routeBlock('/keys')).toContain('pageHeading: true')
    expect(routeBlock('/usage')).toContain('pageHeading: true')
    // 仪表盘行为不变：顶栏继续显示标题
    expect(routeBlock('/dashboard')).not.toContain('pageHeading')
  })
})
