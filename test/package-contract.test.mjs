import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const lock = readFileSync(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8')

assert.equal(manifest.version, '0.4.1')
assert.deepEqual(manifest.engines, { dsh: '>=0.2.0-rc.2 <0.3.0', node: '>=20' })
assert.equal(manifest.dsh.client.platform, 'web')
assert.ok(manifest.files.includes('lib/typert.host.js'))
assert.ok(manifest.files.includes('lib/client.js'))
assert.ok(manifest.files.includes('cordis.patch.yml'))

const expectedPeers = {
  '@deepseek-ai/cordis': '~4.0.4',
  '@deepseek-ai/cordis-plugin-timer': '1.1.6',
  '@deepseek-ai/dsh-agent-default-model': '>=0.2.0-rc.2 <0.3.0',
  '@deepseek-ai/dsh-client-ui-conversation': '>=0.2.0-rc.2 <0.3.0',
  '@deepseek-ai/dsh-fs': '>=0.2.0-rc.2 <0.3.0',
  '@deepseek-ai/dsh-llm': '>=0.2.0-rc.2 <0.3.0',
  '@deepseek-ai/dsh-sandbox-policy': '>=0.2.0-rc.2 <0.3.0',
  '@deepseek-ai/dsh-session': '>=0.2.0-rc.2 <0.3.0',
  '@deepseek-ai/dsh-typert-loader': '>=0.2.0-rc.2 <0.3.0',
}
for (const [name, range] of Object.entries(expectedPeers)) {
  assert.equal(manifest.peerDependencies[name], range, `unexpected peer range for ${name}`)
  assert.ok(lock.includes(`'${name}@`), `lockfile must include ${name}`)
}
assert.equal(manifest.peerDependencies['@deepseek-ai/dsh-client-runtime'], undefined)
assert.ok(lock.includes("'@deepseek-ai/dsh-typert-loader@0.2.0-rc.2"))
assert.ok(lock.includes("'@deepseek-ai/cordis@4.0.4'"))
assert.ok(lock.includes("'@deepseek-ai/dsh-client-ui-conversation@0.2.0-rc.2'"))
console.log('Package compatibility contract passed:', manifest.version, manifest.engines.dsh)
