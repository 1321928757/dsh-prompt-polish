# Changelog

## [0.4.3] - 2026-11-16

### Fixed
- 修复「打开完整设置」后弹窗与输入栏互相穿插：完整设置弹窗改经 `react-dom` 的 `createPortal` 挂载到 `document.body`，`z-index` 提到顶层（`2147483000`，与仓库内其他 DSH 插件一致）。此前弹窗在输入栏槽位子树内使用 `position:fixed`，受宿主输入栏层叠上下文约束，弹窗中部会被输入栏按钮压住、遮罩也压不住宿主 chrome。`react-dom` 解析失败时回退为就地渲染，不至于整块 UI 崩溃。
- 主题变量 `--pp-*` 同时挂到 `.dyn-opt-root` 与 `.dyn-opt-dialog-backdrop`：portal 之后弹窗不再是插件根节点后代，否则卡片、页头、页脚会丢失配色。
- `@supports not (color-mix())` 回退块同步覆盖弹窗遮罩层。

### Tests
- 客户端契约测试新增 portal 契约断言：`react-dom` 必被解析、`createPortal(node, document.body)`、顶层 `z-index`、共享变量选择器。

## [0.4.2] - 2026-11-16

### Fixed
- 修复 DSH 0.2.2-rc.3 上点击「优化」报「没有可用的模型服务」：宿主服务改为**使用时解析**（`ctx.get`），不再在 `apply()` 里捕获快照。Cordis 只把「提供方 fiber 已 ACTIVE」的服务暴露给 `ctx.get`，而本插件在组合树中排在最后，挂载瞬间 `llm` / `fs` / `sandboxPolicy` 可能尚未激活，旧代码把它们永久固化成 `undefined`。
- 同一根因导致的 L3 工作区设置（`.dsh/prompt-optimizer/settings.json`）读写始终返回「文件服务不可用」，现已恢复；沙箱策略与 `sessions` 同样改为按需解析。
- 模型能力探测改用 0.2.2 的 `llm.resolveModelInfo()`（`context.contextWindow` / `defaultMaxTokens`），旧版 `llm.listModels()` 上的 `contextLength` / `maxTokens` 保留为回退。此前探测永远取不到元数据，输入预算与输出上限退化为固定默认值。
- 模型失败时附带宿主 `FinishReason.failure.message`，界面直接显示具体原因（如缺 API Key、鉴权失败），不再只有 `模型调用异常: error`。
- 空闲/整体超时停止等待时同时中止上游流，避免请求悬挂到整体超时。

### Added
- `test/host-services.test.mjs`：用最小 ctx 假件复现「先挂载、后激活服务」的真实时序，覆盖模型解析、能力探测回退、失败原因透出与 L3 读写。

### Migration
- 已安装 0.4.1 的 profile 更新到 0.4.2 后需**完整重启该 profile**（`dsh plugin --profile <name> add <package>` 或插件页更新）。
- `engines.dsh` 仍为 `>=0.2.0-rc.2 <0.3.0`：0.2.2-rc.3 为本次验证目标，0.2.0/0.2.1 通过 `listModels` 回退路径保持可用。

## [0.4.1] - 2026-10-12

### Fixed
- Make the full prompt-polish settings modal opaque and theme-aware under DSH 0.2, preventing the conversation behind it from showing through the form.
- Keep the lightweight composer settings popover's existing translucent appearance unchanged.
- Add a Client style regression check for the modal surface and popover boundary.

## [0.4.0] - 2026-10-12

### Breaking
- **DSH 0.2.0-rc.2+ required; DSH 0.1.x is no longer supported.** Host and browser-side Typert strict codecs now use the DSH 0.2 `create()` factory contract.

### Changed
- Declare DSH and Node.js runtime compatibility ranges and align DSH peer dependencies with the 0.2.0-rc.2 runtime.
- Add Host and Client Typert contract coverage, including a regression check for the rejected schema-only codec form and slot contract checks.
- Add isolated DSH 0.2 Headless and Web acceptance coverage.

### Migration
- On DSH 0.1.x, remain on plugin 0.3.2.
- On DSH 0.2.0-rc.2 or newer below 0.3.0, install plugin 0.4.0 with `dsh plugin --profile <profile> add ...` to reconcile bundle membership, then fully restart that DSH Web profile.
