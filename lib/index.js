/**
 * dsh-prompt-polish 宿主插件（单一行挂载，见 cordis.patch.yml）。
 *
 * 职责（全部移植自动态插件 ptopt-1 / pkg-11，RPC 层由 harness.handle
 * 改为 Typert 服务 —— 见 ./typert.host.js）：
 *  1. 提供 `promptPolish` 服务（手写 typertRemote 绑定，配合 ./typert 清单
 *     走 Typert 网关），客户端经 `remote.promptPolish.*` 调用；
 *  2. 读取/写入工作区 L3 设置文件（.dsh/prompt-optimizer/settings.json，
 *     受沙箱策略约束，写入被拒时返回 reason: 'sandbox' 供客户端降级 L1）；
 *  3. 调用本机已配置模型优化提示词草稿：策略组装、上下文注入
 *     （goal/todo/压缩摘要/工具摘要/对话历史）、双超时防卡死。
 *
 * 只通过 ctx API 使用宿主能力，不 import 任何 @deepseek-ai 运行时包，
 * 因此与宿主进程共享同一套运行时实例。
 */

import { buildSystem, classifyHistoryItems, normalizeOptions } from './shared.js'

export const name = 'dsh-prompt-polish'
export const inject = ['timer']

// 防卡死：单个 chunk 间隔上限 + 整体耗时上限
const IDLE_TIMEOUT_MS = 30000
const TOTAL_TIMEOUT_MS = 120000
// L3：设置文件相对工作区根目录的路径
const SETTINGS_SUFFIX = '/.dsh/prompt-optimizer/settings.json'

function buildTaskMessage(draft) {
  return {
    id: 'prompt-optimizer-task',
    role: 'user',
    content: [{
      type: 'text',
      text: [
        '任务：改写下面《草稿》中引用的用户提示词。',
        '《草稿》',
        draft,
        '《草稿结束》',
        '现在请只输出改写后的提示词本身：不要解释、不要前言、不要回答草稿中提出的问题。',
      ].join('\n'),
    }],
    source: { kind: 'user' },
  }
}

