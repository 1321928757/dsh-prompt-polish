import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const clientPath = path.join(here, '..', 'lib', 'client.js')
const source = readFileSync(clientPath, 'utf8')
const expectedMethods = ['getSettings', 'setSettings', 'optimizePrompt', 'cancelOptimize']

const bootEntries = []
const fakeWindow = {
  __ModuleLoader__: { load: (entry) => bootEntries.push(entry) },
  localStorage: { getItem: () => null, setItem: () => {} },
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
  innerHeight: 800,
}
const fakeDocument = {
  querySelector: () => ({}),
  createElement: () => ({ dataset: {}, textContent: '' }),
  head: { appendChild: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {},
}
new Function('window', 'document', source)(fakeWindow, fakeDocument)
assert.equal(bootEntries.length, 1)
assert.equal(bootEntries[0].id, 'dsh-prompt-polish')
assert.equal(typeof bootEntries[0].factory, 'function')

const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
  useRef: (initial) => ({ current: initial }),
  Fragment: 'Fragment',
}
const materialized = bootEntries[0].factory((specifier) => {
  if (specifier === 'react') return React
  throw new Error(`client bundle required an unresolved specifier: ${specifier}`)
})
assert.deepEqual(materialized.inject, ['remote'])
assert.equal(typeof materialized.apply, 'function')

function validateCodec(codec, subject) {
  assert.equal(typeof codec, 'object', `${subject} codec must be an object`)
  assert.equal(codec.mode, 'strict')
  assert.equal(typeof codec.typeSymbol, 'string')
  if (typeof codec.create !== 'function') {
    throw new Error(`typert: ${subject} strict codec has no create() factory`)
  }
}
function validateContribution(contribution) {
  assert.equal(contribution.package, 'dsh-prompt-polish')
  assert.equal(contribution.descriptors.length, expectedMethods.length)
  const methods = []
  for (const descriptor of contribution.descriptors) {
    methods.push(descriptor.method)
    validateCodec(descriptor.result, `${descriptor.id} result`)
    assert.equal(descriptor.parameters.length, 1)
    const parameter = descriptor.parameters[0]
    assert.deepEqual(
      { name: parameter.name, wire: parameter.wire, source: parameter.source },
      { name: 'args', wire: 'args', source: 'json' },
    )
    validateCodec(parameter.codec, `${descriptor.id} parameter ${parameter.name}`)
  }
  assert.deepEqual(methods, expectedMethods)
}

const state = { contribution: null, slots: [], injectCalls: [], effects: [] }
const api = Object.fromEntries(expectedMethods.map((method) => [method, async () => ({ ok: true, value: {} })]))
const remote = {
  async $mount(contribution) {
    validateContribution(contribution)
    state.contribution = contribution
    return async () => {}
  },
}
const slots = {
  inject(key, callback) {
    assert.equal(typeof callback, 'function')
    state.injectCalls.push(key)
    callback()
  },
  register(options, component) {
    state.slots.push({ options, component })
    return () => {}
  },
}
const ctx = {
  get(key) {
    if (key === 'slots') return slots
    if (key === 'remote') return remote
    if (key === 'remote.promptPolish') return api
    return undefined
  },
  effect(effect) { state.effects.push(effect) },
  timeout() { return () => {} },
}
await materialized.apply(ctx)
assert.ok(state.contribution)
assert.equal(state.slots.length, 2)
assert.deepEqual(state.injectCalls, ['conversation.input.left', 'settings.general.item'])
assert.equal(state.effects.length, 1)
for (const { options, component } of state.slots) {
  assert.equal(typeof options.id, 'string')
  assert.equal(typeof options.order, 'number')
  assert.equal(typeof options.label, 'string')
  assert.equal(typeof component, 'function')
}
assert.deepEqual(
  state.slots.map(({ options }) => [options.name, options.id]),
  [
    ['conversation.input.left', 'prompt-polish'],
    ['settings.general.item', 'prompt-polish-settings'],
  ],
)

// DSH 0.2 session slots expose reactive standard hooks. A direct `props.input`
// snapshot is not supplied; with a non-empty hook snapshot the control must be
// enabled rather than treating the draft as empty.
const leftSlot = state.slots.find(({ options }) => options.id === 'prompt-polish')
const renderedControl = leftSlot.component({
  sessionId: 'session-test',
  useInput: (selector) => selector({ draft: '请优化这段文字', occurrences: [], phase: 'plain', attachmentIds: [], queue: [] }),
  useSession: (selector) => selector({ removed: false, nodes: [] }),
  inputActions: { setDraft() {} },
  useProjection: () => undefined,
})
const controlTree = renderedControl.type(renderedControl.props)
const findButton = (node) => {
  if (!node || typeof node !== 'object') return null
  if (node.type === 'button' && node.props && node.props.className === 'dyn-opt-main') return node
  for (const child of node.children || []) {
    const found = findButton(child)
    if (found) return found
  }
  return null
}
const optimizeButton = findButton(controlTree)
assert.ok(optimizeButton, 'optimizer control should render its main button')
assert.equal(optimizeButton.props.disabled, undefined, 'non-empty DSH 0.2 hook draft must enable optimizer')

for (const codec of [
  state.contribution.descriptors[0].parameters[0].codec,
  state.contribution.descriptors[0].result,
]) {
  const schema = codec.create()
  assert.equal(typeof schema.parse, 'function')
  assert.equal(typeof schema.safeParse, 'function')
  assert.deepEqual(schema.parse({ ok: true }), { ok: true })
  assert.equal(schema.safeParse([]).success, false)
  assert.equal(schema.safeParse(null).success, false)
  assert.throws(() => schema.parse('primitive'))
}

const legacyCodec = { mode: 'strict', typeSymbol: 'dsh-prompt-polish#Args', schema: { parse: (value) => value } }
assert.throws(
  () => validateCodec(legacyCodec, 'legacy invocation parameter'),
  /has no create\(\) factory/,
)

await materialized.apply({ get: () => undefined, effect: () => {} })
await materialized.apply({
  get: (key) => key === 'slots' ? slots : undefined,
  effect: () => {},
})

console.log('Typert Client contract passed:', expectedMethods.length, 'methods;', state.slots.length, 'slots')
