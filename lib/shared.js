/**
 * dsh-prompt-polish 共享纯逻辑（Host 与单测共用）。
 *
 * 全部移植自动态插件 ptopt-1 / pkg-11，保持逐字节同语义：
 *  - 系统提示词组装（6 策略 × 3 语言 + 自定义指令）
 *  - 头尾截断
 *  - 策略选项归一化
 *  - 历史条目按 kind 分类（goal / todo / compaction-summary / tool-summary / message）
 */

export const INTRO_PLAIN = [
  "You are a prompt-optimization engine. The last message is a TASK: it quotes the",
  "user's draft prompt between 《草稿》 and 《草稿结束》.",
].join("\n")

export const INTRO_CONTEXT = [
  "You are a prompt-optimization engine. You will see a conversation between a USER",
  "and an AI assistant, provided as context only, followed by a final TASK message that",
  "quotes the user's draft prompt between 《草稿》 and 《草稿结束》.",
].join("\n")

export const RED_LINES = [
  "Rewrite the quoted draft so it is clearer, more specific and better structured,",
  "preserving the original intent and language.",
  "Voice rule: the output is the USER's message to be sent to an AI assistant, written",
  "from the user's first-person perspective as a request (e.g. '请帮我…').",
  "Never output the assistant's perspective: no AI plans ('我来…'), and never reply to",
  "the draft — do not open with or include wording like '可以', '好的', '这个方向很对',",
  "because the draft is the text to rewrite, not a question addressed to you.",
  "Example: draft '请继续帮我查看有哪些优化点' must become a user request such as",
  "'请继续结合前面的排查结果，帮我列出当前还有哪些可优化点，并给出具体建议。' —",
  "never '可以，这个方向很对。我先从几个维度排查…'.",
  "Output ONLY the rewritten prompt: no explanation, no preamble, no markdown code fences.",
].join("\n")

export const HISTORY_CONTEXT_RULES = [
  "Use the conversation context to understand the user's goal, current progress and",
  "constraints, then rewrite ONLY the quoted draft so it is clearer, more specific,",
  "better structured and consistent with the context. Preserve the original language.",
].join("\n")

export const MODE_FRAGMENTS = {
  precise: 'Keep the information density and original intent; fix only ambiguity, vague wording and structure.',
  concise: 'Compress to the minimum necessary information; remove redundant modifiers and filler.',
  structured: 'Organize into sections: 目标 / 背景 / 要求 / 期望输出.',
  creative: 'Expand with concrete details and offer multiple actionable angles while keeping intent.',
  translate: 'Translate into the target language naturally while preserving the exact intent.',
  code: 'For programming requests: spell out inputs/outputs, environment constraints and acceptance examples.',
}

export const LANGUAGE_FRAGMENTS = {
  follow: 'Language: keep the language of the original draft.',
  zh: 'Language: output in Chinese (简体中文) regardless of the draft language.',
  en: 'Language: output in English regardless of the draft language.',
}

// translate 模式下语言参数即目标语言
export const TRANSLATE_TARGET = {
  follow: 'Target language: keep the draft language (no translation needed).',
  zh: 'Target language: Chinese (简体中文). Output the translated text only.',
  en: 'Target language: English. Output the translated text only.',
}

export function buildSystem(cfg) {
  const parts = [
    cfg.withHistory ? INTRO_CONTEXT : INTRO_PLAIN,
    RED_LINES,
    MODE_FRAGMENTS[cfg.mode],
    cfg.mode === 'translate' ? TRANSLATE_TARGET[cfg.language] : LANGUAGE_FRAGMENTS[cfg.language],
  ]
  if (cfg.custom) parts.push('Additional user requirements (highest priority, obey over anything above):\n' + cfg.custom)
  if (cfg.withHistory) parts.push(HISTORY_CONTEXT_RULES)
  return parts.join('\n\n')
}

/** 超长文本头尾截断（保头 2600 + 省略标记 + 保尾 1400）。 */
export function headTail(text) {
  if (typeof text !== 'string') return ''
  if (text.length <= 4000) return text
  return text.slice(0, 2600) + '\n…[中间省略]…\n' + text.slice(-1400)
}

/** 策略选项解析与归一（pkg-11 同款：非法值回落默认）。 */
export function normalizeOptions(raw) {
  const rawOptions = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {}
  const options = { mode: 'precise', language: 'follow', custom: '', ...rawOptions }
  if (MODE_FRAGMENTS[options.mode] === undefined) options.mode = 'precise'
  if (LANGUAGE_FRAGMENTS[options.language] === undefined) options.language = 'follow'
  options.custom = typeof options.custom === 'string' ? options.custom.trim().slice(0, 500) : ''
  return options
}

/**
 * 按 kind 分类收集历史条目（pkg-11 同款）。
 * 兼容旧 payload：无 kind 视为消息项；goal/todo/compaction-summary 各取第一条；
 * tool-summary 保留原文；消息项应用 headTail 并按 role 归类。
 */
export function classifyHistoryItems(items) {
  let goalItem = null
  let todoItem = null
  let compactionItem = null
  const summaryItems = []
  const messageItems = []
  if (!Array.isArray(items)) {
    return { goalItem, todoItem, compactionItem, summaryItems, messageItems }
  }
  for (const item of items) {
    if (!item || typeof item.text !== 'string') continue
    const kind = typeof item.kind === 'string' ? item.kind : 'message'
    if (kind === 'goal') {
      if (goalItem === null) goalItem = item.text.trim().slice(0, 2000)
      continue
    }
    if (kind === 'todo') {
      if (todoItem === null) todoItem = item.text.trim().slice(0, 2000)
      continue
    }
    if (kind === 'compaction-summary') {
      if (compactionItem === null) compactionItem = item.text.trim().slice(0, 2000)
      continue
    }
    if (kind === 'tool-summary') {
      const text = item.text.trim().slice(0, 400)
      if (text) summaryItems.push(text)
      continue
    }
    const role = item.role === 'assistant' ? 'assistant' : 'user'
    const text = headTail(item.text.trim())
    if (!text) continue
    messageItems.push({ role, text })
  }
  return { goalItem, todoItem, compactionItem, summaryItems, messageItems }
}