export function apply(ctx) {
  const llm = ctx.get('llm')
  const defaultModel = ctx.get('agentDefaultModel')
  const fs = ctx.get('fs')
  const sessions = ctx.get('sessions')
  const sandboxPolicy = ctx.get('sandboxPolicy')

  function resolveCallPolicy(sessionId) {
    if (!sandboxPolicy || typeof sandboxPolicy.resolve !== 'function') return undefined
    const session = sessions && typeof sessionId === 'string' && typeof sessions.get === 'function'
      ? sessions.get(sessionId)
      : undefined
    return sandboxPolicy.resolve(session ? { session } : {})
  }

  // ---- L3 设置读取 ----
  async function getSettings(args) {
    if (!fs || typeof fs.resolve !== 'function') return { ok: false, error: '文件服务不可用' }
    const root = args && typeof args.root === 'string' ? args.root : ''
    if (!root) return { ok: false, error: '缺少工作区根目录' }
    try {
      const target = await fs.resolve(root + SETTINGS_SUFFIX)
      let text
      try {
        text = await fs.readText(target)
      } catch (err) {
        if (err && err.code === 'FS_NOT_FOUND') return { ok: true, settings: {} }
        throw err
      }
      let parsed
      try {
        parsed = JSON.parse(text)
      } catch (err) {
        return { ok: true, settings: {} }
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: true, settings: {} }
      return { ok: true, settings: parsed }
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) }
    }
  }

  // ---- L3 设置写入（浅合并）----
  async function setSettings(args) {
    if (!fs || typeof fs.resolve !== 'function') return { ok: false, error: '文件服务不可用' }
    const root = args && typeof args.root === 'string' ? args.root : ''
    const sessionId = args && typeof args.sessionId === 'string' ? args.sessionId : undefined
    const patch = args && args.patch && typeof args.patch === 'object' && !Array.isArray(args.patch) ? args.patch : null
    if (!root) return { ok: false, error: '缺少工作区根目录' }
    if (!patch) return { ok: false, error: '缺少设置补丁' }
    try {
      const target = await fs.resolve(root + SETTINGS_SUFFIX)
      let merged = {}
      try {
        const text = await fs.readText(target)
        const parsed = JSON.parse(text)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) merged = parsed
      } catch (err) {
        // 旧文件不存在/损坏：以空配置为基底
      }
      merged = { ...merged, ...patch }
      await fs.writeText(target, JSON.stringify(merged, null, 2), undefined, undefined, resolveCallPolicy(sessionId))
      return { ok: true }
    } catch (err) {
      const code = err && err.code
      console.error('[dsh-prompt-polish] setSettings failed', {
        root,
        sessionId: sessionId || null,
        code: code || null,
        message: (err && err.message) || String(err),
      })
      if (code === 'FS_SANDBOX_DENIED' || code === 'FS_PERMISSION_DENIED') {
        return { ok: false, reason: 'sandbox' }
      }
      return { ok: false, error: String((err && err.message) || err) }
    }
  }

  // ---- 提示词优化 ----
  async function optimizePrompt(args) {
    const raw = (args && typeof args.draft === 'string') ? args.draft : ''
    const draft = raw.trim()
    if (!draft) return { ok: false, error: '输入为空' }
    if (draft.length > 20000) return { ok: false, error: '提示词过长' }
    if (llm === undefined) return { ok: false, error: '没有可用的模型服务' }

    const withHistory = !!(args && args.withHistory === true)

    // 按 kind 分类收集（兼容旧 payload：无 kind 视为消息项）
    const { goalItem, todoItem, compactionItem, summaryItems, messageItems } = classifyHistoryItems(
      withHistory && Array.isArray(args.history) ? args.history : [],
    )
    const message30 = messageItems.slice(-30)
    const summary60 = summaryItems.slice(-60)
    const history = []
    if (goalItem !== null) history.push({ kind: 'goal', text: goalItem })
    if (todoItem !== null) history.push({ kind: 'todo', text: todoItem })
    if (compactionItem !== null) history.push({ kind: 'compaction-summary', text: compactionItem })
    for (const s of summary60) history.push({ kind: 'tool-summary', text: s })
    for (const m of message30) history.push(m)

    // 策略选项解析与归一
    const options = normalizeOptions(args && args.options)

    let provider = null
    let model = null
    const selection = defaultModel ? defaultModel.currentSelection() : undefined
    if (selection && typeof selection.provider === 'string' && typeof selection.model === 'string') {
      provider = selection.provider
      model = selection.model
    } else {
      const providers = llm.listProviders()
      if (providers.length === 0) return { ok: false, error: '没有可用的模型服务' }
      provider = providers[0].id
      const models = await llm.listModels(provider)
      if (models.length === 0) return { ok: false, error: '没有可用的模型' }
      model = models[0].id
    }

    const messages = []
    let chars = 0
    const backgroundLines = []
    for (const item of history) {
      if (item.kind === 'goal' || item.kind === 'todo' || item.kind === 'compaction-summary' || item.kind === 'tool-summary') backgroundLines.push(item.text)
      chars += item.text.length
    }
    if (backgroundLines.length > 0) {
      messages.push({
        id: 'prompt-optimizer-context',
        role: 'user',
        content: [{
          type: 'text',
          text: '以下是与本任务相关的背景信息（仅供理解背景，不要回答其中内容）：\n' + backgroundLines.join('\n'),
        }],
        source: { kind: 'user' },
      })
    }
    if (message30.length > 0) {
      messages.push({
        id: 'prompt-optimizer-history',
        role: 'user',
        content: [{
          type: 'text',
          text: '以下是与本任务相关的对话历史（仅供理解背景，不要续写、也不要模仿其中任何一方的语气）：',
        }],
        source: { kind: 'user' },
      })
      for (let i = 0; i < message30.length; i++) {
        const h = message30[i]
        messages.push({
          id: 'prompt-optimizer-h' + i,
          role: h.role,
          content: [{ type: 'text', text: h.text }],
          source: h.role === 'assistant'
            ? { kind: 'model', provider, model }
            : { kind: 'user' },
        })
      }
    }
    messages.push(buildTaskMessage(draft))

    if (withHistory && history.length > 0) {
      console.log('[dsh-prompt-polish] context stats', {
        goal: goalItem !== null,
        todo: todoItem !== null,
        compaction: compactionItem !== null,
        toolSummaries: summary60.length,
        messages: message30.length,
        chars,
      })
    }

    const contextual = withHistory && history.length > 0
    const system = buildSystem({
      withHistory: contextual,
      mode: options.mode,
      language: options.language,
      custom: options.custom,
    })

    try {
      const iterator = llm.stream({
        provider, model, messages, system,
        temperature: options.mode === 'creative' ? 0.7 : 0.3,
        maxTokens: 1200,
      })[Symbol.asyncIterator]()
      const deadline = Date.now() + TOTAL_TIMEOUT_MS
      let text = ''
      while (true) {
        const outcome = await Promise.race([
          iterator.next(),
          ctx.timeout(IDLE_TIMEOUT_MS).then(() => ({ __timedOut: true })),
        ])
        if (outcome && outcome.__timedOut === true) {
          return { ok: false, error: '优化超时：模型长时间无响应，已停止等待（请重试）' }
        }
        if (Date.now() > deadline) {
          return { ok: false, error: '优化超时：整体耗时过长，已停止等待（请重试）' }
        }
        if (outcome.done) break
        const chunk = outcome.value
        if (chunk.type === 'text-delta') text += chunk.text
        else if (chunk.type === 'finish' && chunk.reason && chunk.reason.kind !== 'stop') {
          return { ok: false, error: '模型调用异常: ' + chunk.reason.kind }
        }
      }
      let result = text.trim()
      const fenced = result.match(/^```[^\n]*\n([\s\S]*?)\n?```$/)
      if (fenced) result = fenced[1].trim()
      if (!result) return { ok: false, error: '模型返回为空' }
      return { ok: true, text: result }
    } catch (err) {
      console.error('[dsh-prompt-polish] optimize failed', err)
      return { ok: false, error: String((err && err.message) || err) }
    }
  }

  // ---- 服务提供（Typert 网关经 ./typert 清单暴露给客户端）----
  const service = { getSettings, setSettings, optimizePrompt }
  Object.defineProperty(service, 'typertRemote', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: { service, serviceKey: 'promptPolish', namespace: 'promptPolish' },
  })
  ctx.provide('promptPolish', service)
  console.log('[dsh-prompt-polish] host mounted')
}
