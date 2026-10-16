/**
 * dsh-prompt-polish 浏览器端 bundle（单文件，经 __ModuleLoader__ 加载）。
 *
 * 提供两个界面：
 *  - conversation.input.left：优化 按钮组（优化 + 设置）+ 轻量设置弹层 +
 *    完整设置弹窗（居中 modal）+ 结果确认弹窗 + 瞬时状态提示 + 优化历史；
 *  - settings.general.item：设置页「参考聊天记录上下文」开关行。
 *
 * 数据通道：
 *  - remote.promptPolish.*（Typert RPC，见 ./typert.host.js 与下方 CONTRIBUTION）
 *    → 三级设置持久化、提示词优化与优化取消（cancelOptimize）；
 *  - 宿主槽位 props（session/input/sessionId/useProjection/inputActions）
 *    → 会话上下文采集、草稿读写与输入冻结。
 *
 * 样式以 DSH surface / label / border / interactive 主题变量为主，跟随全局亮/暗主题；
 * 插件 signature 只用于低强度选中、焦点和状态提示，不主导普通控件表面。
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
        display:inline-flex; align-items:center; gap:4px; position:relative;
        --pp-surface: var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-layer-1, #fff));
        --pp-surface-raised: var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-1, #fff));
        --pp-surface-input: var(--dsw-alias-bg-input, var(--dsw-alias-bg-layer-1, #fff));
        --pp-border: var(--dsw-alias-border-l1, #0000000a);
        --pp-border-strong: var(--dsw-alias-border-l2, #0000001a);
        --pp-text: var(--dsw-alias-label-primary, #0f1115);
        --pp-text-secondary: var(--dsw-alias-label-secondary, #61666b);
        --pp-text-tertiary: var(--dsw-alias-label-tertiary, #81858c);
        --pp-accent: var(--dsw-alias-state-business-primary, var(--dsw-alias-brand-primary, #4176e6));
        --pp-accent-hi: var(--dsw-alias-button-primary-hover, var(--pp-accent));
        --pp-accent-soft: color-mix(in srgb, var(--pp-accent) 12%, transparent);
        --pp-selected: var(--dsw-alias-bg-module-platform, var(--dsw-alias-interactive-bg-hover, #f5f6f7));
        --pp-primary: var(--dsw-alias-button-primary-fill, var(--pp-accent));
        --pp-primary-hover: var(--dsw-alias-button-primary-hover, var(--pp-accent-hi));
        --pp-primary-foreground: var(--dsw-alias-label-primary-foreground, #fff);
        --pp-menu-border: var(--dsw-alias-border-inverted, var(--pp-border));
        --pp-result-bg: color-mix(in srgb, var(--pp-accent) 7%, var(--pp-surface-input));
        --pp-scrim: color-mix(in srgb, #000 28%, transparent);
        --pp-warn: var(--dsw-alias-state-error-primary, #b42318);
        --pp-success: var(--dsw-alias-state-success-primary, #15803d);
        /* Explicit modal layers avoid inheriting DSH 0.2 translucent overlay tokens. */
        --pp-modal-surface: var(--dsw-alias-bg-layer-2, #fff);
        --pp-modal-header: var(--dsw-alias-bg-layer-2, #fff);
        --pp-modal-footer: var(--dsw-alias-bg-layer-2, #fff);
        --pp-modal-input: var(--dsw-alias-bg-layer-1, #fff);
        --pp-modal-subtle: var(--dsw-alias-bg-layer-1, #f5f6f7);
        --pp-modal-border: var(--dsw-alias-border-l2, var(--pp-border-strong));
        color:var(--pp-text);
        min-width:0;
      }
      @supports not (background: color-mix(in srgb, red 50%, blue 50%)) {
        .dyn-opt-root {
          --pp-surface: var(--dsw-alias-bg-layer-2, #fff);
          --pp-surface-raised: var(--dsw-alias-bg-layer-3, #fff);
          --pp-surface-input: var(--dsw-alias-bg-layer-1, #fff);
          --pp-border: var(--dsw-alias-border-l1, #0000000a);
          --pp-border-strong: var(--dsw-alias-border-l2, #0000001a);
          --pp-text: var(--dsw-alias-label-primary, #0f1115);
          --pp-text-secondary: var(--dsw-alias-label-secondary, #61666b);
          --pp-text-tertiary: var(--dsw-alias-label-tertiary, #81858c);
          --pp-accent: var(--dsw-alias-state-business-primary, var(--dsw-alias-brand-primary, #4176e6));
          --pp-accent-hi: var(--pp-accent);
          --pp-accent-soft: var(--dsw-alias-bg-module-platform, var(--dsw-alias-interactive-bg-hover, #f5f6f7));
          --pp-selected: var(--dsw-alias-bg-module-platform, var(--dsw-alias-interactive-bg-hover, #f5f6f7));
          --pp-primary: var(--dsw-alias-button-primary-fill, var(--pp-accent));
          --pp-primary-hover: var(--dsw-alias-button-primary-hover, var(--pp-accent-hi));
          --pp-primary-foreground: var(--dsw-alias-label-primary-foreground, #fff);
          --pp-menu-border: var(--dsw-alias-border-inverted, var(--pp-border));
          --pp-result-bg: var(--dsw-alias-bg-layer-1, #fff);
          --pp-scrim: rgba(0,0,0,.28);
          --pp-warn: var(--dsw-alias-state-error-primary, #b42318);
          --pp-success: var(--dsw-alias-state-success-primary, #15803d);
        }
      }

      /* ── 按钮组 ── */
      .dyn-opt-main {
        appearance:none; display:inline-flex; align-items:center; justify-content:center; gap:6px;
        height:28px; min-width:0; padding:0 11px; font-size:12px; font-weight:500; line-height:1;
        color:var(--pp-text-secondary); border:none; border-radius:24px; cursor:pointer;
        background:transparent; box-shadow:none;
        transition:background .15s ease, color .15s ease, transform .12s ease, opacity .15s ease;
      }
      .dyn-opt-main.is-on {
        color:var(--pp-text-secondary);
        background-color:transparent;
      }
      .dyn-opt-main:hover:not(:disabled) {
        color:var(--pp-text);
        background-color:var(--dsw-alias-interactive-bg-hover, var(--pp-surface-raised));
      }
      .dyn-opt-main.is-on:hover:not(:disabled) { background-color:var(--dsw-alias-interactive-bg-hover, var(--pp-selected)); }
      .dyn-opt-main:active:not(:disabled) { transform:scale(.97); background:var(--dsw-alias-interactive-bg-active, var(--pp-surface-raised)); }
      .dyn-opt-main:disabled { opacity:.5; cursor:not-allowed; }
      .dyn-opt-main.is-busy { cursor:progress; color:var(--pp-text-secondary); }
      .dyn-opt-gear {
        appearance:none; display:inline-flex; align-items:center; justify-content:center;
        width:32px; height:28px; padding:0; cursor:pointer;
        color:var(--pp-text-tertiary);
        background:transparent; border:none; border-radius:999px;
        transition:background .15s ease, color .15s ease, transform .12s ease, opacity .15s ease;
      }
      .dyn-opt-gear:hover:not(:disabled), .dyn-opt-gear.is-open {
        background:var(--dsw-alias-interactive-bg-hover, var(--pp-surface-raised));
        color:var(--pp-text);
      }
      .dyn-opt-gear:active:not(:disabled) { transform:scale(.94); background:var(--dsw-alias-interactive-bg-active, var(--pp-surface-raised)); }
      .dyn-opt-gear:disabled { opacity:.45; cursor:not-allowed; }

      /* ── 瞬时状态提示（取消等，短时停留） ── */
      .dyn-opt-chip {
        position:absolute; bottom:calc(100% + 6px); left:0; z-index:170;
        display:inline-flex; align-items:center; gap:6px;
        max-width:min(280px, calc(100vw - 32px));
        padding:5px 10px; font-size:11px; line-height:16px;
        color:var(--dsw-alias-label-secondary);
        background:var(--dsw-specific-menu, var(--dsw-alias-bg-overlay));
        border:1px solid var(--dsw-alias-border-l1); border-radius:8px;
        box-shadow:var(--dsw-shadow-lv2, 0 4px 12px rgba(0,0,0,.12));
        animation:dyn-opt-pop .16s ease-out;
      }

      /* ── 动效 ── */
      .dyn-opt-spinner {
        width:12px; height:12px; flex:none; border-radius:50%;
        border:2px solid color-mix(in srgb, var(--pp-accent) 22%, transparent); border-top-color:var(--pp-accent);
        animation:dyn-opt-spin .7s linear infinite;
      }
      @keyframes dyn-opt-spin { to { transform:rotate(360deg); } }
      @keyframes dyn-opt-pop {
        from { opacity:0; transform:translateY(-6px) scale(.98); }
        to { opacity:1; transform:translateY(0) scale(1); }
      }
      @keyframes dyn-opt-fade { from { opacity:0; } to { opacity:1; } }

      /* ── 轻量设置弹层（锚定输入栏，auto-flip 上/下） ── */
      .dyn-opt-pop {
        position:absolute; right:0; z-index:150; box-sizing:border-box;
        display:flex; flex-direction:column; overflow:hidden;
        width:min(360px, calc(100vw - 32px)); max-width:calc(100vw - 24px);
        background:var(--dsw-specific-menu, var(--pp-surface-raised));
        border:1px solid var(--pp-menu-border); border-radius:12px;
        box-shadow:var(--dsw-shadow-lv3, 0 8px 24px rgba(0,0,0,.18));
        color:var(--pp-text); font-size:12px; line-height:18px; cursor:default;
        min-width:0; animation:dyn-opt-pop .16s ease-out;
      }
      .dyn-opt-pop.up { bottom:calc(100% + 8px); }
      .dyn-opt-pop.down { top:calc(100% + 8px); }
      .dyn-opt-pop-head {
        display:flex; align-items:center; justify-content:space-between; gap:8px;
        padding:11px 14px; border-bottom:1px solid var(--pp-border);
        background:var(--pp-surface-raised); flex:none; min-width:0;
      }
      .dyn-opt-pop-title {
        display:flex; align-items:center; gap:8px;
        font-weight:600; font-size:13px; margin:0; min-width:0;
      }
      .dyn-opt-pop-title svg { width:15px; height:15px; color:var(--pp-text-secondary); flex:none; }
      .dyn-opt-pop-close {
        width:24px; height:24px; padding:0; display:inline-flex; align-items:center; justify-content:center;
        border:none; border-radius:6px; background:transparent;
        color:var(--dsw-alias-label-secondary); cursor:pointer; flex:none;
        transition:background .15s ease, color .15s ease;
      }
      .dyn-opt-pop-close:hover { color:var(--dsw-alias-label-primary); background:var(--dsw-alias-interactive-bg-hover); }
      .dyn-opt-pop-close:active { background:var(--dsw-alias-interactive-bg-active, var(--dsw-alias-interactive-bg-hover)); }
      .dyn-opt-pop-body {
        overflow-y:auto; padding:10px 10px 12px;
        display:flex; flex-direction:column; gap:10px; min-width:0;
      }
      .dyn-opt-pop-foot {
        display:flex; flex-direction:column; gap:6px; padding:10px 14px;
        border-top:1px solid var(--pp-border);
        background:var(--pp-surface); flex:none; min-width:0;
      }
      .dyn-opt-pop-footnote { font-size:11px; line-height:16px; color:var(--dsw-alias-label-tertiary); text-align:center; }

      /* ── 区块 ── */
      .dyn-opt-col { display:flex; flex-direction:column; gap:8px; }
      .dyn-opt-col + .dyn-opt-col { padding-top:2px; }
      .dyn-opt-sec-title {
        display:flex; align-items:center; gap:6px; margin:0 0 8px;
        font-weight:600; font-size:12px; line-height:18px; color:var(--dsw-alias-label-primary);
      }
      .dyn-opt-sec-title svg { width:14px; height:14px; color:var(--pp-text-tertiary); flex:none; }
      .dyn-opt-sec-label {
        margin:0 0 4px; font-size:11px; font-weight:600; line-height:16px;
        color:var(--dsw-alias-label-tertiary);
      }

      /* ── 上下文设置（整行可点） ── */
      .dyn-opt-context-row {
        display:flex; align-items:center; gap:10px; padding:8px 10px;
        border:1px solid transparent; border-radius:8px;
        cursor:pointer;
        transition:background .15s ease, border-color .15s ease;
      }
      .dyn-opt-context-row:hover, .dyn-opt-context-row:focus-within { background-color:var(--dsw-alias-interactive-bg-hover); }
      .dyn-opt-context-row.is-checked { background-color:var(--pp-selected); }
      .dyn-opt-context-row.is-checked:hover, .dyn-opt-context-row.is-checked:focus-within { background-color:var(--dsw-alias-interactive-bg-hover); }
      .dyn-opt-context-icon {
        display:inline-flex; flex:none; width:28px; height:28px;
        align-items:center; justify-content:center; border-radius:8px;
        background-color:var(--dsw-alias-interactive-bg-hover); color:var(--pp-text-secondary);
      }
      .dyn-opt-context-row.is-checked .dyn-opt-context-icon {
        background-color:var(--pp-selected); color:var(--pp-text-secondary);
      }
      .dyn-opt-context-text { flex:1; min-width:0; display:flex; flex-direction:column; gap:1px; }
      .dyn-opt-context-title { font-size:13px; line-height:20px; color:var(--dsw-alias-label-primary); }
      .dyn-opt-context-desc { font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); }
      .dyn-opt-context-check {
        flex:none; width:16px; height:16px; margin:0;
        accent-color:var(--pp-accent); cursor:pointer;
      }

      /* ── 表单（select / textarea） ── */
      .dyn-opt-field { display:flex; flex-direction:column; gap:6px; }
      .dyn-opt-field-label { font-size:12px; line-height:18px; color:var(--dsw-alias-label-secondary); }
      .dyn-opt-field-hint { margin:0; font-size:11px; line-height:16px; color:var(--dsw-alias-label-tertiary); }
      .dyn-opt-select {
        box-sizing:border-box; width:100%; height:36px; padding:0 10px;
        font-size:13px; line-height:20px; font-family:inherit;
        color:var(--dsw-alias-label-primary);
        background:var(--pp-modal-input, var(--dsw-alias-bg-layer-1, #fff));
        border:1px solid var(--pp-modal-border, var(--dsw-alias-border-l1)); border-radius:8px;
        outline:none; cursor:pointer;
        transition:border-color .15s ease, box-shadow .15s ease, opacity .15s ease;
      }
      .dyn-opt-select:focus { border-color:var(--pp-accent); box-shadow:0 0 0 3px var(--pp-accent-soft); }
      .dyn-opt-select:disabled { opacity:.5; cursor:not-allowed; }
      .dyn-opt-form { display:flex; flex-direction:column; gap:6px; }
      .dyn-opt-form-top { display:flex; align-items:baseline; justify-content:space-between; gap:8px; }
      .dyn-opt-form-label { font-size:12px; font-weight:500; line-height:18px; color:var(--dsw-alias-label-primary); }
      .dyn-opt-form-count { font-size:11px; line-height:16px; color:var(--dsw-alias-label-tertiary); }
      .dyn-opt-form-count.is-full { color:var(--dsw-alias-state-error-primary); font-weight:600; }
      .dyn-opt-textarea {
        box-sizing:border-box; width:100%; height:96px; padding:8px 10px;
        font-size:13px; line-height:20px; font-family:inherit;
        color:var(--dsw-alias-label-primary);
        background:var(--pp-modal-input, var(--dsw-alias-bg-layer-1, #fff));
        border:1px solid var(--pp-modal-border, var(--dsw-alias-border-l1)); border-radius:8px;
        outline:none; resize:vertical;
        transition:border-color .15s ease, box-shadow .15s ease;
      }
      .dyn-opt-textarea:focus { border-color:var(--pp-accent); box-shadow:0 0 0 3px var(--pp-accent-soft); }
      .dyn-opt-textarea.is-full { border-color:var(--dsw-alias-state-error-primary); }
      .dyn-opt-form-hint { margin:0; font-size:11px; line-height:16px; color:var(--dsw-alias-label-tertiary); }
      .dyn-opt-form-err {
        margin:0; display:flex; align-items:center; gap:4px;
        font-size:11px; line-height:16px; color:var(--dsw-alias-state-error-primary);
      }

      /* ── 本次优化预览统计 ── */
      .dyn-opt-stats {
        display:grid; grid-template-columns:repeat(4,1fr); gap:6px;
        background:var(--pp-modal-subtle, var(--dsw-alias-bg-layer-1, #f5f6f7));
        border-radius:10px; padding:10px 6px;
      }
      .dyn-opt-stat { text-align:center; min-width:0; }
      .dyn-opt-stat-value {
        font-weight:600; font-size:13px; line-height:18px;
        color:var(--dsw-alias-label-primary);
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      .dyn-opt-stat-value.is-empty { font-weight:400; color:var(--dsw-alias-label-tertiary); }
      .dyn-opt-stat-label { margin-top:2px; font-size:11px; line-height:16px; color:var(--dsw-alias-label-tertiary); }
      .dyn-opt-stats-sub {
        display:flex; flex-wrap:wrap; gap:4px 12px; padding:6px 4px 0;
        font-size:11px; line-height:16px; color:var(--dsw-alias-label-tertiary);
      }

      /* ── 优化历史 ── */
      .dyn-opt-hist-list { display:flex; flex-direction:column; }
      .dyn-opt-hist-item { padding:8px 0; border-bottom:1px dashed var(--dsw-alias-border-l1); }
      .dyn-opt-hist-item:last-child { border-bottom:none; }
      .dyn-opt-hist-head {
        display:flex; align-items:center; gap:8px;
        color:var(--dsw-alias-label-tertiary); font-size:11px; line-height:16px;
      }
      .dyn-opt-hist-src { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .dyn-opt-hist-body {
        font-size:12px; line-height:18px; color:var(--dsw-alias-label-primary);
        word-break:break-all; cursor:pointer; margin:3px 0;
      }
      .dyn-opt-hist-body:hover { color:var(--pp-accent); }
      .dyn-opt-hist-body.is-err { color:var(--pp-warn); }
      .dyn-opt-hist-actions { display:flex; gap:6px; margin-top:4px; }
      .dyn-opt-hist-btn {
        height:22px; padding:0 8px; font-size:11px; line-height:1; cursor:pointer;
        border:1px solid var(--dsw-alias-border-l1); border-radius:6px;
        background:transparent; color:var(--dsw-alias-label-secondary);
        transition:color .15s ease, border-color .15s ease;
      }
      .dyn-opt-hist-btn:hover { color:var(--pp-accent); border-color:var(--pp-accent); }
      .dyn-opt-hist-empty {
        display:flex; flex-direction:column; align-items:center; gap:4px;
        padding:14px 8px; border:1px dashed var(--dsw-alias-border-l1); border-radius:10px;
        color:var(--dsw-alias-label-tertiary); font-size:11px; line-height:16px;
      }
      .dyn-opt-hist-empty svg { width:16px; height:16px; opacity:.7; }

      /* ── 通用按钮 ── */
      .dyn-opt-btn {
        appearance:none; display:inline-flex; align-items:center; justify-content:center; gap:6px;
        min-height:30px; height:30px; padding:0 12px; font-size:12px; font-weight:500; line-height:1;
        cursor:pointer; border:1px solid var(--pp-border); border-radius:8px;
        background:var(--pp-surface); color:var(--pp-text);
        transition:background .15s ease, color .15s ease, border-color .15s ease, opacity .15s ease;
      }
      .dyn-opt-btn:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover, var(--pp-surface-raised)); border-color:var(--pp-border-strong); }
      .dyn-opt-btn:active:not(:disabled) { background:var(--dsw-alias-interactive-bg-active, var(--pp-surface-raised)); }
      .dyn-opt-btn:disabled { opacity:.45; cursor:not-allowed; }
      .dyn-opt-btn-primary { background:var(--pp-primary); border-color:var(--pp-primary); color:var(--pp-primary-foreground); font-weight:600; }
      .dyn-opt-btn-primary:hover:not(:disabled) { background:var(--pp-primary-hover); border-color:var(--pp-primary-hover); color:var(--pp-primary-foreground); }
      .dyn-opt-btn-ghost { border-color:transparent; background:transparent; color:var(--pp-text-secondary); }
      .dyn-opt-btn-ghost:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover, var(--pp-surface-raised)); color:var(--pp-text); }
      .dyn-opt-btn-block { width:100%; }
      .dyn-opt-btn svg { width:14px; height:14px; }

      /* ── 结果弹窗（锚定输入栏，auto-flip 上/下） ── */
      .dyn-opt-result {
        position:absolute; right:0; z-index:160; box-sizing:border-box;
        display:flex; flex-direction:column; gap:10px; padding:14px;
        width:min(360px, calc(100vw - 32px)); max-width:calc(100vw - 24px); overflow-y:auto;
        background:var(--dsw-specific-menu, var(--pp-surface-raised));
        border:1px solid var(--pp-border); border-radius:12px;
        box-shadow:var(--dsw-shadow-lv3, 0 8px 24px rgba(0,0,0,.18));
        color:var(--pp-text); font-size:12px; line-height:18px; cursor:default;
        min-width:0; animation:dyn-opt-pop .16s ease-out;
      }
      .dyn-opt-result.up { bottom:calc(100% + 8px); }
      .dyn-opt-result.down { top:calc(100% + 8px); }
      .dyn-opt-result-head { display:flex; align-items:center; gap:8px; }
      .dyn-opt-result-head svg { width:18px; height:18px; color:var(--pp-text-secondary); flex:none; }
      .dyn-opt-result-head.is-err svg { color:var(--pp-warn); }
      .dyn-opt-result-title { font-weight:600; font-size:13px; line-height:20px; margin:0; }
      .dyn-opt-result-title.is-err { color:var(--pp-warn); }
      .dyn-opt-orig {
        max-height:70px; overflow:hidden; padding:8px 10px;
        font-size:12px; line-height:18px; color:var(--dsw-alias-label-secondary);
        white-space:pre-wrap; word-break:break-word; cursor:pointer;
        background:var(--dsw-alias-bg-input, transparent);
        border:1px dashed var(--dsw-alias-border-l1); border-radius:8px;
        display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;
      }
      .dyn-opt-orig.is-open { max-height:110px; overflow-y:auto; display:block; }
      .dyn-opt-result-body {
        max-height:200px; overflow-y:auto; padding:10px 12px;
        font-size:13px; line-height:20px; color:var(--dsw-alias-label-primary);
        white-space:pre-wrap; word-break:break-word;
        background:var(--pp-result-bg); border-radius:8px;
      }
      .dyn-opt-result-body.is-open { max-height:340px; }
      .dyn-opt-result-err {
        max-height:160px; overflow-y:auto; padding:10px 12px;
        font-size:12px; line-height:18px; color:var(--pp-warn); word-break:break-word;
        background:color-mix(in srgb, var(--pp-warn) 8%, transparent); border-radius:8px;
      }
      .dyn-opt-expand {
        display:inline-flex; align-items:center; gap:3px; margin-top:2px; padding:2px 0;
        border:none; background:transparent; color:var(--pp-accent);
        font-size:11px; line-height:1; cursor:pointer; align-self:flex-start;
      }
      .dyn-opt-expand:hover { text-decoration:underline; }
      .dyn-opt-result-hint { margin:0; font-size:11px; line-height:16px; color:var(--dsw-alias-label-tertiary); }
      .dyn-opt-result-actions { display:flex; justify-content:flex-end; gap:8px; flex-wrap:wrap; }

      /* ── 完整设置弹窗（居中 modal） ── */
      .dyn-opt-dialog-backdrop {
        position:fixed; inset:0; z-index:200;
        display:flex; align-items:center; justify-content:center; padding:20px;
        background:var(--pp-scrim);
        animation:dyn-opt-fade .18s ease-out;
      }
      .dyn-opt-dialog {
        box-sizing:border-box; display:flex; flex-direction:column; overflow:hidden;
        width:min(400px, calc(100vw - 32px)); max-width:calc(100vw - 24px); max-height:min(640px, calc(100dvh - 48px));
        /* DSH 0.2 overlay/menu tokens may be translucent; keep the full settings modal opaque. */
        background:var(--pp-modal-surface, var(--dsw-alias-bg-layer-2, #fff));
        border:1px solid var(--pp-modal-border, var(--dsw-alias-border-l2, var(--pp-border-strong))); border-radius:14px;
        box-shadow:var(--dsw-shadow-lv3, 0 12px 36px rgba(0,0,0,.22));
        color:var(--pp-text); font-size:12px; line-height:18px; cursor:default;
        min-width:0; animation:dyn-opt-pop .18s ease-out;
      }
      .dyn-opt-dialog-head {
        display:flex; align-items:center; justify-content:space-between; gap:8px;
        padding:13px 16px; border-bottom:1px solid var(--pp-modal-border, var(--pp-border));
        background:var(--pp-modal-header, var(--pp-modal-surface, #fff)); min-width:0;
      }
      .dyn-opt-dialog-title {
        display:flex; align-items:center; gap:8px;
        font-weight:600; font-size:14px; line-height:20px; margin:0; min-width:0;
      }
      .dyn-opt-dialog-title svg { width:16px; height:16px; color:var(--pp-text-secondary); flex:none; }
      .dyn-opt-dialog-body {
        overflow-y:auto; padding:14px 16px;
        display:flex; flex-direction:column; gap:16px; min-width:0;
        background:var(--pp-modal-surface, var(--dsw-alias-bg-layer-2, #fff));
      }
      .dyn-opt-dialog-body .dyn-opt-context-row,
      .dyn-opt-dialog-body .dyn-opt-hist-empty {
        background:var(--pp-modal-subtle, var(--dsw-alias-bg-layer-1, #f5f6f7));
      }
      .dyn-opt-dialog-foot {
        display:flex; align-items:center; justify-content:flex-end; gap:8px;
        padding:11px 16px; border-top:1px solid var(--pp-modal-border, var(--pp-border));
        background:var(--pp-modal-footer, var(--pp-modal-surface, #fff)); min-width:0;
      }
      .dyn-opt-note {
        display:flex; align-items:flex-start; gap:8px;
        font-size:11px; line-height:16px; color:var(--dsw-alias-label-tertiary);
      }
      .dyn-opt-note svg { width:13px; height:13px; flex:none; margin-top:1px; }
      .dyn-opt-note code { font-family:inherit; color:var(--dsw-alias-label-secondary); }

      /* ── 设置页 L2 行 ── */
      .dyn-opt-settings-row {
        display:flex; align-items:center; justify-content:space-between; gap:16px;
        width:100%; min-width:0; padding:6px 0;
      }
      .dyn-opt-settings-copy { display:flex; flex:1 1 auto; flex-direction:column; gap:2px; min-width:0; }
      .dyn-opt-settings-label { font-size:13px; line-height:20px; color:var(--pp-text); }
      .dyn-opt-settings-desc { font-size:12px; line-height:18px; color:var(--pp-text-tertiary); overflow-wrap:anywhere; }
      .dyn-opt-switch {
        appearance:none; flex:0 0 auto; width:36px; height:20px; margin:0;
        border:1px solid var(--pp-border-strong); border-radius:999px; cursor:pointer;
        background:var(--pp-surface); position:relative; transition:background .15s ease, border-color .15s ease;
      }
      .dyn-opt-switch::after {
        content:''; position:absolute; top:3px; left:3px; width:12px; height:12px;
        border-radius:50%; background:var(--pp-text-tertiary); transition:transform .15s ease, background .15s ease;
      }
      .dyn-opt-switch:checked { background:var(--pp-selected); border-color:var(--dsw-alias-border-l2, var(--pp-border-strong)); }
      .dyn-opt-switch:checked::after { transform:translateX(16px); background:var(--pp-text-secondary); }
      .dyn-opt-switch:disabled { opacity:.5; cursor:not-allowed; }

      /* ── 焦点与可访问性 ── */
      .dyn-opt-main:focus-visible, .dyn-opt-gear:focus-visible, .dyn-opt-pop-close:focus-visible,
      .dyn-opt-btn:focus-visible, .dyn-opt-hist-btn:focus-visible, .dyn-opt-expand:focus-visible,
      .dyn-opt-context-row:focus-visible, .dyn-opt-select:focus-visible, .dyn-opt-textarea:focus-visible,
      .dyn-opt-switch:focus-visible {
        outline:2px solid var(--dsw-alias-state-business-primary, var(--pp-accent)); outline-offset:2px;
      }
      @media (prefers-reduced-motion: reduce) {
        .dyn-opt-root *, .dyn-opt-pop *, .dyn-opt-result *, .dyn-opt-dialog *, .dyn-opt-dialog-backdrop * {
          transition:none !important; animation:none !important;
        }
      }
      @media (prefers-contrast: high) {
        .dyn-opt-select, .dyn-opt-textarea, .dyn-opt-gear, .dyn-opt-btn, .dyn-opt-hist-btn,
        .dyn-opt-context-row, .dyn-opt-pop, .dyn-opt-result, .dyn-opt-dialog { border-width:2px; }
      }
      @media (max-width:560px) {
        .dyn-opt-pop, .dyn-opt-result { right:auto; left:50%; transform:translateX(-50%); }
        .dyn-opt-pop.up, .dyn-opt-result.up, .dyn-opt-pop.down, .dyn-opt-result.down { transform:translateX(-50%); }
        .dyn-opt-dialog-backdrop { padding:12px; }
        .dyn-opt-dialog { width:min(400px, calc(100vw - 24px)); max-height:calc(100dvh - 24px); }
        .dyn-opt-result-actions { justify-content:stretch; }
        .dyn-opt-result-actions .dyn-opt-btn { flex:1 1 110px; }
      }
      @supports not (background: color-mix(in srgb, red 50%, blue 50%)) {
        .dyn-opt-main.is-on { background-color:transparent; }
        .dyn-opt-main.is-on:hover:not(:disabled) { background-color:var(--dsw-alias-interactive-bg-hover, var(--pp-surface-raised)); }
        .dyn-opt-spinner { border-color:var(--pp-border-strong); border-top-color:var(--pp-accent); }
        .dyn-opt-result-err { background:var(--pp-surface); }
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
    function createLooseSchema() {
      return {
        parse: looseParse,
        safeParse(value) {
          try {
            return { success: true, data: looseParse(value) }
          } catch (error) {
            return { success: false, error }
          }
        },
      }
    }
    const argsCodec = { mode: 'strict', typeSymbol: 'dsh-prompt-polish#Args', create: createLooseSchema }
    const resultCodec = { mode: 'strict', typeSymbol: 'dsh-prompt-polish#Result', create: createLooseSchema }

    const descriptor = (method) => ({
      id: 'dsh-prompt-polish#promptPolish/' + method,
      service: 'promptPolish',
      namespace: 'promptPolish',
      method,
      invocation: { kind: 'direct' },
      parameters: [
        { name: 'args', wire: 'args', source: 'json', codec: argsCodec },
      ],
      result: resultCodec,
    })

    const CONTRIBUTION = {
      package: 'dsh-prompt-polish',
      descriptors: [
        descriptor('getSettings'),
        descriptor('setSettings'),
        descriptor('optimizePrompt'),
        descriptor('cancelOptimize'),
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
        { value: 'translate', label: '翻译并优化' },
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

      // ── 统一线性 SVG 图标（24 viewBox，stroke 1.8，currentColor）────────
      const ICON_PATHS = {
        optimize: [
          'M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z',
          'M20 3v4', 'M22 5h-4',
          'M4 17v2', 'M5 18H3',
        ],
        gear: [
          'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
          'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
        ],
        chat: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
        wrench: ['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'],
        target: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
        list: ['m3 17 2 2 4-4', 'M3 7h18', 'M3 12h18'],
        file: ['M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
        history: ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5', 'M12 7v5l4 2'],
        x: ['M18 6 6 18', 'm6 6 12 12'],
        check: ['M20 6 9 17l-5-5'],
        chevDown: ['m6 9 6 6 6-6'],
        chevRight: ['m9 18 6-6-6-6'],
        info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 8h.01', 'M11 12h1v4h1'],
        alert: ['M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
        save: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'm9 11 3 3L22 4'],
      }
      function Icon({ name, size, className }) {
        const paths = ICON_PATHS[name] || []
        return React.createElement('svg', {
          className: className || '',
          width: size || 14,
          height: size || 14,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        }, paths.map((d, i) => React.createElement('path', { key: i, d })))
      }

      function OptimizeControl(props) {
        const [busy, setBusy] = React.useState(false)
        const [info, setInfo] = React.useState(null)
        const [open, setOpen] = React.useState(false)
        const [dialogOpen, setDialogOpen] = React.useState(false)
        const [settings, setSettings] = React.useState(() => normalizeSettings(loadSettings()))
        // 稳定镜像：随每次渲染同步最新草稿，供异步回填前的守卫比较
        const [mirror] = React.useState(() => ({ currentDraft: '' }))
        // 最近 5 次优化历史（仅会话内存）与待确认结果弹窗
        const [history, setHistory] = React.useState([])
        const [pending, setPending] = React.useState(null)
        const [origOpen, setOrigOpen] = React.useState(false)
        const [bodyOpen, setBodyOpen] = React.useState(false)
        // 弹层/结果弹窗的放置方向与可用高度（auto-flip）
        const [place, setPlace] = React.useState({ dir: 'up', maxH: 520 })
        const rootRef = React.useRef(null)
        const gearRef = React.useRef(null)
        const activeRunRef = React.useRef(null)
        const cancelledRef = React.useRef(false)

        // DSH 0.2 session-scoped slots receive reactive standard hooks rather
        // than a direct `input`/`session` snapshot. Reading the legacy direct
        // props here made the control permanently see an empty draft, so its
        // button stayed disabled even while the composer contained text.
        const input = typeof props.useInput === 'function'
          ? (props.useInput((snapshot) => snapshot) || {})
          : (props.input || {})
        const session = typeof props.useSession === 'function'
          ? (props.useSession((snapshot) => snapshot) || {})
          : (props.session || {})
        const sessionId = props.sessionId
        const draft = typeof input.draft === 'string' ? input.draft : ''
        mirror.currentDraft = draft
        const hasOccurrences = Array.isArray(input.occurrences) && input.occurrences.length > 0
        // 优化中不设 disabled（主按钮承担「停止优化」职责），由 onClick 分流
        const disabled = session.removed === true || !draft.trim() || hasOccurrences

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

        // 瞬时状态提示（取消等）短时停留后自动消失
        React.useEffect(() => {
          if (!info) return
          const t = setTimeout(() => setInfo(null), 4000)
          return () => clearTimeout(t)
        }, [info])

        // 弹层/结果弹窗共用：测量锚点上方/下方空间，决定展开方向与可用高度
        const measurePlace = React.useCallback((minRoom) => {
          const el = rootRef.current
          if (!el) return { dir: 'up', maxH: 520 }
          let r = null
          try { r = el.getBoundingClientRect() } catch (err) { /* ignore */ }
          if (!r) return { dir: 'up', maxH: 520 }
          const vh = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 800
          const above = Math.max(160, Math.floor(r.top - 12))
          const below = Math.max(160, Math.floor(vh - r.bottom - 12))
          const dir = (above >= minRoom || above >= below) ? 'up' : 'down'
          return { dir, maxH: Math.min(560, Math.max(200, dir === 'up' ? above : below)) }
        }, [])

        React.useEffect(() => {
          if (!open && pending === null && !dialogOpen) return
          const update = () => { setPlace(measurePlace(340)) }
          update()
          window.addEventListener('resize', update)
          return () => window.removeEventListener('resize', update)
        }, [open, pending === null, dialogOpen, measurePlace])

        // 面板/结果弹窗/完整弹窗共用的外部点击 / Esc 关闭
        React.useEffect(() => {
          if (!open && pending === null && !dialogOpen) return
          const onMouseDown = (e) => {
            if (!(e.target instanceof Element)) return
            if (e.target.closest('.dyn-opt-root') === null) {
              setOpen(false)
              setPending(null)
              setDialogOpen(false)
            }
          }
          const onKeyDown = (e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              setPending(null)
              setDialogOpen(false)
            }
          }
          document.addEventListener('mousedown', onMouseDown)
          document.addEventListener('keydown', onKeyDown)
          return () => {
            document.removeEventListener('mousedown', onMouseDown)
            document.removeEventListener('keydown', onKeyDown)
          }
        }, [open, pending === null, dialogOpen])

        const togglePanel = () => {
          if (busy) return
          // 打开面板前先收起结果弹窗（结果已存历史，不丢失）
          setPending(null)
          setDialogOpen(false)
          setOpen((v) => !v)
          setInfo(null)
        }

        const openDialog = () => {
          if (busy) return
          setOpen(false)
          setPending(null)
          setDialogOpen(true)
          setInfo(null)
        }

        const closeDialog = () => {
          setDialogOpen(false)
          if (gearRef.current && typeof gearRef.current.focus === 'function') {
            try { gearRef.current.focus() } catch (err) { /* ignore */ }
          }
        }

        const changeMode = (e) => saveSettings({ mode: e.target.value })
        const changeLanguage = (e) => saveSettings({ language: e.target.value })
        const changeCustom = (e) => saveSettings({ custom: e.target.value.slice(0, 500) })
        const toggleToolResults = (v) => saveSettings({ withToolResults: v === true })

        const pushHistory = (entry) => {
          setHistory((h) => [...h, entry].slice(-5))
        }

        // 主流程：快照草稿 → 冻结输入 → RPC 优化 → 结果弹窗/失败历史
        const runOptimize = async (snapshot) => {
          cancelledRef.current = false
          const runId = makeId()
          activeRunRef.current = { runId }
          setBusy(true)
          setInfo(null)
          setPending(null)
          setOpen(false)
          setDialogOpen(false)
          setOrigOpen(false)
          setBodyOpen(false)
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
              runId,
            }
            if (settings.withHistory) payload.history = ctxInfo.items
            const res = await host.call('optimizePrompt', payload)
            // 用户已点「停止」：迟到结果一律丢弃（宿主 abort 后正常返回 cancelled）
            if (cancelledRef.current === true) return
            // 已被取消或已有新一次优化取代本次：丢弃迟到结果，绝不串扰
            const cur = activeRunRef.current
            if (cur === null || cur.runId !== runId) return
            if (res && res.cancelled === true) {
              setInfo('已取消')
              return
            }
            if (res && res.ok === true && typeof res.text === 'string' && res.text.trim()) {
              const entry = { id: makeId(), time: Date.now(), draft: snapshot, result: res.text, failed: false, error: '', truncated: res.truncated === true }
              pushHistory(entry)
              setPending(entry)
            } else {
              const msg = (res && res.error) || '优化失败'
              const entry = { id: makeId(), time: Date.now(), draft: snapshot, result: '', failed: true, error: msg, truncated: false }
              pushHistory(entry)
              setPending(entry)
            }
          } catch (err) {
            if (cancelledRef.current === true) return
            const cur = activeRunRef.current
            if (cur === null || cur.runId !== runId) return
            const msg = String((err && err.message) || err)
            const entry = { id: makeId(), time: Date.now(), draft: snapshot, result: '', failed: true, error: msg, truncated: false }
            pushHistory(entry)
            setPending(entry)
          } finally {
            // 只有仍是「本次运行」时才做收尾：避免旧请求的迟到 finally
            // 清掉新一次优化的注册/输入冻结/busy 状态
            const cur = activeRunRef.current
            if (cur === null || cur.runId === runId) {
              activeRunRef.current = null
              if (conversation && typeof sessionId === 'string') {
                conversation.blocks.set(sessionId, undefined)
              }
              setBusy(false)
            }
          }
        }

        // 停止优化：本地即刻解除冻结，取消 RPC 负责中止宿主侧流
        const cancelRun = () => {
          if (!busy) return
          cancelledRef.current = true
          const runId = activeRunRef.current ? activeRunRef.current.runId : null
          activeRunRef.current = null
          if (conversation && typeof sessionId === 'string') {
            conversation.blocks.set(sessionId, undefined)
          }
          setBusy(false)
          setInfo('已取消')
          if (runId !== null) {
            host.call('cancelOptimize', { runId }).catch(() => { /* 竞态：忽略 */ })
          }
        }

        const onMainClick = () => {
          if (busy) { cancelRun(); return }
          if (disabled) return
          runOptimize(draft)
        }

        const retry = () => {
          if (busy || !pending) return
          const snapshot = pending.draft
          setPending(null)
          setInfo(null)
          runOptimize(snapshot)
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

        // 本组件复用小构件
        const statCell = (value, label, has) => React.createElement('div', { className: 'dyn-opt-stat' },
          React.createElement('div', { className: 'dyn-opt-stat-value' + (has ? '' : ' is-empty') }, value),
          React.createElement('div', { className: 'dyn-opt-stat-label' }, label),
        )

        const contextRow = (iconName, title, desc, checked, onToggle) => React.createElement(
          'label', { className: 'dyn-opt-context-row' + (checked ? ' is-checked' : '') },
          React.createElement('span', { className: 'dyn-opt-context-icon' }, Icon({ name: iconName, size: 14 })),
          React.createElement('span', { className: 'dyn-opt-context-text' },
            React.createElement('span', { className: 'dyn-opt-context-title' }, title),
            React.createElement('span', { className: 'dyn-opt-context-desc' }, desc),
          ),
          React.createElement('input', {
            className: 'dyn-opt-context-check',
            type: 'checkbox',
            checked,
            disabled: busy ? true : undefined,
            onChange: (e) => onToggle(e.target.checked),
          }),
        )

        const withContext = settings.withHistory === true
        const popDir = place.dir

        return React.createElement(
          'span',
          { className: 'dyn-opt-root', ref: rootRef },
          // ── 主按钮（默认/优化中/停止双重语义） ──
          React.createElement(
            'button', {
              type: 'button',
              className: 'dyn-opt-main' + (withContext ? ' is-on' : '') + (busy ? ' is-busy' : ''),
              title: busy ? '点击停止本次优化' : (withContext ? '参考聊天记录上下文优化当前提示词' : '优化当前提示词'),
              disabled: (!busy && disabled) ? true : undefined,
              'aria-disabled': disabled ? true : undefined,
              onClick: onMainClick,
              onMouseDown: (e) => e.preventDefault(),
            },
            busy
              ? React.createElement('span', { className: 'dyn-opt-spinner' })
              : Icon({ name: 'optimize' }),
            busy ? '停止优化' : '优化',
          ),
          // ── 设置齿轮（次级操作） ──
          React.createElement(
            'button', {
              type: 'button',
              ref: gearRef,
              className: 'dyn-opt-gear' + (open || dialogOpen ? ' is-open' : ''),
              title: '提示词优化设置',
              'aria-haspopup': 'dialog',
              'aria-expanded': (open || dialogOpen) ? 'true' : 'false',
              disabled: busy ? true : undefined,
              onClick: togglePanel,
              onMouseDown: (e) => e.preventDefault(),
            },
            Icon({ name: 'gear', size: 15 }),
          ),
          // ── 瞬时状态提示（如「已取消」；弹层/弹窗打开时不显示避免叠加） ──
          (info && !open && pending === null && !dialogOpen) ? React.createElement('span', { className: 'dyn-opt-chip' },
            Icon({ name: 'info', size: 12 }),
            info,
          ) : null,
          // ── 轻量设置弹层 ──
          open ? React.createElement(
            'div', {
              className: 'dyn-opt-pop ' + popDir,
              style: { maxHeight: place.maxH + 'px' },
              role: 'dialog',
              'aria-label': '提示词优化设置',
              onClick: (e) => e.stopPropagation(),
            },
            React.createElement('div', { className: 'dyn-opt-pop-head' },
              React.createElement('div', { className: 'dyn-opt-pop-title' },
                Icon({ name: 'optimize' }),
                '提示词优化设置',
              ),
              React.createElement('button', {
                type: 'button',
                className: 'dyn-opt-pop-close',
                title: '关闭',
                'aria-label': '关闭',
                onClick: () => setOpen(false),
              }, Icon({ name: 'x', size: 12 })),
            ),
            React.createElement('div', { className: 'dyn-opt-pop-body' },
              // 上下文设置
              React.createElement('div', { className: 'dyn-opt-col' },
                React.createElement('div', { className: 'dyn-opt-sec-title' }, Icon({ name: 'chat' }), '上下文设置'),
                contextRow('chat', '参考聊天记录上下文', '开启后，优化会结合最近的聊天记录、当前目标与任务清单理解背景。',
                  settings.withHistory, (v) => saveSettings({ withHistory: v })),
                contextRow('wrench', '包含工具调用结果', '开启后，每轮助手回复附上最近 3 条工具调用摘要（工具名 + 结果前 300 字）。',
                  settings.withToolResults, toggleToolResults),
              ),
              // 优化配置
              React.createElement('div', { className: 'dyn-opt-col' },
                React.createElement('div', { className: 'dyn-opt-sec-title' }, Icon({ name: 'gear' }), '优化配置'),
                React.createElement('div', { className: 'dyn-opt-field' },
                  React.createElement('span', { className: 'dyn-opt-field-label' }, '模式'),
                  React.createElement(
                    'select', { className: 'dyn-opt-select', value: settings.mode, onChange: changeMode, disabled: busy ? true : undefined },
                    MODE_OPTIONS.map((o) => React.createElement('option', { key: o.value, value: o.value }, o.label)),
                  ),
                ),
                React.createElement('div', { className: 'dyn-opt-field' },
                  React.createElement('span', { className: 'dyn-opt-field-label' }, settings.mode === 'translate' ? '目标语言' : '语言'),
                  React.createElement(
                    'select', { className: 'dyn-opt-select', value: settings.language, onChange: changeLanguage, disabled: busy ? true : undefined },
                    LANGUAGE_OPTIONS.map((o) => React.createElement('option', { key: o.value, value: o.value }, o.label)),
                  ),
                ),
                showTranslateHint ? React.createElement(
                  'p', { className: 'dyn-opt-field-hint' },
                  '「翻译并优化」会在目标语言中重写提示词；选「跟随原文」则保持草稿语言，不进行语言转换。',
                ) : null,
              ),
            ),
            React.createElement('div', { className: 'dyn-opt-pop-foot' },
              React.createElement('button', {
                type: 'button',
                className: 'dyn-opt-btn dyn-opt-btn-ghost dyn-opt-btn-block',
                onClick: openDialog,
              },
                Icon({ name: 'chevRight' }),
                '打开完整设置',
              ),
              React.createElement('div', { className: 'dyn-opt-pop-footnote' }, '所有设置自动保存'),
            ),
          ) : null,
          // ── 完整设置弹窗（居中 modal） ──
          dialogOpen ? React.createElement(
            'div', {
              className: 'dyn-opt-dialog-backdrop',
              onClick: (e) => { if (e.target === e.currentTarget) closeDialog() },
            },
            React.createElement(
              'div', {
                className: 'dyn-opt-dialog',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-label': '提示词优化完整设置',
                onClick: (e) => e.stopPropagation(),
              },
              React.createElement('div', { className: 'dyn-opt-dialog-head' },
                React.createElement('div', { className: 'dyn-opt-dialog-title' },
                  Icon({ name: 'optimize' }),
                  '提示词优化设置',
                ),
                React.createElement('button', {
                  type: 'button',
                  className: 'dyn-opt-pop-close',
                  title: '关闭',
                  'aria-label': '关闭',
                  onClick: closeDialog,
                }, Icon({ name: 'x', size: 12 })),
              ),
              React.createElement('div', { className: 'dyn-opt-dialog-body' },
                // 自定义指令
                React.createElement('div', { className: 'dyn-opt-col' },
                  React.createElement('div', { className: 'dyn-opt-sec-title' }, Icon({ name: 'file' }), '自定义指令'),
                  React.createElement('div', { className: 'dyn-opt-form' },
                    React.createElement('div', { className: 'dyn-opt-form-top' },
                      React.createElement('span', { className: 'dyn-opt-form-label' }, '告诉优化器你希望遵循的额外要求'),
                      React.createElement('span', {
                        className: 'dyn-opt-form-count' + (settings.custom.length >= 500 ? ' is-full' : ''),
                      }, settings.custom.length + '/500'),
                    ),
                    React.createElement('textarea', {
                      className: 'dyn-opt-textarea' + (settings.custom.length >= 500 ? ' is-full' : ''),
                      value: settings.custom,
                      rows: 4,
                      maxLength: 500,
                      placeholder: '例如：输出末尾附上一句简短总结',
                      autoFocus: true,
                      onChange: changeCustom,
                    }),
                    settings.custom.length >= 500
                      ? React.createElement('p', { className: 'dyn-opt-form-err' },
                          Icon({ name: 'alert', size: 12 }),
                          '已达 500 字上限，无法继续输入',
                        )
                      : React.createElement('p', { className: 'dyn-opt-form-hint' }, '例如：输出末尾附上一句简短总结'),
                  ),
                ),
                // 本次优化预览
                React.createElement('div', { className: 'dyn-opt-col' },
                  React.createElement('div', { className: 'dyn-opt-sec-title' }, Icon({ name: 'target' }), '本次优化预览'),
                  withContext
                    ? React.createElement('div', null,
                        React.createElement('div', { className: 'dyn-opt-stats' },
                          statCell(String(ctxInfo.stats.messages) + ' 条', '消息', ctxInfo.stats.messages > 0),
                          statCell(ctxInfo.stats.hasGoal ? '有' : '—', '目标', ctxInfo.stats.hasGoal),
                          statCell(ctxInfo.stats.hasTodo ? '有' : '—', '清单', ctxInfo.stats.hasTodo),
                          statCell(ctxInfo.stats.hasCompaction ? '有' : '—', '摘要', ctxInfo.stats.hasCompaction),
                        ),
                        React.createElement('div', { className: 'dyn-opt-stats-sub' },
                          React.createElement('span', null, '≈ ' + ctxInfo.stats.chars + ' 字符'),
                          settings.withToolResults === true
                            ? React.createElement('span', null, String(ctxInfo.stats.toolSummaries) + ' 条工具摘要')
                            : null,
                        ),
                      )
                    : React.createElement('p', { className: 'dyn-opt-form-hint' },
                        '开启「参考聊天记录上下文」后，这里会显示本次将携带的背景统计。'),
                ),
                // 优化历史
                React.createElement('div', { className: 'dyn-opt-col' },
                  React.createElement('div', { className: 'dyn-opt-sec-title' }, Icon({ name: 'history' }), '优化历史（最近 5 次）'),
                  history.length === 0
                    ? React.createElement('div', { className: 'dyn-opt-hist-empty' },
                        Icon({ name: 'history', size: 16 }),
                        React.createElement('span', null, '暂无优化记录'),
                      )
                    : React.createElement('div', { className: 'dyn-opt-hist-list' },
                        history.slice().reverse().map((item) => React.createElement(
                          'div', { key: item.id, className: 'dyn-opt-hist-item' },
                          React.createElement('div', { className: 'dyn-opt-hist-head' },
                            React.createElement('span', { className: 'dyn-opt-hist-src' },
                              formatTime(item.time) + ' · 原稿：' + (item.draft ? clip(item.draft, 24) : '（空）')),
                          ),
                          React.createElement('div', {
                            className: 'dyn-opt-hist-body' + (item.failed ? ' is-err' : ''),
                            title: '点击查看完整内容',
                            onClick: () => {
                              setPending(item)
                              setOpen(false)
                              setDialogOpen(false)
                              setOrigOpen(false)
                              setBodyOpen(false)
                            },
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
                // 配置持久化说明
                React.createElement('div', { className: 'dyn-opt-col' },
                  React.createElement('div', { className: 'dyn-opt-sec-title' }, Icon({ name: 'save' }), '配置持久化'),
                  React.createElement('div', { className: 'dyn-opt-note' },
                    Icon({ name: 'info', size: 13 }),
                    React.createElement('span', null,
                      '所有设置自动保存到本机，并同步到工作区 ',
                      React.createElement('code', null, '.dsh/prompt-optimizer/settings.json'),
                      '。',
                    ),
                  ),
                ),
              ),
              React.createElement('div', { className: 'dyn-opt-dialog-foot' },
                React.createElement('button', {
                  type: 'button',
                  className: 'dyn-opt-btn dyn-opt-btn-primary',
                  onClick: closeDialog,
                }, '完成'),
              ),
            ),
          ) : null,
          // ── 结果确认弹窗（成功/失败） ──
          pending ? React.createElement(
            'div', {
              className: 'dyn-opt-result ' + popDir,
              style: { maxHeight: 'calc(100vh - 24px)' },
              role: 'dialog',
              'aria-label': pending.failed ? '优化失败' : '优化结果',
              onClick: (e) => e.stopPropagation(),
            },
            React.createElement('div', { className: 'dyn-opt-result-head' + (pending.failed ? ' is-err' : '') },
              Icon({ name: pending.failed ? 'alert' : 'optimize' }),
              React.createElement('div', { className: 'dyn-opt-result-title' + (pending.failed ? ' is-err' : '') },
                pending.failed ? '优化失败' : '优化结果'),
            ),
            React.createElement('div', { className: 'dyn-opt-sec-label' }, '原始提示词'),
            React.createElement('div', {
              className: 'dyn-opt-orig' + (origOpen ? ' is-open' : ''),
              title: '点击展开/收起',
              onClick: () => setOrigOpen((v) => !v),
            }, pending.draft ? pending.draft : '（空）'),
            (pending.draft && pending.draft.length > 120)
              ? React.createElement('button', {
                  type: 'button',
                  className: 'dyn-opt-expand',
                  onClick: () => setOrigOpen((v) => !v),
                },
                  origOpen ? '收起' : '展开全部',
                  Icon({ name: 'chevDown', size: 11 }),
                )
              : null,
            pending.failed
              ? React.createElement('div', null,
                  React.createElement('div', { className: 'dyn-opt-sec-label' }, '错误信息'),
                  React.createElement('div', { className: 'dyn-opt-result-err' }, pending.error || '优化失败'),
                )
              : React.createElement('div', null,
                  React.createElement('div', { className: 'dyn-opt-sec-label' }, '优化后的提示词'),
                  React.createElement('div', { className: 'dyn-opt-result-body' + (bodyOpen ? ' is-open' : '') }, pending.result),
                  (pending.result && pending.result.length > 400)
                    ? React.createElement('button', {
                        type: 'button',
                        className: 'dyn-opt-expand',
                        onClick: () => setBodyOpen((v) => !v),
                      },
                        bodyOpen ? '收起' : '展开全部',
                        Icon({ name: 'chevDown', size: 11 }),
                      )
                    : null,
                  pending.truncated === true
                    ? React.createElement('p', { className: 'dyn-opt-result-hint' }, '已达输出上限，结果可能不完整')
                    : null,
                ),
            (!pending.failed && !canAdopt)
              ? React.createElement('p', { className: 'dyn-opt-result-hint' }, '输入已变化，未回填结果')
              : null,
            pending.failed
              ? React.createElement('div', { className: 'dyn-opt-result-actions' },
                  React.createElement('button', {
                    type: 'button',
                    className: 'dyn-opt-btn dyn-opt-btn-primary',
                    onClick: retry,
                  }, '重试'),
                  React.createElement('button', {
                    type: 'button',
                    className: 'dyn-opt-btn dyn-opt-btn-ghost',
                    onClick: () => setPending(null),
                  }, '关闭'),
                )
              : React.createElement('div', { className: 'dyn-opt-result-actions' },
                  React.createElement('button', {
                    type: 'button',
                    className: 'dyn-opt-btn dyn-opt-btn-primary',
                    disabled: !canAdopt,
                    onClick: adopt,
                  }, '采用优化结果'),
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
          React.createElement('div', { className: 'dyn-opt-settings-copy' },
            React.createElement('span', { className: 'dyn-opt-settings-label' }, '参考聊天记录上下文'),
            React.createElement('span', { className: 'dyn-opt-settings-desc' }, '优化时结合最近的聊天记录、当前目标与任务清单理解背景。'),
          ),
          React.createElement('input', {
            className: 'dyn-opt-switch',
            type: 'checkbox',
            checked: settings.withHistory === true,
            onChange: (e) => saveSettings({ withHistory: e.target.checked === true }),
            'aria-label': '参考聊天记录上下文',
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