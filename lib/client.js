/**
 * dsh-prompt-polish 浏览器端 bundle（单文件，经 __ModuleLoader__ 加载）。
 *
 * 提供两个界面：
 *  - conversation.input.left：✨ 优化 按钮 + ⚙ 设置面板 + 结果确认弹窗 +
 *    最近 5 次优化历史；
 *  - settings.general.item：设置页「📖 参考聊天记录上下文」开关行。
 *
 * 数据通道：
 *  - remote.promptPolish.*（Typert RPC，见 ./typert.host.js 与下方 CONTRIBUTION）
 *    → 三级设置持久化与提示词优化；
 *  - 宿主槽位 props（session/input/sessionId/useProjection/inputActions）
 *    → 会话上下文采集、草稿读写与输入冻结。
 *
 * 样式全部使用 --dsw-* 主题变量，跟随全局亮/暗主题。
 */

window.__ModuleLoader__.load({
  id: 'dsh-prompt-polish',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')

    // ── 样式注入（防重复，随插件卸载由宿主 HMR 驱动清理）─────────────────
    const css = `
      .dyn-opt-root {
        display:inline-flex; align-items:stretch; gap:4px; position:relative;
        --pp-accent: color-mix(in srgb, var(--dsw-alias-brand-primary) 62%, #0D9488 38%);
        --pp-accent-hi: color-mix(in srgb, var(--dsw-alias-brand-primary) 36%, #14B8A6 64%);
        --pp-accent-soft: color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent);
        --pp-warn: color-mix(in srgb, var(--dsw-alias-state-error-primary) 82%, #EA580C 18%);
      }
      @supports not (background: color-mix(in srgb, red 50%, blue 50%)) {
        .dyn-opt-root {
          --pp-accent: var(--dsw-alias-brand-primary);
          --pp-accent-hi: var(--dsw-alias-brand-primary);
          --pp-accent-soft: transparent;
          --pp-warn: var(--dsw-alias-state-error-primary);
        }
      }
      .dyn-opt-main, .dyn-opt-gear {
        display:inline-flex; align-items:center; justify-content:center; gap:4px;
        height:26px; font-size:12px; line-height:1; cursor:pointer;
        transition:all .18s ease;
      }
      .dyn-opt-main {
        padding:0 12px; font-weight:600; color:#fff; border:none; border-radius:8px 0 0 8px;
        background:linear-gradient(135deg, var(--pp-accent), var(--pp-accent-hi));
      }
      .dyn-opt-main.is-on {
        background:linear-gradient(135deg, var(--pp-accent-hi), var(--pp-accent));
        box-shadow:inset 0 0 0 1px rgba(255,255,255,.35);
      }
      .dyn-opt-main:hover:not(:disabled) {
        transform:translateY(-1px);
        box-shadow:0 4px 12px color-mix(in srgb, var(--pp-accent) 30%, transparent);
      }
      .dyn-opt-main:active:not(:disabled) { transform:scale(.98); }
      .dyn-opt-main:disabled, .dyn-opt-gear:disabled { opacity:.45; cursor:not-allowed; }
      .dyn-opt-gear {
        width:26px; height:26px; padding:0; border-radius:0 8px 8px 0;
        border:1px solid var(--dsw-alias-border-l1); background:transparent;
        color:var(--dsw-alias-label-secondary);
      }
      .dyn-opt-gear:hover:not(:disabled), .dyn-opt-gear.is-open {
        background:var(--pp-accent-soft); border-color:var(--pp-accent); color:var(--pp-accent);
      }
      .dyn-opt-panel {
        position:absolute; bottom:calc(100% + 8px); right:0; z-index:150;
        width:320px; box-sizing:border-box; padding:0;
        max-height:min(560px, calc(100vh - 120px)); overflow-y:auto;
        background:var(--dsw-specific-menu, var(--dsw-alias-bg-overlay));
        border:1px solid var(--dsw-alias-border-l1); border-radius:12px;
        box-shadow:var(--dsw-shadow-lv3, 0 8px 24px rgba(0,0,0,.18));
        color:var(--dsw-alias-label-primary); font-size:12px; line-height:18px; cursor:default;
        animation:dyn-opt-slide-in .18s ease-out;
      }
      @keyframes dyn-opt-slide-in {
        from { opacity:0; transform:translateY(-8px) scale(.97); }
        to { opacity:1; transform:translateY(0) scale(1); }
      }
      .dyn-opt-panel-header {
        display:flex; align-items:center; justify-content:space-between; gap:8px;
        padding:12px 14px; border-bottom:1px solid var(--dsw-alias-border-l1);
      }
      .dyn-opt-panel-title { font-weight:600; font-size:13px; margin:0; }
      .dyn-opt-panel-close {
        width:22px; height:22px; padding:0; display:inline-flex; align-items:center; justify-content:center;
        border:none; border-radius:6px; background:transparent;
        color:var(--dsw-alias-label-secondary); font-size:12px; line-height:1; cursor:pointer;
      }
      .dyn-opt-panel-close:hover { color:var(--dsw-alias-label-primary); background:var(--pp-accent-soft); }
      .dyn-opt-body { padding:10px 12px; display:flex; flex-direction:column; gap:8px; }
      .dyn-opt-group {
        border:1px solid var(--dsw-alias-border-l1); border-radius:8px; padding:6px 10px;
      }
      .dyn-opt-group-title {
        display:flex; align-items:center; gap:6px;
        font-weight:600; font-size:12px; color:var(--pp-accent); margin:0 0 4px;
      }
      .dyn-opt-row { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:5px 0; }
      .dyn-opt-row-label { color:var(--dsw-alias-label-primary); }
      .dyn-opt-switch { accent-color:var(--pp-accent); width:34px; height:18px; cursor:pointer; }
      .dyn-opt-hint { color:var(--dsw-alias-label-secondary); font-size:11px; line-height:16px; margin:0; }
      .dyn-opt-field { display:flex; flex-direction:column; gap:4px; padding:5px 0; }
      .dyn-opt-field-label { color:var(--dsw-alias-label-secondary); }
      .dyn-opt-select, .dyn-opt-textarea {
        box-sizing:border-box; width:100%; font-size:12px; line-height:18px;
        color:var(--dsw-alias-label-primary);
        background:var(--dsw-alias-bg-input, transparent);
        border:1px solid var(--dsw-alias-border-l1); border-radius:6px; padding:6px 8px;
        outline:none; font-family:inherit;
        transition:border-color .15s ease, box-shadow .15s ease;
      }
      .dyn-opt-select:focus, .dyn-opt-textarea:focus {
        border-color:var(--pp-accent);
        box-shadow:0 0 0 3px var(--pp-accent-soft);
      }
      .dyn-opt-textarea { resize:vertical; min-height:64px; }
      .dyn-opt-stats {
        display:grid; grid-template-columns:1fr 1fr; gap:6px;
        background:var(--pp-accent-soft); border-radius:6px; padding:8px 6px;
      }
      .dyn-opt-stat { text-align:center; }
      .dyn-opt-stat-value { font-weight:700; font-size:13px; color:var(--pp-accent); }
      .dyn-opt-stat-label { font-size:11px; color:var(--dsw-alias-label-secondary); }
      .dyn-opt-err {
        color:var(--dsw-alias-state-error-primary); font-size:11px; max-width:160px;
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      }
      .dyn-opt-info {
        color:var(--dsw-alias-label-secondary); font-size:11px; max-width:180px;
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      }
      .dyn-opt-settings-row { display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; padding:4px 0; }
      .dyn-opt-settings-label { font-size:13px; line-height:20px; color:var(--dsw-alias-label-primary); }
      .dyn-opt-result {
        position:absolute; bottom:calc(100% + 8px); right:0; z-index:160;
        width:320px; box-sizing:border-box; padding:12px;
        display:flex; flex-direction:column; gap:8px;
        background:var(--dsw-specific-menu, var(--dsw-alias-bg-overlay));
        border:1px solid var(--dsw-alias-border-l1); border-radius:12px;
        box-shadow:var(--dsw-shadow-lv3, 0 8px 24px rgba(0,0,0,.18));
        color:var(--dsw-alias-label-primary); font-size:12px; line-height:18px; cursor:default;
        animation:dyn-opt-slide-in .18s ease-out;
      }
      .dyn-opt-result-title { font-weight:600; }
      .dyn-opt-result-label { color:var(--dsw-alias-label-secondary); margin-right:4px; }
      .dyn-opt-result-orig {
        color:var(--dsw-alias-label-secondary); font-size:11px; line-height:16px;
        max-height:72px; overflow-y:auto; padding:6px 8px;
        background:var(--dsw-alias-bg-input, transparent);
        border:1px dashed var(--dsw-alias-border-l1); border-radius:6px;
        white-space:pre-wrap; word-break:break-all;
      }
      .dyn-opt-result-body {
        max-height:240px; overflow-y:auto; white-space:pre-wrap; word-break:break-word;
      }
      .dyn-opt-result-err {
        color:var(--pp-warn); max-height:160px; overflow-y:auto; word-break:break-word;
      }
      .dyn-opt-result-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:2px; }
      .dyn-opt-btn {
        height:26px; padding:0 10px; font-size:12px; line-height:1; cursor:pointer;
        border-radius:6px; border:1px solid var(--dsw-alias-border-l1);
        background:transparent; color:var(--dsw-alias-label-primary);
        transition:all .15s ease;
      }
      .dyn-opt-btn:hover:not(:disabled) { border-color:var(--pp-accent); color:var(--pp-accent); }
      .dyn-opt-btn-primary {
        background:var(--pp-accent); border-color:var(--pp-accent); color:#fff;
      }
      .dyn-opt-btn-primary:hover:not(:disabled) { background:var(--pp-accent-hi); border-color:var(--pp-accent-hi); color:#fff; }
      .dyn-opt-btn:disabled { opacity:.45; cursor:not-allowed; }
      .dyn-opt-hist-title { font-weight:600; color:var(--pp-accent); margin:0 0 4px; }
      .dyn-opt-hist-empty { color:var(--dsw-alias-label-secondary); padding:6px 0; }
      .dyn-opt-hist-item { padding:6px 0; border-bottom:1px dashed var(--dsw-alias-border-l1); }
      .dyn-opt-hist-item:last-child { border-bottom:none; }
      .dyn-opt-hist-head { color:var(--dsw-alias-label-secondary); font-size:11px; line-height:16px; word-break:break-all; }
      .dyn-opt-hist-body {
        font-size:12px; line-height:18px; color:var(--dsw-alias-label-primary);
        word-break:break-all; cursor:pointer; margin:2px 0;
      }
      .dyn-opt-hist-body:hover { color:var(--pp-accent); }
      .dyn-opt-hist-body.is-err { color:var(--pp-warn); }
      .dyn-opt-hist-actions { display:flex; gap:6px; }
      .dyn-opt-hist-btn {
        height:22px; padding:0 8px; font-size:11px; line-height:1; cursor:pointer;
        border:1px solid var(--dsw-alias-border-l1); border-radius:5px;
        background:transparent; color:var(--dsw-alias-label-secondary);
        transition:all .15s ease;
      }
      .dyn-opt-hist-btn:hover { color:var(--pp-accent); border-color:var(--pp-accent); }
      .dyn-opt-save-notice {
        display:flex; align-items:center; gap:6px;
        padding:10px 12px;
        background:var(--dsw-alias-bg-input, transparent);
        border-top:1px solid var(--dsw-alias-border-l1);
        font-size:11px; color:var(--dsw-alias-label-secondary);
      }
      .dyn-opt-main:focus-visible, .dyn-opt-gear:focus-visible,
      .dyn-opt-panel-close:focus-visible, .dyn-opt-btn:focus-visible, .dyn-opt-hist-btn:focus-visible {
        outline:2px solid var(--pp-accent); outline-offset:2px;
      }
      @media (max-width: 768px) {
        .dyn-opt-panel, .dyn-opt-result { width:min(320px, calc(100vw - 32px)); }
      }
      @media (prefers-reduced-motion: reduce) {
        .dyn-opt-panel, .dyn-opt-result { animation:none; }
        .dyn-opt-root *, .dyn-opt-panel *, .dyn-opt-result * { transition:none !important; }
      }
      @media (prefers-contrast: high) {
        .dyn-opt-select, .dyn-opt-textarea, .dyn-opt-gear, .dyn-opt-btn, .dyn-opt-hist-btn { border-width:2px; }
      }
    `
    const cssTagId = 'dsh-prompt-polish/client.css'
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(cssTagId) + ']') === null) {
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-prompt-polish'
      tag.dataset.pluginCss = cssTagId
      tag.textContent = css
      document.head.appendChild(tag)
    }

    // ── 客户端 codec（与服务端 ./typert 清单一一对应；宽松校验）──────────
    function failCodec(path, expect) {
      throw new Error('dsh-prompt-polish: 服务端数据非法 (' + path + ': ' + expect + ')')
    }
    function looseParse(v) {
      if (v === null || typeof v !== 'object' || Array.isArray(v)) failCodec('result', 'object')
      return v
    }
    const argsCodec = { parse: looseParse }
    const resultCodec = { parse: looseParse }

    const descriptor = (method) => ({
      id: 'dsh-prompt-polish#promptPolish/' + method,
      service: 'promptPolish',
      namespace: 'promptPolish',
      method,
      invocation: { kind: 'direct' },
      parameters: [
        { name: 'args', wire: 'args', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-prompt-polish#Args', schema: argsCodec } },
      ],
      result: { mode: 'strict', typeSymbol: 'dsh-prompt-polish#Result', schema: resultCodec },
    })

    const CONTRIBUTION = {
      package: 'dsh-prompt-polish',
      descriptors: [
        descriptor('getSettings'),
        descriptor('setSettings'),
        descriptor('optimizePrompt'),
      ],
    }

    // ── 插件主体 ────────────────────────────────────────────────────────────
    const inject = ['remote']

    async function apply(ctx) {
      const slots = ctx.get('slots')
      if (slots === undefined) return

      // RPC：挂载 Typert 贡献后经 remote.promptPolish.* 调用宿主服务
      const remote = ctx.get('remote')
      if (remote === undefined || typeof remote.$mount !== 'function') return
      const unmount = await remote.$mount(CONTRIBUTION)
      ctx.effect(() => () => { unmount() }, 'dsh-prompt-polish: remote contribution')
      const api = ctx.get('remote.promptPolish')
      if (api === undefined) return
      // 兼容 pkg-11 的调用形状：host.call(name, args) → api[name](args)
      // 兼容 pkg-11 的调用形状：host.call(name, args) → api[name](args)。
      // 注意 Typert 客户端调用返回的是 {ok, value|error} 包装，必须解包成
      // 动态插件时代 harness.handle 的裸业务结果（{ok:true, text|settings} 等）。
      const host = {
        call: async (method, payload) => {
          const result = await api[method](payload)
          if (result === null || typeof result !== 'object') {
            throw new Error('提示词优化服务无响应')
          }
          if (result.ok !== true) {
            const detail = result.error !== undefined && result.error !== null
              ? (typeof result.error === 'string' ? result.error : result.error.message)
              : ''
            throw new Error(detail || '优化失败')
          }
          return result.value
        },
      }

      // 官方 composer block 宿主服务（可选：缺失时跳过冻结，其余功能照常）
      const conversation = ctx.get('conversation')
      const workspacesService = ctx.get('workspaces')
      const sessionsService = ctx.get('sessions')

      // ---- 设置 store：L1 localStorage 持久化 + L3 Host 工作区文件同步 ----
      const SETTINGS_KEY = 'ptopt.settings.v1'
      const listeners = new Set()
      let pulled = false
      const MAX_HISTORY_CHARS = 8000
      const MAX_HISTORY_TURNS = 20

      // ---- 优化历史工具（仅会话内存，FIFO 5）----
      let uid = 0
      function makeId() {
        uid += 1
        return String(Date.now()) + '-' + String(uid)
      }
      function formatTime(t) {
        const d = new Date(t)
        if (isNaN(d.getTime())) return '--:--'
        const p = (n) => (n < 10 ? '0' : '') + n
        return (d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
      }
      function clip(text, n) {
        if (typeof text !== 'string') return ''
        return text.length > n ? text.slice(0, n) + '…' : text
      }

      const MODE_OPTIONS = [
        { value: 'precise', label: '默认' },
        { value: 'concise', label: '压缩精简' },
        { value: 'structured', label: '结构化' },
        { value: 'creative', label: '创意扩展' },
        { value: 'translate', label: '翻译' },
        { value: 'code', label: '代码请求' },
      ]
      const LANGUAGE_OPTIONS = [
        { value: 'follow', label: '跟随原文' },
        { value: 'zh', label: '中文' },
        { value: 'en', label: '英文' },
      ]
      const TODO_STATUS_LABEL = { pending: '待办', in_progress: '进行中', completed: '已完成' }
      const GOAL_PHASE_LABEL = { active: '进行中', paused: '已暂停', blocked: '受阻', complete: '已完成' }

      function hasValue(list, v) {
        return list.some((o) => o.value === v)
      }

      function loadSettings() {
        try {
          const raw = window.localStorage.getItem(SETTINGS_KEY)
          const parsed = raw ? JSON.parse(raw) : null
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
        } catch (err) { /* ignore */ }
        return {}
      }

      function normalizeSettings(s) {
        return {
          withHistory: !!(s && s.withHistory === true),
          withToolResults: !!(s && s.withToolResults === true),
          mode: (s && hasValue(MODE_OPTIONS, s.mode)) ? s.mode : 'precise',
          language: (s && hasValue(LANGUAGE_OPTIONS, s.language)) ? s.language : 'follow',
          custom: (s && typeof s.custom === 'string') ? s.custom.slice(0, 500) : '',
        }
      }

      function currentSessionId() {
        try {
          if (sessionsService && sessionsService.list && typeof sessionsService.list.getSnapshot === 'function') {
            const s = sessionsService.list.getSnapshot()
            return typeof s.current === 'string' ? s.current : undefined
          }
        } catch (err) { /* ignore */ }
        return undefined
      }

      function currentWorkspaceRoot() {
        try {
          const ws = workspacesService
          if (!ws || !ws.list || typeof ws.list.getSnapshot !== 'function') return null
          const snap = ws.list.getSnapshot()
          const items = Array.isArray(snap && snap.items) ? snap.items : []
          const sessionId = currentSessionId()
          let item
          if (typeof sessionId === 'string') {
            item = items.find((it) => it && Array.isArray(it.sessionIds) && it.sessionIds.includes(sessionId))
          }
          if (item === undefined && snap && snap.recentWorkspaceId !== undefined) {
            item = items.find((it) => it && it.workspaceId === snap.recentWorkspaceId)
          }
          if (item === undefined) item = items[0]
          return item && typeof item.path === 'string' && item.path.length > 0 ? item.path : null
        } catch (err) {
          return null
        }
      }

      function markHostBlocked(on) {
        try {
          const cur = loadSettings()
          if (on) cur._hostBlocked = true
          else delete cur._hostBlocked
          window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(cur))
        } catch (err) { /* ignore */ }
      }

      function saveSettings(patch) {
        const base = loadSettings()
        const next = { ...base, ...patch }
        const view = normalizeSettings(next)
        next.withHistory = view.withHistory
        next.withToolResults = view.withToolResults
        next.mode = view.mode
        next.language = view.language
        next.custom = view.custom
        try {
          window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
        } catch (err) { /* 存储被拒：降级为页面内存态 */ }
        for (const fn of listeners) { try { fn(view) } catch (e) { /* ignore */ } }
        try { window.dispatchEvent(new CustomEvent('ptopt:settings-changed', { detail: view })) } catch (e) { /* ignore */ }
        const root = currentWorkspaceRoot()
        if (root) {
          const sessionId = currentSessionId()
          host.call('setSettings', {
            root,
            sessionId,
            patch: {
              withHistory: view.withHistory,
              withToolResults: view.withToolResults,
              mode: view.mode,
              language: view.language,
              custom: view.custom,
            },
          }).then((res) => {
            if (res && res.ok === true) {
              if (next._hostBlocked === true) markHostBlocked(false)
            } else if (res && res.reason === 'sandbox') {
              // L3 写入被沙箱拒绝：标记后，启动拉取不再让旧文件覆盖本地（静默降级 L1）
              markHostBlocked(true)
            }
          }).catch(() => { /* 静默：L3 失败不影响 L1 */ })
        }
        return view
      }

      function pullHostSettings(root, sessionId) {
        host.call('getSettings', { root, sessionId }).then((res) => {
          if (!res || res.ok !== true) return
          const s = res.settings
          if (!s || typeof s !== 'object' || Array.isArray(s)) return
          const local = loadSettings()
          if (local._hostBlocked === true) return
          const hostView = normalizeSettings(s)
          const patch = {}
          let changed = false
          const keys = ['withHistory', 'withToolResults', 'mode', 'language', 'custom']
          for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            if (!Object.prototype.hasOwnProperty.call(s, key)) continue
            const hostVal = hostView[key]
            if (!Object.prototype.hasOwnProperty.call(local, key) || local[key] !== hostVal) {
              patch[key] = hostVal
              changed = true
            }
          }
          if (changed) saveSettings(patch)
        }).catch(() => { /* 拉取失败：只用 localStorage */ })
      }

      // 超长文本头尾截断（保头 2600 + 省略标记 + 保尾 1400）
      function headTail(text) {
        if (typeof text !== 'string') return ''
        if (text.length <= 4000) return text
        return text.slice(0, 2600) + '\n…[中间省略]…\n' + text.slice(-1400)
      }

      function textOfBlocks(blocks) {
        if (!Array.isArray(blocks)) return ''
        return blocks
          .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
          .map((b) => b.text)
          .join('\n')
          .replace(/\uFFFC/g, '')
      }

      function readTodoLines(sessionId, nodes) {
        // 主路径：todos 会话投影（当前任务清单全量快照）
        try {
          if (sessionsService && typeof sessionsService.binding === 'function') {
            const binding = sessionsService.binding(sessionId)
            const face = binding && binding.session && binding.session.projections && typeof binding.session.projections.faceOf === 'function'
              ? binding.session.projections.faceOf('todos')
              : undefined
            const list = face && typeof face.getSnapshot === 'function' ? face.getSnapshot() : undefined
            if (Array.isArray(list)) {
              const lines = list
                .map((t, i) => (i + 1) + '. [' + (TODO_STATUS_LABEL[t && t.status] || '待办') + '] ' + (t && typeof t.content === 'string' ? t.content : ''))
                .filter((l) => l.trim())
                .join('\n')
              if (lines) return lines.slice(0, 2000)
            }
          }
        } catch (err) { /* ignore */ }
        // 兜底：最新一次 todo_write 的 tool-result 节点
        let best = null
        if (Array.isArray(nodes)) {
          for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i]
            if (n && n.kind === 'tool-result' && n.call && n.call.name === 'todo_write') {
              if (best === null || (typeof n.seq === 'number' && (typeof best.seq !== 'number' || n.seq > best.seq))) best = n
            }
          }
        }
        if (best !== null) {
          const text = textOfBlocks(best.content).trim()
          if (text) return text.slice(0, 2000)
        }
        return ''
      }

      function readGoalSnapshot(props, sessionId) {
        // 路径 a：slot props 的 useProjection（响应式）
        if (props && typeof props.useProjection === 'function') {
          try {
            const proj = props.useProjection('goal')
            if (proj && typeof proj === 'object' && proj.goal && typeof proj.goal.objective === 'string') return proj.goal
          } catch (err) { /* ignore */ }
        }
        // 路径 b：sessions.binding + projections（官方同款）
        try {
          if (sessionsService && typeof sessionsService.binding === 'function') {
            const binding = sessionsService.binding(sessionId)
            const face = binding && binding.session && binding.session.projections && typeof binding.session.projections.faceOf === 'function'
              ? binding.session.projections.faceOf('goal')
              : undefined
            const proj = face && typeof face.getSnapshot === 'function' ? face.getSnapshot() : undefined
            if (proj && typeof proj === 'object' && proj.goal && typeof proj.goal.objective === 'string') return proj.goal
          }
        } catch (err) { /* ignore */ }
        return null
      }

      function extractContext(session, settings, goalSnapshot) {
        const nodes = session && Array.isArray(session.nodes) ? session.nodes : []
        const items = []
        const stats = { messages: 0, hasGoal: false, hasTodo: false, chars: 0, toolSummaries: 0, hasCompaction: false }

        // goal：背景最前
        if (goalSnapshot && typeof goalSnapshot.objective === 'string') {
          let text = '当前任务目标（' + (GOAL_PHASE_LABEL[goalSnapshot.phase] || '进行中') + '）：' + goalSnapshot.objective
          if (goalSnapshot.phase === 'blocked' && goalSnapshot.blockedReason && goalSnapshot.blockedReason.message) {
            text += '（受阻原因：' + goalSnapshot.blockedReason.message + '）'
          }
          items.push({ kind: 'goal', text })
          stats.hasGoal = true
          stats.chars += text.length
        }

        // todo：当前任务清单
        const todoText = readTodoLines(session && session.sessionId, nodes)
        if (todoText) {
          const text = '当前任务清单：\n' + todoText
          items.push({ kind: 'todo', text })
          stats.hasTodo = true
          stats.chars += text.length
        }

        // tool-result 索引（仅开关开启时构建）
        const withTools = settings.withToolResults === true
        let resultByCallId = null
        if (withTools) {
          resultByCallId = new Map()
          for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i]
            if (n && n.kind === 'tool-result' && typeof n.callId === 'string' && !resultByCallId.has(n.callId)) {
              resultByCallId.set(n.callId, n)
            }
          }
        }

        // 消息回合（倒序 + 消息边界 + 预算早停）
        const turns = []
        let total = 0
        for (let i = nodes.length - 1; i >= 0 && turns.length < MAX_HISTORY_TURNS; i--) {
          const node = nodes[i]
          if (!node) continue
          // 压缩标记——注入摘要作为背景，并停止采集更旧的原始消息
          if (node.kind === 'compaction') {
            if (typeof node.summary === 'string' && node.summary.trim()) {
              const text = '更早对话的压缩摘要：\n' + node.summary.trim().slice(0, 2000)
              items.push({ kind: 'compaction-summary', text })
              stats.hasCompaction = true
              stats.chars += text.length
            }
            break
          }
          let role = null
          let text = ''
          if (node.kind === 'user' || node.kind === 'steering') {
            role = 'user'
            text = textOfBlocks(node.content)
          } else if (node.kind === 'assistant') {
            role = 'assistant'
            text = Array.isArray(node.blocks)
              ? node.blocks.filter((b) => b && b.kind === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n').replace(/\uFFFC/g, '')
              : ''
          }
          if (role === null || !text.trim()) continue
          text = headTail(text.trim())
          if (!text) continue
          if (total + text.length > MAX_HISTORY_CHARS) break
          total += text.length

          // 该 assistant 轮的工具摘要（≤3 条，插在该消息之后）
          if (role === 'assistant' && withTools && resultByCallId !== null) {
            const heads = (node.blocks || []).filter((b) => b && b.kind === 'tool-call' && typeof b.name === 'string' && typeof b.callId === 'string')
            const summaries = []
            const pick = heads.slice(-3)
            for (let k = 0; k < pick.length; k++) {
              const res = resultByCallId.get(pick[k].callId)
              if (!res) continue
              const resText = textOfBlocks(res.content).trim()
              if (!resText) continue
              summaries.push({ kind: 'tool-summary', text: '[工具] ' + pick[k].name + ' → ' + resText.slice(0, 300) })
            }
            for (let k = summaries.length - 1; k >= 0; k--) {
              turns.unshift(summaries[k])
              stats.toolSummaries += 1
              stats.chars += summaries[k].text.length
            }
          }
          turns.unshift({ role, text })
          stats.messages += 1
          stats.chars += text.length
        }
        for (let k = 0; k < turns.length; k++) items.push(turns[k])

        return { items, stats }
      }

      function OptimizeControl(props) {
        const [busy, setBusy] = React.useState(false)
        const [error, setError] = React.useState(null)
        const [info, setInfo] = React.useState(null)
        const [open, setOpen] = React.useState(false)
        const [settings, setSettings] = React.useState(() => normalizeSettings(loadSettings()))
        // 稳定镜像：随每次渲染同步最新草稿，供异步回填前的守卫比较
        const [mirror] = React.useState(() => ({ currentDraft: '' }))
        // 最近 5 次优化历史（仅会话内存）与待确认结果弹窗
        const [history, setHistory] = React.useState([])
        const [pending, setPending] = React.useState(null)

        const input = props.input || {}
        const session = props.session || {}
        const sessionId = props.sessionId
        const draft = typeof input.draft === 'string' ? input.draft : ''
        mirror.currentDraft = draft
        const hasOccurrences = Array.isArray(input.occurrences) && input.occurrences.length > 0
        const disabled = busy || session.removed === true || !draft.trim() || hasOccurrences

        // goal 快照（useProjection 优先，binding 兜底）
        const goalSnapshot = readGoalSnapshot(props, sessionId)

        // 上下文与携带统计（useMemo；开关关闭时为空）
        const ctxInfo = React.useMemo(() => {
          if (settings.withHistory !== true) {
            return { items: [], stats: { messages: 0, hasGoal: false, hasTodo: false, chars: 0, toolSummaries: 0, hasCompaction: false } }
          }
          return extractContext(session, settings, goalSnapshot)
        }, [session, settings.withHistory, settings.withToolResults, goalSnapshot])

        // store 订阅：设置变更时同步本地状态
        React.useEffect(() => {
          const update = (next) => { setSettings(next) }
          listeners.add(update)
          return () => { listeners.delete(update) }
        }, [])

        // 启动拉取：工作区文件优先合并进本地（仅一次；工作区尚未就绪时订阅重试）
        React.useEffect(() => {
          const attempt = () => {
            if (pulled) return
            const root = currentWorkspaceRoot()
            if (!root) return
            pulled = true
            pullHostSettings(root, sessionId)
          }
          attempt()
          const ws = workspacesService
          const unsubscribe = ws && ws.list && typeof ws.list.subscribe === 'function' ? ws.list.subscribe(attempt) : null
          return () => { if (unsubscribe) unsubscribe() }
        }, [sessionId])

        // 卸载兜底：组件销毁（切会话/插件停止/更新）时清除本会话的输入阻塞，绝不残留锁死
        React.useEffect(() => () => {
          if (conversation && typeof sessionId === 'string') conversation.blocks.set(sessionId, undefined)
        }, [sessionId])

        // 面板与结果弹窗共用的外部点击 / Esc 关闭
        React.useEffect(() => {
          if (!open && pending === null) return
          const onMouseDown = (e) => {
            if (!(e.target instanceof Element)) return
            if (e.target.closest('.dyn-opt-root') === null) {
              setOpen(false)
              setPending(null)
            }
          }
          const onKeyDown = (e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              setPending(null)
            }
          }
          document.addEventListener('mousedown', onMouseDown)
          document.addEventListener('keydown', onKeyDown)
          return () => {
            document.removeEventListener('mousedown', onMouseDown)
            document.removeEventListener('keydown', onKeyDown)
          }
        }, [open, pending])

        const togglePanel = () => {
          if (busy) return
          // 打开面板前先收起结果弹窗（结果已存历史，不丢失）
          setPending(null)
          setOpen((v) => !v)
          setError(null)
          setInfo(null)
        }

        const changeMode = (e) => saveSettings({ mode: e.target.value })
        const changeLanguage = (e) => saveSettings({ language: e.target.value })
        const changeCustom = (e) => saveSettings({ custom: e.target.value.slice(0, 500) })
        const toggleToolResults = (e) => saveSettings({ withToolResults: e.target.checked === true })

        const pushHistory = (entry) => {
          setHistory((h) => [...h, entry].slice(-5))
        }

        const onClick = async () => {
          if (disabled) return
          // 点击瞬间快照原稿（本次优化的回填守卫基准）
          const snapshot = draft
          setBusy(true)
          setError(null)
          setInfo(null)
          setPending(null)
          setOpen(false)
          if (conversation && typeof sessionId === 'string') {
            conversation.blocks.set(sessionId, { reason: '正在优化提示词，完成后可继续发送…' })
          }
          try {
            const payload = {
              draft: snapshot,
              withHistory: settings.withHistory,
              options: {
                mode: settings.mode,
                language: settings.language,
                custom: settings.custom,
              },
            }
            if (settings.withHistory) payload.history = ctxInfo.items
            const res = await host.call('optimizePrompt', payload)
            if (res && res.ok === true && typeof res.text === 'string' && res.text.trim()) {
              const entry = { id: makeId(), time: Date.now(), draft: snapshot, result: res.text, failed: false, error: '' }
              pushHistory(entry)
              setPending(entry)
            } else {
              const msg = (res && res.error) || '优化失败'
              setError(msg)
              const entry = { id: makeId(), time: Date.now(), draft: snapshot, result: '', failed: true, error: msg }
              pushHistory(entry)
              setPending(entry)
            }
          } catch (err) {
            const msg = String((err && err.message) || err)
            setError(msg)
            const entry = { id: makeId(), time: Date.now(), draft: snapshot, result: '', failed: true, error: msg }
            pushHistory(entry)
            setPending(entry)
          } finally {
            if (conversation && typeof sessionId === 'string') {
              conversation.blocks.set(sessionId, undefined)
            }
            setBusy(false)
          }
        }

        // 结果弹窗动作
        const canAdopt = pending !== null && pending.failed !== true
          && typeof pending.result === 'string' && pending.result.trim() !== ''
          && mirror.currentDraft === pending.draft

        const adopt = () => {
          if (!canAdopt) return
          if (props.inputActions && typeof props.inputActions.setDraft === 'function') {
            props.inputActions.setDraft(pending.result)
          }
          setPending(null)
        }

        const refillFromHistory = (item) => {
          if (!item || item.failed === true || typeof item.result !== 'string' || !item.result.trim()) return
          if (props.inputActions && typeof props.inputActions.setDraft === 'function') {
            props.inputActions.setDraft(item.result)
          }
          setOpen(false)
        }

        const removeHistoryItem = (item) => {
          setHistory((h) => h.filter((x) => x.id !== item.id))
        }

        const showTranslateHint = settings.mode === 'translate' && settings.language === 'follow'

        return React.createElement(
          'span',
          { className: 'dyn-opt-root' },
          React.createElement(
            'button', {
              type: 'button',
              className: 'dyn-opt-main' + (settings.withHistory ? ' is-on' : ''),
              title: settings.withHistory ? '参考聊天记录上下文优化当前提示词' : '优化当前提示词',
              disabled,
              onClick,
              onMouseDown: (e) => e.preventDefault(),
            },
            busy ? '优化中…' : '✨ 优化',
          ),
          React.createElement(
            'button', {
              type: 'button',
              className: 'dyn-opt-gear' + (open ? ' is-open' : ''),
              title: '提示词优化设置',
              disabled: busy,
              onClick: togglePanel,
              onMouseDown: (e) => e.preventDefault(),
            },
            '⚙',
          ),
          error ? React.createElement('span', { className: 'dyn-opt-err', title: error }, error) : null,
          info ? React.createElement('span', { className: 'dyn-opt-info', title: info }, info) : null,
          open ? React.createElement(
            'div', {
              className: 'dyn-opt-panel',
              onClick: (e) => e.stopPropagation(),
            },
            React.createElement(
              'div', { className: 'dyn-opt-panel-header' },
              React.createElement('div', { className: 'dyn-opt-panel-title' }, '提示词优化设置'),
              React.createElement('button', {
                type: 'button',
                className: 'dyn-opt-panel-close',
                title: '关闭',
                'aria-label': '关闭',
                onClick: () => setOpen(false),
              }, '✕'),
            ),
            React.createElement(
              'div', { className: 'dyn-opt-body' },
              React.createElement(
                'div', { className: 'dyn-opt-group' },
                React.createElement('div', { className: 'dyn-opt-group-title' }, '📋 上下文设置'),
                React.createElement(
                  'label', { className: 'dyn-opt-row' },
                  React.createElement('span', { className: 'dyn-opt-row-label' }, '📖 参考聊天记录上下文'),
                  React.createElement('input', {
                    className: 'dyn-opt-switch',
                    type: 'checkbox',
                    checked: settings.withHistory,
                    onChange: (e) => saveSettings({ withHistory: e.target.checked === true }),
                  }),
                ),
                React.createElement(
                  'div', { className: 'dyn-opt-hint' },
                  '开启后，优化会结合最近的聊天记录、当前目标与任务清单理解背景。',
                ),
                React.createElement(
                  'label', { className: 'dyn-opt-row' },
                  React.createElement('span', { className: 'dyn-opt-row-label' }, '🔧 包含工具调用结果'),
                  React.createElement('input', {
                    className: 'dyn-opt-switch',
                    type: 'checkbox',
                    checked: settings.withToolResults,
                    onChange: toggleToolResults,
                  }),
                ),
                React.createElement(
                  'div', { className: 'dyn-opt-hint' },
                  '开启后，每轮助手回复附上最近 3 条工具调用摘要（工具名 + 结果前 300 字）。',
                ),
              ),
              React.createElement(
                'div', { className: 'dyn-opt-group' },
                React.createElement('div', { className: 'dyn-opt-group-title' }, '⚙️ 优化配置'),
                React.createElement(
                  'div', { className: 'dyn-opt-field' },
                  React.createElement('span', { className: 'dyn-opt-field-label' }, '模式'),
                  React.createElement(
                    'select', { className: 'dyn-opt-select', value: settings.mode, onChange: changeMode },
                    MODE_OPTIONS.map((o) => React.createElement('option', { key: o.value, value: o.value }, o.label)),
                  ),
                ),
                React.createElement(
                  'div', { className: 'dyn-opt-field' },
                  React.createElement('span', { className: 'dyn-opt-field-label' }, settings.mode === 'translate' ? '目标语言' : '语言'),
                  React.createElement(
                    'select', { className: 'dyn-opt-select', value: settings.language, onChange: changeLanguage },
                    LANGUAGE_OPTIONS.map((o) => React.createElement('option', { key: o.value, value: o.value }, o.label)),
                  ),
                ),
                showTranslateHint ? React.createElement(
                  'div', { className: 'dyn-opt-hint' },
                  '翻译模式请将语言选为目标语言（如 英文）；选「跟随原文」则保持草稿语言。',
                ) : null,
              ),
              React.createElement(
                'div', { className: 'dyn-opt-group' },
                React.createElement('div', { className: 'dyn-opt-group-title' }, '📝 自定义指令'),
                React.createElement(
                  'div', { className: 'dyn-opt-field' },
                  React.createElement('span', { className: 'dyn-opt-field-label' }, '自定义指令（' + settings.custom.length + '/500）'),
                  React.createElement('textarea', {
                    className: 'dyn-opt-textarea',
                    value: settings.custom,
                    rows: 3,
                    maxLength: 500,
                    placeholder: '例如：输出末尾附一句简短总结',
                    onChange: changeCustom,
                  }),
                ),
              ),
              settings.withHistory ? React.createElement(
                'div', { className: 'dyn-opt-group' },
                React.createElement('div', { className: 'dyn-opt-group-title' }, '📊 本次优化预览'),
                React.createElement(
                  'div', { className: 'dyn-opt-stats' },
                  React.createElement('div', { className: 'dyn-opt-stat' },
                    React.createElement('div', { className: 'dyn-opt-stat-value' }, String(ctxInfo.stats.messages) + ' 条'),
                    React.createElement('div', { className: 'dyn-opt-stat-label' }, '消息'),
                  ),
                  React.createElement('div', { className: 'dyn-opt-stat' },
                    React.createElement('div', { className: 'dyn-opt-stat-value' }, ctxInfo.stats.hasGoal ? '✓' : '✗'),
                    React.createElement('div', { className: 'dyn-opt-stat-label' }, '目标'),
                  ),
                  React.createElement('div', { className: 'dyn-opt-stat' },
                    React.createElement('div', { className: 'dyn-opt-stat-value' }, ctxInfo.stats.hasTodo ? '✓' : '✗'),
                    React.createElement('div', { className: 'dyn-opt-stat-label' }, '清单'),
                  ),
                  React.createElement('div', { className: 'dyn-opt-stat' },
                    React.createElement('div', { className: 'dyn-opt-stat-value' }, ctxInfo.stats.hasCompaction ? '✓' : '✗'),
                    React.createElement('div', { className: 'dyn-opt-stat-label' }, '摘要'),
                  ),
                  React.createElement('div', { className: 'dyn-opt-stat' },
                    React.createElement('div', { className: 'dyn-opt-stat-value' }, '≈' + ctxInfo.stats.chars),
                    React.createElement('div', { className: 'dyn-opt-stat-label' }, '字符'),
                  ),
                  settings.withToolResults ? React.createElement('div', { className: 'dyn-opt-stat' },
                    React.createElement('div', { className: 'dyn-opt-stat-value' }, String(ctxInfo.stats.toolSummaries) + ' 条'),
                    React.createElement('div', { className: 'dyn-opt-stat-label' }, '工具摘要'),
                  ) : null,
                ),
              ) : null,
              React.createElement(
                'div', { className: 'dyn-opt-group' },
                React.createElement('div', { className: 'dyn-opt-group-title' }, '🕘 优化历史（最近 5 次）'),
                history.length === 0
                  ? React.createElement('div', { className: 'dyn-opt-hist-empty' }, '暂无记录')
                  : history.slice().reverse().map((item) => React.createElement(
                      'div', { key: item.id, className: 'dyn-opt-hist-item' },
                      React.createElement('div', { className: 'dyn-opt-hist-head' },
                        formatTime(item.time) + ' · 原稿：' + (item.draft ? clip(item.draft, 24) : '（空）')),
                      React.createElement('div', {
                        className: 'dyn-opt-hist-body' + (item.failed ? ' is-err' : ''),
                        title: '点击查看完整内容',
                        onClick: () => { setPending(item); setOpen(false) },
                      }, item.failed ? clip(item.error || '优化失败', 40) : clip(item.result || '', 48)),
                      React.createElement('div', { className: 'dyn-opt-hist-actions' },
                        item.failed ? null : React.createElement('button', {
                          type: 'button',
                          className: 'dyn-opt-hist-btn',
                          onClick: () => refillFromHistory(item),
                        }, '回填'),
                        React.createElement('button', {
                          type: 'button',
                          className: 'dyn-opt-hist-btn',
                          onClick: () => removeHistoryItem(item),
                        }, '删除'),
                      ),
                    )),
              ),
            ),
            React.createElement(
              'div', { className: 'dyn-opt-save-notice' },
              '💾 所有设置自动保存到本机，并同步到工作区（.dsh/prompt-optimizer/settings.json）。',
            ),
          ) : null,
          pending ? React.createElement(
            'div', { className: 'dyn-opt-result' },
            React.createElement('div', { className: 'dyn-opt-result-title' }, pending.failed ? '优化失败' : '✨ 优化结果'),
            React.createElement('div', { className: 'dyn-opt-result-orig' },
              React.createElement('span', { className: 'dyn-opt-result-label' }, '原稿：'),
              pending.draft ? clip(pending.draft, 300) : '（空）'),
            pending.failed
              ? React.createElement('div', { className: 'dyn-opt-result-err' }, pending.error || '优化失败')
              : React.createElement('div', { className: 'dyn-opt-result-body' }, pending.result),
            (!pending.failed && !canAdopt)
              ? React.createElement('div', { className: 'dyn-opt-hint' }, '输入已变化，未回填结果')
              : null,
            React.createElement('div', { className: 'dyn-opt-result-actions' },
              React.createElement('button', {
                type: 'button',
                className: 'dyn-opt-btn dyn-opt-btn-primary',
                disabled: !canAdopt,
                onClick: adopt,
              }, '采用'),
              React.createElement('button', {
                type: 'button',
                className: 'dyn-opt-btn dyn-opt-btn-ghost',
                onClick: () => setPending(null),
              }, '保留原稿'),
              React.createElement('button', {
                type: 'button',
                className: 'dyn-opt-btn dyn-opt-btn-ghost',
                onClick: () => setPending(null),
              }, '稍后再看'),
            ),
          ) : null,
        )
      }

      function SettingsRow() {
        const [settings, setSettings] = React.useState(() => normalizeSettings(loadSettings()))
        React.useEffect(() => {
          const onChange = (e) => {
            if (e && e.detail && typeof e.detail === 'object') setSettings(normalizeSettings(e.detail))
          }
          window.addEventListener('ptopt:settings-changed', onChange)
          return () => window.removeEventListener('ptopt:settings-changed', onChange)
        }, [])
        return React.createElement(
          'div', { className: 'dyn-opt-settings-row' },
          React.createElement('span', { className: 'dyn-opt-settings-label' }, '📖 参考聊天记录上下文'),
          React.createElement('input', {
            className: 'dyn-opt-switch',
            type: 'checkbox',
            checked: settings.withHistory === true,
            onChange: (e) => saveSettings({ withHistory: e.target.checked === true }),
            title: '优化提示词时参考最近的聊天记录上下文',
          }),
        )
      }

      slots.inject('conversation.input.left', () => slots.register(
        { name: 'conversation.input.left', id: 'prompt-polish', order: 100, label: '提示词优化' },
        (props) => React.createElement(OptimizeControl, props),
      ))

      slots.inject('settings.general.item', () => slots.register(
        { name: 'settings.general.item', id: 'prompt-polish-settings', order: 500, label: '提示词优化' },
        () => React.createElement(SettingsRow),
      ))
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
