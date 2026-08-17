# dsh-prompt-polish

English | [中文](README.zh-CN.md)

Input-bar prompt optimizer for DeepSeek Harness (DSH): an **✨ Optimize** button that rewrites your draft into a clearer, more specific, more executable prompt — optionally grounded in the current session's context.

- 6 strategies × 3 languages plus custom instructions
- Optional context: goal, todo list, compaction summary, tool results, conversation history
- Confirm dialog (Adopt / Keep draft / Later) — the draft is never silently overwritten
- Last-5 optimization history (review / refill / delete)
- Composer freeze while optimizing, with dual timeouts
- Three-tier settings persistence (browser L1 → settings row L2 → workspace file L3)

## Install

```sh
dsh plugin --profile web add github:1321928757/dsh-prompt-polish#v0.2.0
```

Or from npm (once published):

```sh
dsh plugin --profile web add dsh-prompt-polish
```

PowerShell one-liner (bootstraps pnpm, pins versions, self-checks):

```powershell
irm https://raw.githubusercontent.com/1321928757/dsh-prompt-polish/v0.2.0/scripts/install.ps1 | iex
```

Restart `dsh web` and the **✨ Optimize** button appears on the left of the composer. Verify:

```sh
dsh --profile web --dump-config | findstr dsh-prompt-polish
```

Uninstall: `dsh plugin --profile web remove dsh-prompt-polish`

> Requirements: DeepSeek Harness (Node ≥ 20). The package ships prebuilt JavaScript, so git installs need no build approval. Every model call goes through the model you already configured in DSH; nothing is sent to third parties.

## Usage

| Entry | What it does |
| --- | --- |
| Composer **✨ Optimize** | Rewrites the draft with the current strategy; includes session context when 📖 is on |
| Composer **⚙** | Settings panel: 📖 context toggle, 🔧 tool-results toggle, mode, language, custom instructions, optimization history, carry stats |
| Settings page row | L2 settings row, linked with the panel toggles |

Modes: **Default** (disambiguate and fix) / Concise / Structured (目标·背景·要求·期望输出) / Creative / Translate / Code request. Languages: follow draft / Chinese / English (target language in Translate mode).

**Output guarantee**: the result is always the user's first-person request to an AI — it never opens with "可以" / "好的" / "我来" and never answers the draft's questions. This is a fixed, byte-identical prompt red line.

## Screenshots

Composer with the ✨ Optimize button and the ⚙ settings toggle:

![Composer with the Optimize button](assets/composer.png)

Optimization result confirm dialog (Adopt / Keep draft / Later):

![Optimization confirm dialog](assets/dialog.png)

Settings panel (context toggles, mode, language, custom instructions, optimization history):

![Settings panel](assets/settings.png)

## Settings persistence (three tiers)

1. **L1 browser**: `localStorage` key `ptopt.settings.v1`, effective immediately;
2. **L2 settings page**: a row under DSH Settings → General, linked with the panel;
3. **L3 workspace file**: `<workspace>/.dsh/prompt-optimizer/settings.json`, synced across browsers/machines; writes are bound by the DSH sandbox policy and silently degrade to L1 when denied.

## Compatibility

- Required host capabilities (all provided by the default web profile via `@deepseek-ai/dsh-base`): `llm`, `sessions`, `fs`, `sandboxPolicy`, `agentDefaultModel`, `timer`, `typert-loader`;
- The browser half talks to the host over Typert RPC (`remote.promptPolish.*`) — no extra network endpoints;
- All UI consumes `--dsw-*` theme tokens and follows the global light/dark theme.

## Development

```sh
node --test test/          # unit tests (strategy assembly, truncation, classification)
node --check lib/index.js  # syntax check
```

Local install loop:

```sh
dsh plugin --profile demo add ./path/to/dsh-prompt-polish
dsh --profile demo --dump-config
```

## License

[MIT](LICENSE). Not affiliated with DeepSeek. Installing runs third-party code on your machine — review the source first.
