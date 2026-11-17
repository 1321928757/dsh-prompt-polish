/**
 * Host 服务解析回归测试。
 *
 * 守护 DSH 0.2.2-rc.3 上的升级故障：宿主组合树里本插件排在最后，`apply()` 执行
 * 时 `llm` / `fs` / `sandboxPolicy` 的提供方 fiber 可能尚未 ACTIVE，Cordis 的
 * `ctx.get()` 因此返回 undefined。若在挂载时把服务捕获成快照，这些服务会被永久
 * 固化为 undefined —— 用户侧表现就是「没有可用的模型服务」（以及 L3 设置恒失败）。
 *
 * 这里用一个最小 ctx 假件复现同一时序：先挂载、后提供 llm / fs，再调用服务方法。
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { apply } from '../lib/index.js'

/** 造一个服务表 + 最小 ctx；服务可在 apply 之后才出现，模拟晚激活。 */
function makeHost() {
  const services = Object.create(null)
  const disposers = []
  const ctx = {
    get: (name) => services[name],
    provide: (name, value) => { services[name] = value },
    // 永不 resolve，且不排任何定时器：单测不因 30s 空闲计时器悬挂
    timeout: () => new Promise(() => {}),
    effect: (factory) => {
      const dispose = factory()
      disposers.push(dispose)
      return dispose
    },
  }
  apply(ctx)
  return { services, disposers }
}

/** llm.stream 假件：按顺序吐出给定 chunk，并记录每次请求参数。 */
function streamOf(chunks, calls) {
  return (options) => {
    calls.push(options)
    return {
      [Symbol.asyncIterator]() {
        let index = 0
        return {
          next: async () => (index < chunks.length
            ? { done: false, value: chunks[index++] }
            : { done: true, value: undefined }),
        }
      },
    }
  }
}

const STOP = { type: 'finish', reason: { kind: 'stop' } }

test('模型服务晚激活时不再报「没有可用的模型服务」', async () => {
  const { services } = makeHost()
  const polish = services.promptPolish
  assert.ok(polish, 'promptPolish 服务应在挂载时即提供')

  // 挂载瞬间没有 llm：给出可诊断的错误，而不是崩溃
  const early = await polish.optimizePrompt({ draft: '你好' })
  assert.equal(early.ok, false)
  assert.match(early.error, /没有可用的模型服务/)

  // llm / agentDefaultModel 稍后激活（真实 DSH 中的实际时序）
  const calls = []
  services.agentDefaultModel = { currentSelection: () => ({ provider: 'deepseek-official', model: 'deepseek-flash' }) }
  services.llm = {
    stream: streamOf([{ type: 'text-delta', text: '请帮我梳理一下需求。' }, STOP], calls),
    listProviders: () => [{ id: 'deepseek-official', name: 'DeepSeek' }],
    listModels: async () => [{ id: 'deepseek-flash', name: 'DeepSeek Flash' }],
    resolveModelInfo: async () => ({ context: { contextWindow: 128000 }, defaultMaxTokens: 8000 }),
  }

  const res = await polish.optimizePrompt({ draft: '你好' })
  assert.equal(res.ok, true, res.error)
  assert.equal(res.text, '请帮我梳理一下需求。')
  assert.equal(calls.length, 1, '应只发起一次模型请求')
  assert.equal(calls[0].provider, 'deepseek-official')
  assert.equal(calls[0].model, 'deepseek-flash')
  assert.ok(calls[0].maxTokens > 0 && calls[0].maxTokens <= 4000, 'maxTokens 应落在插件上限内')
  assert.ok(Array.isArray(calls[0].messages) && calls[0].messages.length > 0)
})

test('模型能力按 llm.resolveModelInfo 探测，小上下文模型仍被压到 MIN 之上', async () => {
  const { services } = makeHost()
  services.agentDefaultModel = { currentSelection: () => ({ provider: 'p', model: 'small' }) }
  const calls = []
  services.llm = {
    stream: streamOf([{ type: 'text-delta', text: '改写结果' }, STOP], calls),
    resolveModelInfo: async () => ({ context: { contextWindow: 2048 }, defaultMaxTokens: 512 }),
  }

  const res = await services.promptPolish.optimizePrompt({ draft: '写一个函数' })
  assert.equal(res.ok, true, res.error)
  // 输出预算取 min(MAX_OUTPUT_TOKENS, 模型 defaultMaxTokens, 剩余上下文)，且不低于 MIN
  assert.equal(calls[0].maxTokens, 1200)
})

test('0.2.2 前半段的 listModels 能力字段仍可作为回退', async () => {
  const { services } = makeHost()
  services.agentDefaultModel = { currentSelection: () => ({ provider: 'p', model: 'legacy' }) }
  const calls = []
  services.llm = {
    stream: streamOf([{ type: 'text-delta', text: '结果' }, STOP], calls),
    listModels: async () => [{ id: 'legacy', name: 'Legacy', contextLength: 32000, maxTokens: 2000 }],
  }

  const res = await services.promptPolish.optimizePrompt({ draft: '你好' })
  assert.equal(res.ok, true, res.error)
  assert.equal(calls[0].maxTokens, 2000)
})

test('没有默认模型时回退到 listProviders / listModels', async () => {
  const { services } = makeHost()
  const calls = []
  services.llm = {
    stream: streamOf([{ type: 'text-delta', text: '回退结果' }, STOP], calls),
    listProviders: () => [{ id: 'fallback', name: 'Fallback' }],
    listModels: async () => [{ id: 'm1', name: 'M1' }],
  }

  const res = await services.promptPolish.optimizePrompt({ draft: '你好' })
  assert.equal(res.ok, true, res.error)
  assert.equal(calls[0].provider, 'fallback')
  assert.equal(calls[0].model, 'm1')
})

test('模型失败原因带上宿主给出的 failure 说明', async () => {
  const { services } = makeHost()
  services.agentDefaultModel = { currentSelection: () => ({ provider: 'p', model: 'm' }) }
  const calls = []
  services.llm = {
    stream: streamOf([{
      type: 'finish',
      reason: { kind: 'error', failure: { message: '401 invalid api key', code: 'AUTH' } },
    }], calls),
  }

  const res = await services.promptPolish.optimizePrompt({ draft: '你好' })
  assert.equal(res.ok, false)
  assert.match(res.error, /模型调用异常/)
  assert.match(res.error, /401 invalid api key/)
})

test('文件服务晚激活时 L3 设置读写可用；缺席时按各自语义降级', async () => {
  const { services } = makeHost()
  const polish = services.promptPolish

  const early = await polish.getSettings({ root: 'E:/repo' })
  assert.equal(early.ok, false)
  assert.match(early.error, /文件服务不可用/)

  const written = new Map()
  services.fs = {
    resolve: async (path) => path,
    readText: async (path) => {
      if (!written.has(path)) {
        const err = new Error('not found')
        err.code = 'FS_NOT_FOUND'
        throw err
      }
      return written.get(path)
    },
    writeText: async (path, text) => { written.set(path, text) },
  }

  assert.deepEqual(await polish.getSettings({ root: 'E:/repo' }), { ok: true, settings: {} })
  assert.deepEqual(await polish.setSettings({ root: 'E:/repo', patch: { mode: 'structured' } }), { ok: true })
  assert.deepEqual(await polish.getSettings({ root: 'E:/repo' }), { ok: true, settings: { mode: 'structured' } })
})
