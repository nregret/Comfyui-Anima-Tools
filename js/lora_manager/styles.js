export function injectStyles() {
    let style = document.getElementById("alm-style");
    if (!style) {
        style = document.createElement("style");
        style.id = "alm-style";
    }
    style.textContent = `
        :root {
            --alm-bg: var(--alm-sampled-panel-bg, var(--comfy-menu-bg, var(--bg-color, var(--p-content-background, #202124))));
            --alm-panel: var(--alm-sampled-panel-bg, var(--comfy-menu-bg, var(--p-content-background, var(--bg-color, #202124))));
            --alm-panel-soft: var(--alm-sampled-card-bg, var(--comfy-input-bg, var(--component-node-widget-background, var(--secondary-background, #2b2d31))));
            --alm-panel-hover: color-mix(in srgb, var(--alm-control) 94%, var(--alm-text) 6%);
            --alm-control: var(--alm-sampled-control-bg, var(--p-button-secondary-background, var(--secondary-background, var(--comfy-input-bg, var(--alm-panel-soft)))));
            --alm-border: var(--border-color, var(--alm-sampled-border-color, var(--p-content-border-color, var(--p-button-secondary-border-color, #4a4a4a))));
            --alm-divider: var(--border-color, var(--alm-border));
            --alm-text: var(--alm-sampled-text-color, var(--fg-color, var(--input-text, var(--p-text-color, var(--base-foreground, #f2f3f5)))));
            --alm-muted: var(--alm-sampled-muted-color, var(--descrip-text, var(--p-text-muted-color, var(--muted-foreground, #9ca3af))));
            --alm-accent: var(--alm-sampled-accent, var(--p-primary-color, var(--p-button-primary-background, #62a8ff)));
            --alm-accent-text: var(--p-primary-contrast-color, #fff);
            --alm-good: #31d0aa;
            --alm-warn: #f1b84b;
            --alm-bad: #ff6b6b;
            --alm-info: var(--alm-accent);
            --alm-radius: 8px;
            --alm-shadow: var(--p-overlay-popover-shadow, 0 18px 48px rgba(0, 0, 0, 0.32));
            --alm-backdrop: color-mix(in srgb, var(--alm-bg) 72%, transparent);
            --alm-accent-soft: color-mix(in srgb, var(--alm-accent) 14%, transparent);
            --alm-accent-border: color-mix(in srgb, var(--alm-accent) 22%, transparent);
            --alm-danger: var(--alm-bad);
            --alm-success: var(--alm-good);
            --alm-warning: var(--alm-warn);
            --alm-danger-soft: color-mix(in srgb, var(--alm-bad) 14%, transparent);
            --alm-danger-border: color-mix(in srgb, var(--alm-bad) 22%, transparent);
        }
        .alm-node-loras {
            --alm-node-card: color-mix(in srgb, var(--alm-text) 4%, transparent);
            --alm-node-card-hover: color-mix(in srgb, var(--alm-text) 7%, transparent);
            --alm-node-line: color-mix(in srgb, var(--alm-text) 9%, transparent);
            --alm-node-line-strong: color-mix(in srgb, var(--alm-text) 20%, transparent);
            --alm-node-track: color-mix(in srgb, var(--alm-text) 14%, transparent);
            --alm-node-fill: var(--alm-accent);
            display: flex;
            flex-direction: column;
            gap: 6px;
            width: 100%;
            min-width: 0;
            box-sizing: border-box;
            overflow: hidden;
            color: var(--alm-text);
            font-family: inherit;
            font-size: 12px;
            line-height: 1.3;
            user-select: none;
            pointer-events: auto;
        }
        .alm-node-loras *, .alm-node-loras *::before, .alm-node-loras *::after { box-sizing: border-box; }
        .alm-node-loras [hidden] { display: none !important; }
        .alm-node-loras button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex: 0 0 auto;
            min-width: 0;
            margin: 0;
            padding: 0;
            border: 0;
            color: inherit;
            background: transparent;
            font: inherit;
            cursor: pointer;
        }
        .alm-node-loras button:focus-visible, .alm-node-loras input:focus-visible { outline: 2px solid var(--alm-accent); outline-offset: 1px; }
        .alm-node-lora-list { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .alm-node-lora {
            display: flex;
            align-items: center;
            gap: 10px;
            flex: 0 0 56px;
            height: 56px;
            min-width: 0;
            padding: 7px 6px 7px 7px;
            border: 1px solid var(--alm-node-line);
            border-radius: 9px;
            background: var(--alm-node-card);
            transition: border-color .15s ease, background-color .15s ease;
        }
        .alm-node-lora:hover { border-color: var(--alm-node-line-strong); background: var(--alm-node-card-hover); }
        .alm-node-lora-thumb {
            position: relative;
            display: grid;
            place-items: center;
            flex: 0 0 40px;
            width: 40px;
            height: 40px;
            overflow: hidden;
            border-radius: 7px;
            color: var(--alm-accent);
            background: linear-gradient(140deg, color-mix(in srgb, var(--alm-accent) 26%, transparent), color-mix(in srgb, var(--alm-accent) 6%, transparent));
            box-shadow: inset 0 0 0 1px var(--alm-node-line);
        }
        .alm-node-lora-thumb svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linejoin: round; stroke-linecap: round; }
        .alm-node-lora-thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; pointer-events: none; transition: opacity .2s ease, filter .2s ease; }
        .alm-node-lora-thumb.has-image img { opacity: 1; }
        .alm-node-lora-thumb.has-image svg { visibility: hidden; }
        .alm-node-lora-body { display: flex; flex: 1 1 auto; flex-direction: column; gap: 4px; min-width: 0; }
        .alm-node-lora-header { display: flex; align-items: center; gap: 7px; height: 18px; min-width: 0; }
        .alm-node-loras .alm-node-lora-toggle {
            position: relative;
            flex: 0 0 26px;
            width: 26px;
            height: 14px;
            border-radius: 7px;
            background: color-mix(in srgb, var(--alm-text) 26%, transparent);
            transition: background-color .15s ease;
        }
        .alm-node-lora-toggle::after {
            content: "";
            position: absolute;
            left: 2px;
            top: 2px;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #fff;
            box-shadow: 0 1px 2px rgba(0, 0, 0, .35);
            transition: transform .15s ease;
        }
        .alm-node-loras .alm-node-lora-toggle[aria-checked="true"] { background: var(--alm-accent); }
        .alm-node-lora-toggle[aria-checked="true"]::after { transform: translateX(12px); }
        .alm-node-loras .alm-node-lora-name {
            display: block;
            flex: 1 1 0;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            text-align: left;
            color: var(--alm-text);
            font-size: 12px;
            font-weight: 600;
            line-height: 18px;
            transition: color .15s ease;
        }
        .alm-node-loras .alm-node-lora-name:hover { color: var(--alm-accent); }
        .alm-node-loras .alm-node-lora-icon {
            flex: 0 0 22px;
            width: 22px;
            height: 22px;
            margin: -2px 0;
            border-radius: 6px;
            color: var(--alm-muted);
            opacity: .6;
            transition: opacity .15s ease, color .15s ease, background-color .15s ease;
        }
        .alm-node-lora:hover .alm-node-lora-icon { opacity: 1; }
        .alm-node-lora-icon svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
        .alm-node-loras .alm-node-lora-copy.is-empty, .alm-node-lora:hover .alm-node-lora-copy.is-empty { opacity: .35; }
        .alm-node-loras .alm-node-lora-copy:hover { color: var(--alm-accent); background: var(--alm-accent-soft); opacity: 1; }
        .alm-node-loras .alm-node-lora-remove:hover { color: var(--alm-danger); background: var(--alm-danger-soft); opacity: 1; }
        .alm-node-lora-strength { display: flex; align-items: center; gap: 8px; height: 18px; min-width: 0; padding-right: 2px; }
        .alm-node-lora-strength input[type="range"] {
            --alm-fill-a: calc(6px + (100% - 12px) * var(--alm-fill-from, 0));
            --alm-fill-b: calc(6px + (100% - 12px) * var(--alm-fill-to, 0));
            --alm-track: linear-gradient(to right, var(--alm-node-track) var(--alm-fill-a), var(--alm-node-fill) var(--alm-fill-a), var(--alm-node-fill) var(--alm-fill-b), var(--alm-node-track) var(--alm-fill-b));
            flex: 1 1 auto;
            min-width: 0;
            height: 18px;
            margin: 0;
            padding: 0;
            outline-offset: 2px;
            background: linear-gradient(var(--alm-node-line-strong), var(--alm-node-line-strong)) no-repeat;
            background-size: 1px 10px;
            background-position: calc(6px + (100% - 12px) * var(--alm-zero, .5)) center;
            appearance: none;
            -webkit-appearance: none;
            cursor: pointer;
        }
        .alm-node-lora-strength input[type="range"]::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: var(--alm-track); }
        .alm-node-lora-strength input[type="range"]::-moz-range-track { height: 4px; border-radius: 2px; background: var(--alm-track); }
        .alm-node-lora-strength input[type="range"]::-webkit-slider-thumb {
            width: 12px;
            height: 12px;
            margin-top: -4px;
            border: 0;
            border-radius: 50%;
            background: #fff;
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--alm-node-fill) 38%, transparent), 0 1px 3px rgba(0, 0, 0, .45);
            appearance: none;
            -webkit-appearance: none;
            transition: transform .12s ease, box-shadow .12s ease;
        }
        .alm-node-lora-strength input[type="range"]::-moz-range-thumb {
            width: 12px;
            height: 12px;
            border: 0;
            border-radius: 50%;
            background: #fff;
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--alm-node-fill) 38%, transparent), 0 1px 3px rgba(0, 0, 0, .45);
        }
        .alm-node-lora-strength input[type="range"]:not(:disabled):hover::-webkit-slider-thumb,
        .alm-node-lora-strength input[type="range"]:not(:disabled):active::-webkit-slider-thumb { transform: scale(1.15); }
        .alm-node-lora-strength input[type="number"] {
            flex: 0 0 46px;
            width: 46px;
            height: 20px;
            margin: 0;
            padding: 0 4px;
            border: 1px solid transparent;
            border-radius: 5px;
            outline: none;
            background: color-mix(in srgb, var(--alm-text) 7%, transparent);
            color: var(--alm-text);
            font: inherit;
            font-size: 11.5px;
            font-weight: 600;
            font-variant-numeric: tabular-nums;
            text-align: center;
            appearance: textfield;
            -moz-appearance: textfield;
            user-select: text;
            transition: border-color .15s ease, background-color .15s ease;
        }
        .alm-node-lora-strength input[type="number"]::-webkit-inner-spin-button,
        .alm-node-lora-strength input[type="number"]::-webkit-outer-spin-button { appearance: none; margin: 0; }
        .alm-node-lora-strength input[type="number"]:not(:disabled):hover { border-color: var(--alm-node-line-strong); }
        .alm-node-lora-strength input[type="number"]:focus { border-color: var(--alm-accent); background: var(--alm-accent-soft); }
        .alm-node-lora.is-negative { --alm-node-fill: var(--alm-warn); }
        .alm-node-lora.is-negative .alm-node-lora-strength input[type="number"] { color: var(--alm-warn); }
        .alm-node-lora.is-disabled { --alm-node-fill: color-mix(in srgb, var(--alm-text) 30%, transparent); background: transparent; }
        .alm-node-lora.is-disabled .alm-node-lora-thumb { opacity: .45; filter: grayscale(1); }
        .alm-node-loras .alm-node-lora.is-disabled .alm-node-lora-name { color: var(--alm-muted); font-weight: 500; }
        .alm-node-lora.is-disabled .alm-node-lora-strength { opacity: .5; }
        .alm-node-lora.is-disabled .alm-node-lora-strength input { cursor: default; }
        .alm-node-lora.is-disabled .alm-node-lora-strength input[type="number"] { color: var(--alm-muted); }
        .alm-node-loras .alm-node-lora-empty {
            justify-content: flex-start;
            gap: 12px;
            width: 100%;
            height: 64px;
            padding: 0 14px;
            border: 1px dashed var(--alm-node-line-strong);
            border-radius: 9px;
            text-align: left;
            transition: border-color .15s ease, background-color .15s ease;
        }
        .alm-node-loras .alm-node-lora-empty:hover { border-color: var(--alm-accent); background: var(--alm-accent-soft); }
        .alm-node-lora-empty-icon { display: grid; place-items: center; flex: 0 0 32px; width: 32px; height: 32px; border-radius: 8px; color: var(--alm-accent); background: var(--alm-accent-soft); }
        .alm-node-lora-empty-icon svg, .alm-node-lora-open-icon svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
        .alm-node-lora-empty-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .alm-node-lora-empty-text strong { overflow: hidden; color: var(--alm-text); font-size: 12px; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }
        .alm-node-lora-empty-text span { color: var(--alm-accent); font-size: 11px; }
        .alm-node-lora-footer { display: flex; flex: 0 0 28px; align-items: center; justify-content: space-between; gap: 8px; height: 28px; min-width: 0; padding-left: 2px; }
        .alm-node-lora-summary { overflow: hidden; color: var(--alm-muted); font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; text-overflow: ellipsis; }
        .alm-node-loras .alm-node-lora-open {
            gap: 6px;
            height: 28px;
            padding: 0 12px 0 9px;
            border: 1px solid var(--alm-accent-border);
            border-radius: 7px;
            background: var(--alm-accent-soft);
            color: var(--alm-accent);
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
            transition: background-color .15s ease, border-color .15s ease;
        }
        .alm-node-loras .alm-node-lora-open:hover { border-color: var(--alm-accent); background: color-mix(in srgb, var(--alm-accent) 24%, transparent); }
        .alm-node-lora-open-icon { display: inline-grid; place-items: center; }
        .alm-node-lora-open-icon svg { width: 14px; height: 14px; }
        .alm-left-entry {
            position: fixed;
            left: 8px;
            top: 46%;
            z-index: 999;
            writing-mode: vertical-rl;
            transform: translateY(-50%);
            border: 1px solid rgba(92, 180, 255, 0.45);
            background: #141922;
            color: #d8e8ff;
            padding: 10px 7px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
        }
        .alm-left-entry:hover {
            opacity: 1;
            background: #1d2633;
        }
        .alm-overlay {
            position: fixed;
            inset: 0;
            z-index: 10000;
            display: none;
            background: rgba(5, 7, 10, 0.72);
            color: #e6edf7;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .alm-overlay.show {
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .alm-shell {
            width: min(1480px, calc(100vw - 48px));
            height: min(920px, calc(100vh - 48px));
            background: #101318;
            border: 1px solid #2b323d;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 28px 80px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
            position: relative;
        }
        .alm-topbar {
            height: 68px;
            padding: 12px 18px;
            border-bottom: 1px solid #27303a;
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #151a21;
        }
        .alm-title {
            font-size: 20px;
            font-weight: 800;
        }
        .alm-subtitle {
            margin-top: 3px;
            font-size: 12px;
            color: #9aa6b6;
        }
        .alm-layout {
            min-height: 0;
            flex: 1;
            display: grid;
            grid-template-columns: 180px minmax(0, 1fr);
        }
        .alm-nav {
            border-right: 1px solid #27303a;
            background: #12171e;
            padding: 14px 10px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .alm-nav-btn,
        .alm-segmented button,
        .alm-primary,
        .alm-secondary,
        .alm-danger,
        .alm-icon-btn,
        .alm-load-more,
        .alm-trained button,
        .alm-alert button {
            border: 1px solid #323b47;
            background: #1b222b;
            color: #e6edf7;
            border-radius: 7px;
            min-height: 34px;
            padding: 0 12px;
            cursor: pointer;
            font-weight: 650;
        }
        .alm-nav-btn {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
        }
        .alm-nav-btn.active,
        .alm-segmented button.active {
            background: #243142;
            border-color: #5ea6e8;
            color: #f7fbff;
        }
        .alm-nav-btn b {
            min-width: 22px;
            height: 22px;
            border-radius: 999px;
            background: #2f8cd8;
            display: grid;
            place-items: center;
            font-size: 11px;
        }
        .alm-body {
            min-width: 0;
            min-height: 0;
            overflow: hidden;
            position: relative;
        }
        .alm-page {
            height: 100%;
            display: flex;
            flex-direction: column;
            min-height: 0;
        }
        .alm-toolbar {
            min-height: 58px;
            padding: 12px;
            border-bottom: 1px solid #27303a;
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }
        .alm-toolbar h2 {
            margin: 0;
            font-size: 18px;
        }
        .alm-segmented {
            display: inline-flex;
            gap: 4px;
            padding: 3px;
            border: 1px solid #2c3541;
            background: #151a21;
            border-radius: 8px;
        }
        .alm-segmented button {
            border-color: transparent;
            min-height: 30px;
        }
        .alm-input {
            min-height: 34px;
            border: 1px solid #323b47;
            background: #0f1319;
            color: #e6edf7;
            border-radius: 7px;
            padding: 0 10px;
            box-sizing: border-box;
        }
        .alm-input:disabled {
            opacity: 0.5;
        }
        .alm-search {
            min-width: min(420px, 46vw);
            flex: 1;
        }
        .alm-full {
            width: 100%;
        }
        .alm-primary {
            background: #2a6ea8;
            border-color: #4ea8e9;
        }
        .alm-secondary:hover,
        .alm-primary:hover,
        .alm-danger:hover,
        .alm-load-more:hover,
        .alm-trained button:hover {
            filter: brightness(1.13);
        }
        .alm-danger {
            background: #5b2024;
            border-color: #a5434b;
        }
        .alm-split {
            min-height: 0;
            flex: 1;
            position: relative;
            display: block;
            overflow: hidden;
        }
        .alm-results {
            height: 100%;
            min-width: 0;
            overflow: auto;
            padding: 14px;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
            align-content: start;
            gap: 12px;
        }
        .alm-detail {
            min-width: 0;
            overflow: hidden;
            border-left: 1px solid #27303a;
            background: #12171e;
        }
        .alm-detail-scroll {
            height: 100%;
            overflow: auto;
            padding: 14px;
            box-sizing: border-box;
        }
        .alm-card {
            border: 1px solid #27303a;
            background: #151a21;
            border-radius: 8px;
            overflow: hidden;
            cursor: pointer;
            min-width: 0;
        }
        .alm-card:hover,
        .alm-card.selected {
            border-color: #5ea6e8;
        }
        .alm-thumb {
            position: relative;
            aspect-ratio: 4 / 5;
            background: #0b0f14;
            overflow: hidden;
        }
        .alm-thumb.small {
            aspect-ratio: 16 / 10;
        }
        .alm-thumb img,
        .alm-detail-preview img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        .alm-no-image {
            width: 100%;
            height: 100%;
            display: grid;
            place-items: center;
            color: #8792a1;
            background: #20242c;
            font-size: 13px;
        }
        .alm-card-body {
            padding: 10px;
            display: grid;
            gap: 7px;
        }
        .alm-card-title {
            font-size: 13px;
            font-weight: 780;
            line-height: 1.28;
            min-height: 34px;
            overflow: hidden;
        }
        .alm-card-meta,
        .alm-card-tags {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            color: #9aa6b6;
            font-size: 11px;
        }
        .alm-card-tags span {
            border: 1px solid #323b47;
            border-radius: 999px;
            padding: 3px 7px;
            background: #10151c;
        }
        .alm-card-tags .installed {
            border-color: #3f9965;
            color: #98e5b2;
        }
        .alm-card-tags .favorite {
            border-color: #b7984a;
            color: #ffe09a;
        }
        .alm-card-tags .missing,
        .alm-warning,
        .alm-card-tags .warning {
            color: #ffd28a;
        }
        .alm-detail-head {
            display: grid;
            grid-template-columns: 108px minmax(0, 1fr);
            gap: 12px;
            align-items: center;
            margin-bottom: 14px;
        }
        .alm-detail-head h2 {
            margin: 0 0 6px;
            font-size: 18px;
            line-height: 1.25;
        }
        .alm-detail-head p {
            margin: 0;
            color: #9aa6b6;
            font-size: 12px;
        }
        .alm-detail-preview {
            aspect-ratio: 1 / 1;
            border: 1px solid #27303a;
            border-radius: 8px;
            overflow: hidden;
            background: #0b0f14;
        }
        .alm-label {
            display: block;
            margin: 12px 0 6px;
            color: #b8c4d4;
            font-size: 12px;
            font-weight: 700;
        }
        .alm-trained {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin: 12px 0;
            color: #9aa6b6;
            font-size: 12px;
        }
        .alm-trained button {
            min-height: 28px;
            font-size: 11px;
        }
        .alm-path-box {
            border: 1px solid #27303a;
            background: #151a21;
            border-radius: 8px;
            padding: 12px;
            margin: 12px 0;
        }
        .alm-path-title {
            font-size: 13px;
            font-weight: 800;
            margin-bottom: 10px;
        }
        .alm-grid2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }
        .alm-grid2 label {
            display: grid;
            gap: 5px;
            color: #aeb9c8;
            font-size: 11px;
            font-weight: 700;
        }
        .alm-path {
            margin-top: 10px;
            word-break: break-all;
            color: #aeb9c8;
            font-size: 11px;
            line-height: 1.45;
            background: #0f1319;
            border: 1px solid #27303a;
            border-radius: 7px;
            padding: 8px;
        }
        .alm-description {
            margin-top: 14px;
            color: #aeb9c8;
            font-size: 12px;
            line-height: 1.5;
        }
        .alm-empty,
        .alm-empty-detail {
            min-height: 240px;
            display: grid;
            place-items: center;
            color: #8e99a8;
            text-align: center;
            padding: 28px;
            border: 1px dashed #303946;
            border-radius: 8px;
        }
        .alm-load-more {
            grid-column: 1 / -1;
        }
        .alm-load-status {
            grid-column: 1 / -1;
            min-height: 40px;
            display: grid;
            place-items: center;
            color: #a1a1aa;
            font-size: 12.5px;
            font-weight: 750;
        }
        .alm-info-list {
            display: grid;
            gap: 7px;
            margin: 12px 0;
        }
        .alm-info-list div {
            display: grid;
            grid-template-columns: 100px minmax(0, 1fr);
            gap: 8px;
            font-size: 12px;
        }
        .alm-info-list span {
            color: #8693a3;
        }
        .alm-info-list b {
            color: #d6dfeb;
            word-break: break-all;
            font-weight: 650;
        }
        .alm-action-row {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        .alm-download-list {
            overflow: auto;
            padding: 14px;
            display: grid;
            gap: 12px;
        }
        .alm-settings-grid {
            padding: 18px;
            display: grid;
            grid-template-columns: minmax(360px, 520px) minmax(320px, 1fr);
            gap: 18px;
            overflow: auto;
        }
        .alm-settings-form,
        .alm-roots {
            border: 1px solid #27303a;
            background: #151a21;
            border-radius: 8px;
            padding: 16px;
        }
        .alm-settings-form h2,
        .alm-roots h2 {
            margin: 0 0 14px;
        }
        .alm-check {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 12px 0;
            color: #c5cfdd;
            font-size: 13px;
        }
        .alm-root-row {
            display: grid;
            grid-template-columns: 120px minmax(0, 1fr);
            gap: 10px;
            padding: 10px 0;
            border-bottom: 1px solid #27303a;
            font-size: 12px;
        }
        .alm-root-row:last-child {
            border-bottom: 0;
        }
        .alm-root-row span {
            color: #9aa6b6;
        }
        .alm-root-row b {
            word-break: break-all;
        }
        .alm-alert {
            position: absolute;
            left: 12px;
            right: 12px;
            top: 12px;
            z-index: 3;
            border: 1px solid #9f4f4f;
            background: #35181b;
            color: #ffd5d8;
            border-radius: 8px;
            padding: 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }
        .alm-toast {
            position: absolute;
            right: 18px;
            top: 18px;
            z-index: 4;
            background: #1d3428;
            color: #c8f8da;
            border: 1px solid #4c9b6a;
            border-radius: 8px;
            padding: 10px 12px;
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
        }
        .alm-muted {
            color: #8d98a8;
        }
        @media (max-width: 980px) {
            .alm-shell {
                width: 100vw;
                height: 100vh;
                border-radius: 0;
            }
            .alm-layout {
                grid-template-columns: 1fr;
            }
            .alm-nav {
                border-right: 0;
                border-bottom: 1px solid #27303a;
                flex-direction: row;
                overflow-x: auto;
            }
            .alm-split {
                grid-template-columns: 1fr;
            }
            .alm-detail {
                border-left: 0;
                border-top: 1px solid #27303a;
                min-height: 560px;
            }
            .alm-settings-grid {
                grid-template-columns: 1fr;
            }
        }

        /* Anima Clothing inspired visual pass. Keep this block last so it
           stabilizes the manager across ComfyUI frontend versions. */
        @keyframes almFadeIn {
            from { opacity: 0; transform: scale(0.985) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .alm-overlay {
            z-index: 99999;
            background: rgba(10, 10, 15, 0.74);
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            color: #f3f4f6;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        .alm-shell {
            width: min(1780px, calc(100vw - 24px));
            max-width: none;
            height: calc(100vh - 24px);
            max-height: none;
            background: #171718;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 24px;
            box-shadow: 0 25px 60px rgba(0,0,0,0.58);
            animation: almFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .alm-left-entry {
            left: 10px;
            top: 50%;
            z-index: 9999;
            border: 1px solid rgba(219,39,119,0.36);
            background: rgba(23,23,24,0.92);
            color: #f9a8d4;
            border-radius: 12px;
            padding: 12px 8px;
            box-shadow: 0 14px 34px rgba(0,0,0,0.42), 0 0 18px rgba(219,39,119,0.16);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
        }
        .alm-left-entry:hover {
            background: rgba(219,39,119,0.16);
            border-color: rgba(219,39,119,0.58);
            color: #fff;
        }
        .alm-topbar {
            height: auto;
            min-height: 72px;
            padding: 20px 26px 16px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            background: linear-gradient(180deg, rgba(219,39,119,0.08), rgba(23,23,24,0));
            gap: 18px;
        }
        .alm-title {
            font-size: 20px;
            font-weight: 850;
            color: #fff;
            line-height: 1.2;
        }
        .alm-subtitle {
            font-size: 12.5px;
            color: #a1a1aa;
            margin-top: 5px;
        }
        .alm-layout {
            display: grid;
            grid-template-columns: clamp(260px, 16vw, 292px) minmax(0, 1fr);
            min-height: 0;
            flex: 1;
            background: rgba(10,10,15,0.18);
        }
        .alm-nav {
            border-right: 1px solid rgba(255,255,255,0.06);
            background: rgba(18,18,24,0.45);
            padding: 18px 12px 18px 14px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 7px;
        }
        .alm-nav::-webkit-scrollbar,
        .alm-results::-webkit-scrollbar,
        .alm-detail-scroll::-webkit-scrollbar,
        .alm-download-list::-webkit-scrollbar,
        .alm-settings-grid::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        .alm-nav::-webkit-scrollbar-track,
        .alm-results::-webkit-scrollbar-track,
        .alm-detail-scroll::-webkit-scrollbar-track,
        .alm-download-list::-webkit-scrollbar-track,
        .alm-settings-grid::-webkit-scrollbar-track {
            background: transparent;
        }
        .alm-nav::-webkit-scrollbar-thumb,
        .alm-results::-webkit-scrollbar-thumb,
        .alm-detail-scroll::-webkit-scrollbar-thumb,
        .alm-download-list::-webkit-scrollbar-thumb,
        .alm-settings-grid::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.14);
            border-radius: 999px;
        }
        .alm-nav-btn {
            min-height: 42px;
            padding: 0 12px;
            border-radius: 10px;
            color: #a1a1aa;
            background: transparent;
            border: 1px solid transparent;
            font-size: 12.5px;
            font-weight: 700;
            transition: all 0.16s ease;
            width: 100%;
            justify-content: space-between;
        }
        .alm-nav-group {
            display: grid;
            gap: 7px;
            padding-bottom: 14px;
            margin-bottom: 10px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .alm-nav-group:last-child {
            border-bottom: 0;
            margin-bottom: 0;
        }
        .alm-nav-title {
            color: #71717a;
            font-size: 11px;
            font-weight: 850;
            text-transform: uppercase;
            letter-spacing: 0;
            padding: 4px 2px;
        }
        .alm-category-group {
            padding-bottom: 0;
        }
        .alm-category-btn span {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .alm-folder-tree,
        .alm-folder-children {
            display: grid;
            gap: 4px;
            min-width: 0;
        }
        .alm-folder-node {
            min-width: 0;
        }
        .alm-folder-row {
            display: grid;
            grid-template-columns: 22px minmax(0, 1fr);
            align-items: center;
            gap: 4px;
            min-width: 0;
            padding-left: calc(var(--alm-folder-depth, 0) * 12px);
        }
        .alm-folder-toggle,
        .alm-folder-spacer {
            width: 22px;
            height: 34px;
        }
        .alm-folder-toggle {
            border: 0;
            border-radius: 8px;
            background: transparent;
            color: #8d8d96;
            cursor: pointer;
            display: grid;
            place-items: center;
            padding: 0;
        }
        .alm-folder-toggle::before {
            content: "";
            width: 0;
            height: 0;
            border-top: 4px solid transparent;
            border-bottom: 4px solid transparent;
            border-left: 5px solid currentColor;
            transition: transform 0.12s ease;
        }
        .alm-folder-toggle.expanded::before {
            transform: rotate(90deg);
        }
        .alm-folder-toggle:hover {
            background: rgba(255,255,255,0.05);
            color: #fff;
        }
        .alm-folder-select {
            min-width: 0;
            padding: 0 10px;
        }
        .alm-folder-select span {
            min-width: 0;
            overflow: hidden;
            text-align: left;
            text-overflow: ellipsis;
        }
        .alm-nav-note {
            color: #8d8d96;
            font-size: 12px;
            line-height: 1.4;
            padding: 8px 4px;
        }
        .alm-nav-btn:hover {
            background: rgba(255,255,255,0.05);
            color: #fff;
        }
        .alm-nav-btn.active {
            background: rgba(219,39,119,0.14);
            border-color: rgba(219,39,119,0.34);
            color: #f9a8d4;
        }
        .alm-nav-btn b {
            background: #db2777;
            color: #fff;
            box-shadow: 0 0 14px rgba(219,39,119,0.52);
        }
        .alm-body {
            background: rgba(10,10,15,0.18);
            color: #f3f4f6;
        }
        .alm-toolbar {
            min-height: 64px;
            padding: 14px 26px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            background: rgba(18,18,24,0.42);
            gap: 10px;
        }
        .alm-nav-btn,
        .alm-segmented button,
        .alm-primary,
        .alm-secondary,
        .alm-danger,
        .alm-icon-btn,
        .alm-load-more,
        .alm-trained button,
        .alm-alert button {
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px;
            background: rgba(255,255,255,0.05);
            color: #e5e7eb;
            min-height: 38px;
            padding: 0 14px;
            font-size: 13px;
            font-weight: 700;
            transition: all 0.18s ease;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            white-space: nowrap;
        }
        .alm-nav .alm-nav-btn {
            justify-content: space-between;
            width: 100%;
        }
        .alm-primary {
            background: linear-gradient(135deg, #db2777, #9d174d);
            border-color: rgba(219,39,119,0.35);
            color: #fff;
            box-shadow: 0 8px 20px rgba(219,39,119,0.24);
        }
        .alm-primary:hover:not(:disabled) {
            box-shadow: 0 10px 25px rgba(219,39,119,0.36);
            transform: translateY(-1px);
        }
        .alm-secondary:hover:not(:disabled),
        .alm-icon-btn:hover:not(:disabled),
        .alm-load-more:hover:not(:disabled),
        .alm-trained button:hover:not(:disabled) {
            background: rgba(255,255,255,0.11);
            border-color: rgba(255,255,255,0.16);
            color: #fff;
            filter: none;
        }
        .alm-danger {
            background: rgba(239,68,68,0.08);
            border-color: rgba(239,68,68,0.22);
            color: #fca5a5;
        }
        .alm-danger:hover:not(:disabled) {
            background: rgba(239,68,68,0.16);
            border-color: rgba(239,68,68,0.34);
            color: #fecaca;
            filter: none;
        }
        .alm-segmented {
            border: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.035);
            border-radius: 14px;
            padding: 4px;
        }
        .alm-segmented button {
            min-height: 34px;
            border-color: transparent;
            background: transparent;
            color: #a1a1aa;
            border-radius: 10px;
        }
        .alm-segmented button.active {
            background: rgba(219,39,119,0.18);
            border-color: rgba(219,39,119,0.42);
            color: #f9a8d4;
        }
        .alm-input {
            min-height: 39px;
            background: rgba(10,10,15,0.76);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            color: #f8fafc;
            outline: none;
            font-size: 13px;
            padding: 0 13px;
            transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .alm-input:focus {
            border-color: rgba(219,39,119,0.55);
            box-shadow: 0 0 0 3px rgba(219,39,119,0.12);
        }
        .alm-search {
            min-width: 260px;
            flex: 1;
        }
        .alm-nav-select {
            width: 100%;
            min-width: 0;
        }
        .alm-chip-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
        }
        .alm-filter-chip {
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 999px;
            background: rgba(255,255,255,0.055);
            color: #e5e7eb;
            min-height: 30px;
            padding: 0 10px;
            font-size: 12.5px;
            font-weight: 700;
            line-height: 1;
            cursor: pointer;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
        }
        .alm-filter-chip:hover {
            background: rgba(255,255,255,0.09);
            color: #fff;
        }
        .alm-filter-chip.active {
            background: rgba(219,39,119,0.16);
            border-color: rgba(219,39,119,0.38);
            color: #f9a8d4;
        }
        .alm-search-picker {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 8px;
            align-items: center;
        }
        .alm-clear-filter {
            min-height: 39px;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px;
            background: rgba(255,255,255,0.05);
            color: #d4d4d8;
            padding: 0 11px;
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
        }
        .alm-clear-filter:disabled {
            opacity: 0.45;
            cursor: default;
        }
        .alm-split {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            position: relative;
            overflow: hidden;
            background: rgba(10,10,15,0.18);
        }
        .alm-discover .alm-split,
        .alm-split.has-detail {
            grid-template-columns: minmax(0, 1fr) clamp(340px, 22vw, 400px);
        }
        .alm-results {
            height: 100%;
            display: grid;
            padding: 24px;
            gap: 18px;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            grid-auto-rows: max-content !important;
            justify-content: stretch;
            align-content: start;
            align-items: start;
        }
        .alm-card {
            position: relative;
            width: 100%;
            height: 100%;
            aspect-ratio: auto;
            min-width: 0;
            min-height: 0;
            overflow: hidden;
            box-sizing: border-box;
            border-radius: 16px;
            isolation: isolate;
            background: rgba(255,255,255,0.06);
            border: 2px solid rgba(255,255,255,0.06);
            box-shadow: 0 5px 18px rgba(0,0,0,0.25);
            transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .alm-card::before {
            content: "";
            display: none;
            width: 100%;
            padding-top: 0;
        }
        .alm-card.asset {
            height: 100%;
        }
        .alm-card:hover,
        .alm-card.selected {
            border-color: rgba(219,39,119,0.82);
            box-shadow: 0 12px 30px rgba(0,0,0,0.38), 0 0 18px rgba(219,39,119,0.16);
        }
        .alm-card.selected {
            border-color: #db2777;
            box-shadow: 0 12px 30px rgba(0,0,0,0.36), 0 0 24px rgba(219,39,119,0.24);
        }
        .alm-thumb,
        .alm-thumb.small {
            position: absolute;
            inset: 2px;
            z-index: 0;
            overflow: hidden;
            border-radius: 13px;
            clip-path: inset(0 round 13px);
            background: #0a0a10;
            aspect-ratio: auto;
        }
        .alm-thumb::after {
            content: "";
            position: absolute;
            inset: 0;
            z-index: 2;
            background: linear-gradient(to top, rgba(10,10,16,0.99) 0%, rgba(10,10,16,0.72) 42%, rgba(10,10,16,0.16) 100%);
            pointer-events: none;
        }
        .alm-thumb img,
        .alm-thumb video,
        .alm-detail-preview img,
        .alm-detail-preview video {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        .alm-no-image {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #2a1430, #101018);
            color: rgba(255,255,255,0.68);
            font-size: 18px;
            font-weight: 850;
        }
        .alm-card-body {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 4;
            padding: 13px 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            pointer-events: none;
        }
        .alm-card-title {
            min-height: 0;
            color: #fff;
            font-size: 14px;
            font-weight: 850;
            line-height: 1.2;
            text-shadow: 0 2px 12px rgba(0,0,0,0.75);
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .alm-card-meta,
        .alm-card-tags {
            color: rgba(255,255,255,0.76);
            font-size: 11.5px;
            gap: 6px;
        }
        .alm-card-tags span {
            border: 1px solid rgba(255,255,255,0.1);
            background: rgba(0,0,0,0.32);
            color: #f4f4f5;
            border-radius: 999px;
            padding: 4px 8px;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .alm-detail {
            position: relative;
            width: 100%;
            min-width: 0;
            max-width: none;
            height: 100%;
            z-index: 8;
            border-left: 1px solid rgba(255,255,255,0.06);
            background: rgba(18,18,24,0.74);
            box-shadow: -12px 0 32px rgba(0,0,0,0.28);
        }
        .alm-detail-scroll {
            padding: 20px;
            position: relative;
        }
        .alm-detail-close {
            position: sticky;
            top: 0;
            margin-left: auto;
            margin-bottom: 10px;
            z-index: 2;
            width: 32px;
            height: 32px;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.1);
            background: rgba(255,255,255,0.06);
            color: #e5e7eb;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            font-weight: 800;
        }
        .alm-detail-close:hover {
            background: rgba(219,39,119,0.16);
            border-color: rgba(219,39,119,0.38);
            color: #fff;
        }
        .alm-detail-head {
            grid-template-columns: 116px minmax(0, 1fr);
            gap: 14px;
        }
        .alm-detail-head > div:last-child {
            min-width: 0;
        }
        .alm-detail-title-link {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 8px;
            align-items: start;
            color: inherit;
            text-decoration: none;
        }
        .alm-detail-head h2,
        .alm-settings-form h2,
        .alm-roots h2,
        .alm-toolbar h2 {
            color: #fff;
            font-weight: 850;
        }
        .alm-detail-title-link h2 {
            min-width: 0;
            margin: 0;
            overflow-wrap: anywhere;
        }
        .alm-detail-title-link:hover h2 {
            color: #f9a8d4;
        }
        .alm-external-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 8px;
            color: #f9a8d4;
            background: rgba(219,39,119,0.1);
            font-size: 13px;
            line-height: 1;
        }
        .alm-detail-head p,
        .alm-card-meta,
        .alm-muted {
            color: #a1a1aa;
        }
        .alm-detail-preview {
            position: relative;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 16px;
            box-shadow: 0 8px 22px rgba(0,0,0,0.26);
        }
        .alm-path-box,
        .alm-settings-form,
        .alm-roots {
            border: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.045);
            border-radius: 16px;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .alm-path-title {
            color: #fff;
            font-weight: 850;
        }
        .alm-label,
        .alm-grid2 label,
        .alm-check {
            color: #cbd5e1;
        }
        .alm-detail .alm-input,
        .alm-detail-scroll .alm-input {
            width: 100%;
            min-width: 0;
            box-sizing: border-box;
        }
        .alm-detail .alm-grid2 {
            grid-template-columns: 1fr;
        }
        .alm-grid2 label {
            min-width: 0;
        }
        .alm-path,
        .alm-info-list b {
            background: rgba(10,10,15,0.48);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px;
            color: #d4d4d8;
        }
        .alm-info-list b {
            padding: 7px 9px;
        }
        .alm-trained button {
            min-height: 30px;
            color: #f9a8d4;
            border-color: rgba(219,39,119,0.22);
            background: rgba(219,39,119,0.08);
            font-size: 11.5px;
        }
        .alm-description {
            margin-top: 14px;
            color: #d4d4d8;
            font-size: 13px;
            line-height: 1.58;
        }
        .alm-description p,
        .alm-description ul,
        .alm-description ol,
        .alm-description pre,
        .alm-description blockquote {
            margin: 0 0 12px;
        }
        .alm-description h1,
        .alm-description h2,
        .alm-description h3,
        .alm-description h4 {
            margin: 18px 0 8px;
            color: #fff;
            line-height: 1.25;
        }
        .alm-description h1 { font-size: 18px; }
        .alm-description h2 { font-size: 16px; }
        .alm-description h3,
        .alm-description h4 { font-size: 14px; }
        .alm-description ul,
        .alm-description ol {
            padding-left: 20px;
        }
        .alm-description li {
            margin: 0 0 6px;
        }
        .alm-description a {
            color: #f9a8d4;
            text-decoration: none;
        }
        .alm-description a:hover {
            text-decoration: underline;
        }
        .alm-description code {
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 7px;
            padding: 1px 5px;
            background: rgba(10,10,15,0.6);
            color: #fbcfe8;
            font-size: 12px;
        }
        .alm-description pre {
            overflow-x: auto;
            padding: 10px;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            background: rgba(10,10,15,0.64);
        }
        .alm-description pre code {
            border: 0;
            padding: 0;
            background: transparent;
            white-space: pre-wrap;
        }
        .alm-description blockquote {
            padding: 8px 12px;
            border-left: 3px solid rgba(219,39,119,0.55);
            background: rgba(255,255,255,0.04);
            border-radius: 8px;
        }
        .alm-empty,
        .alm-empty-detail {
            grid-column: 1 / -1;
            min-height: 260px;
            border: 1px dashed rgba(255,255,255,0.12);
            border-radius: 16px;
            color: #a1a1aa;
            background: rgba(255,255,255,0.025);
        }
        .alm-load-more {
            width: min(280px, 100%);
            justify-self: center;
        }
        .alm-load-status {
            border: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.035);
            border-radius: 999px;
            width: min(260px, 100%);
            justify-self: center;
        }
        .alm-download-list,
        .alm-settings-grid {
            padding: 24px 28px;
            background: rgba(10,10,15,0.18);
        }
        @keyframes almProgressSlide {
            0% { transform: translateX(-110%); }
            100% { transform: translateX(280%); }
        }
        .alm-alert {
            border: 1px solid rgba(239,68,68,0.28);
            background: rgba(69,10,10,0.88);
            color: #fecaca;
            border-radius: 14px;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        }
        .alm-toast {
            background: rgba(80,7,36,0.92);
            color: #fce7f3;
            border: 1px solid rgba(219,39,119,0.36);
            border-radius: 14px;
            box-shadow: 0 14px 34px rgba(0,0,0,0.42), 0 0 18px rgba(219,39,119,0.18);
        }

        /* ComfyUI synchronized theme layer. Keep color decisions here so the
           manager follows the official frontend theme instead of a fixed skin. */
        .alm-overlay {
            background: var(--alm-backdrop);
            color: var(--alm-text);
        }
        .alm-shell {
            background: var(--alm-panel);
            border-color: var(--alm-border);
            border-radius: var(--alm-radius);
            box-shadow: var(--alm-shadow);
        }
        .alm-left-entry {
            background: var(--alm-control);
            border-color: var(--alm-border);
            border-radius: var(--alm-radius);
            color: var(--alm-text);
            box-shadow: var(--alm-shadow);
        }
        .alm-left-entry:hover {
            background: var(--alm-panel-hover);
            border-color: var(--alm-border);
            color: var(--alm-text);
        }
        .alm-topbar {
            background: var(--alm-panel);
            border-bottom-color: var(--alm-border);
        }
        .alm-layout,
        .alm-body,
        .alm-split,
        .alm-download-list,
        .alm-settings-grid {
            background: var(--alm-bg);
            color: var(--alm-text);
        }
        .alm-nav,
        .alm-toolbar {
            background: var(--alm-panel);
            border-color: var(--alm-border);
        }
        .alm-library-toolbar-actions {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-left: auto;
        }
        .alm-library-match-status {
            flex: 1 0 100%;
            display: grid;
            grid-template-columns: minmax(140px, 240px) auto minmax(0, 1fr);
            align-items: center;
            gap: 10px;
            min-width: 0;
            color: var(--alm-muted);
            font-size: 12px;
        }
        .alm-library-match-status > span {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .alm-library-match-progress {
            height: 7px;
            overflow: hidden;
            border-radius: 999px;
            background: color-mix(in srgb, var(--alm-muted) 18%, transparent);
        }
        .alm-library-match-progress span {
            display: block;
            height: 100%;
            border-radius: inherit;
            background: var(--alm-good);
            transition: width 0.2s ease;
        }
        .alm-nav {
            border-right-color: var(--alm-border);
            gap: 12px;
            padding-top: 16px;
        }
        .alm-nav-group {
            border-bottom-color: var(--alm-border);
            gap: 10px;
            padding-bottom: 16px;
            margin-bottom: 2px;
        }
        .alm-nav-group:last-child {
            border-bottom: 0;
            padding-bottom: 0;
            margin-bottom: 0;
        }
        .alm-category-group {
            gap: 12px;
        }
        .alm-title,
        .alm-toolbar h2,
        .alm-detail-head h2,
        .alm-settings-form h2,
        .alm-roots h2,
        .alm-path-title,
        .alm-card-title {
            color: var(--alm-text);
        }
        .alm-subtitle,
        .alm-nav-title,
        .alm-nav-note,
        .alm-detail-head p,
        .alm-card-meta,
        .alm-muted {
            color: var(--alm-muted);
        }
        .alm-nav-btn,
        .alm-segmented button,
        .alm-secondary,
        .alm-icon-btn,
        .alm-load-more,
        .alm-trained button,
        .alm-alert button,
        .alm-clear-filter,
        .alm-detail-close {
            background: var(--alm-control);
            border-radius: var(--alm-radius);
            border-color: var(--alm-border);
            color: var(--alm-text);
        }
        .alm-nav-btn {
            background: transparent;
            border-color: transparent;
            color: var(--alm-muted);
            box-shadow: none;
            transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
        }
        .alm-folder-toggle {
            color: var(--alm-muted);
        }
        .alm-folder-toggle:hover,
        .alm-nav-btn:not(.active):hover,
        .alm-secondary:hover:not(:disabled),
        .alm-icon-btn:hover:not(:disabled),
        .alm-load-more:hover:not(:disabled),
        .alm-trained button:hover:not(:disabled),
        .alm-clear-filter:hover:not(:disabled),
        .alm-detail-close:hover {
            background: var(--alm-panel-hover);
            border-color: var(--alm-border);
            color: var(--alm-text);
        }
        .alm-nav-btn.active,
        .alm-segmented button.active,
        .alm-filter-chip.active {
            background: var(--alm-accent-soft);
            border-color: var(--alm-accent-border);
            color: color-mix(in srgb, var(--alm-accent) 72%, var(--alm-text));
        }
        .alm-nav-btn.active:hover,
        .alm-nav-btn.active:focus-visible,
        .alm-filter-chip.active:hover,
        .alm-filter-chip.active:focus-visible {
            background: var(--alm-accent-soft);
            border-color: var(--alm-accent-border);
            color: color-mix(in srgb, var(--alm-accent) 72%, var(--alm-text));
            box-shadow: none;
            transform: none;
            filter: none;
        }
        .alm-nav-btn:active,
        .alm-filter-chip:active,
        .alm-nav-btn.active:active,
        .alm-filter-chip.active:active {
            transform: none;
            filter: none;
            box-shadow: none;
        }
        .alm-nav-btn b {
            background: var(--alm-accent);
            color: var(--alm-accent-text);
            box-shadow: none;
        }
        .alm-primary {
            background: var(--alm-control);
            border-color: var(--alm-border);
            color: var(--alm-accent-text);
            box-shadow: none;
        }
        .alm-primary:not(:disabled) {
            background: var(--alm-accent);
            border-color: color-mix(in srgb, var(--alm-accent) 54%, var(--alm-border));
        }
        .alm-primary:hover:not(:disabled) {
            background: color-mix(in srgb, var(--alm-accent) 88%, var(--alm-text) 12%);
            box-shadow: none;
        }
        .alm-danger {
            background: var(--alm-danger-soft);
            border-color: var(--alm-danger-border);
            color: var(--alm-danger);
        }
        .alm-danger:hover:not(:disabled) {
            background: color-mix(in srgb, var(--alm-danger) 22%, transparent);
            border-color: color-mix(in srgb, var(--alm-danger) 48%, transparent);
            color: var(--alm-danger);
        }
        .alm-segmented,
        .alm-load-status {
            background: var(--alm-panel-soft);
            border-color: var(--alm-border);
            border-radius: var(--alm-radius);
        }
        .alm-segmented button {
            background: transparent;
            border-color: transparent;
            color: var(--alm-muted);
        }
        .alm-input {
            background: var(--alm-control);
            border-color: var(--alm-border);
            color: var(--alm-text);
        }
        select.alm-input,
        .alm-input:is(select) {
            appearance: none;
            -webkit-appearance: none;
            min-height: 39px;
            border-radius: var(--alm-radius);
            background-color: var(--alm-control);
            background-image:
                linear-gradient(45deg, transparent 50%, var(--alm-muted) 50%),
                linear-gradient(135deg, var(--alm-muted) 50%, transparent 50%);
            background-position:
                calc(100% - 16px) 52%,
                calc(100% - 10px) 52%;
            background-size: 6px 6px, 6px 6px;
            background-repeat: no-repeat;
            padding-right: 34px;
            font-size: 12.5px;
            font-weight: 680;
            line-height: 1.2;
            cursor: pointer;
        }
        select.alm-input:focus,
        .alm-input:is(select):focus {
            border-color: var(--alm-accent-border);
            box-shadow: 0 0 0 3px var(--alm-accent-soft);
            outline: 0;
        }
        select.alm-input option,
        .alm-input:is(select) option {
            background: var(--alm-panel);
            color: var(--alm-text);
        }
        .alm-input::placeholder {
            color: var(--alm-muted);
            opacity: 0.82;
        }
        .alm-input:focus {
            border-color: var(--alm-accent-border);
            box-shadow: 0 0 0 3px var(--alm-accent-soft);
        }
        .alm-combo {
            position: relative;
            min-width: 0;
            width: 100%;
            z-index: 1;
        }
        .alm-select-menu {
            width: 100%;
        }
        .alm-toolbar-select {
            flex: 0 0 180px;
            width: 180px;
        }
        .alm-combo.open {
            z-index: 40;
        }
        .alm-combo-control {
            width: 100%;
            min-width: 0;
            min-height: 39px;
            box-sizing: border-box;
            border: 1px solid var(--alm-border);
            border-radius: var(--alm-radius);
            background: var(--alm-control);
            color: var(--alm-text);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 0 10px 0 12px;
            cursor: pointer;
            font-size: 12.5px;
            font-weight: 680;
            text-align: left;
        }
        .alm-combo.open .alm-combo-control,
        .alm-combo-control:focus-visible {
            border-color: var(--alm-accent-border);
            box-shadow: 0 0 0 3px var(--alm-accent-soft);
            outline: 0;
        }
        .alm-combo-value {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .alm-combo-value.placeholder {
            color: var(--alm-muted);
            font-weight: 620;
        }
        .alm-combo-arrow {
            flex: 0 0 auto;
            width: 18px;
            height: 18px;
            color: transparent;
            line-height: 1;
            position: relative;
            transform: none;
            transition: transform 0.14s ease;
        }
        .alm-combo-arrow::before {
            content: "";
            position: absolute;
            left: 50%;
            top: 45%;
            width: 7px;
            height: 7px;
            border-right: 1.5px solid var(--alm-muted);
            border-bottom: 1.5px solid var(--alm-muted);
            transform: translate(-50%, -50%) rotate(45deg);
        }
        .alm-combo.open .alm-combo-arrow {
            transform: rotate(180deg);
        }
        .alm-combo-popover {
            position: absolute;
            left: 0;
            right: 0;
            top: calc(100% + 6px);
            display: none;
            padding: 7px;
            border: 1px solid var(--alm-border);
            border-radius: var(--alm-radius);
            background: color-mix(in srgb, var(--alm-panel) 94%, #000 6%);
            box-shadow: 0 14px 34px rgba(0, 0, 0, 0.34);
            box-sizing: border-box;
            max-height: min(360px, var(--alm-combo-available-height, calc(100vh - 180px)));
            min-width: 100%;
        }
        .alm-combo.open-up .alm-combo-popover {
            top: auto;
            bottom: calc(100% + 6px);
        }
        .alm-combo.open .alm-combo-popover {
            display: grid;
            gap: 7px;
        }
        .alm-combo-search {
            width: 100%;
            min-width: 0;
            min-height: 34px;
            box-sizing: border-box;
            border: 1px solid var(--alm-border);
            border-radius: calc(var(--alm-radius) - 2px);
            background: var(--alm-control);
            color: var(--alm-text);
            padding: 0 10px;
            outline: 0;
            font-size: 12.5px;
        }
        .alm-combo-search::placeholder {
            color: var(--alm-muted);
            opacity: 0.82;
        }
        .alm-combo-search:focus {
            border-color: var(--alm-accent-border);
        }
        .alm-combo-list {
            display: grid;
            gap: 3px;
            max-height: min(270px, calc(var(--alm-combo-available-height, calc(100vh - 180px)) - 56px));
            min-height: 32px;
            overflow: auto;
            overscroll-behavior: contain;
            padding-right: 2px;
        }
        .alm-combo-option {
            width: 100%;
            min-width: 0;
            min-height: 31px;
            border: 1px solid transparent;
            border-radius: calc(var(--alm-radius) - 3px);
            background: transparent;
            color: var(--alm-text);
            display: flex;
            align-items: center;
            justify-content: flex-start;
            padding: 0 9px;
            cursor: pointer;
            font-size: 12.5px;
            font-weight: 620;
            text-align: left;
        }
        .alm-combo-option span {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .alm-combo-option:hover,
        .alm-combo-option.is-key-active {
            background: var(--alm-panel-hover);
            border-color: var(--alm-border);
        }
        .alm-combo-option.active {
            background: var(--alm-accent-soft);
            border-color: var(--alm-accent-border);
            color: color-mix(in srgb, var(--alm-accent) 72%, var(--alm-text));
        }
        .alm-combo-option.active:hover,
        .alm-combo-option.active.is-key-active {
            background: var(--alm-accent-soft);
            border-color: var(--alm-accent-border);
            color: color-mix(in srgb, var(--alm-accent) 72%, var(--alm-text));
        }
        .alm-combo-empty {
            color: var(--alm-muted);
            font-size: 12px;
            line-height: 1.35;
            padding: 8px 9px;
        }
        .alm-search-wrap {
            position: relative;
            flex: 1 1 min(620px, 100%);
            min-width: min(460px, 100%);
            max-width: min(780px, 100%);
        }
        .alm-search-wrap .alm-search {
            width: 100%;
            min-width: 0;
            padding-left: 38px;
            padding-right: 36px;
        }
        .alm-search-mark {
            position: absolute;
            left: 13px;
            top: 50%;
            z-index: 1;
            color: var(--alm-muted);
            font-size: 18px;
            font-weight: 800;
            line-height: 1;
            transform: translateY(-52%);
            pointer-events: none;
        }
        .alm-search-clear {
            position: absolute;
            right: 6px;
            top: 50%;
            z-index: 1;
            width: 27px;
            height: 27px;
            border: 0;
            border-radius: var(--alm-radius);
            background: transparent;
            color: var(--alm-muted);
            cursor: pointer;
            font-size: 18px;
            font-weight: 800;
            line-height: 1;
            transform: translateY(-50%);
        }
        .alm-search-clear:hover {
            background: var(--alm-panel-hover);
            color: var(--alm-text);
        }
        .alm-filter-chip {
            background: var(--alm-control);
            border-color: var(--alm-border);
            color: var(--alm-text);
            box-shadow: none;
            transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
        }
        .alm-filter-chip:not(.active):hover {
            background: var(--alm-panel-hover);
            color: var(--alm-text);
        }
        .alm-card {
            position: relative;
            background: var(--alm-panel-soft);
            border-color: var(--alm-border);
            border-radius: var(--alm-radius);
            box-shadow: none;
            display: block;
            width: 100%;
            height: auto !important;
            min-height: auto;
            aspect-ratio: 2 / 3 !important;
            align-self: start;
            overflow: hidden;
            contain: paint;
        }
        .alm-card::before {
            content: "";
            display: none !important;
            width: 100%;
            padding-top: 0 !important;
            pointer-events: none;
        }
        .alm-card-spacer {
            display: none !important;
        }
        .alm-card:hover,
        .alm-card.selected {
            border-color: color-mix(in srgb, var(--alm-accent) 54%, var(--alm-border));
            box-shadow: none;
        }
        .alm-card.selected {
            border-color: var(--alm-accent);
        }
        .alm-thumb,
        .alm-thumb.small {
            position: absolute;
            inset: 2px;
            width: auto;
            height: auto;
            background: var(--alm-panel);
        }
        .alm-thumb::after {
            display: none;
        }
        .alm-no-image {
            background: var(--alm-panel-soft);
            color: var(--alm-muted);
        }
        .alm-card-title {
            text-shadow: 0 1px 8px rgba(0, 0, 0, 0.32);
        }
        .alm-card-body {
            left: 0;
            right: 0;
            bottom: 0;
            padding: 36px 11px 11px;
            border: 0;
            border-radius: 0;
            background: linear-gradient(
                to top,
                rgba(10, 10, 15, 0.94) 0%,
                rgba(10, 10, 15, 0.62) 58%,
                rgba(10, 10, 15, 0) 100%
            );
            box-shadow: none;
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
        }
        .alm-card-badge {
            position: absolute;
            top: 10px;
            left: 10px;
            z-index: 5;
            max-width: min(72%, 210px);
            padding: 5px 8px;
            border: 1px solid color-mix(in srgb, var(--alm-accent) 24%, var(--alm-border));
            border-radius: 999px;
            background: color-mix(in srgb, var(--alm-panel) 62%, transparent);
            color: color-mix(in srgb, var(--alm-accent) 70%, var(--alm-text));
            font-size: 11.5px;
            font-weight: 760;
            line-height: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            pointer-events: none;
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
        }
        .alm-card-title {
            color: #fff;
            font-weight: 700;
            font-size: 13.25px;
            line-height: 1.24;
            text-shadow:
                0 1px 3px rgba(0, 0, 0, 0.82),
                0 2px 8px rgba(0, 0, 0, 0.64);
        }
        .alm-card-stat-row {
            display: flex;
            align-items: center;
            gap: 6px;
            min-height: 20px;
            margin-top: 2px;
            overflow: hidden;
        }
        .alm-card-stat-chip {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            height: 20px;
            max-width: 76px;
            padding: 0 7px;
            border: 1px solid color-mix(in srgb, #fff 13%, transparent);
            border-radius: 999px;
            background: color-mix(in srgb, var(--alm-panel) 72%, transparent);
            color: #f8fafc;
            font-size: 10px;
            font-weight: 700;
            line-height: 1;
            white-space: nowrap;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.34);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
        }
        .alm-card-stat-chip span:last-child {
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .alm-skeleton-card,
        .alm-skeleton-card:hover {
            cursor: progress;
            pointer-events: none;
            background: var(--alm-panel-soft);
            border-color: var(--alm-border);
            box-shadow: none;
        }
        .alm-skeleton-card::after {
            content: "";
            position: absolute;
            inset: 0;
            z-index: 8;
            pointer-events: none;
            background: linear-gradient(
                105deg,
                transparent 24%,
                color-mix(in srgb, var(--alm-text) 11%, transparent) 43%,
                transparent 62%
            );
            transform: translateX(-115%);
            animation: almSkeletonShimmer 1.35s ease-in-out infinite;
        }
        .alm-skeleton-badge,
        .alm-skeleton-line,
        .alm-skeleton-stats span {
            background: color-mix(in srgb, var(--alm-panel-soft) 74%, var(--alm-text) 26%);
        }
        .alm-skeleton-badge {
            position: absolute;
            top: 11px;
            left: 11px;
            z-index: 2;
            width: 34%;
            height: 22px;
            border-radius: 999px;
        }
        .alm-skeleton-content {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 2;
            display: grid;
            gap: 10px;
            padding: 48px 12px 13px;
            background: linear-gradient(to top, color-mix(in srgb, var(--alm-panel) 94%, transparent), transparent);
        }
        .alm-skeleton-line {
            width: 82%;
            height: 13px;
            border-radius: 999px;
        }
        .alm-skeleton-line.is-medium {
            width: 68%;
        }
        .alm-skeleton-line.is-short {
            width: 54%;
        }
        .alm-skeleton-stats {
            display: flex;
            gap: 7px;
        }
        .alm-skeleton-stats span {
            width: 52px;
            height: 19px;
            border-radius: 999px;
        }
        .alm-skeleton-stats span:last-child {
            width: 44px;
        }
        @keyframes almSkeletonShimmer {
            0% { transform: translateX(-115%); }
            65%, 100% { transform: translateX(115%); }
        }
        .alm-media-skeleton {
            position: absolute;
            inset: 0;
            z-index: 1;
            overflow: hidden;
            background: color-mix(in srgb, var(--alm-panel-soft) 86%, var(--alm-text) 14%);
            opacity: 1;
            pointer-events: none;
            transition: opacity 0.18s ease;
        }
        .alm-media-skeleton::after {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(
                105deg,
                transparent 22%,
                color-mix(in srgb, var(--alm-text) 15%, transparent) 44%,
                transparent 66%
            );
            transform: translateX(-115%);
            animation: almSkeletonShimmer 1.35s ease-in-out infinite;
        }
        .alm-filtered-preview {
            box-sizing: border-box;
            padding: 24px;
            color: color-mix(in srgb, var(--alm-muted) 88%, var(--alm-text) 12%);
            font-size: 13px;
            font-weight: 720;
            line-height: 1.55;
            text-align: center;
        }
        @media (prefers-reduced-motion: reduce) {
            .alm-skeleton-card::after,
            .alm-media-skeleton::after {
                animation: none;
                transform: none;
                opacity: 0.45;
            }
        }
        .alm-card-meta,
        .alm-card-tags {
            color: color-mix(in srgb, var(--alm-text) 78%, transparent);
        }
        .alm-card-tags span {
            background: color-mix(in srgb, var(--alm-panel) 58%, transparent);
            border-color: var(--alm-border);
            color: var(--alm-text);
        }
        .alm-detail {
            background: var(--alm-panel);
            border-color: var(--alm-border);
            box-shadow: none;
        }
        .alm-detail-head {
            display: block;
            grid-template-columns: none;
            margin: 14px 0;
        }
        .alm-detail-head > div:last-child {
            min-width: 0;
        }
        .alm-detail-match-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin: 0 0 14px;
            padding: 12px;
            border: 1px solid var(--alm-border);
            border-radius: var(--alm-radius);
            background: var(--alm-panel-soft);
        }
        .alm-detail-match-row.is-matched {
            border-color: color-mix(in srgb, var(--alm-good) 42%, var(--alm-border));
        }
        .alm-detail-match-row > div {
            min-width: 0;
            display: grid;
            gap: 3px;
        }
        .alm-detail-match-row b {
            color: var(--alm-text);
        }
        .alm-detail-match-row span {
            color: var(--alm-muted);
            font-size: 12px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .alm-detail-match-row .alm-primary {
            flex: 0 0 auto;
        }
        .alm-detail-preview,
        .alm-path-box,
        .alm-settings-form,
        .alm-roots {
            background: var(--alm-panel-soft);
            border-color: var(--alm-border);
            border-radius: var(--alm-radius);
            box-shadow: none;
        }
        .alm-detail-preview {
            width: 100%;
            height: clamp(240px, 38vh, 420px);
            min-height: 220px;
            position: relative;
            overflow: hidden;
            background: color-mix(in srgb, var(--alm-panel) 92%, #000 8%);
            border-radius: 10px;
            isolation: isolate;
        }
        .alm-detail-preview-bg {
            position: absolute;
            inset: -24px;
            z-index: 0;
            width: calc(100% + 48px);
            height: calc(100% + 48px);
            object-fit: cover;
            filter: blur(22px) saturate(1.18) brightness(0.72);
            transform: scale(1.08);
            opacity: 0.82;
            pointer-events: none;
        }
        .alm-detail-preview > .alm-no-image {
            position: relative;
            inset: auto;
            z-index: 2;
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: transparent;
        }
        .alm-detail-preview-nav {
            position: absolute;
            top: 50%;
            z-index: 7;
            width: 34px;
            height: 34px;
            border: 1px solid color-mix(in srgb, var(--alm-text) 18%, transparent);
            border-radius: 999px;
            background: color-mix(in srgb, #000 55%, transparent);
            color: #fff;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            font-weight: 800;
            line-height: 1;
            transform: translateY(-50%);
            transition: background 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
        }
        .alm-detail-preview-nav:hover {
            background: color-mix(in srgb, #000 72%, transparent);
            border-color: color-mix(in srgb, var(--alm-info) 54%, var(--alm-border));
            transform: translateY(-50%) scale(1.04);
        }
        .alm-detail-preview-nav.prev {
            left: 10px;
        }
        .alm-detail-preview-nav.next {
            right: 10px;
        }
        .alm-detail-preview-count {
            position: absolute;
            right: 10px;
            bottom: 10px;
            z-index: 7;
            border: 1px solid color-mix(in srgb, var(--alm-text) 16%, transparent);
            border-radius: 999px;
            background: color-mix(in srgb, #000 52%, transparent);
            color: #fff;
            padding: 4px 8px;
            font-size: 11px;
            font-weight: 760;
            line-height: 1;
        }
        .alm-settings-grid {
            grid-template-columns: minmax(360px, 520px) minmax(420px, 1fr);
            align-content: start;
            gap: 16px;
        }
        .alm-settings-column {
            display: grid;
            gap: 16px;
            align-content: start;
            min-width: 0;
        }
        .alm-setting-card {
            display: grid;
            gap: 14px;
            padding: 18px;
        }
        .alm-settings-head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 14px;
            min-width: 0;
        }
        .alm-settings-head h2 {
            margin: 0;
            color: var(--alm-text);
            font-size: 16px;
            line-height: 1.2;
        }
        .alm-settings-head p {
            margin: 5px 0 0;
            color: var(--alm-muted);
            font-size: 12px;
            line-height: 1.42;
        }
        .alm-setting-status {
            flex: 0 0 auto;
            border: 1px solid var(--alm-border);
            border-radius: 999px;
            background: var(--alm-control);
            color: var(--alm-muted);
            padding: 4px 8px;
            font-size: 11px;
            font-weight: 760;
            line-height: 1;
        }
        .alm-setting-status.is-set {
            border-color: color-mix(in srgb, var(--alm-good) 30%, var(--alm-border));
            background: color-mix(in srgb, var(--alm-good) 12%, transparent);
            color: color-mix(in srgb, var(--alm-good) 76%, var(--alm-text));
        }
        .alm-check-list {
            display: grid;
            gap: 8px;
        }
        .alm-check {
            min-height: 38px;
            margin: 0;
            padding: 9px 10px;
            border: 1px solid var(--alm-border);
            border-radius: var(--alm-radius);
            background: var(--alm-control);
        }
        .alm-check input {
            accent-color: var(--alm-info);
        }
        .alm-root-list {
            display: grid;
            gap: 8px;
        }
        .alm-root-row {
            grid-template-columns: 116px minmax(0, 1fr);
            align-items: center;
            border: 1px solid var(--alm-border);
            border-radius: var(--alm-radius);
            background: var(--alm-control);
            padding: 9px 10px;
        }
        .alm-root-row:last-child {
            border-bottom: 1px solid var(--alm-border);
        }
        .alm-root-row span {
            color: var(--alm-muted);
            font-weight: 740;
        }
        .alm-root-row b {
            color: var(--alm-text);
            font-weight: 620;
        }
        .alm-settings-footer {
            grid-column: 1 / -1;
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 10px;
            padding: 12px;
            border: 1px solid var(--alm-border);
            border-radius: var(--alm-radius);
            background: var(--alm-panel-soft);
        }
        .alm-detail-title-link {
            display: inline-flex;
            align-items: baseline;
            gap: 6px;
            max-width: 100%;
            color: inherit;
            text-decoration: none;
        }
        .alm-detail-title-link h2 {
            display: inline;
        }
        .alm-detail-title-link:hover h2,
        .alm-description a {
            color: color-mix(in srgb, var(--alm-accent) 72%, var(--alm-text));
        }
        .alm-external-icon {
            width: auto;
            height: auto;
            border: 0;
            border-radius: 0;
            background: transparent;
            color: var(--alm-info);
            font-size: 16px;
            font-weight: 800;
            line-height: 1;
            transform: translateY(-1px);
        }
        .alm-external-icon,
        .alm-trained button {
            background: var(--alm-accent-soft);
            border-color: var(--alm-accent-border);
            color: color-mix(in srgb, var(--alm-accent) 72%, var(--alm-text));
        }
        .alm-external-icon {
            background: transparent;
            border-color: transparent;
            color: var(--alm-info);
        }
        .alm-section-title {
            margin: 14px 0 7px;
            color: color-mix(in srgb, var(--alm-text) 82%, var(--alm-muted));
            font-size: 11.5px;
            font-weight: 760;
            line-height: 1.2;
            text-transform: uppercase;
            letter-spacing: 0;
        }
        .alm-section-title + .alm-description {
            margin-top: 0;
        }
        .alm-trained {
            min-width: 0;
            max-width: 100%;
            overflow: hidden;
            align-items: flex-start;
            border: 1px solid var(--alm-border);
            border-radius: var(--alm-radius);
            background: var(--alm-panel-soft);
            padding: 10px;
            box-sizing: border-box;
        }
        .alm-trained span {
            color: var(--alm-muted);
            font-size: 12px;
            line-height: 1.4;
        }
        .alm-detail .alm-trained button,
        .alm-detail-scroll .alm-trained button {
            min-width: 0;
            max-width: 100%;
            min-height: 24px;
            padding: 4px 8px;
            border-radius: calc(var(--alm-radius) - 2px);
            white-space: normal;
            overflow-wrap: anywhere;
            word-break: break-word;
            text-align: left;
            justify-content: flex-start;
            font-size: 10.75px;
            font-weight: 620;
            line-height: 1.22;
        }
        .alm-label,
        .alm-grid2 label,
        .alm-check {
            color: color-mix(in srgb, var(--alm-text) 86%, transparent);
        }
        .alm-description {
            border: 1px solid var(--alm-border);
            border-radius: var(--alm-radius);
            background: var(--alm-panel-soft);
            padding: 12px;
            box-sizing: border-box;
            color: color-mix(in srgb, var(--alm-text) 86%, transparent);
        }
        .alm-description > :last-child {
            margin-bottom: 0;
        }
        .alm-path,
        .alm-info-list b,
        .alm-description code,
        .alm-description pre {
            background: var(--alm-control);
            border-color: var(--alm-border);
            color: var(--alm-text);
        }
        .alm-description h1,
        .alm-description h2,
        .alm-description h3,
        .alm-description h4 {
            color: var(--alm-text);
        }
        .alm-description blockquote {
            background: var(--alm-panel-soft);
            border-left-color: var(--alm-accent-border);
        }
        .alm-empty,
        .alm-empty-detail {
            background: var(--alm-panel-soft);
            border-color: var(--alm-border);
            color: var(--alm-muted);
        }
        .alm-alert {
            background: color-mix(in srgb, var(--alm-bad) 14%, var(--alm-panel));
            border-color: var(--alm-danger-border);
            color: color-mix(in srgb, var(--alm-bad) 72%, var(--alm-text));
        }
        .alm-toast {
            background: var(--alm-panel);
            border-color: var(--alm-border);
            color: var(--alm-text);
            box-shadow: var(--alm-shadow);
        }
        .alm-overlay,
        .alm-overlay * {
            scrollbar-width: none;
            -ms-overflow-style: none;
        }
        .alm-overlay::-webkit-scrollbar,
        .alm-overlay *::-webkit-scrollbar {
            width: 0;
            height: 0;
            display: none;
        }
        .alm-combo-list {
            padding-right: 0;
        }
        @media (max-width: 980px) {
            .alm-shell {
                width: 100vw;
                height: 100vh;
                border-radius: 0;
            }
            .alm-layout {
                grid-template-columns: 1fr;
            }
            .alm-nav {
                flex-direction: row;
                overflow-x: auto;
                overflow-y: hidden;
                border-right: 0;
                border-bottom: 1px solid rgba(255,255,255,0.06);
                padding: 10px 12px;
            }
            .alm-nav-group {
                display: flex;
                flex: 0 0 auto;
                gap: 7px;
                padding: 0;
                margin: 0;
                border-bottom: 0;
            }
            .alm-nav-title,
            .alm-nav-note {
                display: none;
            }
            .alm-nav-btn {
                width: auto;
                flex: 0 0 auto;
            }
            .alm-folder-tree {
                display: flex;
                flex: 0 0 auto;
                align-items: flex-start;
                gap: 7px;
                max-width: min(70vw, 380px);
                overflow: auto;
            }
            .alm-folder-node {
                flex: 0 0 auto;
            }
            .alm-folder-row {
                padding-left: 0;
            }
            .alm-folder-children {
                display: flex;
                align-items: flex-start;
                gap: 7px;
            }
            .alm-folder-select {
                width: auto;
                max-width: 180px;
            }
            .alm-split {
                display: flex;
                flex-direction: column;
                grid-template-columns: none;
                overflow-y: auto;
                overflow-x: hidden;
            }
            .alm-detail {
                position: static;
                width: auto;
                min-width: 0;
                max-width: none;
                border-left: 0;
                border-top: 1px solid rgba(255,255,255,0.06);
                min-height: 0;
                overflow: visible;
                flex: 0 0 auto;
                box-shadow: none;
                backdrop-filter: none;
                -webkit-backdrop-filter: none;
            }
            .alm-detail-scroll {
                height: auto;
                overflow: visible;
            }
            .alm-results {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                grid-auto-rows: auto;
                padding: 18px;
                overflow: visible;
                flex: 0 0 auto;
                align-items: start;
            }
            .alm-card,
            .alm-card.asset {
                width: 100%;
                height: auto !important;
                min-height: auto;
                aspect-ratio: 2 / 3 !important;
            }
            .alm-card::before {
                display: none !important;
                padding-top: 0 !important;
            }
            .alm-card-spacer {
                display: none !important;
                padding-top: 0;
            }
            .alm-settings-grid {
                grid-template-columns: 1fr;
                padding: 18px;
            }
            .alm-search-wrap {
                flex-basis: 100%;
                min-width: 100%;
                max-width: none;
            }
            .alm-settings-footer {
                justify-content: stretch;
            }
            .alm-settings-footer .alm-primary {
                width: 100%;
            }
            .alm-toolbar {
                padding: 12px 16px;
            }
            .alm-library-toolbar-actions {
                width: 100%;
                margin-left: 0;
                flex-wrap: wrap;
            }
            .alm-library-match-status {
                grid-template-columns: 1fr;
            }
            .alm-detail-match-row {
                align-items: stretch;
                flex-direction: column;
            }
            .alm-nav {
                border-bottom-color: var(--alm-border);
            }
            .alm-detail {
                border-top-color: var(--alm-border);
            }
        }
        /* Multi-LoRA node selector. It deliberately reuses the manager theme
           while keeping a smaller, LoRA-only information architecture. */
        .alm-lora-shell {
            width: min(1480px, 96vw);
            height: min(900px, 94vh);
            position: relative;
        }
        .alm-lora-layout {
            grid-template-columns: 210px minmax(0, 1fr);
        }
        .alm-lora-nav {
            min-width: 0;
        }
        .alm-lora-nav-summary {
            margin-top: auto;
            padding: 14px 12px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            border: 1px solid var(--alm-border);
            border-radius: var(--alm-radius);
            background: var(--alm-control);
            color: var(--alm-muted);
            font-size: 11px;
        }
        .alm-lora-nav-summary b {
            color: var(--alm-text);
            font-size: 12px;
        }
        .alm-lora-folder-group {
            gap: 6px;
        }
        .alm-lora-folder-all,
        .alm-lora-folder-select {
            min-height: 34px;
        }
        .alm-lora-folder-label {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
        }
        .alm-lora-folder-glyph {
            position: relative;
            flex: 0 0 auto;
            width: 13px;
            height: 9px;
            border: 1.5px solid currentColor;
            border-radius: 2px;
            opacity: 0.75;
        }
        .alm-lora-folder-glyph::before {
            content: "";
            position: absolute;
            left: -1.5px;
            top: -5px;
            width: 6px;
            height: 4px;
            border: 1.5px solid currentColor;
            border-bottom: 0;
            border-radius: 2px 2px 0 0;
            background: var(--alm-panel);
        }
        .alm-lora-folder-glyph.is-library {
            box-shadow: inset 0 -3px 0 color-mix(in srgb, var(--alm-accent) 35%, transparent);
        }
        .alm-lora-folder-glyph.is-file {
            width: 10px;
            height: 13px;
            border-radius: 2px;
        }
        .alm-lora-folder-glyph.is-file::before {
            display: none;
        }
        .alm-lora-folder-select.is-ancestor:not(.active) {
            background: color-mix(in srgb, var(--alm-accent) 7%, transparent);
            color: color-mix(in srgb, var(--alm-text) 84%, var(--alm-muted));
        }
        .alm-lora-local-toolbar {
            grid-template-columns: minmax(250px, auto) minmax(220px, 1fr) auto;
        }
        .alm-lora-local-heading {
            display: grid;
            gap: 5px;
            min-width: 0;
        }
        .alm-lora-local-heading h2 {
            margin: 0;
        }
        .alm-lora-folder-context {
            display: flex;
            align-items: center;
            gap: 7px;
            min-width: 0;
            color: var(--alm-muted);
            font-size: 10.5px;
        }
        .alm-lora-folder-context-label {
            flex: 0 0 auto;
        }
        .alm-lora-breadcrumb {
            display: flex;
            align-items: center;
            min-width: 0;
            overflow-x: auto;
            scrollbar-width: none;
        }
        .alm-lora-breadcrumb::-webkit-scrollbar {
            display: none;
        }
        .alm-lora-breadcrumb button {
            flex: 0 0 auto;
            max-width: 150px;
            overflow: hidden;
            border: 0;
            border-radius: 5px;
            background: transparent;
            color: var(--alm-muted);
            cursor: pointer;
            padding: 2px 4px;
            font: inherit;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .alm-lora-breadcrumb button:hover,
        .alm-lora-breadcrumb button.active {
            background: color-mix(in srgb, var(--alm-accent) 10%, transparent);
            color: var(--alm-text);
        }
        .alm-lora-breadcrumb-separator {
            flex: 0 0 auto;
            color: color-mix(in srgb, var(--alm-muted) 70%, transparent);
            padding: 0 1px;
        }
        .alm-lora-body,
        .alm-lora-page {
            min-width: 0;
            min-height: 0;
            height: 100%;
            overflow: hidden;
        }
        .alm-lora-page {
            display: grid;
            grid-template-rows: auto minmax(0, 1fr);
        }
        .alm-lora-search {
            min-width: 0;
        }
        .alm-lora-split {
            min-height: 0;
            grid-template-columns: minmax(0, 1fr) clamp(330px, 27vw, 410px) !important;
        }
        .alm-lora-results {
            min-width: 0;
            min-height: 0;
            overflow-y: auto;
            grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
            grid-auto-rows: 280px !important;
            gap: 14px;
            padding: 18px;
        }
        .alm-lora-card,
        .alm-lora-card.asset {
            height: 280px !important;
            min-height: 280px;
            cursor: pointer;
        }
        .alm-lora-card .alm-thumb {
            inset: 2px;
        }
        .alm-lora-detail {
            min-width: 0;
            overflow: hidden;
        }
        .alm-lora-detail-actions {
            display: grid;
            gap: 10px;
            margin-top: 18px;
        }
        .alm-lora-file-info b {
            overflow-wrap: anywhere;
            text-align: right;
        }
        .alm-notification-host {
            position: absolute;
            top: 42px;
            left: 50%;
            z-index: 220;
            width: min(520px, calc(100% - 32px));
            display: grid;
            gap: 8px;
            transform: translate(-50%, -50%);
            pointer-events: none;
        }
        .alm-notification-host:empty {
            display: none;
        }
        .alm-notification-host .alm-notice {
            position: relative;
            top: auto;
            right: auto;
            display: grid;
            grid-template-columns: 24px minmax(0, 1fr) auto;
            align-items: center;
            gap: 10px;
            min-height: 46px;
            box-sizing: border-box;
            margin: 0;
            padding: 9px 14px 9px 11px;
            border: 1px solid color-mix(in srgb, var(--alm-accent) 30%, var(--alm-border));
            border-radius: 14px;
            background: color-mix(in srgb, var(--alm-panel) 93%, var(--alm-accent) 7%);
            color: var(--alm-text);
            box-shadow: 0 16px 42px rgba(0, 0, 0, 0.34), 0 3px 10px rgba(0, 0, 0, 0.18);
            backdrop-filter: blur(18px) saturate(1.12);
            -webkit-backdrop-filter: blur(18px) saturate(1.12);
            font-size: 12.5px;
            font-weight: 680;
            line-height: 1.42;
            animation: almNoticeDrop 0.28s cubic-bezier(0.2, 0.82, 0.24, 1) both;
        }
        .alm-notification-host .alm-notice.alm-error {
            border-color: color-mix(in srgb, var(--alm-bad) 42%, var(--alm-border));
            background: color-mix(in srgb, var(--alm-panel) 90%, var(--alm-bad) 10%);
        }
        .alm-notice-icon {
            width: 24px;
            height: 24px;
            display: grid;
            place-items: center;
            border-radius: 50%;
            background: color-mix(in srgb, var(--alm-accent) 18%, transparent);
            color: color-mix(in srgb, var(--alm-accent) 82%, var(--alm-text));
            font-size: 12px;
            font-style: normal;
            font-weight: 900;
        }
        .alm-notice.alm-error .alm-notice-icon {
            background: color-mix(in srgb, var(--alm-bad) 18%, transparent);
            color: color-mix(in srgb, var(--alm-bad) 76%, var(--alm-text));
        }
        .alm-lora-detail [data-action="match-local"]:disabled {
            opacity: 1;
            cursor: wait;
            background: color-mix(in srgb, var(--alm-accent) 78%, var(--alm-panel));
            border-color: color-mix(in srgb, var(--alm-accent) 72%, var(--alm-text));
            color: #fff;
            box-shadow: 0 5px 16px color-mix(in srgb, var(--alm-accent) 22%, transparent);
        }
        .alm-lora-detail [data-action="match-local"]:disabled::before {
            content: "";
            width: 12px;
            height: 12px;
            flex: 0 0 auto;
            box-sizing: border-box;
            border: 2px solid rgba(255, 255, 255, 0.42);
            border-top-color: #fff;
            border-radius: 50%;
            animation: almLoraMatchSpin 0.72s linear infinite;
        }
        @keyframes almLoraMatchSpin {
            to { transform: rotate(360deg); }
        }
        .alm-notice-dismiss {
            width: 26px;
            height: 26px;
            display: grid;
            place-items: center;
            pointer-events: auto;
            border: 0;
            border-radius: 50%;
            background: color-mix(in srgb, var(--alm-text) 8%, transparent);
            color: var(--alm-text);
            cursor: pointer;
            padding: 0;
            font-size: 17px;
            line-height: 1;
        }
        .alm-notice-dismiss:hover {
            background: color-mix(in srgb, var(--alm-text) 14%, transparent);
        }
        @keyframes almNoticeDrop {
            from {
                opacity: 0;
                transform: translateY(-18px) scale(0.98);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        .alm-lora-applied-list,
        .alm-lora-download-list {
            min-height: 0;
            overflow-y: auto;
            padding: 18px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .alm-lora-toggle {
            color: var(--alm-muted);
            font-size: 11px;
        }
        .alm-lora-toggle {
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
        }
        .alm-lora-order-actions {
            display: grid;
            grid-template-columns: repeat(2, 38px);
            gap: 6px;
        }
        .alm-lora-order-actions .alm-danger {
            grid-column: 1 / -1;
        }

        /* A calm, informative placeholder keeps the permanent detail rail
           useful even before a card is selected. */
        .alm-empty-detail-scroll {
            overflow: hidden;
            padding: 20px;
        }
        .alm-empty-detail {
            position: relative;
            width: 100%;
            height: 100%;
            min-height: 0;
            overflow: hidden;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 24px;
            padding: clamp(24px, 4vh, 42px) 24px;
            border: 1px solid color-mix(in srgb, var(--alm-border) 82%, transparent);
            border-radius: calc(var(--alm-radius) + 4px);
            background:
                radial-gradient(circle at 50% 18%, color-mix(in srgb, var(--alm-accent) 13%, transparent), transparent 35%),
                linear-gradient(155deg, color-mix(in srgb, var(--alm-panel-soft) 92%, transparent), color-mix(in srgb, var(--alm-panel) 97%, transparent));
            color: var(--alm-muted);
            text-align: center;
        }
        .alm-empty-detail::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            opacity: 0.28;
            background-image: radial-gradient(color-mix(in srgb, var(--alm-text) 18%, transparent) 0.7px, transparent 0.7px);
            background-size: 15px 15px;
            mask-image: linear-gradient(to bottom, #000, transparent 72%);
        }
        .alm-empty-detail-art {
            position: relative;
            width: 146px;
            height: 132px;
            flex: 0 0 auto;
        }
        .alm-empty-detail-orbit {
            position: absolute;
            inset: 12px;
            border: 1px solid color-mix(in srgb, var(--alm-accent) 26%, transparent);
            border-radius: 50%;
            transform: rotate(-18deg) scaleY(0.48);
        }
        .alm-empty-detail-orbit.orbit-two {
            inset: 27px 5px;
            border-style: dashed;
            transform: rotate(27deg) scaleY(0.55);
            opacity: 0.65;
        }
        .alm-empty-detail-card {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 82px;
            height: 96px;
            border: 1px solid color-mix(in srgb, var(--alm-border) 78%, var(--alm-accent));
            border-radius: 11px;
            background: color-mix(in srgb, var(--alm-panel-soft) 92%, var(--alm-accent) 8%);
            box-shadow: 0 18px 34px color-mix(in srgb, #000 24%, transparent);
        }
        .alm-empty-detail-card.card-back {
            transform: translate(-40%, -48%) rotate(9deg);
            opacity: 0.48;
        }
        .alm-empty-detail-card.card-front {
            transform: translate(-58%, -55%) rotate(-4deg);
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 8px;
            padding: 12px;
            box-sizing: border-box;
        }
        .alm-empty-detail-card.card-front::before {
            content: "";
            height: 45px;
            border-radius: 7px;
            background: linear-gradient(145deg, color-mix(in srgb, var(--alm-accent) 28%, transparent), color-mix(in srgb, var(--alm-accent) 7%, transparent));
        }
        .alm-empty-detail-card.card-front i {
            height: 4px;
            border-radius: 999px;
            background: color-mix(in srgb, var(--alm-text) 22%, transparent);
        }
        .alm-empty-detail-card.card-front i:nth-child(2) { width: 74%; }
        .alm-empty-detail-card.card-front i:nth-child(3) { width: 48%; }
        .alm-empty-detail-spark {
            position: absolute;
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: var(--alm-accent);
            box-shadow: 0 0 14px color-mix(in srgb, var(--alm-accent) 72%, transparent);
        }
        .alm-empty-detail-spark.spark-one { top: 20px; right: 22px; }
        .alm-empty-detail-spark.spark-two { left: 17px; bottom: 28px; width: 4px; height: 4px; opacity: 0.65; }
        .alm-empty-detail-copy {
            position: relative;
            z-index: 1;
            display: grid;
            justify-items: center;
            gap: 8px;
            max-width: 290px;
        }
        .alm-empty-detail-kicker {
            color: color-mix(in srgb, var(--alm-accent) 74%, var(--alm-text));
            font-size: 10px;
            font-weight: 850;
            letter-spacing: 0.16em;
            text-transform: uppercase;
        }
        .alm-empty-detail h2 {
            margin: 0;
            color: var(--alm-text);
            font-size: 20px;
            line-height: 1.25;
        }
        .alm-empty-detail p {
            margin: 0;
            color: var(--alm-muted);
            font-size: 12px;
            line-height: 1.65;
        }
        .alm-empty-detail-features {
            position: relative;
            z-index: 1;
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 7px;
        }
        .alm-empty-detail-features span {
            border: 1px solid var(--alm-border);
            border-radius: 999px;
            background: color-mix(in srgb, var(--alm-control) 82%, transparent);
            color: color-mix(in srgb, var(--alm-text) 72%, var(--alm-muted));
            padding: 5px 9px;
            font-size: 10.5px;
            font-weight: 720;
        }

        /* The LoRA-only manager now follows the exact outer geometry and
           detail hierarchy of the full CivitaiManager popup. */
        .alm-lora-shell {
            width: min(1780px, calc(100vw - 24px));
            height: calc(100vh - 24px);
        }
        .alm-lora-layout {
            grid-template-columns: clamp(260px, 16vw, 292px) minmax(0, 1fr);
        }
        .alm-lora-nav {
            overflow-x: hidden;
            overflow-y: auto;
        }
        .alm-lora-filter-group {
            gap: 9px;
        }
        .alm-lora-category-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 7px;
        }
        .alm-lora-category-grid .alm-filter-chip {
            min-width: 0;
            min-height: 36px;
            padding: 7px 8px;
            font-size: 12.5px;
            font-weight: 720;
            line-height: 1.2;
        }
        .alm-lora-nav-summary {
            flex: 0 0 auto;
        }
        .alm-lora-split {
            grid-template-columns: minmax(0, 1fr) clamp(340px, 22vw, 400px) !important;
        }
        .alm-detail-stat-row {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 7px;
            margin: 0 0 14px;
        }
        .alm-detail-stat-row > span {
            min-width: 0;
            display: grid;
            gap: 3px;
            padding: 9px;
            border: 1px solid var(--alm-border);
            border-radius: var(--alm-radius);
            background: var(--alm-panel-soft);
        }
        .alm-detail-stat-row b {
            overflow: hidden;
            color: var(--alm-text);
            font-size: 12px;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .alm-detail-stat-row small {
            color: var(--alm-muted);
            font-size: 10px;
        }
        .alm-lora-detail .alm-description {
            margin-bottom: 6px;
        }
        @media (max-width: 900px) {
            .alm-lora-shell {
                width: 100vw;
                height: 100vh;
            }
            .alm-lora-layout {
                display: grid;
                grid-template-columns: 1fr;
                grid-template-rows: auto minmax(0, 1fr);
            }
            .alm-lora-nav {
                display: flex;
                overflow-x: auto;
                padding: 8px;
            }
            .alm-lora-nav .alm-nav-group {
                display: flex;
                flex-direction: row;
                padding: 0;
                margin: 0;
                border: 0;
            }
            .alm-lora-nav .alm-nav-title,
            .alm-lora-nav-summary,
            .alm-lora-filter-group {
                display: none;
            }
            .alm-lora-split {
                display: grid;
                grid-template-columns: 1fr !important;
                grid-template-rows: minmax(380px, 1fr) auto;
                overflow-y: auto;
            }
            .alm-lora-detail {
                max-height: none;
                border-left: 0;
                border-top: 1px solid var(--alm-border);
            }
            .alm-lora-search {
                grid-column: 1 / -1;
            }
            .alm-lora-order-actions {
                grid-column: 1 / -1;
                display: flex;
                justify-content: flex-end;
            }
        }

        /* Shared discovery toolbar used by both manager surfaces. */
        .alm-search-toolbar {
            min-height: 74px;
            display: grid;
            grid-template-columns: minmax(0, 1fr) clamp(340px, 22vw, 400px);
            align-items: stretch;
            gap: 0;
            box-sizing: border-box;
            padding: 0;
            flex-wrap: nowrap;
        }
        .alm-search-toolbar-main {
            min-width: 0;
            display: grid;
            grid-template-columns: 148px minmax(220px, 1fr);
            align-items: center;
            gap: 14px;
            box-sizing: border-box;
            padding: 11px 18px 11px 24px;
        }
        .alm-search-toolbar-heading {
            min-width: 0;
            display: grid;
            align-content: center;
            gap: 2px;
            padding-left: 2px;
        }
        .alm-search-toolbar-heading > span {
            overflow: hidden;
            color: var(--alm-muted);
            font-size: 9.5px;
            font-weight: 760;
            letter-spacing: 0.08em;
            line-height: 1.1;
            text-overflow: ellipsis;
            text-transform: uppercase;
            white-space: nowrap;
        }
        .alm-search-toolbar .alm-search-toolbar-heading h2 {
            min-width: 0;
            overflow: hidden;
            grid-column: auto;
            margin: 0;
            color: var(--alm-text);
            font-size: 17px;
            font-weight: 780;
            line-height: 1.2;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .alm-search-toolbar .alm-search-wrap {
            width: 100%;
            min-width: 0;
            max-width: none;
            flex: none;
        }
        .alm-search-toolbar .alm-search,
        .alm-search-toolbar .alm-combo-control,
        .alm-search-toolbar select.alm-input,
        .alm-search-toolbar .alm-search-submit {
            min-height: 40px;
            height: 40px;
            box-sizing: border-box;
            border-radius: calc(var(--alm-radius) - 1px);
        }
        .alm-search-toolbar .alm-search {
            width: 100%;
            min-width: 0;
            padding-left: 38px;
            padding-right: 38px;
            background: var(--alm-control);
            font-size: 13px;
        }
        .alm-search-toolbar .alm-search-mark {
            left: 13px;
            width: 14px;
            height: 14px;
            box-sizing: border-box;
            border: 2px solid var(--alm-muted);
            border-radius: 50%;
            font-size: 0;
            opacity: 0.82;
        }
        .alm-search-toolbar .alm-search-mark::after {
            content: "";
            position: absolute;
            right: -4px;
            bottom: -2px;
            width: 6px;
            height: 2px;
            border-radius: 999px;
            background: var(--alm-muted);
            transform: rotate(45deg);
            transform-origin: left center;
        }
        .alm-search-toolbar .alm-search-clear {
            right: 7px;
            width: 28px;
            height: 28px;
            border-radius: 8px;
        }
        .alm-search-toolbar-actions {
            display: grid;
            grid-template-columns: 190px 68px;
            align-items: center;
            justify-content: end;
            gap: 8px;
            box-sizing: border-box;
            padding: 11px 18px;
            border-left: 1px solid var(--alm-border);
        }
        .alm-search-toolbar-actions > :only-child {
            grid-column: 2;
        }
        .alm-library > .alm-library-match-status,
        .alm-lora-page > .alm-library-match-status {
            flex: 0 0 auto;
            box-sizing: border-box;
            padding: 9px 24px;
            border-bottom: 1px solid var(--alm-border);
            background: var(--alm-panel-soft);
        }
        .alm-local-search-toolbar .alm-lora-local-heading {
            gap: 3px;
            overflow: hidden;
        }
        .alm-local-search-toolbar .alm-lora-folder-context {
            overflow: hidden;
        }
        .alm-settings-footer [data-action="save-settings"][aria-busy="true"] {
            opacity: 1;
            cursor: wait;
            background: color-mix(in srgb, var(--alm-accent) 78%, var(--alm-panel));
            border-color: color-mix(in srgb, var(--alm-accent) 58%, var(--alm-border));
            color: #fff;
        }
        .alm-settings-footer [data-action="save-settings"][aria-busy="true"]::before {
            content: "";
            width: 12px;
            height: 12px;
            flex: 0 0 auto;
            box-sizing: border-box;
            border: 2px solid rgba(255, 255, 255, 0.38);
            border-top-color: #fff;
            border-radius: 50%;
            animation: almLoraMatchSpin 0.72s linear infinite;
        }
        .alm-sidebar-launcher {
            min-height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 10px;
            box-sizing: border-box;
            padding: 24px;
            color: var(--alm-text);
            text-align: center;
        }
        .alm-sidebar-launcher-icon {
            width: 48px;
            height: 48px;
            display: grid;
            place-items: center;
            border: 1px solid color-mix(in srgb, var(--alm-accent) 28%, var(--alm-border));
            border-radius: 15px;
            background: color-mix(in srgb, var(--alm-accent) 12%, var(--alm-control));
            color: color-mix(in srgb, var(--alm-accent) 78%, var(--alm-text));
            font-size: 21px;
        }
        .alm-sidebar-launcher h3 {
            margin: 4px 0 0;
            color: var(--alm-text);
            font-size: 16px;
        }
        .alm-sidebar-launcher p {
            max-width: 260px;
            margin: 0 0 6px;
            color: var(--alm-muted);
            font-size: 12px;
            line-height: 1.55;
        }
        .alm-search-toolbar .alm-toolbar-select,
        .alm-search-toolbar .alm-lora-sort {
            width: 190px;
            min-width: 190px;
            max-width: 190px;
        }
        .alm-search-toolbar .alm-search-submit {
            width: 68px;
            min-width: 68px;
            padding: 0 12px;
        }
        @media (max-width: 900px) {
            .alm-search-toolbar {
                grid-template-columns: minmax(0, 1fr);
                align-items: center;
                gap: 8px;
                padding: 10px 16px;
            }
            .alm-search-toolbar-main {
                grid-template-columns: minmax(118px, 148px) minmax(220px, 1fr);
                gap: 12px;
                padding: 0;
            }
            .alm-search-toolbar-heading {
                display: grid;
            }
            .alm-search-toolbar-actions {
                grid-template-columns: 190px 68px;
                justify-content: end;
                padding: 0;
                border-left: 0;
            }
        }
        @media (max-width: 720px) {
            .alm-search-toolbar-main {
                grid-template-columns: minmax(0, 1fr);
            }
            .alm-search-toolbar-heading {
                grid-template-columns: auto minmax(0, 1fr);
                align-items: baseline;
                gap: 8px;
            }
            .alm-search-toolbar-heading > span {
                order: 2;
            }
            .alm-search-toolbar-actions {
                grid-template-columns: minmax(0, 1fr) auto;
            }
            .alm-search-toolbar .alm-toolbar-select,
            .alm-search-toolbar .alm-lora-sort {
                width: 100%;
                max-width: none;
            }
        }

        /* Shared project links in both popup title bars. */
        .alm-topbar > :first-child {
            min-width: 0;
        }
        .alm-topbar-actions,
        .alm-promo-links {
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        .alm-topbar-actions {
            flex: 0 0 auto;
            gap: 10px;
        }
        .alm-promo-links {
            gap: 8px;
        }
        .alm-promo-link {
            width: 34px;
            height: 34px;
            box-sizing: border-box;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex: 0 0 auto;
            border: 1px solid color-mix(in srgb, currentColor 36%, var(--alm-border));
            border-radius: 12px;
            background: color-mix(in srgb, var(--alm-control) 88%, transparent);
            box-shadow: inset 0 1px 0 color-mix(in srgb, var(--alm-text) 6%, transparent);
            color: color-mix(in srgb, var(--alm-accent) 78%, var(--alm-text));
            text-decoration: none;
            user-select: none;
            transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease;
        }
        .alm-promo-link:hover,
        .alm-promo-link:focus-visible {
            border-color: color-mix(in srgb, currentColor 58%, var(--alm-border));
            background: color-mix(in srgb, currentColor 14%, var(--alm-control));
            color: var(--alm-text);
            transform: translateY(-1px);
            box-shadow: 0 8px 22px color-mix(in srgb, currentColor 16%, transparent), inset 0 1px 0 color-mix(in srgb, var(--alm-text) 7%, transparent);
            outline: none;
        }
        .alm-promo-afdian {
            width: 74px;
            color: color-mix(in srgb, #f7a8c8 88%, var(--alm-text));
        }
        .alm-promo-afdian span {
            font-size: 12px;
            font-weight: 850;
            letter-spacing: -0.02em;
            white-space: nowrap;
        }
        @media (max-width: 640px) {
            .alm-topbar {
                padding-inline: 14px;
                gap: 10px;
            }
            .alm-topbar-actions {
                gap: 6px;
            }
            .alm-promo-links {
                gap: 5px;
            }
            .alm-promo-link {
                width: 32px;
                height: 32px;
                border-radius: 10px;
            }
            .alm-promo-afdian {
                width: 68px;
            }
        }

        /* Shared sidebar count badges. Keep them quiet until their row is active. */
        .alm-nav .alm-nav-btn > span {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .alm-nav .alm-nav-btn > b {
            flex: 0 0 auto;
            min-width: 23px;
            height: 22px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            margin-left: 10px;
            padding: 0 7px;
            border: 1px solid color-mix(in srgb, var(--alm-border) 86%, transparent);
            border-radius: 999px;
            background: color-mix(in srgb, var(--alm-control) 82%, transparent);
            color: color-mix(in srgb, var(--alm-text) 68%, var(--alm-muted));
            box-shadow: none;
            font-size: 10px;
            font-weight: 760;
            font-variant-numeric: tabular-nums;
            letter-spacing: 0.01em;
            line-height: 1;
        }
        .alm-nav .alm-nav-btn:hover:not(.active) > b {
            border-color: color-mix(in srgb, var(--alm-text) 14%, var(--alm-border));
            background: var(--alm-panel-hover);
            color: var(--alm-text);
        }
        .alm-nav .alm-nav-btn.active > b {
            border-color: color-mix(in srgb, var(--alm-accent) 28%, var(--alm-border));
            background: color-mix(in srgb, var(--alm-accent) 12%, var(--alm-control));
            color: color-mix(in srgb, var(--alm-accent) 72%, var(--alm-text));
            box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--alm-accent) 5%, transparent);
        }

        /* Shared favorites UI used by the full manager and the LoRA manager. */
        .alm-favorite-folder-group {
            gap: 6px;
        }
        .alm-favorite-folder-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            min-width: 0;
        }
        .alm-favorite-folder-head .alm-nav-title {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .alm-favorite-folder-add,
        .alm-favorite-folder-actions button,
        .alm-favorite-folder-editor button {
            display: inline-grid;
            place-items: center;
            box-sizing: border-box;
            border: 1px solid color-mix(in srgb, var(--alm-border) 88%, transparent);
            background: color-mix(in srgb, var(--alm-control) 88%, transparent);
            color: var(--alm-muted);
            cursor: pointer;
            transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
        }
        .alm-favorite-folder-add {
            width: 28px;
            height: 28px;
            flex: 0 0 auto;
            border-radius: 9px;
            color: color-mix(in srgb, var(--alm-accent) 76%, var(--alm-text));
            font-size: 18px;
            line-height: 1;
        }
        .alm-favorite-folder-add:hover,
        .alm-favorite-folder-actions button:hover,
        .alm-favorite-folder-editor button:hover {
            border-color: color-mix(in srgb, var(--alm-accent) 34%, var(--alm-border));
            background: color-mix(in srgb, var(--alm-accent) 9%, var(--alm-control));
            color: var(--alm-text);
            transform: translateY(-1px);
        }
        .alm-favorite-folder-list {
            display: grid;
            gap: 4px;
            min-width: 0;
        }
        .alm-favorite-folder-row {
            position: relative;
            min-width: 0;
        }
        .alm-favorite-folder-row > .alm-nav-btn {
            padding-right: 66px;
        }
        .alm-favorite-folder-actions {
            position: absolute;
            top: 50%;
            right: 7px;
            display: inline-flex;
            align-items: center;
            gap: 3px;
            opacity: 0;
            pointer-events: none;
            transform: translateY(-50%);
            transition: opacity 0.15s ease;
        }
        .alm-favorite-folder-row:hover .alm-favorite-folder-actions,
        .alm-favorite-folder-row:focus-within .alm-favorite-folder-actions {
            opacity: 1;
            pointer-events: auto;
        }
        .alm-favorite-folder-actions button {
            width: 24px;
            height: 24px;
            border-radius: 7px;
            padding: 0;
            font-size: 12px;
        }
        .alm-favorite-folder-editor {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 28px 28px;
            align-items: center;
            gap: 5px;
            padding: 6px;
            border: 1px solid color-mix(in srgb, var(--alm-accent) 24%, var(--alm-border));
            border-radius: 11px;
            background: color-mix(in srgb, var(--alm-accent) 5%, var(--alm-panel-soft));
        }
        .alm-favorite-folder-editor .alm-input {
            width: 100%;
            min-width: 0;
            height: 32px;
            min-height: 32px;
            padding-inline: 9px;
        }
        .alm-favorite-folder-editor button {
            width: 28px;
            height: 28px;
            border-radius: 8px;
            padding: 0;
        }
        .alm-favorite-controls {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 14px 0;
            padding: 8px;
            border: 1px solid var(--alm-border);
            border-radius: 12px;
            background: color-mix(in srgb, var(--alm-control) 58%, transparent);
            transition: border-color 0.16s ease, background-color 0.16s ease;
        }
        .alm-favorite-controls.is-active {
            border-color: color-mix(in srgb, #f59e0b 24%, var(--alm-border));
            background: color-mix(in srgb, #f59e0b 4%, var(--alm-control));
        }
        .alm-favorite-toggle {
            min-width: 138px;
            min-height: 46px;
            display: inline-flex;
            align-items: center;
            justify-content: flex-start;
            gap: 9px;
            flex: 0 0 auto;
            box-sizing: border-box;
            padding: 7px 11px;
            border: 1px solid transparent;
            border-radius: 9px;
            background: transparent;
            color: var(--alm-text);
            cursor: pointer;
            font: inherit;
            text-align: left;
            transition: border-color 0.15s ease, background-color 0.15s ease, transform 0.15s ease;
        }
        .alm-favorite-toggle-star {
            width: 30px;
            height: 30px;
            display: grid;
            place-items: center;
            flex: 0 0 auto;
            border-radius: 9px;
            background: color-mix(in srgb, var(--alm-text) 6%, transparent);
            color: color-mix(in srgb, var(--alm-muted) 80%, var(--alm-text));
            font-size: 18px;
            line-height: 1;
        }
        .alm-favorite-toggle-copy {
            min-width: 0;
            display: grid;
            gap: 1px;
        }
        .alm-favorite-toggle-copy b {
            color: var(--alm-text);
            font-size: 11.5px;
            line-height: 1.25;
        }
        .alm-favorite-toggle-copy small {
            max-width: 150px;
            overflow: hidden;
            color: var(--alm-muted);
            font-size: 9px;
            font-weight: 580;
            line-height: 1.25;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .alm-favorite-toggle.is-active {
            border-color: color-mix(in srgb, #f59e0b 22%, transparent);
            background: color-mix(in srgb, #f59e0b 8%, transparent);
        }
        .alm-favorite-toggle.is-active .alm-favorite-toggle-star {
            background: color-mix(in srgb, #f59e0b 16%, transparent);
            color: #f6b83f;
        }
        .alm-favorite-toggle:hover {
            border-color: color-mix(in srgb, #f59e0b 28%, var(--alm-border));
            background: color-mix(in srgb, #f59e0b 9%, transparent);
            transform: translateY(-1px);
        }
        .alm-favorite-folder-select {
            min-width: 0;
            display: grid;
            grid-template-columns: auto minmax(0, 1fr);
            align-items: center;
            gap: 9px;
            flex: 1 1 auto;
            padding-left: 10px;
            border-left: 1px solid var(--alm-border);
        }
        .alm-favorite-folder-select > span {
            color: var(--alm-muted);
            font-size: 10px;
            font-weight: 760;
            white-space: nowrap;
        }
        .alm-favorite-folder-select .alm-input {
            width: 100%;
            min-width: 0;
            height: 38px;
        }
        .alm-favorite-hint {
            min-width: 0;
            color: var(--alm-muted);
            font-size: 10px;
            font-weight: 620;
            line-height: 1.4;
        }
        .alm-card-favorite-mark {
            position: absolute;
            top: 9px;
            right: 9px;
            z-index: 7;
            height: 25px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            box-sizing: border-box;
            padding: 0 8px;
            border: 1px solid color-mix(in srgb, #f59e0b 46%, transparent);
            border-radius: 999px;
            background: color-mix(in srgb, var(--alm-panel) 78%, transparent);
            box-shadow: 0 5px 14px rgba(0, 0, 0, 0.26);
            color: #f7c65d;
            font-size: 9.5px;
            font-weight: 800;
            line-height: 1;
            pointer-events: none;
            backdrop-filter: blur(8px);
        }
        .alm-card-favorite-mark > span {
            font-size: 12px;
        }
        .alm-favorite-total {
            min-width: 34px;
            height: 30px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            padding: 0 10px;
            border: 1px solid color-mix(in srgb, var(--alm-accent) 24%, var(--alm-border));
            border-radius: 999px;
            background: color-mix(in srgb, var(--alm-accent) 8%, var(--alm-control));
            color: var(--alm-text);
            font-size: 11px;
            font-weight: 800;
            font-variant-numeric: tabular-nums;
        }

        /* Applied LoRAs form a numbered vertical pipeline {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto auto;
            align-items: center;
            gap: 12px;
        }
        .alm-lora-applied-list {
            min-width: 0;
            height: 100%;
            box-sizing: border-box;
            padding: 24px;
            background:
                radial-gradient(circle at 50% 0, color-mix(in srgb, var(--alm-accent) 6%, transparent), transparent 34%),
                color-mix(in srgb, var(--alm-bg) 88%, transparent);
        }
        .alm-lora-order-actions {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            gap: 8px;
            align-content: center;
        }
        .alm-lora-reorder-buttons {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6px;
        }
        .alm-lora-reorder-buttons .alm-secondary {
            min-width: 0;
            min-height: 34px;
            padding: 0;
            font-size: 14px;
        }
        .alm-lora-reorder-buttons .alm-secondary:disabled {
            opacity: 0.28;
            cursor: default;
            filter: none;
        }
        @media (max-width: 560px) {
            .alm-lora-applied-list {
                padding: 14px;
            }
        }

        /* Rich collection placeholders mirror the permanent detail rail. */
        .alm-empty-state {
            position: relative;
            grid-column: 1 / -1;
            width: 100%;
            min-height: clamp(320px, 55vh, 560px);
            overflow: hidden;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 20px;
            padding: clamp(28px, 5vh, 52px) 24px;
            border: 1px solid color-mix(in srgb, var(--alm-border) 82%, transparent);
            border-radius: calc(var(--alm-radius) + 6px);
            background:
                radial-gradient(circle at 50% 15%, color-mix(in srgb, var(--alm-accent) 14%, transparent), transparent 36%),
                linear-gradient(155deg, color-mix(in srgb, var(--alm-panel-soft) 92%, transparent), color-mix(in srgb, var(--alm-panel) 97%, transparent));
            color: var(--alm-muted);
            text-align: center;
        }
        .alm-empty-state::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            opacity: 0.28;
            background-image: radial-gradient(color-mix(in srgb, var(--alm-text) 18%, transparent) 0.7px, transparent 0.7px);
            background-size: 15px 15px;
            mask-image: linear-gradient(to bottom, #000, transparent 78%);
        }
        .alm-empty-state .alm-empty-detail-art {
            width: 132px;
            height: 116px;
        }
        .alm-empty-state .alm-empty-detail-card {
            width: 72px;
            height: 84px;
        }
        .alm-empty-state .alm-empty-detail-card.card-front::before {
            height: 38px;
        }
        .alm-empty-state-symbol {
            position: absolute;
            left: 50%;
            top: 43%;
            z-index: 2;
            width: 26px;
            height: 26px;
            display: grid;
            place-items: center;
            transform: translate(-68%, -80%) rotate(-4deg);
            color: color-mix(in srgb, var(--alm-accent) 78%, var(--alm-text));
            font-size: 22px;
            font-style: normal;
            font-weight: 820;
            line-height: 1;
            text-shadow: 0 0 16px color-mix(in srgb, var(--alm-accent) 42%, transparent);
        }
        .alm-empty-state-symbol::before { content: "·"; }
        .alm-empty-state[data-empty-kind="favorites"] .alm-empty-state-symbol::before { content: "★"; }
        .alm-empty-state[data-empty-kind="downloads"] .alm-empty-state-symbol::before { content: "↓"; }
        .alm-empty-state[data-empty-kind="library"] .alm-empty-state-symbol::before { content: "▦"; }
        .alm-empty-state[data-empty-kind="applied"] .alm-empty-state-symbol::before { content: "+"; }
        .alm-empty-state[data-empty-kind="discover"] .alm-empty-state-symbol {
            width: 18px;
            height: 18px;
            border: 2px solid currentColor;
            border-radius: 50%;
        }
        .alm-empty-state[data-empty-kind="discover"] .alm-empty-state-symbol::before {
            content: "";
            position: absolute;
            right: -7px;
            bottom: -5px;
            width: 8px;
            height: 2px;
            border-radius: 999px;
            background: currentColor;
            transform: rotate(45deg);
            transform-origin: left center;
        }
        .alm-empty-state .alm-empty-detail-copy,
        .alm-empty-state .alm-empty-detail-features {
            position: relative;
            z-index: 1;
        }
        .alm-empty-state h2 {
            margin: 0;
            color: var(--alm-text);
            font-size: clamp(18px, 2vw, 22px);
            line-height: 1.3;
        }
        .alm-empty-state p {
            max-width: 460px;
            margin: 0;
            color: var(--alm-muted);
            font-size: 12px;
            line-height: 1.65;
        }
        .alm-lora-applied-list > .alm-empty-state {
            flex: 1;
        }
        .alm-download-list {
            min-height: 0;
            flex: 1;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            align-content: start;
            gap: 16px;
            padding: 22px 24px;
        }
        .alm-lora-download-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            align-content: start;
            gap: 16px;
            padding: 22px 24px;
        }

        /* Draw the add mark geometrically so it is centered independent of font metrics. */
        .alm-favorite-folder-add {
            padding: 0;
            font-size: 0;
        }
        .alm-favorite-folder-add > span {
            position: relative;
            width: 12px;
            height: 12px;
            display: block;
        }
        .alm-favorite-folder-add > span::before,
        .alm-favorite-folder-add > span::after {
            content: "";
            position: absolute;
            left: 50%;
            top: 50%;
            border-radius: 999px;
            background: currentColor;
            transform: translate(-50%, -50%);
        }
        .alm-favorite-folder-add > span::before { width: 12px; height: 2px; }
        .alm-favorite-folder-add > span::after { width: 2px; height: 12px; }

        @media (max-width: 720px) {
            .alm-download-list {
                grid-template-columns: minmax(0, 1fr);
                padding: 16px;
            }
            .alm-lora-download-list {
                grid-template-columns: minmax(0, 1fr);
                padding: 16px;
            }
            .alm-empty-state {
                min-height: 360px;
            }
        }
        @media (max-width: 480px) {
            .alm-favorite-controls {
                align-items: stretch;
                flex-direction: column;
            }
            .alm-favorite-toggle {
                width: 100%;
            }
            .alm-favorite-folder-select {
                padding-top: 8px;
                padding-left: 0;
                border-top: 1px solid var(--alm-border);
                border-left: 0;
            }
        }

        /* Keep the popup geometry isolated from ComfyUI themes and other
           extensions that change flex cross-axis sizing on generic shells. */
        .alm-overlay .alm-shell {
            align-items: stretch;
        }
        .alm-overlay .alm-layout {
            width: 100%;
            align-self: stretch;
            box-sizing: border-box;
        }
        .alm-overlay .alm-body,
        .alm-overlay .alm-page,
        .alm-overlay .alm-toolbar,
        .alm-overlay .alm-split {
            width: 100%;
            max-width: none;
            box-sizing: border-box;
        }

        /* =================================================================
           UI Refactor: Clean Search Toolbar, Active Filter Chips,
           Action-First Detail Hub, Collapsible Path Bar, & Card Badges
           ================================================================= */

        /* 1. Inline clear button inside SearchCombo & single-column picker */
        .alm-search-picker {
            grid-template-columns: minmax(0, 1fr) !important;
        }
        .alm-combo-clear[hidden],
        .alm-search-clear[hidden],
        .alm-search-spinner[hidden] {
            display: none !important;
        }
        .alm-combo.has-value .alm-combo-control {
            padding-right: 52px;
            border-color: color-mix(in srgb, var(--alm-accent) 36%, var(--alm-border));
            background: color-mix(in srgb, var(--alm-accent) 6%, var(--alm-control));
        }
        .alm-combo-clear {
            position: absolute;
            top: 50%;
            right: 28px;
            z-index: 3;
            width: 20px;
            height: 20px;
            display: grid;
            place-items: center;
            padding: 0;
            border: 0;
            border-radius: 50%;
            background: color-mix(in srgb, var(--alm-text) 10%, transparent);
            color: var(--alm-muted);
            font-size: 13px;
            line-height: 1;
            cursor: pointer;
            transform: translateY(-50%);
            transition: background-color 0.15s ease, color 0.15s ease;
        }
        .alm-combo-clear:hover {
            background: color-mix(in srgb, var(--alm-danger) 22%, transparent);
            color: var(--alm-danger);
        }

        /* 2. Top Toolbar: Segmented Kind Tabs, Inline Loading Spinner, & Active Filter Bar */
        .alm-search-toolbar-main {
            grid-template-columns: auto minmax(220px, 1fr) !important;
        }
        .alm-search-toolbar-actions {
            display: flex !important;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            padding: 11px 18px;
        }
        .alm-search-toolbar.has-filter-bar {
            row-gap: 0;
        }
        .alm-search-toolbar-filters {
            grid-column: 1 / -1;
            min-width: 0;
            padding: 0 18px 10px 24px;
        }
        .alm-active-filters,
        .alm-active-filter-list {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 6px;
        }
        .alm-active-filter-chip {
            height: 26px;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 0 8px 0 10px;
            border: 1px solid color-mix(in srgb, var(--alm-accent) 34%, var(--alm-border));
            border-radius: 999px;
            background: color-mix(in srgb, var(--alm-accent) 10%, var(--alm-control));
            color: var(--alm-text);
            font-size: 11px;
            line-height: 1;
            cursor: pointer;
            transition: border-color 0.15s ease, background-color 0.15s ease;
        }
        .alm-active-filter-chip > small {
            color: var(--alm-muted);
            font-size: 10px;
            font-weight: 650;
        }
        .alm-active-filter-chip > b {
            font-weight: 780;
            color: var(--alm-text);
        }
        .alm-active-filter-chip > i {
            width: 15px;
            height: 15px;
            display: inline-grid;
            place-items: center;
            border-radius: 50%;
            background: color-mix(in srgb, var(--alm-text) 10%, transparent);
            color: var(--alm-muted);
            font-style: normal;
            font-size: 11px;
        }
        .alm-active-filter-chip:hover {
            border-color: color-mix(in srgb, var(--alm-danger) 46%, var(--alm-border));
            background: color-mix(in srgb, var(--alm-danger) 10%, var(--alm-control));
        }
        .alm-active-filter-chip:hover > i {
            background: color-mix(in srgb, var(--alm-danger) 24%, transparent);
            color: var(--alm-danger);
        }
        .alm-reset-filters-btn {
            height: 26px;
            padding: 0 10px;
            border: 1px dashed var(--alm-border);
            border-radius: 999px;
            background: transparent;
            color: var(--alm-muted);
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
            transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
        }
        .alm-reset-filters-btn:hover {
            border-color: color-mix(in srgb, var(--alm-accent) 42%, var(--alm-border));
            background: color-mix(in srgb, var(--alm-accent) 8%, transparent);
            color: var(--alm-text);
        }
        .alm-kind-tabs {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 3px;
            border: 1px solid var(--alm-border);
            border-radius: 11px;
            background: color-mix(in srgb, var(--alm-bg) 56%, var(--alm-control));
        }
        .alm-kind-tab {
            height: 32px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 0 12px;
            border: 0;
            border-radius: 8px;
            background: transparent;
            color: var(--alm-muted);
            font-size: 12px;
            font-weight: 780;
            white-space: nowrap;
            cursor: pointer;
            transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
        }
        .alm-kind-tab:hover {
            color: var(--alm-text);
            background: color-mix(in srgb, var(--alm-text) 5%, transparent);
        }
        .alm-kind-tab.active {
            background: color-mix(in srgb, var(--alm-accent) 20%, var(--alm-panel));
            color: var(--alm-text);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18), inset 0 0 0 1px color-mix(in srgb, var(--alm-accent) 42%, transparent);
        }
        .alm-kind-tab > b {
            padding: 1px 6px;
            border-radius: 999px;
            background: color-mix(in srgb, var(--alm-text) 9%, transparent);
            color: var(--alm-muted);
            font-size: 10px;
            font-weight: 800;
        }
        .alm-kind-tab.active > b {
            background: color-mix(in srgb, var(--alm-accent) 26%, transparent);
            color: var(--alm-text);
        }
        .alm-toolbar-icon-btn {
            width: 40px;
            height: 40px;
            min-width: 40px;
            padding: 0 !important;
            display: inline-grid;
            place-items: center;
            border-radius: 10px;
            font-size: 15px;
            line-height: 1;
        }
        .alm-search-spinner {
            position: absolute;
            right: 38px;
            top: 50%;
            width: 14px;
            height: 14px;
            box-sizing: border-box;
            border: 2px solid color-mix(in srgb, var(--alm-muted) 30%, transparent);
            border-top-color: var(--alm-accent);
            border-radius: 50%;
            transform: translateY(-50%);
            animation: almSpin 0.7s linear infinite;
            pointer-events: none;
        }
        @keyframes almSpin {
            to { transform: translateY(-50%) rotate(360deg); }
        }

        /* 3. Interactive Card Favorite Button & Card Status Badges */
        .alm-card-favorite-btn {
            pointer-events: auto !important;
            cursor: pointer;
            opacity: 0;
            transform: translateY(-2px) scale(0.96);
            transition: opacity 0.16s ease, transform 0.16s ease, background-color 0.16s ease, border-color 0.16s ease;
        }
        .alm-card:hover .alm-card-favorite-btn,
        .alm-card:focus-within .alm-card-favorite-btn,
        .alm-card-favorite-btn.is-active {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
        .alm-card-favorite-btn:not(.is-active) {
            width: 28px;
            padding: 0;
            justify-content: center;
            border-color: color-mix(in srgb, var(--alm-border) 85%, transparent);
            background: color-mix(in srgb, var(--alm-panel) 76%, transparent);
            color: var(--alm-text);
        }
        .alm-card-favorite-btn:hover {
            border-color: color-mix(in srgb, #f59e0b 65%, var(--alm-border)) !important;
            background: color-mix(in srgb, #f59e0b 20%, var(--alm-panel)) !important;
            color: #fbbf24 !important;
        }
        .alm-card-top-badges {
            position: absolute;
            top: 10px;
            left: 10px;
            z-index: 6;
            max-width: calc(100% - 52px);
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 5px;
            pointer-events: none;
        }
        .alm-card-top-badges .alm-card-badge {
            position: static;
            max-width: 100%;
        }
        .alm-card-status-slot {
            position: static;
            display: inline-flex;
            gap: 5px;
            pointer-events: none;
        }
        .alm-card-status-slot:empty {
            display: none;
        }
        .alm-card-status {
            height: 22px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 0 8px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 800;
            line-height: 1;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
        }
        .alm-card-status.is-installed {
            border: 1px solid color-mix(in srgb, var(--alm-success) 52%, transparent);
            background: color-mix(in srgb, var(--alm-panel) 84%, var(--alm-success) 16%);
            color: var(--alm-success);
        }
        .alm-card-status.is-downloading {
            border: 1px solid color-mix(in srgb, var(--alm-info) 52%, transparent);
            background: color-mix(in srgb, var(--alm-panel) 82%, var(--alm-info) 18%);
            color: var(--alm-info);
        }
        .alm-card-status.is-downloading > i {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: currentColor;
            box-shadow: 0 0 8px currentColor;
        }
        .alm-card-creator {
            overflow: hidden;
            color: rgba(255, 255, 255, 0.72);
            font-size: 10.5px;
            font-weight: 680;
            line-height: 1.1;
            text-overflow: ellipsis;
            white-space: nowrap;
            text-shadow: 0 1px 4px rgba(0, 0, 0, 0.75);
        }
        .alm-card-stat-chip.is-size {
            margin-left: auto;
            opacity: 0.92;
        }

        /* 4. Right Detail Panel: Unified Download Card, Top Action Hub, Live Progress & Compact Favorite */
        .alm-detail-download-card {
            display: grid;
            gap: 10px;
            margin: 12px 0 16px;
            padding: 12px;
            border: 1px solid color-mix(in srgb, var(--alm-accent) 26%, var(--alm-border));
            border-radius: 14px;
            background: linear-gradient(
                180deg,
                color-mix(in srgb, var(--alm-accent) 7%, var(--alm-panel-soft)) 0%,
                var(--alm-panel-soft) 100%
            );
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
        }
        .alm-detail-download-card .alm-detail-field-block {
            margin: 0;
        }
        .alm-detail-download-card .alm-path-box {
            margin: 0;
            background: color-mix(in srgb, var(--alm-bg) 42%, var(--alm-control));
        }
        .alm-detail-action-hub {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin: 0;
        }
        .alm-detail-action-hub.is-inline-cta {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: stretch;
            gap: 8px;
        }
        .alm-detail-action-hub.is-inline-cta .alm-favorite-controls.is-compact {
            padding: 0;
            border: 0;
            background: transparent;
            box-shadow: none;
            min-height: 44px;
            display: flex;
        }
        .alm-detail-action-hub.is-inline-cta .alm-favorite-controls.is-compact .alm-favorite-toggle {
            min-height: 44px;
            padding: 0 12px;
            border: 1px solid var(--alm-border);
            border-radius: 12px;
            background: var(--alm-control);
        }
        .alm-detail-action-hub.is-inline-cta .alm-favorite-controls.is-compact .alm-favorite-toggle:hover {
            border-color: color-mix(in srgb, #f59e0b 52%, var(--alm-border));
            background: color-mix(in srgb, #f59e0b 10%, var(--alm-control));
        }
        .alm-download-cta {
            min-height: 44px !important;
            width: 100%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border-radius: 12px !important;
            font-size: 13.5px !important;
            font-weight: 820 !important;
            letter-spacing: 0.01em;
            box-shadow: 0 8px 22px color-mix(in srgb, var(--alm-accent) 26%, transparent);
            transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
        }
        .alm-download-cta:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 12px 26px color-mix(in srgb, var(--alm-accent) 34%, transparent);
            filter: brightness(1.05);
        }
        .alm-download-cta-icon {
            width: 22px;
            height: 22px;
            display: inline-grid;
            place-items: center;
            border-radius: 7px;
            background: rgba(255, 255, 255, 0.16);
            font-size: 13px;
            line-height: 1;
        }
        .alm-detail-download-progress {
            display: grid;
            gap: 8px;
            padding: 11px 12px;
            border: 1px solid color-mix(in srgb, var(--alm-info) 38%, var(--alm-border));
            border-radius: 12px;
            background: color-mix(in srgb, var(--alm-info) 7%, var(--alm-control));
        }
        .alm-detail-download-progress-actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 6px;
        }
        .alm-detail-installed-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 10px;
            padding: 10px 12px;
            border: 1px solid color-mix(in srgb, var(--alm-success) 34%, var(--alm-border));
            border-radius: 12px;
            background: color-mix(in srgb, var(--alm-success) 7%, var(--alm-control));
        }
        .alm-detail-installed-badge {
            min-width: 0;
            flex: 1 1 140px;
            display: flex;
            align-items: center;
            gap: 9px;
        }
        .alm-installed-check {
            width: 26px;
            height: 26px;
            flex: 0 0 auto;
            display: grid;
            place-items: center;
            border-radius: 8px;
            background: color-mix(in srgb, var(--alm-success) 18%, transparent);
            color: var(--alm-success);
            font-size: 13px;
            font-weight: 900;
        }
        .alm-detail-installed-badge > div {
            min-width: 0;
            display: grid;
            gap: 2px;
        }
        .alm-detail-installed-badge b {
            color: var(--alm-text);
            font-size: 12px;
            font-weight: 800;
        }
        .alm-detail-installed-badge span {
            overflow: hidden;
            color: var(--alm-muted);
            font-size: 10px;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .alm-detail-installed-actions {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .alm-mini-btn {
            min-height: 30px !important;
            padding: 0 10px !important;
            font-size: 11px !important;
            border-radius: 8px !important;
        }
        .alm-mini-btn.is-danger:hover {
            border-color: color-mix(in srgb, var(--alm-danger) 48%, var(--alm-border));
            color: var(--alm-danger);
        }
        .alm-favorite-controls.is-compact {
            margin: 0;
            padding: 5px 8px;
            min-height: 38px;
        }
        .alm-favorite-controls.is-compact .alm-favorite-toggle {
            min-height: 32px;
            min-width: 0;
            padding: 4px 8px;
        }
        .alm-favorite-controls.is-compact .alm-favorite-toggle-star {
            width: 24px;
            height: 24px;
            font-size: 14px;
        }

        /* 5. Version Pills & Trigger Words Header */
        .alm-detail-field-block {
            display: grid;
            gap: 6px;
            margin: 10px 0;
        }
        .alm-detail-field-block > .alm-label {
            margin: 0;
        }
        .alm-version-pills {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        .alm-version-pill {
            min-height: 30px;
            max-width: 100%;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border: 1px solid var(--alm-border);
            border-radius: 9px;
            background: var(--alm-control);
            color: var(--alm-muted);
            font-size: 11.5px;
            font-weight: 740;
            cursor: pointer;
            transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
        }
        .alm-version-pill > span {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .alm-version-pill > small {
            padding: 2px 5px;
            border-radius: 5px;
            background: color-mix(in srgb, var(--alm-text) 8%, transparent);
            color: var(--alm-muted);
            font-size: 9.5px;
            font-weight: 760;
        }
        .alm-version-pill:hover {
            border-color: color-mix(in srgb, var(--alm-accent) 38%, var(--alm-border));
            color: var(--alm-text);
        }
        .alm-version-pill.active {
            border-color: color-mix(in srgb, var(--alm-accent) 58%, var(--alm-border));
            background: color-mix(in srgb, var(--alm-accent) 14%, var(--alm-control));
            color: var(--alm-text);
        }
        .alm-version-pill.active > small {
            background: color-mix(in srgb, var(--alm-accent) 26%, transparent);
            color: var(--alm-text);
        }
        .alm-section-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            margin: 14px 0 8px;
        }
        .alm-section-head > .alm-section-title {
            margin: 0;
        }
        .alm-copy-all-btn {
            height: 24px;
            padding: 0 9px;
            border: 1px solid color-mix(in srgb, var(--alm-accent) 28%, var(--alm-border));
            border-radius: 999px;
            background: color-mix(in srgb, var(--alm-accent) 8%, var(--alm-control));
            color: var(--alm-text);
            font-size: 10.5px;
            font-weight: 740;
            cursor: pointer;
            transition: background-color 0.15s ease, border-color 0.15s ease;
        }
        .alm-copy-all-btn:hover {
            border-color: color-mix(in srgb, var(--alm-accent) 52%, var(--alm-border));
            background: color-mix(in srgb, var(--alm-accent) 16%, var(--alm-control));
        }

        /* 6. Collapsible Automatic Save Path Drawer */
        .alm-path-box {
            margin: 10px 0;
            padding: 10px 12px;
            display: grid;
            gap: 8px;
        }
        .alm-path-summary-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            min-width: 0;
        }
        .alm-path-summary-main {
            min-width: 0;
            flex: 1 1 auto;
            display: flex;
            align-items: center;
            gap: 7px;
        }
        .alm-path-folder-icon {
            flex: 0 0 auto;
            font-size: 13px;
            line-height: 1;
        }
        .alm-path-summary-text {
            min-width: 0;
            overflow: hidden;
            color: var(--alm-muted);
            font-size: 11px;
            font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .alm-path-toggle-btn {
            flex: 0 0 auto;
            height: 26px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 0 9px;
            border: 1px solid var(--alm-border);
            border-radius: 8px;
            background: var(--alm-control);
            color: var(--alm-text);
            font-size: 10.5px;
            font-weight: 740;
            cursor: pointer;
            transition: border-color 0.15s ease, background-color 0.15s ease;
        }
        .alm-path-toggle-btn:hover {
            border-color: color-mix(in srgb, var(--alm-accent) 40%, var(--alm-border));
            background: color-mix(in srgb, var(--alm-accent) 8%, var(--alm-control));
        }
        .alm-path-toggle-btn > i {
            font-style: normal;
            font-size: 10px;
            color: var(--alm-muted);
        }
        .alm-path-drawer {
            display: grid;
            gap: 10px;
            padding-top: 8px;
            border-top: 1px solid var(--alm-border);
        }
        .alm-path-conflict {
            margin: 0 !important;
            font-size: 10.5px;
        }
    `;
    if (!style.isConnected) {
        document.head.appendChild(style);
    }
}
