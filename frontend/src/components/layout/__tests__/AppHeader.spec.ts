import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../AppHeader.vue'), 'utf8')

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
})
