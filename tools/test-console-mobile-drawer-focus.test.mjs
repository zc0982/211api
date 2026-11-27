import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const script = fileURLToPath(new URL('./test-console-mobile-drawer-focus.sh', import.meta.url))
const fixture = `<!doctype html>
<style>aside{position:fixed;width:200px;left:0} aside[inert]{left:-200px}</style>
<aside class="sidebar" tabindex="-1" aria-hidden="true" inert>
  <a class="sidebar-logo" href="#">Logo</a>
  <a class="sidebar-brand-title" href="#">Brand</a>
  <button class="sidebar-close">Close</button>
</aside>
<button class="console-topbar__menu">Menu</button>
<a class="console-topbar__brand" href="#">Home</a>
<script>
const menu = document.querySelector('.console-topbar__menu')
const drawer = document.querySelector('.sidebar')
menu.onclick = () => { drawer.inert = false; drawer.removeAttribute('aria-hidden'); drawer.focus() }
document.querySelector('.sidebar-close').onclick = () => {
  drawer.inert = true
  drawer.setAttribute('aria-hidden', 'true')
  menu.focus()
}
</script>`

function runDrawer(url) {
  return run('bash', [script, url], {
    timeout: 25_000,
    env: { ...process.env, AGENT_BROWSER_DEFAULT_TIMEOUT: '4000' }
  })
}

async function listen(t, host, handler) {
  const server = createServer(handler).listen(0, host)
  t.after(() => new Promise(resolve => server.close(resolve)))
  await once(server, 'listening')
  return server.address().port
}

function serveFixture(response) {
  response.writeHead(200, { 'Content-Type': 'text/html' })
  response.end(fixture)
}

test('drawer browser runner restricts input and redirect requests to loopback names', async (t) => {
  const blockedRequests = []
  const allowedRequests = []
  const blockedPort = await listen(t, '::1', (request, response) => {
    blockedRequests.push(request.url)
    serveFixture(response)
  })
  const blockedOrigin = `http://[::1]:${blockedPort}`
  const probe = await fetch(`${blockedOrigin}/probe`)
  assert.equal(probe.status, 200)
  await probe.text()
  assert.deepEqual(blockedRequests.splice(0), ['/probe'])
  const allowedPort = await listen(t, '127.0.0.1', (request, response) => {
    allowedRequests.push(request.url)
    if (request.url === '/outside' || request.url === '/inside') {
      const location = request.url === '/outside'
        ? `${blockedOrigin}/must-not-arrive`
        : `http://127.0.0.1:${allowedPort}/drawer`
      response.writeHead(302, { Location: location }).end()
      return
    }
    serveFixture(response)
  })
  const allowedOrigin = `http://127.0.0.1:${allowedPort}`

  await t.test('rejects invalid protocol, host and URL user information before requests', async () => {
    for (const url of [
      `ftp://localhost:${allowedPort}/drawer`,
      `${blockedOrigin}/invalid-host`,
      `http://127.0.0.1:9@[::1]:${blockedPort}/invalid-userinfo-host`,
      `http://127.0.0.1:9@localhost:${allowedPort}/invalid-userinfo`,
      `http://@localhost:${allowedPort}/empty-userinfo`
    ]) {
      await assert.rejects(runDrawer(url), { code: 2, stderr: /HTTP\/HTTPS loopback URL/ }, url)
    }
    assert.deepEqual(allowedRequests, [])
    assert.deepEqual(blockedRequests, [])
  })

  await t.test('blocks the browser request to a redirect destination outside the allowlist', async () => {
    await assert.rejects(runDrawer(`${allowedOrigin}/outside`), { stderr: /blocked|ERR_BLOCKED/i })
    assert.ok(allowedRequests.includes('/outside'))
    assert.deepEqual(blockedRequests, [])
    t.diagnostic(`Redirect source received /outside, excluded destination received ${blockedRequests.length} requests`)
  })

  await t.test('allows a localhost entry redirecting to a normal 127.0.0.1 preview', async () => {
    await runDrawer(`http://localhost:${allowedPort}/inside`)
    assert.ok(allowedRequests.includes('/inside'))
    assert.ok(allowedRequests.includes('/drawer'))
    assert.deepEqual(blockedRequests, [])
  })
})
