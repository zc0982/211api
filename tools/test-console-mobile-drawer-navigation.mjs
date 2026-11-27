import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { launchOriginGuardedChrome, parseLoopbackPreview, restrictContextToOrigin } from './console-mobile-drawer-network-guard.mjs'

const preview = parseLoopbackPreview(process.argv[2])
assert.ok(preview, 'Expected a loopback HTTP/HTTPS synthetic preview URL')
const screenshots = process.argv[3]
if (screenshots) await mkdir(screenshots, { recursive: true })

const { chromium } = createRequire(import.meta.url)('playwright')
const menu = '.console-topbar__menu'
const logo = '.sidebar-logo'
const guarded = await launchOriginGuardedChrome(chromium, preview.origin)
const { browser } = guarded
const failures = []
const blockedByContext = []

async function snapshot(page, name) {
  const state = await page.evaluate(() => {
    const focused = document.activeElement
    return {
      path: location.pathname,
      expanded: document.querySelector('.console-topbar__menu').getAttribute('aria-expanded'),
      focused: focused ? focused.tagName + '.' + [...focused.classList].join('.') : null,
      keysFailure: window.keysNavigationOutcome
    }
  })
  console.log(JSON.stringify({ name, ...state }))
  if (screenshots) await page.screenshot({ path: join(screenshots, name + '.png') })
  return state
}

async function checkDrawerNavigation(superseded) {
  const scenario = superseded ? 'superseded' : 'reopened'
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
  let releaseKeys
  const keysHeld = new Promise(resolve => { releaseKeys = resolve })
  let keysRequests = 0
  await restrictContextToOrigin(context, preview.origin, {
    blocked: blockedByContext,
    async beforeContinue(url) {
      if (/\/KeysView-[^/]+\.js$/.test(url.pathname)) {
        keysRequests++
        await keysHeld
      }
    }
  })
  const page = await context.newPage()
  page.setDefaultTimeout(12_000)

  try {
    await page.goto(preview.href)
    await page.waitForURL('**/dashboard')
    await page.locator(menu).waitFor()
    await page.evaluate(() => {
      const { $router } = document.querySelector('#app').__vue_app__.config.globalProperties
      window.keysNavigationStarted = false
      window.keysNavigationOutcome = undefined
      $router.beforeEach((to) => {
        if (to.path === '/keys') window.keysNavigationStarted = true
      })
      $router.afterEach((to, _from, failure) => {
        if (to.path === '/keys') window.keysNavigationOutcome = failure?.type ?? null
      })
    })

    await page.locator(menu).press('Enter')
    await page.locator('.sidebar-nav a[href="/keys"]').press('Enter')
    await page.waitForFunction(() => window.keysNavigationStarted)
    assert.equal(new URL(page.url()).pathname, '/dashboard')
    if (superseded) {
      await page.locator('.sidebar-nav a[href="/usage"]').press('Enter')
      await page.waitForURL('**/usage')
      await page.waitForFunction(() => document.activeElement.matches('.console-topbar__menu'))
    } else {
      await page.locator('.sidebar-close').press('Enter')
      assert.equal(await page.locator(menu).evaluate(node => node === document.activeElement), true)
    }

    await page.locator(menu).press('Enter')
    await page.keyboard.press('Tab')
    // Mark the focused Logo so the settled state can tell the old node from a remounted one.
    assert.equal(await page.locator(logo).evaluate((node) => {
      node.dataset.drawerFocusProbe = 'before-release'
      return node === document.activeElement
    }), true)
    const before = await snapshot(page, scenario + '-before-release')
    assert.equal(before.expanded, 'true')
    assert.ok(keysRequests > 0, 'The KeysView request must have reached the gate')
    releaseKeys()
    await page.waitForFunction(() => window.keysNavigationOutcome !== undefined)
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const after = await snapshot(page, scenario + '-after-settlement')
    assert.equal(after.path, superseded ? '/usage' : '/keys')
    assert.equal(after.keysFailure, superseded ? 8 : null) // Vue Router cancelled / success
    assert.equal(after.expanded, 'true')
    const focus = await page.evaluate(() => {
      const focused = document.activeElement
      const logos = document.querySelectorAll('aside.sidebar .sidebar-logo')
      return {
        onDrawerLogo: logos.length === 1 && focused === logos[0],
        sameNode: focused?.getAttribute('data-drawer-focus-probe') === 'before-release',
        connected: Boolean(focused?.isConnected)
      }
    })
    // Superseded: the page never changed, so the very same Logo keeps focus.
    // Reopened: /keys remounted the shell, so the new drawer's Logo receives focus.
    assert.deepEqual(focus, { onDrawerLogo: true, sameNode: superseded, connected: true })
  } finally {
    releaseKeys()
    await context.close()
  }
}

try {
  console.log('Chrome ' + browser.version() + ' · 390 × 844')
  for (const superseded of [true, false]) {
    try {
      await checkDrawerNavigation(superseded)
    } catch (error) {
      failures.push(error)
      console.error(error)
    }
  }
  console.log(JSON.stringify({ blockedByContext: blockedByContext.length, blockedByProxy: guarded.blocked.length }))
  if (failures.length) process.exitCode = 1
} finally {
  await guarded.close()
}
