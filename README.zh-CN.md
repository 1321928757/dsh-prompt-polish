# dsh-prompt-polish

[English](README.md) | 中文

DeepSeek Harness（DSH）输入栏提示词优化插件。点击 **优化**，将当前草稿交给 DSH 中配置的模型提供商处理，并在决定是否使用前先查看结果。

> **数据边界：** 插件不新增独立 API 端点；优化请求通过 DSH 已配置的模型提供商和模型完成。开启上下文后，请求可能包含最近消息、当前目标与任务清单、压缩摘要以及可选的工具调用结果摘要。因此，草稿和已开启的上下文对该模型提供商可见；将插件用于敏感会话前，请先查看提供商的隐私和数据留存政策。

## 功能入口

| 入口 | 提供的功能 |
| --- | --- |
| **输入栏 → 优化** | 重写当前草稿，展示结果供确认，或停止正在进行的优化。 |
| **输入栏 → 设置齿轮** | 配置上下文、工具摘要、模式和语言，并打开完整设置弹窗。 |
| **DSH 设置 → 通用** | 注册在 `settings.general.item` 的关联设置行，用于切换「参考聊天记录上下文」。其他选项仍在输入栏设置中。 |

## 功能特性

- 六种提示词重写模式：**默认**、**压缩精简**、**结构化**、**创意扩展**、**翻译并优化**、**代码请求**。
- 三种语言选择：**跟随原文**、**中文**、**英文**。显式语言选择会在自定义偏好之后生效；在「翻译并优化」模式中，**跟随原文**表示只优化、不翻译。
- 可选携带当前会话上下文：目标、任务清单、压缩摘要、最近消息，以及在两个上下文开关同时开启时的简短工具结果摘要。
- 结果弹窗会展示原稿和优化结果，并提供 **采用优化结果**、**保留原稿**、**稍后再看**。结果不会自动采用。
- 模型流式输出期间可以停止；当 DSH 会话 block API 可用时，输入栏阻塞会立即解除，迟到的取消结果会被丢弃。
- 失败结果会保留原稿并显示失败原因，支持 **重试**。
- 当前挂载组件内保存最近五次优化尝试。成功记录可查看或显式回填到输入栏；失败记录也会保留为失败记录。
- 设置会保存到本地，并尽力同步到工作区文件。
- 浏览器 UI 使用 DSH 主题令牌，跟随亮/暗主题，并支持键盘焦点、Escape/点击外部关闭、减少动效和高对比度边框。输入栏控件保持低噪声：**优化**按钮静止时透明，仅在悬浮、聚焦或按下时显示宿主交互背景，文字颜色也会贴近相邻 DSH 控件并降低强调度。

## 模式与语言行为

| 模式 | 优化器会要求模型做什么 |
| --- | --- |
| **默认**（`precise`） | 消除歧义、改善结构，同时保留原始意图和有依据的约束；不新增无依据的交付物。 |
| **压缩精简**（`concise`） | 删除重复和填充表达，同时保留目标、约束、示例、验收标准和要求的输出格式。 |
| **结构化**（`structured`） | 使用有意义的标题组织内容，例如目标、背景、要求、期望输出；空区块可以省略。 |
| **创意扩展**（`creative`） | 增加不超过三个有用、可执行的角度；不确定内容会标记为可选项或示例，而不是事实或强制任务。 |
| **翻译并优化**（`translate`） | 自然地重写；只有当所选目标语言与原稿不同时才进行翻译。 |
| **代码请求**（`code`） | 将适用的编程信息组织为目标、背景、环境、输入、输出、约束、边界情况和验收标准，不臆造未知技术或 API。 |

选择 **跟随原文** 时保留草稿语言；选择 **中文** 或 **英文** 时锁定最终请求语言。自定义指令最多 500 字，可以影响可选行为，但优化器会将它置于输出契约、草稿/上下文边界和显式语言锁定之后。

优化器会要求模型输出一条用户准备发给 AI 的请求，而不是回答、计划、解释或 Markdown 代码围栏。这属于模型指令，不是确定性的输出过滤；采用前请检查生成文本。

