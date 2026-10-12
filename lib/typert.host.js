/**
 * dsh-prompt-polish 的 Host 面 Typert 清单（由 typert-loader 自动扫描注册）。
 *
 * 手写清单，结构与 @deepseek-ai/dsh-typert-generator 产物一致：
 * `./typert` 导出 TYPERT；invocations 的 strict codec 通过 create() 返回 zod v4 schema。
 *
 * 四个 RPC 方法与动态插件时代的 harness.handle 一一对应（cancelOptimize 为
 * 新增的取消能力，动态插件时代无对应）：
 *  - promptPolish/getSettings     ← get-settings
 *  - promptPolish/setSettings     ← set-settings
 *  - promptPolish/optimizePrompt  ← optimize-prompt
 *  - promptPolish/cancelOptimize  ← 新增：按 runId 中止进行中的优化
 *
 * 入参与结果均为普通 JSON 对象（与宿主服务方法签名一一对应），
 * 因此 codec 采用宽松的 record schema：结构校验交给业务方法自身。
 */

import { z } from 'zod'

const argsSchema = z.record(z.string(), z.unknown())
const resultSchema = z.record(z.string(), z.unknown())

const args$codec = { mode: 'strict', typeSymbol: 'dsh-prompt-polish#Args', create: () => argsSchema }
const result$codec = { mode: 'strict', typeSymbol: 'dsh-prompt-polish#Result', create: () => resultSchema }

const invocation = (method) => ({
  id: 'dsh-prompt-polish#promptPolish/' + method,
  service: 'promptPolish',
  namespace: 'promptPolish',
  method,
  invocation: { kind: 'direct' },
  parameters: [
    { name: 'args', wire: 'args', source: 'json', codec: args$codec },
  ],
  result: result$codec,
})

export const TYPERT = {
  package: 'dsh-prompt-polish',
  face: 'host',
  schemas: [],
  invocations: [
    invocation('getSettings'),
    invocation('setSettings'),
    invocation('optimizePrompt'),
    invocation('cancelOptimize'),
  ],
  model: {
    services: [
      {
        description: 'dsh-prompt-polish 提示词优化服务 (ctx.promptPolish)：读取/写入三级设置，并调用本机已配置模型优化提示词草稿。Prompt optimization service (ctx.promptPolish): reads/writes the three-tier settings and optimizes prompt drafts through the locally configured model.',
        summary: 'dsh-prompt-polish 提示词优化服务 (dsh-prompt-polish prompt optimization service)。',
        tags: [],
        jsDoc: '/** dsh-prompt-polish 提示词优化服务 (ctx.promptPolish)。dsh-prompt-polish prompt optimization service (ctx.promptPolish). */',
        key: 'promptPolish',
        exportName: 'PromptPolishService',
        members: [
          {
            kind: 'method',
            name: 'getSettings',
            signature: 'getSettings(args: object): Promise<object>',
            summary: '读取工作区 L3 设置文件（.dsh/prompt-optimizer/settings.json）。Read the workspace L3 settings file.',
            jsDoc: '/**\n * 读取工作区 L3 设置文件。\n * @param args - { root: 工作区根目录 }\n * @returns { ok, settings? } 或 { ok:false, error }\n */',
          },
          {
            kind: 'method',
            name: 'setSettings',
            signature: 'setSettings(args: object): Promise<object>',
            summary: '浅合并写入工作区 L3 设置文件（受沙箱策略约束）。Shallow-merge a settings patch into the workspace L3 file (sandbox-policy bound).',
            jsDoc: '/**\n * 浅合并写入工作区 L3 设置文件。\n * @param args - { root, sessionId?, patch }\n * @returns { ok:true } 或 { ok:false, error? | reason?: "sandbox" }\n */',
          },
          {
            kind: 'method',
            name: 'optimizePrompt',
            signature: 'optimizePrompt(args: object): Promise<object>',
            summary: '按策略与本机模型重写提示词草稿，可携带目标、任务清单、压缩摘要与对话历史。Rewrite the draft through the local model with optional goal/todo/compaction-summary/history context.',
            jsDoc: '/**\n * 按策略与本机模型重写提示词草稿。\n * @param args - { draft, withHistory, history?, options?, runId? }\n * @returns { ok:true, text } 或 { ok:false, error }，用户取消时 { ok:false, cancelled:true, error:"已取消" }\n */',
          },
          {
            kind: 'method',
            name: 'cancelOptimize',
            signature: 'cancelOptimize(args: object): Promise<object>',
            summary: '按 runId 中止正在进行的优化请求。Abort an in-flight optimization request by runId.',
            jsDoc: '/**\n * 中止正在进行的优化请求。\n * @param args - { runId }\n * @returns { ok:true } 或 { ok:false, error }\n */',
          },
        ],
        types: [],
      },
    ],
    events: [],
    objects: [],
  },
}

export default TYPERT
