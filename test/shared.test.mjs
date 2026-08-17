import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSystem,
  headTail,
  normalizeOptions,
  classifyHistoryItems,
  MODE_FRAGMENTS,
  LANGUAGE_FRAGMENTS,
  TRANSLATE_TARGET,
  INTRO_CONTEXT,
  INTRO_PLAIN,
  RED_LINES,
  HISTORY_CONTEXT_RULES,
} from '../lib/shared.js'

test('buildSystem: 默认（无上下文，precise/follow）', () => {
  const sys = buildSystem({ withHistory: false, mode: 'precise', language: 'follow', custom: '' })
  assert.ok(sys.startsWith(INTRO_PLAIN))
  assert.ok(sys.includes(RED_LINES))
  assert.ok(sys.includes(MODE_FRAGMENTS.precise))
  assert.ok(sys.includes(LANGUAGE_FRAGMENTS.follow))
  assert.ok(!sys.includes(HISTORY_CONTEXT_RULES))
})

test('buildSystem: 带上下文时注入 INTRO_CONTEXT 与历史规则', () => {
  const sys = buildSystem({ withHistory: true, mode: 'structured', language: 'zh', custom: '' })
  assert.ok(sys.startsWith(INTRO_CONTEXT))
  assert.ok(sys.includes(MODE_FRAGMENTS.structured))
  assert.ok(sys.includes(LANGUAGE_FRAGMENTS.zh))
  assert.ok(sys.includes(HISTORY_CONTEXT_RULES))
})

test('buildSystem: translate 模式使用目标语言片段', () => {
  const sys = buildSystem({ withHistory: false, mode: 'translate', language: 'en', custom: '' })
  assert.ok(sys.includes(TRANSLATE_TARGET.en))
  assert.ok(!sys.includes(LANGUAGE_FRAGMENTS.follow))
})

test('buildSystem: 自定义指令置于末尾且标注最高优先级', () => {
  const custom = '输出末尾附一句简短总结'
  const sys = buildSystem({ withHistory: false, mode: 'precise', language: 'follow', custom })
  assert.ok(sys.includes('Additional user requirements (highest priority, obey over anything above):'))
  assert.ok(sys.endsWith(custom))
})

test('headTail: 短文本原样返回', () => {
  const s = 'x'.repeat(4000)
  assert.equal(headTail(s), s)
})

test('headTail: 长文本保头保尾并插入省略标记', () => {
  const s = 'a'.repeat(5000) + 'Z'.repeat(2000)
  const out = headTail(s)
  assert.ok(out.startsWith('a'.repeat(2600)))
  assert.ok(out.endsWith('Z'.repeat(1400)))
  assert.ok(out.includes('\n…[中间省略]…\n'))
})

test('normalizeOptions: 非法模式/语言回退默认，custom 截断 500', () => {
  const o = normalizeOptions({ mode: 'nope', language: 'xx', custom: 'c'.repeat(600) })
  assert.equal(o.mode, 'precise')
  assert.equal(o.language, 'follow')
  assert.equal(o.custom.length, 500)
})

test('normalizeOptions: 合法值保留', () => {
  const o = normalizeOptions({ mode: 'creative', language: 'en', custom: '  hi  ' })
  assert.equal(o.mode, 'creative')
  assert.equal(o.language, 'en')
  assert.equal(o.custom, 'hi')
})

test('classifyHistoryItems: 按 kind 分类，goal/todo/compaction 只取第一条', () => {
  const { goalItem, todoItem, compactionItem, summaryItems, messageItems } = classifyHistoryItems([
    { kind: 'goal', text: '目标A' },
    { kind: 'goal', text: '目标B' },
    { kind: 'todo', text: '清单A' },
    { kind: 'compaction-summary', text: '摘要A' },
    { kind: 'compaction-summary', text: '摘要B' },
    { kind: 'tool-summary', text: '工具1' },
    { kind: 'tool-summary', text: '工具2' },
    { role: 'user', text: '用户消息' },
    { role: 'assistant', text: '助手消息' },
    { text: '无 kind 默认消息' },
  ])
  assert.equal(goalItem, '目标A')
  assert.equal(todoItem, '清单A')
  assert.equal(compactionItem, '摘要A')
  assert.deepEqual(summaryItems, ['工具1', '工具2'])
  assert.deepEqual(messageItems, [
    { role: 'user', text: '用户消息' },
    { role: 'assistant', text: '助手消息' },
    { role: 'user', text: '无 kind 默认消息' },
  ])
})

test('classifyHistoryItems: 非法条目被跳过，长消息被 headTail 截断', () => {
  const long = 'a'.repeat(9000)
  const { messageItems } = classifyHistoryItems([
    null,
    {},
    { kind: 'goal', text: 123 },
    { role: 'user', text: long },
  ])
  assert.equal(messageItems.length, 1)
  assert.ok(messageItems[0].text.length < 9000)
  assert.ok(messageItems[0].text.includes('…[中间省略]…'))
})

test('classifyHistoryItems: 非数组输入返回空结构', () => {
  const r = classifyHistoryItems(undefined)
  assert.equal(r.goalItem, null)
  assert.equal(r.todoItem, null)
  assert.equal(r.compactionItem, null)
  assert.deepEqual(r.summaryItems, [])
  assert.deepEqual(r.messageItems, [])
})
