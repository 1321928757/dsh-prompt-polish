# dsh-prompt-polish

[English](README.md) | 中文

DeepSeek Harness（DSH）输入栏提示词优化插件：一个 **✨ 优化** 按钮，一键把草稿重写为更清晰、更具体、更可执行的提示词，并可选携带当前会话的背景信息。

- 6 种策略 × 3 种语言 + 自定义指令
- 可选上下文：目标、任务清单、压缩摘要、工具结果、对话历史
- 结果确认弹窗（采用 / 保留原稿 / 稍后再看），绝不静默覆盖草稿
- 最近 5 次优化历史（回看 / 回填 / 删除）
- 优化期间冻结输入框，双超时防卡死
- 三级设置持久化（浏览器 L1 → 设置页行 L2 → 工作区文件 L3）

## 安装

```sh
dsh plugin --profile web add github:1321928757/dsh-prompt-polish#v0.2.1
```

或从 npm 安装（发布后可用）：

```sh
dsh plugin --profile web add dsh-prompt-polish
```

PowerShell 一键安装（自动补齐 pnpm、固定版本、装完自检）：

```powershell
irm https://raw.githubusercontent.com/1321928757/dsh-prompt-polish/v0.2.1/scripts/install.ps1 | iex
```

装完重启 `dsh web`，输入栏左侧即出现 **✨ 优化** 按钮。验证：

```sh
dsh --profile web --dump-config | findstr dsh-prompt-polish
```

卸载：`dsh plugin --profile web remove dsh-prompt-polish`

> 依赖：DeepSeek Harness（Node ≥ 20）。插件本身无构建步骤，git 安装不需要任何构建授权；所有模型请求走本机已在 DSH 中配置的模型，不向任何第三方发送数据。

## 使用

| 入口 | 功能 |
| --- | --- |
| 输入栏 **✨ 优化** | 按当前策略重写草稿；📖 开关开启时携带会话背景 |
| 输入栏 **⚙** | 设置面板：📖 上下文开关、🔧 工具结果开关、模式、语言、自定义指令、优化历史、本次携带统计 |
| 设置页「📖 参考聊天记录上下文」 | L2 设置行，与面板开关联动 |

模式：**默认**（消歧修正）/ 压缩精简 / 结构化（目标·背景·要求·期望输出）/ 创意扩展 / 翻译 / 代码请求。语言：跟随原文 / 中文 / 英文（翻译模式下为目标语言）。

**输出保证**：结果永远是「用户要发送给 AI 的第一人称请求」，不会以「可以」「好的」「我来」开头，也不会回答草稿中的问题——这是构建期提示词的红线，逐字节固定。

## 截图

输入栏的 ✨ 优化按钮与 ⚙ 设置入口：

![输入栏优化按钮](assets/composer.png)

优化结果确认弹窗（采用 / 保留原稿 / 稍后再看）：

![优化确认弹窗](assets/dialog.png)

设置面板（上下文开关、模式、语言、自定义指令、优化历史）：

![设置面板](assets/settings.png)

## 设置持久化（三级）

1. **L1 浏览器**：`localStorage` 键 `ptopt.settings.v1`，即时生效；
2. **L2 设置页**：DSH 设置 → 通用 里的开关行，与面板联动；
3. **L3 工作区文件**：`<workspace>/.dsh/prompt-optimizer/settings.json`，跨浏览器/机器同步；写入受 DSH 沙箱策略约束，被拒时静默降级 L1（不报错、不阻塞）。

## 兼容性

- 宿主能力要求（web profile 内置）：`llm`、`sessions`、`fs`、`sandboxPolicy`、`agentDefaultModel`、`timer`、`typert-loader` —— 均为 `@deepseek-ai/dsh-base` 默认提供；
- 浏览器侧经 Typert RPC（`remote.promptPolish.*`）与宿主通信，无额外网络端点；
- UI 全部使用 `--dsw-*` 主题令牌，跟随全局亮/暗主题。

## 开发

```sh
node --test test/          # 单测（策略组装、截断、分类）
node --check lib/index.js  # 语法检查
```

本地安装调试：

```sh
dsh plugin --profile demo add ./path/to/dsh-prompt-polish
dsh --profile demo --dump-config
```

## License

[MIT](LICENSE)。本插件与 DeepSeek 官方无隶属关系；安装即在你的机器上运行第三方代码，请自行审阅源码。