## 运行行为与限制

这是一个浏览器输入栏扩展，不是独立的命令行工具，也不是暴露给 Agent 的模型工具。浏览器通过 Typert RPC 调用 Host 的 `promptPolish` 服务，Host 再通过 DSH 的 LLM 服务流式处理请求。

| 范围 | 实际行为 |
| --- | --- |
| 草稿校验 | 空白或仅空格的草稿会被拒绝；超过 **20,000 字符**的草稿会被拒绝。 |
| 上下文收集 | 用户主动开启后才收集。浏览器最多扫描 **20 个消息节点**，消息文本滚动上限为 **8,000 字符**。单条消息超过 4,000 字符时，保留开头 2,600 和结尾 1,400 字符。 |
| 目标、清单与压缩摘要 | 有效的当前目标和任务清单会放在消息回合之前。压缩摘要最多 2,000 字符，并会停止继续收集更早的原始消息。 |
| 工具结果 | 只有上下文开关和工具结果开关同时开启时才构建。每个被选中的助手回合最多摘要最近三个工具调用，每条结果取前 300 字符。 |
| Host 上下文预算 | Host 最多接收 30 条消息项和 60 条工具摘要项，然后还会根据所选模型的上下文预算再次裁剪。因此部分上下文可能被省略。 |
| 流式超时 | 连续 **30 秒**没有新 chunk，或总耗时达到 **120 秒**时停止，并返回可重试的错误。 |
| 输出预算 | 请求最多 **4,000 output tokens**，还会受所选模型和剩余上下文空间限制。请求的最低值为 1,200 tokens；模型达到上限时可能返回带 `truncated` 标记的结果。 |
| 取消 | 每次运行都有 `runId`。点击停止会调用 `cancelOptimize`，中止 Host 流，并丢弃迟到结果。 |
| 采用保护 | 必须明确点击采用，并且输入栏内容必须仍与本次优化的原稿完全一致。输入发生变化时，采用按钮会被禁用。 |

## 环境要求与兼容性

- 需要提供插件 Host 和浏览器依赖的兼容 DSH Web profile。
- **需要 DSH 0.2.0-rc.2 及以上、低于 0.3.0。** 插件 0.4.1 保留 DSH 0.2 的 Typert 迁移并修复完整设置页背景；插件 0.4.0 首次将 Host 与 Client 两侧 Typert strict codec 迁移到 DSH 0.2 的 `create()` factory 契约，不再支持 DSH 0.1.x；0.1.x 环境请使用插件 0.3.2。
- 当前包以 `@deepseek-ai/cordis ~4.0.4`、`package.json` 中列出的 DSH `0.2.0-rc.2` 服务包以及 React `^18.2.0` 为目标，并直接依赖 `zod ^4.4.3`；包声明 Node.js `>=20`。
- 优化必须有可用的 DSH 模型提供商。提供商可用性、模型限制、网络访问和提供商政策不属于本插件控制范围。

## 安装、更新与卸载

### 安装固定 GitHub 版本

以下命令会将当前文档对应的版本安装到 `web` profile：

```powershell
dsh plugin --profile web add github:1321928757/dsh-prompt-polish#v0.4.1
```

安装后重启现有的 DSH Web 进程，再检查 profile 组合：

```powershell
dsh --profile web --dump-config | findstr dsh-prompt-polish
```

