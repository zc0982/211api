// Keeps every request of a Playwright Chrome on one loopback preview origin.
//
// Two layers, both browser- or context-wide rather than per page:
// - Chrome is launched behind an in-process proxy. Playwright proxies loopback too (`<-loopback>`),
//   so every hop from every page, popup and tab, including each redirect hop, reaches the proxy,
//   which only forwards requests whose origin is the preview origin.
// - `context.route` sees the first hop of every page in the context, including popups and new
//   tabs, aborts other origins and lets callers hold same-origin requests.
import { createServer, request as httpRequest } from 'node:http'
import { connect } from 'node:net'
import { once } from 'node:events'

const hopByHopHeaders = ['connection', 'proxy-connection', 'proxy-authorization', 'keep-alive', 'te', 'trailer', 'upgrade']

export function parseLoopbackPreview(input) {
  let preview
  try {
    preview = new URL(input ?? '')
  } catch {
    return undefined
  }
  const allowed = ['http:', 'https:'].includes(preview.protocol) &&
    ['127.0.0.1', 'localhost'].includes(preview.hostname) &&
    !preview.username && !preview.password
  return allowed ? preview : undefined
}

function authorityOf(url) {
  return `${url.hostname}:${url.port || (url.protocol === 'https:' ? '443' : '80')}`
}

export async function startOriginProxy(origin) {
  const allowed = new URL(origin)
  const blocked = []
  const sockets = new Set()
  const server = createServer((request, response) => {
    let target
    try {
      target = new URL(request.url)
    } catch {
      target = undefined
    }
    if (!target || target.origin !== allowed.origin || target.protocol !== 'http:') {
      blocked.push(request.url)
      response.writeHead(403).end()
      request.resume()
      return
    }
    const headers = { ...request.headers }
    for (const name of hopByHopHeaders) delete headers[name]
    const upstream = httpRequest({
      host: target.hostname,
      port: target.port || 80,
      method: request.method,
      path: target.pathname + target.search,
      headers
    }, (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers)
      upstreamResponse.pipe(response)
    })
    upstream.on('error', () => response.destroy())
    request.pipe(upstream)
  })
  // HTTPS previews and WebSockets tunnel through CONNECT; only the preview authority is reachable.
  server.on('connect', (request, client, head) => {
    if (request.url !== authorityOf(allowed)) {
      blocked.push('CONNECT ' + request.url)
      client.end('HTTP/1.1 403 Forbidden\r\n\r\n')
      return
    }
    const upstream = connect(Number(allowed.port || (allowed.protocol === 'https:' ? 443 : 80)), allowed.hostname, () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      upstream.write(head)
      upstream.pipe(client)
      client.pipe(upstream)
    })
    upstream.on('error', () => client.destroy())
    client.on('error', () => upstream.destroy())
  })
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    blocked,
    async close() {
      for (const socket of sockets) socket.destroy()
      await new Promise(resolve => server.close(resolve))
    }
  }
}

export async function launchOriginGuardedChrome(chromium, origin, launchOptions = {}) {
  const proxy = await startOriginProxy(origin)
  let browser
  try {
    browser = await chromium.launch({ channel: 'chrome', ...launchOptions, proxy: { server: proxy.url } })
  } catch (error) {
    await proxy.close()
    throw error
  }
  return {
    browser,
    blocked: proxy.blocked,
    async close() {
      await browser.close()
      await proxy.close()
    }
  }
}

export async function restrictContextToOrigin(context, origin, { beforeContinue, blocked = [] } = {}) {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) {
      blocked.push(url.href)
      await route.abort('blockedbyclient').catch(() => {})
      return
    }
    await beforeContinue?.(url)
    await route.continue().catch(() => {}) // The page or context may close while a request is held.
  })
  return blocked
}
