const [, , url, debugPortArg, timeoutArg] = process.argv
const debugPort = Number(debugPortArg)
const timeoutMs = Number(timeoutArg ?? 90000)
if (!url || !Number.isInteger(debugPort)) throw new Error('Usage: node web-boot-probe.mjs <url> <debugPort> [timeoutMs]')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const consoleMessages = []
const exceptions = []
let page

for (let attempt = 0; attempt < 60; attempt++) {
  try {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`)
    const targets = await response.json()
    page = targets.find((target) => target.type === 'page' && typeof target.webSocketDebuggerUrl === 'string')
    if (page) break
  } catch { /* wait for CDP endpoint */ }
  await sleep(250)
}
if (!page) {
  console.log(JSON.stringify({ verdict: 'no-cdp-target' }))
  process.exit(1)
}

const socket = new WebSocket(page.webSocketDebuggerUrl)
const pending = new Map()
let nextId = 1
socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data))
  if (message.id !== undefined) {
    const item = pending.get(message.id)
    if (!item) return
    pending.delete(message.id)
    if (message.error) item.reject(new Error(message.error.message))
    else item.resolve(message.result)
  } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    consoleMessages.push(message.params.args.map((arg) => arg.value ?? arg.description ?? arg.type).join(' ').slice(0, 800))
  } else if (message.method === 'Runtime.exceptionThrown') {
    const details = message.params.exceptionDetails
    exceptions.push((details.exception?.description ?? details.text ?? 'unknown').slice(0, 1000))
  }
})
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', () => reject(new Error('CDP socket error')), { once: true })
})
function send(method, params = {}) {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text)
  return response.result && response.result.value
}
await send('Runtime.enable')
await send('Page.enable')
await send('Log.enable')
await send('Page.navigate', { url })

const deadline = Date.now() + timeoutMs
let snapshot
let verdict = 'timeout'
while (Date.now() < deadline) {
  await sleep(500)
  try {
    snapshot = await evaluate(`(() => {
      const boot = document.querySelector('[data-dsh-boot]')
      const bootText = boot === null ? null : boot.innerText
      const graph = window.__DSH_BOOT__
      const entries = graph && Array.isArray(graph.entries) ? graph.entries.map((entry) => entry.id) : null
      return {
        href: location.href,
        graphReady: entries !== null,
        hasPluginEntry: entries !== null && entries.includes('dsh-prompt-polish'),
        entryCount: entries === null ? 0 : entries.length,
        failedPlugins: bootText !== null && /Failed to load plugins|did not activate/i.test(bootText),
        bootText: bootText === null ? null : bootText.replace(/\\s+/g, ' ').slice(0, 500),
        optimizeControl: document.querySelectorAll('.dyn-opt-root').length,
        settingsRow: document.querySelectorAll('.dyn-opt-settings-row').length,
        buttons: Array.from(document.querySelectorAll('button')).map((button) => (button.innerText || button.getAttribute('aria-label') || button.title || '').trim()).filter(Boolean).slice(0, 80),
      }
    })()`)
  } catch { continue }
  if (snapshot.failedPlugins) { verdict = 'boot-failed'; break }
  if (snapshot.hasPluginEntry && snapshot.optimizeControl >= 1) { verdict = 'ok'; break }
}
if (verdict === 'ok') {
  const openedSettings = await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button')).find((item) => {
      if (item.matches('.dyn-opt-gear')) return false
      return (item.innerText || '').trim() === '设置' || item.getAttribute('aria-label') === '设置'
    })
    if (!button) return false
    button.click()
    return true
  })()`)
  if (openedSettings) {
    const settingsDeadline = Date.now() + Math.min(timeoutMs, 20000)
    while (Date.now() < settingsDeadline) {
      await sleep(400)
      const state = await evaluate(`({ settingsRow: document.querySelectorAll('.dyn-opt-settings-row').length, href: location.href })`)
      if (state.settingsRow > 0) {
        snapshot.settingsRow = state.settingsRow
        snapshot.settingsHref = state.href
        break
      }
    }
  }
}
socket.close()
console.log(JSON.stringify({ verdict, snapshot, console: consoleMessages, exceptions }, null, 2))
if (verdict !== 'ok' || consoleMessages.length || exceptions.length) process.exitCode = 1