重启后，输入栏左侧应出现 **优化** 按钮和设置齿轮。如果没有出现，请查看[故障排查](#故障排查)。

### 更新到新的固定版本

仓库中的安装脚本通过再次执行 `dsh plugin ... add`，让已安装版本对齐脚本固定的 tag。也可以手动使用想要的发布 tag：

```powershell
dsh plugin --profile web add github:1321928757/dsh-prompt-polish#v0.4.1
```

将 `v0.4.1` 替换为更新的已发布 tag，然后重启该 profile 的 DSH Web 进程，并重新执行 `--dump-config` 检查。

### 从 npm 安装

仅当该包已经发布并且能在你使用的 registry 中找到时使用：

```powershell
dsh plugin --profile web add dsh-prompt-polish
```

### PowerShell 一键安装脚本

仓库包含一个固定版本安装脚本：

```powershell
irm https://raw.githubusercontent.com/1321928757/dsh-prompt-polish/v0.4.1/scripts/install.ps1 | iex
```

执行远程 `irm | iex` 前请先审阅脚本。脚本会检查 `dsh`，确保 pnpm 可用，固定使用 pnpm `11.21.0`；有 Git 时优先使用 Git，没有 Git 时回退到 GitHub tag 压缩包；默认将固定版本安装到 `web` profile。它可能通过 Corepack 激活 pnpm，或通过 npm 全局安装 pnpm。下载后运行脚本时可传入 `-Profile <name>`；如果使用其他 profile，请在重启、验证和卸载命令中使用相同的 profile。

如需先下载并查看脚本：

```powershell
$path = Join-Path $PWD install.ps1
Invoke-WebRequest https://raw.githubusercontent.com/1321928757/dsh-prompt-polish/v0.4.1/scripts/install.ps1 -OutFile $path
Get-Content $path
powershell -NoProfile -ExecutionPolicy Bypass -File $path -Profile web
```

### 卸载

```powershell
dsh plugin --profile web remove dsh-prompt-polish
```

卸载后重启该 profile 的 DSH Web 进程。该命令只从 profile 中移除包，不会删除 localStorage 或已有的工作区设置文件。

### 使用独立 profile 本地开发

建议将本地开发与日常使用的 profile 分开：

```powershell
dsh plugin --profile demo add E:\path\to\dsh-prompt-polish
dsh --profile demo --dump-config
```

## 快速开始

1. 在 DSH 输入栏输入一段草稿。
2. 可选：打开设置齿轮，启用 **参考聊天记录上下文**。只有同时开启上下文和工具结果开关，才会在请求中加入工具结果摘要。
3. 选择模式和语言。在 **翻译并优化** 模式下，语言选择器表示目标语言。
4. 如果需要最多 500 字的自定义指令，或想查看上下文预览和最近尝试记录，打开 **完整设置**。
5. 点击 **优化**。当会话 block API 可用时，请求运行期间输入栏会被阻塞；按钮会变成 **停止优化**。
6. 在结果弹窗中检查原始提示词和生成的提示词。
7. 选择 **采用优化结果**、**保留原稿** 或 **稍后再看**。后两者只关闭结果，不会保存提醒。输入发生变化时，旧结果不能覆盖新输入。

**重试**会使用失败尝试的原始快照；历史中的 **回填** 是一次明确写入输入栏的操作，与自动采用不同。

## 截图

以下截图使用已发布的 GitHub Raw 绝对地址，以便在仓库、npm 和外部市场页面中渲染；前提是仓库资源已经 push。

### 输入栏入口

**优化**按钮和设置齿轮注册在 `conversation.input.left` 槽位。当前 UI 中，按钮静止时保持透明并使用更淡的文字；悬浮或聚焦时才显示宿主交互背景，不再保留持续性的高亮：

![输入栏优化按钮](https://raw.githubusercontent.com/1321928757/dsh-prompt-polish/main/assets/composer.png)

### 采用前查看结果

结果弹窗会展示原稿和生成的提示词，在写回输入栏前不会自动修改草稿：

![优化结果确认弹窗](https://raw.githubusercontent.com/1321928757/dsh-prompt-polish/main/assets/dialog.png)

### 快速设置与完整设置

齿轮会打开上下文、工具摘要、模式和语言的快速设置；完整弹窗还会显示自定义指令、上下文统计、当前组件内的历史记录和持久化说明：

![设置面板](https://raw.githubusercontent.com/1321928757/dsh-prompt-polish/main/assets/settings.png)

仓库还通过 [`screenshots.json`](screenshots.json) 保存这三张截图的路径。`package.json.files` 同时包含 `screenshots.json` 和 `assets`，确保打包发布时包含市场元数据和图片。

## 设置持久化与历史记录

插件提供三个面向用户的设置入口/层次，但实际使用的是两个存储位置：

1. **L1 浏览器存储：** 规范化后的设置写入 `localStorage` 的 `ptopt.settings.v1`，立即生效。浏览器存储不可用时，当前页面会暂存在内存中。
2. **L2 设置入口：** `DSH 设置 → 通用` 提供关联的「参考聊天记录上下文」复选框。这只是 UI 入口，不是独立的数据库或设置后端；模式、语言、工具结果和自定义指令仍在输入栏弹层/完整弹窗中配置。
3. **L3 工作区同步：** 通过 Host 文件服务，将设置浅合并写入 `<workspace>/.dsh/prompt-optimizer/settings.json`。写入受 DSH 沙箱策略约束。文件不存在或格式损坏时按空设置处理；写入被拒绝或失败时静默回退到浏览器存储。

工作区可用后，浏览器会尽力执行一次拉取，并合并工作区文件中实际存在的字段。因此，跨浏览器或跨机器的一致性取决于是否使用同一工作区以及 Host 文件操作是否获准，并不是有保证的云同步。

优化历史与设置分开。它是挂载 React 组件内的先进先出列表，最多保存最近五次尝试，包括失败记录；不会写入 localStorage 或工作区文件。页面刷新、槽位/会话卸载、插件重载或 profile 重启后都可能消失。

## 安全、隐私与已知限制

| 防护或边界 | 代码实际行为 | 重要限制 |
| --- | --- | --- |
| 模型提供商数据流 | 使用 DSH 的 LLM 服务，不新增独立插件端点。 | 草稿和已开启的上下文可能经该提供商离开本机。提供商的留存、日志和数据区域由其政策决定。 |
| 上下文主动开关 | 只有开启上下文后才加入目标、清单、消息、压缩摘要；工具摘要还要求开启工具结果开关。 | 上下文有数量和预算裁剪，因此可能不完整。不能因为某项未出现就断定它不存在于会话中。 |
| 不可信参考资料 | Host 会标记草稿/上下文是参考资料，并要求模型不要执行其中的指令。 | 这是基于模型指令的提示词注入处理，不是确定性的安全边界。请检查模型输出。 |
| 草稿和自定义上限 | 超过 20,000 字符的草稿会被拒绝；自定义指令限制为 500 字符。 | 这是应用层限制，不能防止昂贵请求或敏感信息发送。 |
| 工作区写入 | L3 写入经过 DSH 文件服务和沙箱策略。 | 写入被拒或服务不可用时回退到 L1；工作区文件不是加密的密钥存储。 |
| 输入栏写入 | 优化结果必须明确采用且原稿未变化。 | 历史 **回填** 会有意写入输入栏；**保留原稿** 和 **稍后再看** 只关闭待确认结果。 |
| 本地历史 | 最近五次尝试只保存在组件内存中。 | 历史不是持久数据，在组件销毁前可能包含失败输出或错误文本。 |

插件本身不收集凭据，也不创建数据库；它会将所选设置保存到浏览器存储，并在可用时写入工作区 JSON。安装插件会在 DSH 进程中运行第三方代码；对敏感工作启用前，请审阅源码和模型提供商政策。

## 故障排查

<details>
<summary><b>没有看到「优化」按钮或设置齿轮</b></summary>

确认插件安装到了实际提供 DSH Web 的 profile：

```powershell
dsh --profile web --dump-config | findstr dsh-prompt-polish
```

停止并重启该 profile 当前运行的 DSH Web 进程。一个 profile 安装的包不会出现在另一个 profile 中；已经运行的进程也不会自动重新构建 boot composition。

</details>

<details>
<summary><b>「优化」按钮不可用</b></summary>

输入为空或只有空格、会话已移除，或输入当前存在其他 occurrence/action 状态时，按钮会禁用。优化进行中按钮会有意变为可用的 **停止优化**。

</details>

<details>
<summary><b>没有模型或请求失败</b></summary>

插件使用当前 DSH 的 provider/model 选择；没有显式选择时，会尝试使用第一个可用的 provider/model。请确认 DSH 中存在可用的模型服务和模型、提供商可访问，并且模型能容纳请求的上下文和输出。失败会在结果弹窗中保留失败记录，并提供 **重试**。

</details>

<details>
<summary><b>为什么没有包含某段上下文或工具结果？</b></summary>

只有开启上下文后，消息、目标、任务清单或压缩摘要才会发送。工具摘要还要求同时开启工具结果开关。浏览器和 Host 都会执行字符数、条目数和模型上下文预算裁剪，因此较旧或优先级较低的内容可能省略；附件和非文本 block 不会加入。

</details>

<details>
<summary><b>结果被标记为可能被截断</b></summary>

模型达到了长度或输出上限。只要存在文本，Host 会返回带 `truncated` 标记的结果，结果弹窗会显示提示。请仔细检查，尝试缩短草稿/上下文，换用输出预算更大的模型，或重新优化。

</details>

<details>
<summary><b>修改草稿后不能采用结果</b></summary>

这是有意设计的保护。只有当前草稿与本次运行使用的快照完全一致时，才允许采用，避免旧结果覆盖新输入。请针对新草稿重新点击优化，或显式使用历史记录中的 **回填**。

</details>

<details>
<summary><b>请求超时或我点击了「停止优化」</b></summary>

连续 30 秒没有新的流式 chunk，或总耗时达到 120 秒时，请求会停止。点击 **停止优化** 会中止 Host 请求，在支持时立即解除输入栏阻塞，显示短暂的取消提示，并忽略迟到结果。超时失败可以重试。

</details>

<details>
<summary><b>工作区设置没有持久化</b></summary>

L3 是尽力而为，并受 DSH 沙箱策略约束。请确认已选择工作区且文件可写。写入被拒时不会阻塞使用，插件继续使用浏览器设置。受限浏览环境也可能无法使用浏览器存储，此时设置只能保留到当前页面。

</details>

<details>
<summary><b>优化历史为什么消失了</b></summary>

历史记录有意只保存在当前组件/会话内存中，不是持久存储。刷新页面、卸载槽位、重载插件或重启 profile 都可能清除历史。设置持久化不会持久化历史记录。

</details>

## 工作原理

```text
输入栏槽位 + 设置行
          │ 浏览器 UI
          │ Typert remote.promptPolish.*
          ▼
Host promptPolish 服务
          ├── 尽力读写工作区设置
          ├── 组装模式、语言、自定义指令和可选上下文规则
          └── 通过 DSH 已配置的 LLM 提供商流式处理
```

- Host bundle 由 [`cordis.patch.yml`](cordis.patch.yml) 挂载，并提供 `getSettings`、`setSettings`、`optimizePrompt`、`cancelOptimize`。
- 浏览器 bundle 注册 `conversation.input.left` 和 `settings.general.item`。
- 浏览器到 Host 的调用使用 `lib/typert.host.js` 声明的 Typert contribution；插件不暴露其他 HTTP API。
- 停止、更新或卸载时，只要对应 DSH 服务可用，活动流和浏览器侧输入栏 block 都会被清理。

## 开发与验证

仓库提供预构建 JavaScript bundle，没有声明 package build 脚本。在仓库根目录运行：

```powershell
node --test test/shared.test.mjs
Get-ChildItem lib\*.js | ForEach-Object { node --check $_.FullName }
pnpm pack --dry-run
git diff --check
```

单元测试覆盖共享策略组装、选项归一化、历史分类、截断和流式结束原因处理。可以使用独立 profile 做运行时冒烟测试：

```powershell
dsh plugin --profile demo add E:\path\to\dsh-prompt-polish
dsh --profile demo --dump-config
```

发布文档或截图更新前，请确认 [`screenshots.json`](screenshots.json) 中每个路径都存在，打包清单包含 `assets` 和 `screenshots.json`。截图 push 后，再确认上文三个 GitHub Raw 地址返回 HTTP 200。

## 许可证与免责声明

[MIT](LICENSE)。项目历史和归属信息见 [`NOTICE`](NOTICE)。本项目是独立维护的社区插件，与 DeepSeek 或 `@deepseek-ai/*` 软件包无隶属关系。安装会在你的机器上运行第三方代码，请在安装前审阅源码。
