import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { launchOriginGuardedChrome, parseLoopbackPreview, restrictContextToOrigin } from './console-mobile-drawer-network-guard.mjs'

// Requires Playwright through NODE_PATH and a local Chrome, like the navigation script.
const { chromium } = createRequire(import.meta.url)('playwright')

async function listen(t, handler) {
  const server = createServer(handler).listen(0, '127.0.0.1')
  t.after(() => new Promise(resolve => server.close(resolve)))
  await once(server, 'listening')
  return `http://127.0.0.1:${server.address().port}`
}

test('parseLoopbackPreview accepts only HTTP/HTTPS loopback URLs without user information', () => {
  for (const url of ['http://127.0.0.1:5391/session', 'https://localhost:5391/']) {
    assert.ok(parseLoopbackPreview(url), url)
  }
  for (const url of [undefined, '', 'not a url', 'ftp://127.0.0.1/', 'http://[::1]:5391/', 'http://example.test/',
    'http://user@127.0.0.1:5391/', 'http://127.0.0.1:9@example.test/', 'http://:secret@localhost/']) {
    assert.equal(parseLoopbackPreview(url), undefined, String(url))
  }
})

test('navigation runner keeps pages, popups, tabs and redirects on the preview origin', async (t) => {
  const outsideRequests = []
  // Another loopback port is a different origin: only an origin check can keep requests off it.
  const outside = await listen(t, (request, response) => {
    outsideRequests.push(request.url)
    response.writeHead(200, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' }).end('outside')
  })
  const previewRequests = []
  const preview = await listen(t, (request, response) => {
    previewRequests.push(request.url)
    const redirects = {
      '/hop-1': '/hop-2',
      '/hop-2': `${outside}/redirected-navigation`,
      '/asset-hop': `${outside}/redirected-asset`,
      '/inside-hop': '/page'
    }
    if (redirects[request.url]) {
      response.writeHead(302, { Location: redirects[request.url] }).end()
      return
    }
    response.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><p>preview</p>')
  })

  const guarded = await launchOriginGuardedChrome(chromium, preview)
  t.after(() => guarded.close())
  const context = await guarded.browser.newContext()
  const blockedByContext = await restrictContextToOrigin(context, preview)
  async function openPreviewPage() {
    const page = await context.newPage()
    page.setDefaultTimeout(8_000)
    await page.goto(`${preview}/page`)
    return page
  }

  await t.test('serves same-origin pages and same-origin redirects', async () => {
    const page = await openPreviewPage()
    previewRequests.length = 0
    await page.goto(`${preview}/inside-hop`)
    assert.equal(page.url(), `${preview}/page`)
    assert.deepEqual(previewRequests.splice(0).filter(url => url !== '/favicon.ico'), ['/inside-hop', '/page'])
  })

  await t.test('blocks an outside navigation in the current page', async () => {
    const page = await openPreviewPage()
    await assert.rejects(page.goto(`${outside}/direct-navigation`), /ERR_BLOCKED_BY_CLIENT/)
  })

  await t.test('blocks the outside hop of a multi-hop navigation redirect', async () => {
    const page = await openPreviewPage()
    await assert.rejects(page.goto(`${preview}/hop-1`), /net::ERR_/)
    assert.ok(previewRequests.includes('/hop-1') && previewRequests.includes('/hop-2'))
  })

  await t.test('blocks outside subresources and their redirects', async () => {
    const page = await openPreviewPage()
    const results = await page.evaluate(async (urls) => Promise.all(urls.map(url =>
      fetch(url).then(() => 'loaded', () => 'blocked'))), [`${outside}/direct-asset`, `${preview}/asset-hop`])
    assert.deepEqual(results, ['blocked', 'blocked'])
    assert.ok(previewRequests.includes('/asset-hop'))
  })

  await t.test('blocks a popup and a new tab opened on another origin', async () => {
    const page = await openPreviewPage()
    const popupEvent = page.waitForEvent('popup')
    await page.evaluate(url => { window.open(url) }, `${outside}/popup`)
    const popup = await popupEvent
    await popup.waitForLoadState('domcontentloaded').catch(() => {})
    // Older Playwright reports an empty URL for the blocked popup; either way it must not be the outside page.
    assert.equal(popup.url().startsWith(outside), false, 'popup must not load the outside page')
    assert.doesNotMatch(await popup.evaluate(() => document.body?.innerText ?? '').catch(() => ''), /outside/)

    const redirectedPopupEvent = page.waitForEvent('popup')
    await page.evaluate(url => { window.open(url) }, `${preview}/hop-1`)
    const redirectedPopup = await redirectedPopupEvent
    await redirectedPopup.waitForLoadState('domcontentloaded').catch(() => {})

    const tab = await context.newPage()
    await assert.rejects(tab.goto(`${outside}/new-tab`), /ERR_BLOCKED_BY_CLIENT/)
  })

  await t.test('lets no request reach the outside origin', () => {
    assert.deepEqual(outsideRequests, [])
    assert.ok(blockedByContext.some(url => url.endsWith('/popup')), 'the context route saw the popup')
    assert.ok(guarded.blocked.some(url => url.endsWith('/redirected-navigation')), 'the proxy saw the redirect hop')
    assert.ok(guarded.blocked.some(url => url.endsWith('/redirected-asset')), 'the proxy saw the asset redirect hop')
    t.diagnostic(`outside origin received ${outsideRequests.length} requests`)
  })
})
