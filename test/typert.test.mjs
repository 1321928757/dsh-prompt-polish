import assert from 'node:assert/strict'
import { TYPERT } from '../lib/typert.host.js'
import { apply } from '../lib/index.js'

const expectedMethods = ['getSettings', 'setSettings', 'optimizePrompt', 'cancelOptimize']
assert.equal(TYPERT.package, 'dsh-prompt-polish')
assert.equal(TYPERT.face, 'host')
assert.deepEqual(TYPERT.schemas, [])
assert.deepEqual(TYPERT.invocations.map((entry) => entry.method), expectedMethods)

for (const invocation of TYPERT.invocations) {
  assert.equal(invocation.id, 'dsh-prompt-polish#promptPolish/' + invocation.method)
  assert.equal(invocation.service, 'promptPolish')
  assert.equal(invocation.namespace, 'promptPolish')
  assert.deepEqual(invocation.invocation, { kind: 'direct' })
  assert.equal(invocation.parameters.length, 1)

  const parameter = invocation.parameters[0]
  assert.deepEqual(
    { name: parameter.name, wire: parameter.wire, source: parameter.source },
    { name: 'args', wire: 'args', source: 'json' },
  )
  assert.equal(parameter.codec.mode, 'strict')
  assert.equal(parameter.codec.typeSymbol, 'dsh-prompt-polish#Args')
  assert.equal(typeof parameter.codec.create, 'function')
  assert.equal(parameter.codec.schema, undefined)
  assert.ok(parameter.codec.create().safeParse({}).success)
  assert.equal(parameter.codec.create().safeParse(null).success, false)

  assert.equal(invocation.result.mode, 'strict')
  assert.equal(invocation.result.typeSymbol, 'dsh-prompt-polish#Result')
  assert.equal(typeof invocation.result.create, 'function')
  assert.equal(invocation.result.schema, undefined)
  assert.ok(invocation.result.create().safeParse({ ok: true }).success)
  assert.equal(invocation.result.create().safeParse([]).success, false)
}

const remoteService = TYPERT.model.services.find((service) => service.key === 'promptPolish')
assert.ok(remoteService)
assert.deepEqual(remoteService.members.map((member) => member.name), expectedMethods)
assert.deepEqual(TYPERT.model.events, [])
assert.deepEqual(TYPERT.model.objects, [])

const provided = []
const effects = []
apply({
  get: (key) => key === 'timer' ? {} : undefined,
  provide: (key, service) => provided.push({ key, service }),
  effect: (factory, label) => effects.push({ factory, label }),
})
assert.equal(provided.length, 1)
assert.equal(provided[0].key, 'promptPolish')
assert.equal(provided[0].service.typertRemote.serviceKey, 'promptPolish')
assert.equal(provided[0].service.typertRemote.namespace, 'promptPolish')
assert.equal(effects.length, 1)

console.log('Typert Host manifest contract passed:', expectedMethods.length, 'methods')
