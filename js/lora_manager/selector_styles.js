export function injectSelectorStyles() {
    if (document.getElementById("alm-selector-style")) return;
    const style = document.createElement("style");
    style.id = "alm-selector-style";
    style.textContent = `
        .alm-selector-overlay {
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
            --selector-tint: color-mix(in srgb, var(--alm-accent) 45%, #8b9099);
            --selector-surface: color-mix(in srgb, var(--alm-panel) 84%, var(--selector-tint) 16%);
            --selector-rail: color-mix(in srgb, var(--alm-panel) 94%, var(--selector-tint) 6%);
            --selector-field: color-mix(in srgb, var(--alm-panel) 72%, var(--selector-tint) 28%);
            --selector-hover: color-mix(in srgb, var(--alm-text) 7%, var(--selector-surface));
            --selector-menu: color-mix(in srgb, var(--alm-panel) 74%, var(--selector-tint) 26%);
            --selector-line: color-mix(in srgb, var(--alm-text) 10%, transparent);
            --selector-text: var(--alm-text);
            --selector-muted: color-mix(in srgb, var(--alm-text) 62%, var(--selector-surface));
            --selector-accent: color-mix(in srgb, var(--alm-accent) 88%, var(--alm-text));
            --selector-selected: color-mix(in srgb, var(--alm-accent) 16%, var(--selector-surface));
            --selector-primary: var(--alm-sampled-primary, #526f98);
            --selector-favorite: color-mix(in srgb, #e8a924 78%, var(--alm-text));
            --selector-good: color-mix(in srgb, #38b26d 78%, var(--alm-text));
            --selector-warn: color-mix(in srgb, #df8f2e 80%, var(--alm-text));
            --alm-danger: color-mix(in srgb, #e5484d 82%, var(--alm-text));
        }
        .alm-selector-overlay .alm-selector-shell {
            position: relative;
            display: flex;
            flex-direction: column;
            width: min(1780px, calc(100vw - 32px));
            height: calc(100dvh - 32px);
            border: 0;
            border-radius: 12px;
            overflow: hidden;
            background: var(--selector-surface);
            box-shadow: 0 24px 80px rgba(0, 0, 0, .4);
        }
        .alm-selector-topbar, .alm-selector-tabs, .alm-selector-nav, .alm-selector-toolbar, .alm-selector-footer,
        .alm-selector-utility-toolbar {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
            font-size: 12px;
            font-weight: 400;
        }
        .alm-selector-overlay .alm-selector-topbar {
            flex: 0 0 auto;
            min-height: 58px;
            padding: 12px 20px;
            gap: 20px;
            background: var(--selector-surface);
            border-bottom: 1px solid var(--selector-line);
        }
        .alm-selector-heading { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .alm-selector-heading > svg { flex: 0 0 auto; width: 22px; height: 22px; color: var(--selector-accent); }
        .alm-selector-overlay .alm-selector-heading .alm-title { margin: 0; color: var(--selector-text); font-size: 15px; font-weight: 600; line-height: 22px; }
        .alm-selector-topbar .alm-topbar-actions { gap: 12px; }
        .alm-selector-close, .alm-selector-filter-toggle, .alm-selector-reset, .alm-selector-tab, .alm-selector-node-status {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            border: 0;
            background: transparent;
            color: var(--selector-muted);
            font: inherit;
            cursor: pointer;
        }
        .alm-selector-close { width: 32px; height: 32px; padding: 0; border-radius: 6px; }
        .alm-selector-close:hover { color: var(--selector-text); background: var(--selector-hover); }
        .alm-selector-filter-toggle { gap: 7px; min-height: 32px; padding: 0 10px; border-radius: 6px; font-size: 12px; }
        .alm-selector-filter-toggle:hover { background: var(--selector-hover); color: var(--selector-text); }
        .alm-selector-filter-toggle[aria-expanded="true"] { background: var(--selector-selected); color: var(--selector-accent); }
        .alm-selector-filter-toggle[hidden] { display: none; }
        .alm-selector-workspace { display: grid; grid-template-columns: 76px minmax(0, 1fr); flex: 1 1 auto; min-height: 0; overflow: hidden; }
        .alm-selector-tabs {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 8px;
            min-width: 0;
            padding: 14px 8px;
            background: var(--selector-rail);
            border-right: 1px solid var(--selector-line);
            overflow-y: auto;
            scrollbar-width: thin;
        }
        .alm-selector-tab {
            position: relative;
            flex: 0 0 auto;
            flex-direction: column;
            gap: 7px;
            min-height: 66px;
            padding: 10px 3px;
            border-radius: 8px;
            color: var(--selector-muted);
            font-size: 10px;
            font-weight: 450;
            line-height: 14px;
            text-align: center;
            transition: background-color 160ms ease, color 160ms ease;
        }
        .alm-selector-tab > svg { width: 21px; height: 21px; }
        .alm-selector-tab > span { max-width: 100%; overflow-wrap: anywhere; }
        .alm-selector-tab:hover { background: var(--selector-hover); color: var(--selector-text); }
        .alm-selector-tab.active { color: var(--selector-accent); background: var(--selector-selected); }
        .alm-selector-tab b {
            position: absolute;
            top: 5px;
            right: 2px;
            min-width: 16px;
            padding: 0 3px;
            border-radius: 4px;
            background: var(--selector-rail);
            color: var(--selector-muted);
            font-size: 9px;
            font-weight: 500;
            font-variant-numeric: tabular-nums;
            line-height: 14px;
        }
        .alm-selector-tab.active b { background: var(--selector-accent); color: var(--alm-panel); }
        .alm-selector-tab b:empty { display: none; }
        .alm-selector-overlay .alm-selector-layout {
            position: relative;
            display: grid;
            min-width: 0;
            min-height: 0;
            grid-template-columns: minmax(0, 1fr);
            grid-template-rows: minmax(0, 1fr);
            overflow: hidden;
        }
        .alm-selector-overlay .alm-selector-layout.has-filters.filters-open { grid-template-columns: 208px minmax(0, 1fr); }
        .alm-selector-overlay .alm-selector-nav { display: none; }
        .alm-selector-overlay .has-filters.filters-open > .alm-selector-nav {
            display: flex;
            flex-direction: column;
            gap: 0;
            min-height: 0;
            padding: 20px 14px;
            overflow: hidden auto;
            background: var(--selector-surface);
            border-right: 1px solid var(--selector-line);
        }
        .alm-selector-filter-backdrop { display: none; }
        .alm-selector-filter-heading { display: flex; align-items: center; justify-content: space-between; flex: 0 0 auto; gap: 8px; margin-bottom: 24px; }
        .alm-selector-filter-heading h2 { margin: 0; color: var(--selector-text); font-size: 13px; font-weight: 600; }
        .alm-selector-reset { padding: 2px 0; color: var(--selector-muted); font-size: 10px; text-decoration: underline; text-underline-offset: 3px; }
        .alm-selector-reset:hover { color: var(--selector-text); }
        .alm-selector-nav .alm-nav-group { display: flex; flex-direction: column; flex: 0 0 auto; gap: 9px; margin: 0 0 24px; padding: 0; border: 0; }
        .alm-selector-nav .alm-nav-group:last-child { margin-bottom: 0; }
        .alm-selector-nav .alm-nav-title { display: block; margin: 0; padding: 0; color: var(--selector-muted); font-size: 11px; font-weight: 500; text-transform: none; letter-spacing: 0; }
        .alm-selector-nav .alm-search-picker { width: 100%; min-width: 0; }
        .alm-selector-nav .alm-combo-control {
            min-height: 38px;
            padding: 10px 30px 10px 11px;
            border: 1px solid transparent;
            border-radius: 7px;
            background: var(--selector-field);
            color: var(--selector-text);
            font-size: 12px;
            font-weight: 400;
            line-height: 16px;
            box-shadow: none;
        }
        .alm-selector-nav .alm-combo-control:hover { border-color: var(--selector-line); background: var(--selector-hover); }
        .alm-selector-nav .alm-combo.has-value .alm-combo-control { padding-right: 50px; border-color: transparent; background: var(--selector-selected); color: var(--selector-accent); }
        .alm-selector-nav .alm-combo.is-locked .alm-combo-control { cursor: default; }
        .alm-selector-nav .alm-combo-value.placeholder { color: var(--selector-muted); font-weight: 400; }
        .alm-selector-nav .alm-combo-control > svg { position: absolute; right: 9px; top: 50%; width: 17px; height: 17px; color: var(--selector-muted); transform: translateY(-50%); }
        .alm-selector-nav .alm-combo.open .alm-combo-control > svg { transform: translateY(-50%) rotate(180deg); }
        .alm-selector-nav .alm-combo-clear { width: 20px; height: 20px; right: 26px; border-radius: 4px; background: transparent; color: var(--selector-muted); }
        .alm-selector-nav .alm-combo-clear:hover { background: var(--selector-hover); color: var(--selector-text); }
        .alm-selector-nav .alm-combo-clear svg { width: 13px; height: 13px; }
        .alm-selector-nav [hidden], .alm-selector-toolbar [hidden] { display: none !important; }
        .alm-selector-nav .alm-combo-popover { padding: 6px; border: 0; border-radius: 9px; background: var(--selector-menu); color: var(--selector-text); box-shadow: 0 16px 40px rgba(0, 0, 0, .36); }
        .alm-selector-combo-search { position: relative; margin-bottom: 5px; }
        .alm-selector-combo-search > svg { position: absolute; left: 9px; top: 9px; width: 14px; height: 14px; color: var(--selector-muted); pointer-events: none; }
        .alm-selector-nav .alm-combo-search { width: 100%; height: 32px; min-height: 32px; margin: 0; padding: 7px 9px 7px 30px; border: 0; border-radius: 5px; background: var(--selector-rail); color: var(--selector-text); font-size: 12px; font-weight: 400; }
        .alm-selector-nav .alm-combo-search::placeholder { color: var(--selector-muted); }
        .alm-selector-nav .alm-combo-list { padding: 0; }
        .alm-selector-nav .alm-combo-option { display: flex; align-items: center; min-height: 33px; padding: 7px 8px; border: 0; border-radius: 5px; background: transparent; color: var(--selector-text); font-size: 12px; font-weight: 400; line-height: 18px; }
        .alm-selector-nav .alm-combo-option:hover, .alm-selector-nav .alm-combo-option.is-key-active { background: var(--selector-hover); }
        .alm-selector-nav .alm-combo-option.active { background: var(--selector-selected); color: var(--selector-accent); }
        .alm-selector-nav .alm-combo-option.active::after { content: ""; flex: 0 0 auto; width: 5px; height: 9px; margin: 0 3px 3px auto; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(45deg); }
        .alm-selector-nav .alm-nav-btn { min-height: 32px; padding: 6px 8px; border: 0; border-radius: 5px; background: transparent; color: var(--selector-muted); font-size: 12px; font-weight: 400; line-height: 20px; box-shadow: none; }
        .alm-selector-nav .alm-nav-btn:hover { background: var(--selector-hover); color: var(--selector-text); }
        .alm-selector-nav .alm-nav-btn.active { background: var(--selector-selected); color: var(--selector-accent); }
        .alm-selector-nav .alm-nav-btn b { min-width: 16px; padding: 0; border: 0; border-radius: 0; background: transparent; color: var(--selector-muted); font-size: 10px; font-weight: 400; font-variant-numeric: tabular-nums; }
        .alm-selector-nav .alm-folder-row { min-height: 32px; padding-left: calc(var(--alm-folder-depth, 0) * 12px); }
        .alm-selector-nav .alm-folder-tree,
        .alm-selector-nav .alm-folder-children { display: grid; align-items: stretch; width: 100%; max-width: none; gap: 2px; overflow: visible; }
        .alm-selector-nav .alm-folder-select { width: 100%; max-width: none; }
        .alm-selector-nav .alm-lora-folder-label { gap: 8px; }
        .alm-selector-nav .alm-folder-toggle { width: 20px; height: 30px; color: var(--selector-muted); }
        .alm-selector-nav .alm-folder-select.is-ancestor:not(.active) { background: transparent; color: var(--selector-text); }
        .alm-selector-overlay .alm-selector-body { min-width: 0; min-height: 0; }
        .alm-selector-overlay .alm-page { display: flex; flex-direction: column; height: 100%; }
        .alm-selector-overlay .alm-page > .alm-split,
        .alm-selector-overlay .alm-page > :is(.alm-download-list, .alm-lora-applied-list) { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
        .alm-selector-overlay .alm-selector-toolbar {
            display: flex;
            flex: 0 0 auto;
            flex-direction: column;
            align-items: stretch;
            gap: 14px;
            min-height: 0;
            padding: 20px;
            border-bottom: 1px solid var(--selector-line);
            background: var(--selector-surface);
        }
        .alm-selector-toolbar-top { display: flex; align-items: center; justify-content: space-between; min-width: 0; gap: 16px; }
        .alm-selector-page-heading { min-width: 0; }
        .alm-selector-overlay .alm-selector-toolbar h2 { margin: 0; color: var(--selector-text); font-size: 19px; font-weight: 600; line-height: 26px; }
        .alm-selector-toolbar .alm-lora-local-heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 12px; min-width: 0; }
        .alm-selector-toolbar .alm-lora-folder-context { min-width: 0; gap: 0; }
        .alm-selector-toolbar .alm-lora-folder-context-label { display: none; }
        .alm-selector-toolbar .alm-lora-breadcrumb { max-width: 280px; font-size: 11px; }
        .alm-selector-toolbar .alm-lora-breadcrumb button { color: var(--selector-muted); padding: 2px; }
        .alm-selector-toolbar .alm-lora-breadcrumb button:hover { background: transparent; color: var(--selector-text); }
        .alm-selector-toolbar .alm-lora-breadcrumb button.active { background: transparent; color: var(--selector-accent); }
        .alm-selector-actions { display: flex; align-items: center; flex: 0 0 auto; gap: 8px; }
        .alm-selector-button, .alm-selector-tools > summary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            min-height: 32px;
            margin: 0;
            padding: 0 10px;
            border: 0;
            border-radius: 6px;
            background: var(--selector-field);
            color: var(--selector-text);
            font: inherit;
            font-size: 12px;
            font-weight: 450;
            line-height: 18px;
            white-space: nowrap;
            cursor: pointer;
            list-style: none;
            box-shadow: none;
        }
        .alm-selector-tools > summary::-webkit-details-marker { display: none; }
        .alm-selector-button:hover, .alm-selector-tools > summary:hover { background: var(--selector-hover); color: var(--selector-accent); }
        .alm-selector-button:disabled, .alm-selector-menu button:disabled { opacity: .45; cursor: default; }
        .alm-selector-button.is-icon, .alm-selector-tools > summary.is-icon { width: 32px; padding: 0; }
        .alm-selector-button svg, .alm-selector-tools > summary svg { width: 16px; height: 16px; }
        .alm-selector-tools { position: relative; }
        .alm-selector-tools[open] > summary { background: var(--selector-selected); color: var(--selector-accent); }
        .alm-selector-sort > summary { background: transparent; color: var(--selector-muted); }
        .alm-selector-menu {
            position: absolute;
            z-index: 20;
            top: calc(100% + 7px);
            right: 0;
            min-width: 200px;
            max-width: min(290px, calc(100vw - 100px));
            padding: 6px;
            border-radius: 9px;
            background: var(--selector-menu);
            color: var(--selector-text);
            box-shadow: 0 16px 40px rgba(0, 0, 0, .36);
        }
        .alm-selector-menu button {
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
            min-height: 36px;
            padding: 8px 10px;
            border: 0;
            border-radius: 5px;
            background: transparent;
            color: var(--selector-text);
            font: inherit;
            font-size: 12px;
            font-weight: 400;
            line-height: 18px;
            text-align: left;
            white-space: nowrap;
            cursor: pointer;
        }
        .alm-selector-menu button:hover, .alm-selector-menu button:focus-visible { background: var(--selector-hover); }
        .alm-selector-menu button[aria-checked="true"] { background: var(--selector-selected); color: var(--selector-accent); }
        .alm-selector-menu button[aria-checked="true"]::after { content: ""; width: 5px; height: 9px; margin: 0 3px 3px auto; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(45deg); }
        .alm-selector-search-row { min-width: 0; width: 100%; }
        .alm-selector-search-row .alm-selector-search { position: relative; width: 100%; max-width: none; min-width: 0; margin: 0; }
        .alm-selector-search > .alm-selector-icon { position: absolute; z-index: 1; left: 13px; top: 50%; width: 17px; height: 17px; color: var(--selector-muted); transform: translateY(-50%); pointer-events: none; }
        .alm-selector-overlay .alm-selector-search .alm-search { width: 100%; min-width: 0; height: 42px; min-height: 42px; margin: 0; padding: 10px 42px 10px 40px; border: 1px solid transparent; border-radius: 8px; background: var(--selector-field); color: var(--selector-text); font: inherit; font-size: 12px; font-weight: 400; line-height: 20px; box-shadow: none; }
        .alm-selector-search .alm-search::placeholder { color: var(--selector-muted); opacity: 1; }
        .alm-selector-search .alm-search:hover { border-color: var(--selector-line); }
        .alm-selector-search .alm-search:focus { border-color: var(--selector-accent); outline: 0; }
        .alm-selector-search .alm-selector-search-clear { position: absolute; right: 7px; top: 50%; display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 5px; background: transparent; color: var(--selector-muted); transform: translateY(-50%); cursor: pointer; }
        .alm-selector-search-clear svg { width: 15px; height: 15px; }
        .alm-selector-search-clear:hover { background: var(--selector-hover); color: var(--selector-text); }
        .alm-selector-search .alm-search-spinner { right: 12px; }
        .alm-selector-search [hidden] { display: none !important; }
        .alm-selector-filter-chips { min-width: 0; }
        .alm-selector-filter-chips .alm-active-filters { margin: 0; padding: 0; border: 0; background: transparent; }
        .alm-selector-filter-chips .alm-active-filter-chip { padding: 4px 8px; border: 0; border-radius: 5px; background: var(--selector-selected); color: var(--selector-accent); font-size: 11px; font-weight: 400; }
        .alm-selector-filter-chips .alm-active-filter-chip small { color: inherit; opacity: .75; }
        .alm-selector-filter-chips .alm-active-filter-chip b { font-weight: 500; }
        .alm-selector-total { color: var(--selector-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
        .alm-selector-toolbar .alm-kind-tabs { display: flex; flex-wrap: wrap; align-items: center; gap: 3px; padding: 3px; border: 0; border-radius: 7px; background: var(--selector-rail); }
        .alm-selector-toolbar .alm-kind-tab { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; margin: 0; padding: 0 10px; border: 0; border-radius: 5px; background: transparent; color: var(--selector-muted); font: inherit; font-size: 12px; font-weight: 450; box-shadow: none; }
        .alm-selector-toolbar .alm-kind-tab:hover { background: var(--selector-hover); color: var(--selector-text); }
        .alm-selector-toolbar .alm-kind-tab.active { background: var(--selector-field); color: var(--selector-accent); box-shadow: none; }
        .alm-selector-toolbar .alm-kind-tab b { padding: 0; border: 0; background: transparent; color: inherit; font-size: 10px; font-weight: 400; font-variant-numeric: tabular-nums; }
        .alm-selector-toolbar .alm-kind-tab.active::before, .alm-selector-toolbar .alm-kind-tab.active::after { display: none; }
        .alm-selector-overlay .alm-selector-utility-toolbar { display: flex; flex: 0 0 auto; flex-wrap: wrap; justify-content: space-between; align-items: center; min-height: 80px; padding: 20px; gap: 12px 20px; background: var(--selector-surface); border-bottom: 1px solid var(--selector-line); }
        .alm-selector-utility-toolbar h2 { margin: 0; color: var(--selector-text); font-size: 19px; font-weight: 600; }
        .alm-selector-utility-toolbar button { min-height: 32px; padding: 0 10px; border: 0; border-radius: 6px; background: var(--selector-field); color: var(--selector-text); font: inherit; font-size: 12px; font-weight: 400; }
        .alm-selector-body > .settings { min-height: 0; overflow: hidden; }
        .alm-selector-body > .settings .alm-settings-grid { min-height: 0; overflow-y: auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; }
        .alm-selector-body > .settings .alm-setting-card { background: var(--selector-surface); border-color: var(--selector-line); }
        .alm-selector-body > .settings .alm-input { background: var(--selector-field); color: var(--selector-text); border-color: transparent; border-radius: 6px; font-size: 12px; }
        .alm-selector-body > .settings .alm-secondary { min-height: 32px; padding: 0 10px; background: var(--selector-field); color: var(--selector-text); border: 0; border-radius: 6px; font-size: 12px; font-weight: 400; }
        .alm-selector-footer { display: flex; align-items: center; justify-content: space-between; flex: 0 0 auto; min-height: 34px; padding: 0 16px; border-top: 1px solid var(--selector-line); background: var(--selector-rail); color: var(--selector-muted); }
        .alm-selector-footer > div { display: flex; align-items: center; gap: 20px; }
        .alm-selector-node-status { gap: 7px; padding: 5px 0; color: var(--selector-muted); font-size: 10px; }
        .alm-selector-node-status:hover { color: var(--selector-text); }
        .alm-selector-node-status svg { width: 13px; height: 13px; }
        .alm-selector-node-status b { color: var(--selector-accent); font-size: 10px; font-weight: 500; font-variant-numeric: tabular-nums; }
        .alm-selector-footer .alm-promo-links { gap: 8px; }
        .alm-selector-footer .alm-promo-link { min-height: 26px; height: 26px; padding: 0 4px; border: 0; border-radius: 4px; background: transparent; color: var(--selector-muted); font-size: 10px; box-shadow: none; }
        .alm-selector-footer .alm-promo-link svg { width: 14px; height: 14px; }
        .alm-selector-footer .alm-promo-link:hover { color: var(--selector-text); background: var(--selector-hover); box-shadow: none; transform: none; }
        .alm-selector-escape { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; }
        .alm-selector-escape kbd { padding: 1px 4px; border: 1px solid var(--selector-line); border-radius: 4px; color: var(--selector-muted); font: inherit; }
        .alm-selector-tab:focus-visible, .alm-selector-close:focus-visible, .alm-selector-filter-toggle:focus-visible,
        .alm-selector-reset:focus-visible, .alm-selector-node-status:focus-visible,
        .alm-selector-nav button:focus-visible, .alm-selector-nav input:focus-visible,
        .alm-selector-toolbar :is(button, summary):focus-visible { outline: 2px solid var(--selector-accent); outline-offset: -2px; }
        .alm-selector-nav, .alm-selector-nav .alm-combo-list { scrollbar-width: thin; scrollbar-color: var(--selector-line) transparent; }
        .alm-selector-nav::-webkit-scrollbar, .alm-selector-nav .alm-combo-list::-webkit-scrollbar { width: 5px; height: 5px; }
        .alm-selector-nav ::selection, .alm-selector-toolbar ::selection { background: var(--selector-selected); color: var(--selector-text); }
        .alm-selector-nav input, .alm-selector-toolbar input { caret-color: var(--selector-accent); }
        .alm-selector-body {
            --alm-panel: var(--selector-rail);
            --alm-panel-soft: var(--selector-surface);
            --alm-control: var(--selector-field);
            --alm-border: var(--selector-line);
            --alm-muted: var(--selector-muted);
            --alm-radius: 8px;
            background: var(--selector-rail);
            color: var(--selector-text);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
            font-size: 12px;
            font-weight: 400;
            line-height: 1.5;
        }
        .alm-selector-body [hidden] { display: none !important; }
        .alm-selector-body .alm-split { background: var(--selector-rail); }
        .alm-selector-body .alm-results { padding: 20px; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 184px), 1fr)); grid-auto-rows: max-content !important; scrollbar-gutter: stable; }
        .alm-selector-body .alm-card {
            display: block;
            height: auto !important;
            min-height: 0;
            aspect-ratio: 2 / 3 !important;
            border: 1px solid var(--selector-line);
            border-radius: 9px;
            background: var(--selector-surface);
            box-shadow: none;
            contain: none;
            content-visibility: visible !important;
            transition: border-color .16s ease, background-color .16s ease;
        }
        .alm-selector-body .alm-card:hover { border-color: var(--selector-muted); box-shadow: none; transform: none; }
        .alm-selector-body .alm-card.selected { border-color: var(--selector-accent); background: var(--selector-selected); box-shadow: 0 0 0 1px var(--selector-accent); }
        .alm-selector-body .alm-card .alm-thumb {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            aspect-ratio: auto;
            border-radius: 0;
            clip-path: none;
            background: var(--selector-field);
        }
        .alm-selector-body .alm-card .alm-card-body { position: absolute; inset: auto 0 0; min-height: 0; box-sizing: border-box; gap: 5px; padding: 42px 12px 12px; background: linear-gradient(0deg, rgba(12, 17, 25, .96), rgba(12, 17, 25, .78) 62%, transparent); }
        .alm-selector-body .alm-card-title { order: 0; min-height: 0; color: #f2f5fa; font-size: 13px; font-weight: 550; line-height: 18px; text-shadow: none; overflow-wrap: anywhere; }
        .alm-selector-body :is(.alm-card-creator, .alm-card-meta) { order: 1; color: #b8c4d4; font-size: 10px; font-weight: 400; line-height: 15px; text-shadow: none; }
        .alm-selector-body .alm-card-tags:empty { display: none; }
        .alm-selector-body .alm-card-stat-row { order: 2; gap: 6px; min-height: 24px; margin: 2px 0 0; }
        .alm-selector-body .alm-card-stat-chip { max-width: none; height: 23px; gap: 5px; padding: 0 6px; border: 1px solid rgba(255, 255, 255, .14); border-radius: 5px; background: rgba(255, 255, 255, .1); color: #f4f5f7; font-size: 10px; font-weight: 550; font-variant-numeric: tabular-nums; box-shadow: none; backdrop-filter: none; }
        .alm-selector-body .alm-card-stat-chip svg { width: 12px; height: 12px; color: color-mix(in srgb, var(--alm-accent) 45%, #fff); }
        .alm-selector-body .alm-card-stat-chip.is-likes { background: rgba(151, 96, 116, .17); border-color: rgba(217, 161, 183, .14); }
        .alm-selector-body .alm-card-stat-chip.is-likes svg { color: #d9a1b7; }
        .alm-selector-body .alm-card-stat-chip.is-size { padding: 0; border: 0; background: transparent; color: #b8c4d4; font-size: 9px; font-weight: 400; }
        .alm-selector-body :is(.alm-card-badge, .alm-card-status) { padding: 5px 7px; border: 0; border-radius: 4px; background: var(--selector-menu); color: var(--selector-text); font-size: 10px; font-weight: 500; line-height: 13px; box-shadow: none; backdrop-filter: none; }
        .alm-selector-body .alm-card-status.is-installed { background: #2f9e62; color: #fff; }
        .alm-selector-body .alm-card-status.is-downloading { background: var(--selector-primary); color: #fff; }
        .alm-selector-body .alm-card-badge.is-early-access { display: grid; place-items: center; width: 23px; height: 23px; padding: 0; background: #d97a1e; color: #fff; }
        .alm-selector-body .alm-card-badge.is-early-access svg { width: 13px; height: 13px; stroke-width: 2; }
        .alm-selector-body .alm-early-access { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px 10px; margin: 0; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--selector-warn) 40%, transparent); border-radius: 8px; background: color-mix(in srgb, var(--selector-warn) 10%, var(--selector-surface)); }
        .alm-selector-body .alm-early-access-icon { color: var(--selector-warn); }
        .alm-selector-body .alm-early-access-icon svg { width: 16px; height: 16px; }
        .alm-selector-body .alm-early-access > div { display: grid; gap: 3px; min-width: 0; }
        .alm-selector-body .alm-early-access b { color: var(--selector-warn); font-size: 12px; font-weight: 600; }
        .alm-selector-body .alm-early-access span { color: var(--selector-text); font-size: 11.5px; line-height: 17px; }
        .alm-selector-body .alm-early-access > a { grid-column: 2; display: inline-flex; align-items: center; justify-self: start; min-height: 28px; padding: 0 10px; font-size: 11px; text-decoration: none; }
        .alm-selector-body .alm-card-badge { top: 9px; left: 9px; }
        .alm-selector-body .alm-card-top-badges { top: 9px; left: 9px; }
        .alm-selector-body .alm-card-top-badges .alm-card-badge { position: static; }
        .alm-selector-body .alm-card-tags span { padding: 3px 6px; border: 0; border-radius: 4px; background: color-mix(in srgb, var(--selector-primary) 55%, transparent); color: #fff; font-size: 10px; font-weight: 400; }
        .alm-selector-body .alm-card-tags .installed { background: #2f9e62; font-weight: 500; }
        .alm-selector-body .alm-card-favorite-btn { display: grid; place-items: center; justify-content: center; opacity: 1; transform: none; width: 28px; height: 28px; min-height: 28px; padding: 0; border: 0; border-radius: 5px; background: var(--selector-menu); color: var(--selector-muted); box-shadow: none; backdrop-filter: none; }
        .alm-selector-body .alm-card-favorite-mark > span { display: grid; place-items: center; width: 18px; height: 18px; }
        .alm-selector-body .alm-card-favorite-btn:hover { color: var(--selector-favorite) !important; background: var(--selector-menu) !important; border-color: transparent !important; }
        .alm-selector-body .alm-card-favorite-btn.is-active, .alm-selector-body .alm-card-favorite-btn.is-active:hover { color: #fff !important; background: #e09b17 !important; box-shadow: 0 2px 8px rgba(0, 0, 0, .3); }
        .alm-selector-body .alm-no-image { background: var(--selector-field); color: var(--selector-muted); font-size: 12px; font-weight: 400; }
        .alm-selector-body .alm-skeleton-card::after { display: none; }
        .alm-selector-body .alm-skeleton-badge { top: 9px; left: 9px; width: 56px; height: 23px; background: var(--selector-menu); }
        .alm-selector-body .alm-skeleton-content { position: absolute; inset: auto 0 0; display: grid; gap: 5px; box-sizing: border-box; padding: 42px 12px 12px; background: linear-gradient(0deg, rgba(12, 17, 25, .96), rgba(12, 17, 25, .78) 62%, transparent); }
        .alm-selector-body .alm-skeleton-content :is(.alm-skeleton-line, .alm-skeleton-stats span) { background: rgba(255, 255, 255, .13); }
        .alm-selector-body .alm-skeleton-line { height: 12px; margin: 3px 0; }
        .alm-selector-body .alm-skeleton-line.is-creator { width: 38%; height: 9px; }
        .alm-selector-body .alm-skeleton-stats { align-items: center; gap: 6px; min-height: 24px; margin-top: 2px; }
        .alm-selector-body .alm-skeleton-stats span { width: 52px; height: 23px; }
        .alm-selector-body :is(.alm-skeleton-line, .alm-skeleton-stats span, .alm-skeleton-badge) { border-radius: 4px; }
        .alm-selector-body .alm-media-skeleton { background: var(--selector-field); transition: opacity .32s ease .04s; }
        .alm-selector-body :is(.alm-thumb, .alm-dl-thumb, .alm-applied-thumb):has(.alm-card-media.is-loaded, .alm-no-image) .alm-media-skeleton { opacity: 0; }
        .alm-selector-body .alm-card-media { opacity: 0; transition: opacity .32s ease; }
        .alm-selector-body .alm-card-media.is-loaded { opacity: 1; }
        .alm-selector-body .alm-card-video:not(.alm-card-media) { opacity: 0; transition: opacity .22s ease; }
        .alm-selector-body .alm-card-video.is-loaded { opacity: 1; }
        .alm-selector-body .alm-card.is-entering > :not(.alm-thumb) { animation: almCardIn .36s cubic-bezier(.2,.7,.2,1) var(--alm-enter-delay, 0ms) both; }
        @keyframes almCardIn { from { opacity: 0; } }
        .alm-selector-body .alm-detail { background: var(--selector-surface); border-color: var(--selector-line); box-shadow: none; }
        .alm-selector-body .alm-detail-scroll { padding: 16px 18px 24px; }
        .alm-selector-body .alm-detail-preview { height: clamp(220px, 32vh, 360px); min-height: 0; border: 0; border-radius: 7px; background: var(--selector-rail); box-shadow: none; }
        .alm-selector-body .alm-detail-preview-bg { filter: blur(26px) saturate(1.1) brightness(.5); opacity: .9; }
        .alm-selector-body .alm-detail-preview-nav { width: 30px; height: 34px; border: 0; border-radius: 5px; background: var(--selector-menu); color: var(--selector-text); box-shadow: none; }
        .alm-selector-body .alm-detail-preview-count { border: 0; border-radius: 4px; background: var(--selector-menu); color: var(--selector-text); font-size: 10px; font-weight: 400; }
        .alm-selector-body .alm-detail-head { margin: 14px 0 16px; }
        .alm-selector-body .alm-detail-head h2 { margin: 0; color: var(--selector-text); font-size: 17px; font-weight: 550; line-height: 23px; }
        .alm-selector-body .alm-detail-head p { margin: 7px 0 0; color: var(--selector-muted); font-size: 11px; font-weight: 400; line-height: 17px; }
        .alm-selector-body .alm-detail-head .alm-card-stat-row { margin-top: 12px; }
        .alm-selector-body :is(.alm-detail-head, .alm-dl-model) .alm-card-stat-chip { background: var(--selector-field); border-color: transparent; color: var(--selector-text); }
        .alm-selector-body :is(.alm-detail-head, .alm-dl-model) .alm-card-stat-chip svg { color: var(--selector-accent); }
        .alm-selector-body .alm-detail-title-link:hover h2 { color: var(--selector-accent); }
        .alm-selector-body .alm-external-icon { border: 0; border-radius: 4px; background: transparent; color: var(--selector-muted); }
        .alm-selector-body .alm-detail-match-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0; padding: 12px 0 0; border: 0; border-top: 1px solid var(--selector-line); border-radius: 0; background: transparent; }
        .alm-selector-body .alm-detail-match-row.is-matched { background: transparent; border-color: var(--selector-line); }
        .alm-selector-body .alm-detail-match-row > div { flex: 1 1 auto; min-width: 0; gap: 2px; }
        .alm-selector-body .alm-detail-match-row b { display: flex; align-items: center; gap: 6px; color: var(--selector-text); font-size: 12px; font-weight: 500; }
        .alm-selector-body .alm-detail-match-row b::before { content: ""; flex: 0 0 auto; width: 6px; height: 6px; border-radius: 50%; background: var(--selector-muted); }
        .alm-selector-body .alm-detail-match-row.is-matched b::before { background: var(--selector-good); }
        .alm-selector-body .alm-detail-match-row span { color: var(--selector-muted); font-size: 11px; font-weight: 400; line-height: 16px; white-space: normal; overflow: visible; }
        .alm-selector-body .alm-detail-match-row .alm-secondary { flex: 0 0 auto; min-height: 28px; padding: 0 9px; font-size: 11px; }
        .alm-selector-body .alm-info-list { margin: 0; gap: 0; }
        .alm-selector-body .alm-info-list > div { grid-template-columns: 64px minmax(0, 1fr); align-items: start; gap: 12px; padding: 8px 0; border: 0; font-size: 11px; line-height: 17px; }
        .alm-selector-body .alm-info-list > div:first-child { padding-top: 0; }
        .alm-selector-body .alm-info-list span { color: var(--selector-muted); }
        .alm-selector-body .alm-info-list b { padding: 0; border: 0; border-radius: 0; background: transparent; color: var(--selector-text); font: inherit; text-align: left; overflow-wrap: anywhere; word-break: normal; }
        .alm-selector-body :is(.alm-info-list, .alm-description) a { color: var(--selector-accent); text-decoration-color: var(--selector-line); text-underline-offset: 3px; }
        .alm-selector-body :is(.alm-info-list, .alm-description) a:hover { text-decoration: underline; }
        .alm-selector-body :is(.alm-section-title, .alm-path-title) { margin: 22px 0 10px; color: var(--selector-text); font-size: 12px; font-weight: 600; line-height: 18px; }
        .alm-selector-body .alm-section-head { margin: 22px 0 10px; }
        .alm-selector-body .alm-section-head .alm-section-title { margin: 0; }
        .alm-selector-body .alm-trained { gap: 6px; padding: 0; border: 0; border-radius: 0; background: transparent; color: var(--selector-muted); font-size: 11px; }
        .alm-selector-body .alm-description { margin-top: 0; color: var(--selector-muted); font-size: 12px; line-height: 1.7; overflow-wrap: anywhere; }
        .alm-selector-body .alm-selector-section { margin: 8px 0 0; border-top: 1px solid var(--selector-line); interpolate-size: allow-keywords; }
        .alm-selector-body .alm-selector-section > summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 42px; color: var(--selector-text); font-size: 12px; font-weight: 500; cursor: pointer; list-style: none; }
        .alm-selector-body .alm-selector-section > summary::-webkit-details-marker { display: none; }
        .alm-selector-body .alm-selector-section > summary > svg { flex: 0 0 auto; width: 15px; height: 15px; color: var(--selector-muted); }
        .alm-selector-body .alm-selector-section > summary > span { flex: 1; }
        .alm-selector-body .alm-selector-section > summary::after { content: ""; width: 6px; height: 6px; margin-right: 3px; border-right: 1px solid var(--selector-muted); border-bottom: 1px solid var(--selector-muted); transform: rotate(45deg); transition: transform .21s cubic-bezier(.2,.7,.2,1); }
        .alm-selector-body .alm-selector-section[open] > summary::after { transform: rotate(225deg); }
        .alm-selector-body .alm-selector-section-body { display: grid; gap: 12px; padding: 0 0 14px; }
        .alm-selector-body .alm-selector-section::details-content { block-size: 0; overflow: clip; opacity: 0; transition: block-size .21s cubic-bezier(.2,.7,.2,1), opacity .16s ease, content-visibility .21s allow-discrete; }
        .alm-selector-body .alm-selector-section[open]::details-content { block-size: auto; opacity: 1; }
        @keyframes almSelectorMenuIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
        .alm-selector-overlay .alm-combo.open .alm-combo-popover,
        .alm-selector-tools[open] > .alm-selector-menu,
        .alm-selector-body .alm-path-drawer { animation: almSelectorMenuIn .17s cubic-bezier(.2,.7,.2,1); }
        .alm-selector-overlay .alm-selector-body :where(.alm-primary, .alm-secondary, .alm-danger, .alm-icon-btn, .alm-load-more, .alm-trained button, .alm-copy-all-btn, .alm-alert button) {
            min-height: 34px;
            padding: 0 11px;
            border: 1px solid transparent;
            border-radius: 6px;
            background: var(--selector-field);
            color: var(--selector-text);
            font-family: inherit;
            font-size: 12px;
            font-weight: 450;
            line-height: 18px;
            text-shadow: none;
            box-shadow: none;
            transition: background-color .16s ease, border-color .16s ease, color .16s ease;
        }
        .alm-selector-overlay .alm-selector-body :where(.alm-primary, .alm-secondary, .alm-icon-btn, .alm-load-more, .alm-trained button, .alm-copy-all-btn):hover:not(:disabled) { background: var(--selector-hover); color: var(--selector-text); border-color: var(--selector-line); box-shadow: none; transform: none; filter: none; }
        .alm-selector-body .alm-primary { background: var(--selector-primary); color: #fff; }
        .alm-selector-body .alm-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--selector-primary) 86%, #000); color: #fff; border-color: transparent; }
        .alm-selector-body .alm-danger { background: color-mix(in srgb, var(--alm-danger) 9%, var(--selector-surface)); color: var(--alm-danger); }
        .alm-selector-body .alm-danger:hover:not(:disabled) { background: color-mix(in srgb, var(--alm-danger) 16%, var(--selector-surface)); border-color: transparent; color: var(--alm-danger); }
        .alm-selector-body :is(button, input):disabled { opacity: .45; cursor: default; }
        .alm-selector-body .alm-download-cta { min-height: 38px !important; border-radius: 6px !important; font-size: 12px !important; font-weight: 500 !important; letter-spacing: 0; box-shadow: none; }
        .alm-selector-body .alm-download-cta-icon { background: transparent; }
        .alm-selector-body .alm-trained button { min-height: 28px; padding: 4px 9px; font-size: 11px; }
        .alm-selector-overlay .alm-selector-body .alm-copy-all-btn { display: inline-flex; align-items: center; gap: 5px; min-height: 26px; padding: 0 8px; border-color: color-mix(in srgb, var(--selector-accent) 35%, transparent); background: transparent; color: var(--selector-accent); font-size: 10px; font-weight: 500; }
        .alm-selector-body :is(.alm-input, .alm-combo-control) { min-height: 36px; padding: 8px 10px; border: 1px solid transparent; border-radius: 6px; background: var(--selector-field); color: var(--selector-text); font: inherit; font-size: 12px; line-height: 18px; box-shadow: none; }
        .alm-selector-body :is(.alm-input, .alm-combo-control):hover { border-color: var(--selector-line); }
        .alm-selector-body .alm-input:focus { outline: 0; border-color: var(--selector-accent); box-shadow: none; }
        .alm-selector-body .alm-combo.open .alm-combo-control { border-color: var(--selector-accent); box-shadow: none; }
        .alm-selector-body .alm-combo-popover { padding: 6px; border: 0; border-radius: 8px; background: var(--selector-menu); color: var(--selector-text); box-shadow: 0 12px 30px rgba(0, 0, 0, .3); }
        .alm-selector-body .alm-combo-option { min-height: 32px; padding: 7px 8px; border: 0; border-radius: 4px; background: transparent; color: var(--selector-text); font-size: 12px; font-weight: 400; }
        .alm-selector-body .alm-combo-option:hover, .alm-selector-body .alm-combo-option.is-key-active { background: var(--selector-hover); }
        .alm-selector-body .alm-combo-option.active { background: var(--selector-selected); color: var(--selector-accent); }
        .alm-selector-body :is(.alm-label, .alm-grid2 label, .alm-check) { color: var(--selector-muted); font-size: 11px; font-weight: 400; }
        .alm-selector-body .alm-grid2 { gap: 12px; }
        .alm-selector-body .alm-path-box { margin: 24px 0; padding: 20px 0 0; border: 0; border-top: 1px solid var(--selector-line); border-radius: 0; background: transparent; box-shadow: none; }
        .alm-selector-body .alm-path-title { margin: 0 0 12px; }
        .alm-selector-body .alm-path { padding: 10px; border: 0; border-radius: 6px; background: var(--selector-rail); color: var(--selector-muted); font-size: 11px; font-weight: 400; }
        .alm-selector-body .alm-detail-download-card { margin: 18px 0; padding: 12px; gap: 14px; border: 1px solid var(--selector-line); border-radius: 8px; background: var(--selector-rail); box-shadow: none; }
        .alm-selector-body .alm-detail-download-card .alm-label { display: flex; align-items: center; gap: 7px; color: var(--selector-accent); font-size: 12px; font-weight: 550; }
        .alm-selector-body .alm-detail-download-card .alm-label svg { width: 15px; height: 15px; }
        .alm-selector-body .alm-detail-download-card .alm-path-box { margin: 0; background: transparent; }
        .alm-selector-body .alm-version-pill { min-height: 32px; padding: 6px 9px; border: 1px solid transparent; border-radius: 5px; background: var(--selector-field); color: var(--selector-muted); font-size: 11px; font-weight: 400; }
        .alm-selector-body .alm-version-pill:hover { border-color: var(--selector-line); color: var(--selector-text); }
        .alm-selector-body .alm-version-pill.active { border-color: var(--selector-accent); background: var(--selector-selected); color: var(--selector-accent); }
        .alm-selector-body .alm-version-pill small { background: transparent; color: inherit; font-size: 9px; font-weight: 400; }
        .alm-selector-body .alm-favorite-controls { position: relative; display: flex; flex-direction: row; align-items: center; gap: 4px; margin-top: 20px; padding: 12px 0; border: 0; border-top: 1px solid var(--selector-line); border-bottom: 1px solid var(--selector-line); border-radius: 0; background: transparent; box-shadow: none; }
        .alm-selector-body .alm-favorite-toggle { min-width: 0; flex: 1 1 auto; padding: 0; gap: 10px; border: 0; border-radius: 6px; background: transparent; color: var(--selector-text); transform: none; }
        .alm-selector-body .alm-favorite-toggle:hover { background: var(--selector-hover); transform: none; }
        .alm-selector-body .alm-favorite-toggle-star { width: 30px; height: 30px; border: 0; border-radius: 5px; background: var(--selector-field); color: var(--selector-muted); }
        .alm-selector-body .alm-favorite-toggle.is-active .alm-favorite-toggle-star { background: color-mix(in srgb, var(--selector-favorite) 18%, var(--selector-surface)); color: var(--selector-favorite); }
        .alm-selector-body .alm-favorite-toggle-copy b { font-size: 12px; font-weight: 500; }
        .alm-selector-body .alm-favorite-toggle-copy small { color: var(--selector-muted); font-size: 10px; font-weight: 400; }
        .alm-selector-body .alm-favorite-controls.is-compact { width: 128px; margin: 0; border: 0; padding: 0; gap: 0; border-radius: 6px; background: var(--selector-field); }
        .alm-selector-body .alm-detail-action-hub.is-inline-cta .alm-favorite-controls.is-compact .alm-favorite-toggle { min-height: 38px; width: 96px; padding: 0 9px; gap: 6px; border: 0; border-radius: 6px 0 0 6px; background: transparent; }
        .alm-selector-body .alm-favorite-controls.is-compact .alm-favorite-toggle-copy { width: 52px; }
        .alm-selector-body .alm-detail-action-hub [data-remote-download-state] { display: grid; gap: 10px; min-width: 0; }
        .alm-selector-body .alm-detail-action-hub [data-remote-download-state] > .alm-lora-detail-actions { min-width: 0; margin: 0; gap: 0; }
        .alm-selector-body [data-remote-download-state] .alm-download-cta { min-width: 0; height: 38px; padding: 4px 8px; }
        .alm-selector-body .alm-download-cta-copy { display: grid; min-width: 0; gap: 0; line-height: 14px; text-align: center; }
        .alm-selector-body .alm-download-cta-copy > span { font-size: 11px; }
        .alm-selector-body .alm-download-cta-copy > small { font-size: 10px; line-height: 12px; font-weight: 400; opacity: .85; }
        .alm-selector-body .alm-detail-action-hub.is-inline-cta { align-items: start; }
        .alm-selector-body .alm-detail-action-hub.is-inline-cta > .alm-favorite-controls.is-compact { min-height: 38px; height: 38px; align-self: start; flex-direction: row; background: var(--selector-field); }
        .alm-selector-body .alm-detail-action-hub.is-inline-cta .alm-favorite-toggle { height: 38px; box-sizing: border-box; }
        .alm-selector-body .alm-detail-action-hub .alm-favorite-toggle-star { width: 16px; height: 16px; background: transparent; color: var(--selector-favorite); font-size: 16px; }
        .alm-selector-body .alm-favorite-controls:not(.is-compact) { margin-top: 16px; padding: 12px; border: 1px solid var(--selector-line); border-radius: 8px; background: var(--selector-surface); }
        .alm-selector-body .alm-favorite-controls:not(.is-compact) .alm-favorite-toggle-star { color: var(--selector-favorite); background: color-mix(in srgb, var(--selector-favorite) 12%, var(--selector-surface)); }
        .alm-selector-body .alm-favorite-controls.is-active { border-color: color-mix(in srgb, var(--selector-favorite) 45%, transparent); background: color-mix(in srgb, var(--selector-favorite) 14%, var(--selector-surface)); }
        .alm-selector-body .alm-detail-action-hub.is-inline-cta > .alm-favorite-controls.is-compact.is-active { background: color-mix(in srgb, var(--selector-favorite) 16%, var(--selector-surface)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--selector-favorite) 55%, transparent); }
        .alm-selector-body .alm-favorite-toggle.is-active .alm-favorite-toggle-copy b { color: var(--selector-favorite); font-weight: 600; }
        .alm-selector-body .alm-favorite-controls.is-active .alm-favorite-organize { border-color: color-mix(in srgb, var(--selector-favorite) 35%, transparent); }
        .alm-selector-body .alm-favorite-organize { display: grid; place-items: center; flex: 0 0 32px; width: 32px; height: 32px; min-height: 32px; padding: 0; border: 0; border-radius: 5px; background: transparent; color: var(--selector-muted); transform: none; }
        .alm-selector-body .is-compact .alm-favorite-organize { height: 38px; border-radius: 0 6px 6px 0; border-left: 1px solid var(--selector-line); }
        .alm-selector-body .alm-favorite-organize:hover:not(:disabled), .alm-selector-body .alm-favorite-organize[aria-expanded="true"] { background: var(--selector-hover); color: var(--selector-text); }
        .alm-selector-body .alm-favorite-organize:disabled { opacity: .35; cursor: default; }
        .alm-selector-body .alm-favorite-popover { position: absolute; z-index: 12; top: calc(100% + 7px); right: 0; width: 224px; max-width: calc(100vw - 100px); box-sizing: border-box; padding: 14px; border-radius: 8px; background: var(--selector-menu); box-shadow: 0 8px 24px rgba(0,0,0,.3); animation: almFavoriteMenuIn 170ms cubic-bezier(.16,1,.3,1); }
        .alm-selector-body .alm-favorite-popover[hidden] { display: none; }
        .alm-selector-body .opens-above .alm-favorite-popover { top: auto; bottom: calc(100% + 7px); }
        .alm-selector-body .alm-favorite-popover .alm-favorite-folder-select { display: grid; grid-template-columns: minmax(0,1fr); gap: 10px; padding: 0; border: 0; }
        .alm-selector-body .alm-favorite-popover .alm-favorite-folder-select > span { font-size: 12px; font-weight: 500; color: var(--selector-text); }
        .alm-selector-body .alm-favorite-star { display: block; flex: none; fill: transparent; transition: fill 160ms ease, color 160ms ease; }
        .alm-selector-body :is(.alm-favorite-toggle.is-active, .alm-card-favorite-mark.is-active) .alm-favorite-star { fill: currentColor; animation: almFavoriteSaved 260ms cubic-bezier(.16,1,.3,1); }
        @keyframes almFavoriteSaved { 0% { transform: scale(.8); } 55% { transform: scale(1.15); } 100% { transform: scale(1); } }
        @keyframes almFavoriteMenuIn { from { opacity: .2; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .alm-selector-body .alm-selector-triggers { margin: 16px 0; padding: 12px; border: 1px solid color-mix(in srgb, var(--selector-accent) 30%, transparent); border-radius: 8px; background: var(--selector-selected); }
        .alm-selector-body .alm-selector-triggers .alm-section-head { margin: 0 0 10px; }
        .alm-selector-body .alm-selector-triggers:not(:has(.alm-trained button)) { border-color: var(--selector-line); background: transparent; }
        .alm-selector-body .alm-selector-triggers:not(:has(.alm-trained button)) .alm-section-title { color: var(--selector-muted); }
        .alm-selector-body .alm-selector-triggers .alm-section-title { display: flex; align-items: center; gap: 7px; margin: 0 0 10px; color: var(--selector-accent); }
        .alm-selector-body .alm-selector-triggers .alm-section-head .alm-section-title { margin: 0; }
        .alm-selector-body .alm-selector-triggers .alm-section-title svg { width: 15px; height: 15px; }
        .alm-selector-overlay .alm-selector-body .alm-selector-triggers .alm-trained button { display: inline-flex; align-items: center; gap: 5px; border-color: color-mix(in srgb, var(--selector-accent) 32%, transparent); background: var(--selector-surface); color: var(--selector-accent); font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-weight: 500; }
        .alm-selector-overlay .alm-selector-body .alm-selector-triggers :is(.alm-trained button, .alm-copy-all-btn):hover:not(:disabled) { border-color: transparent; background: var(--selector-primary); color: #fff; }
        .alm-selector-overlay .alm-selector-body .alm-selector-triggers :is(.alm-trained button, .alm-copy-all-btn).is-copied { border-color: transparent; background: color-mix(in srgb, var(--selector-good) 18%, var(--selector-surface)); color: var(--selector-good); }
        .alm-selector-body .alm-selector-triggers .is-copied::before { content: ""; width: 10px; height: 10px; background: currentColor; -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 6.2 5 8.6l4.5-5' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 6.2 5 8.6l4.5-5' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat; }
        .alm-selector-body :is(.alm-detail-installed-bar, .alm-detail-download-progress) { padding: 12px; border: 0; border-radius: 6px; background: var(--selector-rail); box-shadow: none; }
        .alm-selector-body .alm-detail-installed-badge b { font-size: 12px; font-weight: 500; }
        .alm-selector-body .alm-card-status i { box-shadow: none; }
        .alm-selector-body :is(.alm-download-list, .alm-lora-applied-list) { display: block; padding: 20px; }
                .alm-selector-body :is(.alm-empty, .alm-empty-detail, .alm-empty-state) { border: 0; border-radius: 0; background: transparent; color: var(--selector-muted); box-shadow: none; }
        .alm-selector-body :is(.alm-empty-detail, .alm-empty-state)::before { display: none; }
        .alm-selector-body :is(.alm-empty-detail-art, .alm-empty-detail-kicker, .alm-empty-detail-features) { display: none; }
        .alm-selector-body :is(.alm-empty-detail, .alm-empty-state) h2 { color: var(--selector-text); font-size: 16px; font-weight: 550; line-height: 24px; }
        .alm-selector-body :is(.alm-empty-detail, .alm-empty-state) p { color: var(--selector-muted); font-size: 12px; font-weight: 400; line-height: 20px; }
        .alm-selector-body .alm-load-status { color: var(--selector-muted); font-size: 12px; font-weight: 400; }
        .alm-selector-body .alm-setting-card { border: 0; border-radius: 8px; background: var(--selector-surface); box-shadow: none; }
        .alm-selector-body .alm-settings-head h2 { color: var(--selector-text); font-size: 15px; font-weight: 550; }
        .alm-selector-body .alm-settings-head p { color: var(--selector-muted); font-size: 12px; font-weight: 400; }
        .alm-selector-body .alm-root-row { padding: 12px 0; border: 0; border-bottom: 1px solid var(--selector-line); border-radius: 0; background: transparent; }
        .alm-selector-body .alm-check { padding: 8px 0; border: 0; border-radius: 0; background: transparent; }
        .alm-selector-body .alm-settings-footer { padding: 16px 0 0; border: 0; border-top: 1px solid var(--selector-line); border-radius: 0; background: transparent; }
        .alm-selector-body .alm-root-row b { border: 0; background: transparent; color: var(--selector-text); font-size: 11px; font-weight: 400; }
        .alm-selector-body :is(.alm-setting-status, .alm-root-row > span) { font-size: 11px; font-weight: 450; }
        .alm-selector-body input[type="checkbox"] { accent-color: var(--selector-primary); }
        .alm-selector-body :is(button, input, summary, a):focus-visible { outline: 2px solid var(--selector-accent); outline-offset: 2px; box-shadow: none; }
        .alm-selector-body ::selection { background: var(--selector-selected); color: var(--selector-text); }
        .alm-selector-body input { caret-color: var(--selector-accent); }
        .alm-selector-body :is(.alm-results, .alm-detail-scroll, .alm-download-list, .alm-lora-applied-list, .alm-settings-grid) { scrollbar-width: thin; scrollbar-color: var(--selector-line) transparent; }
        .alm-selector-body ::-webkit-scrollbar { display: block; width: 5px; height: 5px; }
        .alm-selector-body ::-webkit-scrollbar-thumb { background: var(--selector-line); border-radius: 4px; }
        .alm-selector-overlay .alm-notification-host .alm-notice { border: 0; border-radius: 7px; background: var(--selector-menu); color: var(--selector-text); font: 400 12px/18px -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; backdrop-filter: none; }
        .alm-selector-body .alm-card:focus-visible { outline: 2px solid var(--selector-accent); outline-offset: 2px; }
        .alm-selector-body .alm-detail.is-loading::before { content: ""; position: absolute; z-index: 9; inset: 0 0 auto; height: 2px; background: linear-gradient(90deg, transparent, var(--selector-accent), transparent) no-repeat; background-size: 40% 100%; animation: almDetailLoading 1s linear infinite; }
        .alm-selector-body .alm-split.is-searching-more::before { content: ""; position: absolute; z-index: 4; grid-column: 1; grid-row: 1; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--selector-accent), transparent) no-repeat; background-size: 40% 100%; animation: almDetailLoading 1s linear infinite; pointer-events: none; }
        @keyframes almDetailLoading { from { background-position: -70% 0; } to { background-position: 170% 0; } }
        .alm-selector-body .alm-detail-dismiss { display: none; }
        .alm-selector-body :is(.alm-detail-stage-media, .alm-detail-thumb img, .alm-detail-preview-bg) { transition: opacity .26s ease; }
        .alm-selector-body :is(.alm-detail-stage-media, .alm-detail-thumb img, .alm-detail-preview-bg):not(.is-loaded) { opacity: 0; }
        .alm-selector-body .alm-detail-preview:not(:has(.alm-detail-stage-media.is-loaded, .alm-no-image))::after,
        .alm-selector-body .alm-detail-skeleton :is(.alm-detail-skeleton-block, .alm-detail-skeleton-chips span, .alm-detail-skeleton-lines span)::after,
        .alm-selector-body :is(.alm-description, .alm-dl-model) .alm-detail-skeleton-lines span::after { content: ""; position: absolute; inset: 0; background: linear-gradient(105deg, transparent 22%, color-mix(in srgb, var(--selector-text) 9%, transparent) 44%, transparent 66%); transform: translateX(-115%); animation: almSkeletonShimmer 1.35s ease-in-out infinite; }
        .alm-selector-body .alm-detail-skeleton .alm-detail-preview { position: relative; overflow: hidden; }
        .alm-selector-body .alm-detail-skeleton-lines { display: grid; gap: 8px; margin: 16px 0; }
        .alm-selector-body .alm-detail-skeleton-lines span, .alm-selector-body .alm-detail-skeleton-chips span, .alm-selector-body .alm-detail-skeleton-block { position: relative; display: block; overflow: hidden; border-radius: 5px; background: var(--selector-field); }
        .alm-selector-body .alm-detail-skeleton-lines span { height: 10px; }
        .alm-selector-body .alm-detail-skeleton-lines span:nth-child(2n) { width: 82%; }
        .alm-selector-body .alm-detail-skeleton-lines span:last-child { width: 56%; }
        .alm-selector-body .alm-detail-skeleton-lines.is-title span:first-child { height: 18px; width: 74%; }
        .alm-selector-body .alm-detail-skeleton-lines.is-title span:last-child { width: 34%; }
        .alm-selector-body .alm-detail-skeleton-chips { display: flex; gap: 6px; }
        .alm-selector-body .alm-detail-skeleton-chips span { width: 52px; height: 22px; }
        .alm-selector-body .alm-detail-skeleton-block { height: 64px; margin-top: 18px; border-radius: 8px; }
        .alm-selector-body .alm-detail-gallery { display: grid; gap: 8px; }
        .alm-selector-body .alm-detail-stage { position: relative; z-index: 2; display: block; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; border-radius: 0; background: transparent; cursor: zoom-in; }
        .alm-selector-body .alm-detail-stage-media { display: block; width: 100%; height: 100%; object-fit: contain; }
        .alm-selector-body .alm-detail-stage:focus-visible { outline-offset: -2px; }
        .alm-selector-body .alm-detail-preview > .alm-no-image { display: grid; place-items: center; height: 100%; }
        @media (hover: hover) {
            .alm-selector-body .alm-detail-preview-nav { opacity: 0; transition: opacity .15s ease; }
            .alm-selector-body .alm-detail-preview:hover .alm-detail-preview-nav, .alm-selector-body .alm-detail-preview-nav:focus-visible { opacity: 1; }
        }
        .alm-selector-body .alm-detail-thumbs { position: relative; display: flex; gap: 6px; padding: 1px; overflow-x: auto; scrollbar-width: none; }
        .alm-selector-body .alm-detail-thumbs::-webkit-scrollbar { display: none; }
        .alm-selector-body .alm-detail-thumb { position: relative; flex: 0 0 46px; width: 46px; height: 46px; margin: 0; padding: 0; border: 1px solid transparent; border-radius: 6px; overflow: hidden; background: var(--selector-field); opacity: .55; cursor: pointer; transition: opacity .15s ease, border-color .15s ease; }
        .alm-selector-body .alm-detail-thumb:hover { opacity: .9; }
        .alm-selector-body .alm-detail-thumb.active { border-color: var(--selector-accent); opacity: 1; }
        .alm-selector-body .alm-detail-thumb:focus-visible { outline-offset: -2px; }
        .alm-selector-body .alm-detail-thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }
        .alm-selector-body .alm-detail-thumb-play { position: absolute; inset: 0; margin: auto; width: 0; height: 0; border-top: 6px solid transparent; border-bottom: 6px solid transparent; border-left: 10px solid #fff; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .6)); }
        .alm-selector-body .alm-detail-head p { overflow-wrap: anywhere; }
        .alm-selector-body .alm-detail-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; }
        .alm-selector-body .alm-detail-meta > :is(.alm-detail-facts, .alm-card-stat-row) { display: contents; }
        .alm-selector-body .alm-detail-facts span { padding: 3px 7px; border-radius: 4px; background: var(--selector-field); color: var(--selector-text); font-size: 10.5px; line-height: 16px; }
        .alm-selector-body .alm-detail-tags { margin: 16px 0; }
        .alm-selector-body .alm-detail-tags .alm-section-title { display: flex; align-items: center; gap: 7px; margin: 0 0 10px; }
        .alm-selector-body .alm-detail-tags .alm-section-title svg { width: 15px; height: 15px; color: var(--selector-muted); }
        .alm-selector-body .alm-detail-tag-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .alm-selector-body .alm-detail-tag-list > * { margin: 0; padding: 2px 9px; border: 1px solid var(--selector-line); border-radius: 999px; background: transparent; color: var(--selector-muted); font: inherit; font-size: 11px; line-height: 18px; }
        .alm-selector-body .alm-detail-tag-list > button { cursor: pointer; }
        .alm-selector-body .alm-detail-tag-list > button:hover { border-color: var(--selector-accent); color: var(--selector-accent); }
        .alm-selector-body .alm-detail-local-cta { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 38px; }
        .alm-selector-body .alm-detail-local-cta svg { width: 16px; height: 16px; }
        .alm-selector-body .alm-detail-danger-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 12px; border-top: 1px solid var(--selector-line); }
        .alm-selector-body .alm-detail-danger-row > span { display: grid; gap: 2px; min-width: 0; }
        .alm-selector-body .alm-detail-danger-row b { color: var(--selector-text); font-size: 12px; font-weight: 500; }
        .alm-selector-body .alm-detail-danger-row small { color: var(--selector-muted); font-size: 10px; }
        .alm-selector-body .alm-detail-file-actions { display: flex; gap: 8px; }
        .alm-selector-body .alm-detail-file-actions > button { flex: 1 1 0; }
        .alm-lightbox { position: absolute; z-index: 60; inset: 0; display: grid; grid-template-rows: minmax(0, 1fr) auto; background: rgba(6, 9, 14, .94); color: #dbe2ec; font: 400 12px/18px -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; animation: almLightboxIn .16s ease; }
        @keyframes almLightboxIn { from { opacity: 0; } to { opacity: 1; } }
        .alm-lightbox-stage { display: flex; align-items: center; justify-content: center; min-height: 0; padding: 28px 76px 8px; overflow: hidden; }
        .alm-lightbox-stage > :is(img, video) { width: auto; height: auto; max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 6px; box-shadow: 0 24px 64px rgba(0, 0, 0, .55); }
        .alm-lightbox-bar { display: flex; align-items: center; gap: 16px; min-width: 0; padding: 10px 20px 16px; }
        .alm-lightbox-title { flex: 1 1 auto; min-width: 0; overflow: hidden; color: #f2f5fa; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
        .alm-lightbox-count { color: #9aa6b6; font-variant-numeric: tabular-nums; }
        .alm-lightbox-original { color: color-mix(in srgb, var(--alm-accent) 50%, #fff); text-decoration: none; white-space: nowrap; }
        .alm-lightbox-original:hover { text-decoration: underline; }
        .alm-lightbox-close, .alm-lightbox-nav { display: grid; place-items: center; margin: 0; padding: 0; border: 0; border-radius: 7px; background: rgba(255, 255, 255, .08); color: #fff; cursor: pointer; }
        .alm-lightbox-close { flex: 0 0 auto; width: 34px; height: 34px; }
        .alm-lightbox-close svg { width: 18px; height: 18px; }
        .alm-lightbox-nav { position: absolute; top: calc(50% - 46px); width: 46px; height: 60px; font-size: 30px; line-height: 1; }
        .alm-lightbox-nav.prev { left: 16px; }
        .alm-lightbox-nav.next { right: 16px; }
        .alm-lightbox :is(.alm-lightbox-close, .alm-lightbox-nav):hover { background: rgba(255, 255, 255, .16); }
        .alm-lightbox :is(button, a):focus-visible { outline: 2px solid color-mix(in srgb, var(--alm-accent) 50%, #fff); outline-offset: 2px; }
        .alm-lightbox .alm-no-image { color: #9aa6b6; font-size: 13px; }
        .alm-selector-overlay .alm-notice-action { margin-left: 6px; padding: 3px 9px; border: 0; border-radius: 5px; background: var(--selector-selected); color: var(--selector-accent); font: inherit; font-weight: 600; cursor: pointer; }
        .alm-selector-overlay .alm-notice-action:hover { background: var(--selector-hover); }
        .alm-selector-body :is(.alm-dl-thumb, .alm-applied-thumb) { position: relative; overflow: hidden; border-radius: 6px; background: var(--selector-field); }
        .alm-selector-body :is(.alm-dl-thumb, .alm-applied-thumb) > :is(img, video, .alm-no-image, .alm-media-skeleton) { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .alm-selector-body :is(.alm-dl-thumb, .alm-applied-thumb) .alm-no-image { display: grid; place-items: center; padding: 2px; font-size: 9px; line-height: 1.2; text-align: center; }
        .alm-dl-heading { display: grid; gap: 4px; min-width: 0; }
        .alm-dl-heading > span { color: var(--selector-muted); font-size: 12px; }
        :is(.alm-dl-toolbar-actions, .alm-applied-toolbar-actions) { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
        .alm-selector-body .alm-dl-group { margin: 0 0 22px; }
        .alm-selector-body .alm-dl-group > h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; color: var(--selector-muted); font-size: 11px; font-weight: 500; }
        .alm-selector-body .alm-dl-group > h3 b { min-width: 18px; padding: 0 6px; border-radius: 9px; background: var(--selector-field); color: var(--selector-text); font-size: 10px; font-weight: 500; line-height: 18px; text-align: center; }
        .alm-selector-body .alm-dl-rows { display: grid; gap: 8px; }
        .alm-selector-body .alm-dl-row { border: 1px solid var(--selector-line); border-radius: 8px; background: var(--selector-surface); transition: border-color .15s ease; }
        .alm-selector-body .alm-dl-row:hover { border-color: color-mix(in srgb, var(--selector-muted) 50%, transparent); }
        .alm-selector-body .alm-dl-row.is-open { border-color: color-mix(in srgb, var(--selector-accent) 45%, transparent); }
        .alm-selector-body .alm-dl-row-head { display: grid; grid-template-columns: 48px minmax(0, 1fr) 84px 156px 28px; align-items: center; gap: 14px; padding: 10px 12px; cursor: pointer; }
        .alm-selector-body .alm-dl-thumb { width: 48px; height: 48px; }
        .alm-selector-body .alm-dl-main { display: grid; gap: 6px; min-width: 0; }
        .alm-selector-body .alm-dl-status { justify-self: start; padding: 3px 8px; border-radius: 4px; background: var(--selector-field); color: var(--selector-muted); font-size: 11px; font-weight: 500; line-height: 16px; white-space: nowrap; }
        .alm-selector-body .alm-dl-actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; min-width: 0; }
        .alm-selector-body .alm-dl-expand { display: grid; place-items: center; width: 28px; height: 28px; margin: 0; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--selector-muted); cursor: pointer; }
        .alm-selector-body .alm-dl-expand:hover { background: var(--selector-hover); color: var(--selector-text); }
        .alm-selector-body .alm-dl-expand svg { width: 16px; height: 16px; transition: transform .2s cubic-bezier(.2,.7,.2,1); }
        .alm-selector-body .alm-dl-row.is-open .alm-dl-expand svg { transform: rotate(180deg); }
        .alm-selector-body .alm-dl-details { display: grid; grid-template-rows: 0fr; visibility: hidden; transition: grid-template-rows .22s cubic-bezier(.2,.7,.2,1), visibility 0s linear .22s; }
        .alm-selector-body .alm-dl-row.is-open .alm-dl-details { grid-template-rows: 1fr; visibility: visible; transition: grid-template-rows .22s cubic-bezier(.2,.7,.2,1); }
        .alm-selector-body .alm-dl-details > div { min-height: 0; overflow: hidden; }
        .alm-selector-body .alm-dl-details-body { display: grid; grid-template-columns: 280px minmax(0, 1fr); align-items: start; gap: 20px; margin: 0 12px; padding: 14px 0 16px; border-top: 1px solid var(--selector-line); }
        .alm-selector-body .alm-dl-gallery .alm-detail-preview { position: relative; height: clamp(240px, 34vh, 360px); overflow: hidden; }
        .alm-selector-body .alm-dl-gallery [aria-busy] .alm-detail-thumb { opacity: 1; cursor: default; }
        .alm-selector-body .alm-dl-info { display: grid; align-content: start; gap: 14px; min-width: 0; }
        .alm-selector-body .alm-dl-model { display: grid; gap: 12px; padding-top: 12px; border-top: 1px solid var(--selector-line); }
        .alm-selector-body .alm-dl-model :is(.alm-selector-triggers, .alm-detail-tags, .alm-detail-skeleton-lines) { margin: 0; }
        .alm-selector-body .alm-dl-model-stats { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: var(--selector-muted); font-size: 11px; }
        .alm-selector-body .alm-dl-model-stats .alm-card-stat-row { margin: 0; }
        .alm-selector-body .alm-dl-description { display: -webkit-box; margin: 0; overflow: hidden; color: var(--selector-muted); font-size: 12px; line-height: 1.65; white-space: pre-line; -webkit-box-orient: vertical; -webkit-line-clamp: 4; }
        .alm-selector-body .alm-dl-links { display: flex; flex-wrap: wrap; gap: 8px; }
        .alm-selector-body .alm-dl-links > * { display: inline-flex; align-items: center; gap: 6px; text-decoration: none; }
        .alm-selector-body .alm-dl-links svg { width: 15px; height: 15px; }
        .alm-selector-body .alm-dl-facts { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); grid-auto-flow: dense; gap: 10px 24px; margin: 0; }
        .alm-selector-body .alm-dl-facts > div { display: grid; gap: 3px; min-width: 0; }
        .alm-selector-body .alm-dl-facts > div:has(.is-path) { grid-column: 1 / -1; }
        .alm-selector-body .alm-dl-facts dt { color: var(--selector-muted); font-size: 10.5px; }
        .alm-selector-body .alm-dl-facts dd { margin: 0; color: var(--selector-text); font-size: 12px; line-height: 18px; overflow-wrap: anywhere; }
        .alm-selector-body .alm-dl-facts dd a { color: var(--selector-accent); text-decoration: none; }
        .alm-selector-body .alm-dl-facts dd a:hover { text-decoration: underline; }
        .alm-selector-body .alm-dl-facts .is-path { font: 11px/18px ui-monospace, "Cascadia Mono", Consolas, monospace; user-select: text; }
        .alm-selector-body .alm-dl-reason { display: grid; gap: 4px; padding: 10px 12px; border-left: 3px solid var(--alm-danger); border-radius: 6px; background: color-mix(in srgb, var(--alm-danger) 9%, var(--selector-surface)); }
        .alm-selector-body .alm-dl-reason > b { color: var(--alm-danger); font-size: 12px; font-weight: 600; }
        .alm-selector-body .alm-dl-reason > span { color: var(--selector-text); font-size: 12px; line-height: 18px; }
        .alm-selector-body .alm-dl-reason > code { color: var(--selector-muted); font: 10.5px/16px ui-monospace, "Cascadia Mono", Consolas, monospace; overflow-wrap: anywhere; }
        .alm-selector-body .alm-dl-reason > a { display: inline-flex; align-items: center; justify-self: start; min-height: 30px; margin-top: 4px; text-decoration: none; }
        .alm-selector-body .alm-dl-row.is-new { animation: almRowIn .32s cubic-bezier(.2,.7,.2,1); }
        .alm-selector-body .alm-dl-row.is-changed { animation: almRowFlash .9s ease; }
        @keyframes almRowIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
        @keyframes almRowFlash { from { background: var(--selector-selected); } to { background: var(--selector-surface); } }
        .alm-selector-body .alm-dl-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .alm-selector-body .alm-dl-head > b { min-width: 0; overflow: hidden; color: var(--selector-text); font-size: 13px; font-weight: 550; text-overflow: ellipsis; white-space: nowrap; }
        .alm-selector-body .alm-dl-chip { flex: 0 0 auto; padding: 1px 6px; border-radius: 4px; background: var(--selector-field); color: var(--selector-muted); font-size: 10px; }
        .alm-selector-body .is-downloading .alm-dl-status { background: var(--selector-selected); color: var(--selector-accent); }
        .alm-selector-body .is-completed .alm-dl-status { background: color-mix(in srgb, var(--selector-good) 15%, transparent); color: var(--selector-good); }
        .alm-selector-body .is-failed .alm-dl-status { background: color-mix(in srgb, var(--alm-danger) 14%, transparent); color: var(--alm-danger); }
        .alm-selector-body .alm-dl-bar { position: relative; height: 4px; overflow: hidden; border-radius: 2px; background: var(--selector-field); }
        .alm-selector-body .alm-dl-bar > span { display: block; height: 100%; border-radius: inherit; background: var(--selector-accent); transition: width .6s linear; }
        .alm-selector-body .alm-dl-bar.is-indeterminate > span { width: 35% !important; animation: almBarSlide 1.1s ease-in-out infinite; }
        @keyframes almBarSlide { from { transform: translateX(-100%); } to { transform: translateX(290%); } }
        .alm-selector-body .alm-dl-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; color: var(--selector-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
        .alm-selector-body .alm-dl-meta b { color: var(--selector-text); font-weight: 550; }
        .alm-selector-body .alm-dl-meta i { font-style: normal; opacity: .5; }
        .alm-selector-body .alm-dl-meta .is-error { color: var(--alm-danger); overflow-wrap: anywhere; }
        .alm-selector-body .alm-dl-actions :is(.alm-primary, .alm-secondary) { min-height: 30px; padding: 0 10px; font-size: 11px; }
        .alm-selector-body .alm-dl-remove { display: grid; place-items: center; width: 30px; height: 30px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--selector-muted); cursor: pointer; opacity: 0; transition: opacity .15s ease, background-color .15s ease; }
        .alm-selector-body .alm-dl-row:hover .alm-dl-remove, .alm-selector-body .alm-dl-remove:focus-visible { opacity: 1; }
        .alm-selector-body .alm-dl-remove:hover { background: var(--selector-hover); color: var(--selector-text); }
        .alm-selector-body .alm-dl-remove svg { width: 14px; height: 14px; }
        .alm-selector-body .alm-dl-inline { display: grid; gap: 7px; }
        .alm-selector-body .alm-dl-inline-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; min-width: 0; }
        .alm-selector-body .alm-dl-inline-head > b { flex: 0 0 auto; color: var(--selector-text); font-size: 12px; font-weight: 500; }
        .alm-selector-body .alm-dl-inline .alm-dl-meta { justify-content: flex-end; }
        .alm-applied-note { color: var(--selector-muted); font-size: 11px; }
        .alm-selector-body .alm-applied-rows { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
        .alm-selector-body .alm-applied-row { display: grid; grid-template-columns: 24px 20px 48px minmax(0, 1fr) minmax(160px, 240px) auto auto auto; align-items: center; gap: 12px; padding: 8px 10px 8px 6px; border: 1px solid var(--selector-line); border-radius: 8px; background: var(--selector-surface); transition: transform .18s cubic-bezier(.2,.7,.2,1), border-color .15s ease, background-color .15s ease; }
        .alm-selector-body .alm-applied-row:hover { border-color: color-mix(in srgb, var(--selector-muted) 55%, transparent); }
        .alm-selector-body .alm-applied-row.is-disabled :is(.alm-applied-order, .alm-applied-thumb, .alm-applied-info, .alm-applied-strength) { opacity: .42; }
        .alm-selector-body .alm-applied-row.is-dragging { position: relative; z-index: 3; transition: none; border-color: var(--selector-accent); background: var(--selector-selected); box-shadow: 0 12px 30px rgba(0, 0, 0, .35); }
        .alm-selector-body .alm-applied-handle { display: grid; place-items: center; width: 24px; height: 36px; padding: 0; border: 0; border-radius: 5px; background: transparent; color: var(--selector-muted); cursor: grab; touch-action: none; }
        .alm-selector-body .alm-applied-handle:hover { background: var(--selector-hover); color: var(--selector-text); }
        .alm-selector-body .alm-applied-row.is-dragging .alm-applied-handle { cursor: grabbing; }
        .alm-selector-body .alm-applied-order { color: var(--selector-muted); font-size: 11px; font-variant-numeric: tabular-nums; text-align: center; }
        .alm-selector-body .alm-applied-thumb { width: 48px; height: 48px; }
        .alm-selector-body .alm-applied-info { display: grid; gap: 3px; min-width: 0; }
        .alm-selector-body .alm-applied-name { justify-self: start; max-width: 100%; margin: 0; padding: 0; overflow: hidden; border: 0; background: transparent; color: var(--selector-text); font: inherit; font-size: 13px; font-weight: 550; text-align: left; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
        .alm-selector-body .alm-applied-name:hover:not(:disabled) { color: var(--selector-accent); }
        .alm-selector-body .alm-applied-name:disabled { cursor: default; opacity: 1; }
        .alm-selector-body .alm-applied-meta { display: flex; align-items: center; gap: 6px; min-width: 0; color: var(--selector-muted); font-size: 11px; }
        .alm-selector-body .alm-applied-meta > i { flex: 0 0 auto; padding: 1px 6px; border-radius: 4px; background: var(--selector-field); font-size: 10px; font-style: normal; }
        .alm-selector-body .alm-applied-meta > i.is-warning { background: color-mix(in srgb, var(--selector-warn) 15%, transparent); color: var(--selector-warn); }
        .alm-selector-body .alm-applied-meta > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .alm-selector-body .alm-applied-strength { display: grid; grid-template-columns: minmax(0, 1fr) 64px; align-items: center; gap: 8px; }
        .alm-selector-body .alm-applied-strength input[type="number"] { min-height: 30px; padding: 4px 6px; font-variant-numeric: tabular-nums; text-align: right; }
        .alm-selector-body .alm-applied-strength input[type="range"] {
            --alm-fill-a: calc(7px + (100% - 14px) * var(--alm-fill-from, 0));
            --alm-fill-b: calc(7px + (100% - 14px) * var(--alm-fill-to, 0));
            --alm-track: linear-gradient(to right, var(--selector-field) var(--alm-fill-a), var(--selector-accent) var(--alm-fill-a), var(--selector-accent) var(--alm-fill-b), var(--selector-field) var(--alm-fill-b));
            min-width: 0; height: 20px; margin: 0; padding: 0; background: linear-gradient(var(--selector-line), var(--selector-line)) no-repeat; background-size: 1px 10px;
            background-position: calc(7px + (100% - 14px) * var(--alm-zero, .5)) center; appearance: none; -webkit-appearance: none; cursor: pointer;
        }
        .alm-selector-body .alm-applied-strength input[type="range"]::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: var(--alm-track); }
        .alm-selector-body .alm-applied-strength input[type="range"]::-moz-range-track { height: 4px; border-radius: 2px; background: var(--alm-track); }
        .alm-selector-body .alm-applied-strength input[type="range"]::-webkit-slider-thumb { width: 14px; height: 14px; margin-top: -5px; border: 0; border-radius: 50%; background: #fff; box-shadow: 0 0 0 3px color-mix(in srgb, var(--selector-accent) 40%, transparent), 0 1px 3px rgba(0, 0, 0, .45); appearance: none; -webkit-appearance: none; transition: transform .12s ease; }
        .alm-selector-body .alm-applied-strength input[type="range"]::-moz-range-thumb { width: 14px; height: 14px; border: 0; border-radius: 50%; background: #fff; box-shadow: 0 0 0 3px color-mix(in srgb, var(--selector-accent) 40%, transparent), 0 1px 3px rgba(0, 0, 0, .45); }
        .alm-selector-body .alm-applied-strength input[type="range"]:active::-webkit-slider-thumb { transform: scale(1.15); }
        .alm-selector-body .alm-applied-words { display: inline-flex; align-items: center; gap: 4px; min-height: 30px; margin: 0; padding: 0 8px; border: 0; border-radius: 6px; background: var(--selector-field); color: var(--selector-muted); font: inherit; font-size: 11px; cursor: pointer; }
        .alm-selector-body .alm-applied-words svg { width: 13px; height: 13px; }
        .alm-selector-body .alm-applied-words:not(:disabled) { background: var(--selector-selected); color: var(--selector-accent); font-weight: 500; }
        .alm-selector-body .alm-applied-words:hover:not(:disabled) { background: var(--selector-primary); color: #fff; }
        .alm-selector-body .alm-applied-toggle { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 82px; min-height: 30px; margin: 0; padding: 0 10px; border: 1px solid var(--selector-line); border-radius: 6px; background: transparent; color: var(--selector-muted); font: inherit; font-size: 11px; font-weight: 500; cursor: pointer; transition: background-color .15s ease, border-color .15s ease, color .15s ease; }
        .alm-selector-body .alm-applied-toggle > i { width: 12px; height: 12px; box-sizing: border-box; border: 1.5px solid currentColor; border-radius: 50%; }
        .alm-selector-body .alm-applied-toggle:hover { border-color: var(--selector-muted); color: var(--selector-text); }
        .alm-selector-body .alm-applied-toggle.is-on { border-color: transparent; background: color-mix(in srgb, var(--selector-good) 18%, transparent); color: var(--selector-good); }
        .alm-selector-body .alm-applied-toggle.is-on > i { border: 0; background: currentColor; -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 6.2 5 8.6l4.5-5' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 6.2 5 8.6l4.5-5' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat; }
        .alm-selector-body .alm-applied-toggle.is-on:hover { background: color-mix(in srgb, var(--selector-good) 26%, transparent); }
        .alm-selector-body .alm-applied-remove { display: grid; place-items: center; width: 30px; height: 30px; margin: 0; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--selector-muted); cursor: pointer; }
        .alm-selector-body .alm-applied-remove:hover { background: color-mix(in srgb, var(--alm-danger) 14%, transparent); color: var(--alm-danger); }
        .alm-selector-body .alm-applied-remove svg { width: 15px; height: 15px; }
        @media (hover: none) { .alm-selector-body .alm-dl-remove { opacity: 1; } }
        @media (max-width: 900px) {
            .alm-selector-body .alm-applied-row { grid-template-columns: 24px 48px minmax(0, 1fr) auto auto auto; }
            .alm-selector-body .alm-applied-order { display: none; }
            .alm-selector-body .alm-applied-strength { grid-column: 2 / -1; grid-row: 2; }
            .alm-selector-body .alm-dl-row-head { grid-template-columns: 44px minmax(0, 1fr) auto 28px; }
            .alm-selector-body .alm-dl-thumb { width: 44px; height: 44px; }
            .alm-selector-body .alm-dl-actions { grid-column: 2 / -1; grid-row: 2; }
            .alm-selector-body .alm-dl-details-body { grid-template-columns: minmax(0, 1fr); }
        }
        @media (max-width: 980px) {
            .alm-selector-body .alm-split.has-detail { display: grid; grid-template-columns: minmax(0, 1fr); overflow: hidden; }
            .alm-selector-body .alm-split.has-detail > .alm-results { height: 100%; overflow-y: auto; }
            .alm-selector-body .alm-split.has-detail > .alm-detail { position: absolute; z-index: 5; inset: 0 0 0 auto; width: min(420px, 100%); height: 100%; overflow: hidden; border-left: 1px solid var(--selector-line); box-shadow: -18px 0 40px rgba(0, 0, 0, .35); transform: translateX(100%); visibility: hidden; transition: transform .22s cubic-bezier(.2,.7,.2,1), visibility 0s linear .22s; }
            .alm-selector-body .alm-split.has-detail.is-detail-open > .alm-detail { transform: none; visibility: visible; transition: transform .22s cubic-bezier(.2,.7,.2,1); }
            .alm-selector-body .alm-split.has-detail .alm-detail-scroll { height: 100%; overflow-y: auto; }
            .alm-selector-body .alm-detail-dismiss { position: absolute; z-index: 10; top: 22px; right: 24px; display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 6px; background: var(--selector-menu); color: var(--selector-text); box-shadow: 0 4px 14px rgba(0, 0, 0, .3); cursor: pointer; }
            .alm-selector-body .alm-detail-dismiss svg { width: 16px; height: 16px; }
            .alm-lightbox-stage { padding: 20px 16px 8px; }
            .alm-lightbox-nav { top: auto; bottom: 64px; height: 46px; }
        }
        @media (max-width: 720px) {
            .alm-selector-body .alm-results { padding: 14px; gap: 12px; }
            .alm-selector-body :is(.alm-card .alm-card-body, .alm-skeleton-content) { min-height: 0; padding: 34px 10px 10px; }
            .alm-selector-body .alm-detail-scroll { padding: 16px; }
            .alm-selector-body :is(.alm-download-list, .alm-lora-applied-list) { padding: 14px; }
        }
        @media (prefers-reduced-motion: reduce) {
            .alm-selector-body *, .alm-selector-body *::before, .alm-selector-body *::after,
            .alm-selector-body .alm-selector-section::details-content,
            .alm-selector-overlay .alm-combo-popover, .alm-selector-tools > .alm-selector-menu,
            .alm-selector-overlay .alm-notice { transition: none !important; animation: none !important; }
        }
        @media (max-width: 1179px) {
            .alm-selector-overlay .alm-selector-layout.has-filters.filters-open { grid-template-columns: minmax(0, 1fr); }
            .alm-selector-overlay .has-filters.filters-open > .alm-selector-nav { position: absolute; z-index: 3; inset: 0 auto 0 0; width: 248px; max-width: calc(100% - 40px); box-sizing: border-box; box-shadow: 12px 0 30px rgba(0, 0, 0, .25); }
            .alm-selector-overlay .has-filters.filters-open > .alm-selector-filter-backdrop { position: absolute; z-index: 2; inset: 0; display: block; border: 0; padding: 0; background: rgba(0, 0, 0, .4); cursor: pointer; }
        }
        @media (max-width: 720px) {
            .alm-selector-overlay .alm-selector-shell { width: 100vw; height: 100dvh; max-height: none; border-radius: 0; }
            .alm-selector-overlay .alm-selector-topbar { min-height: 54px; padding: 10px 14px; }
            .alm-selector-topbar .alm-topbar-actions { gap: 6px; }
            .alm-selector-filter-toggle { width: 32px; padding: 0; }
            .alm-selector-filter-toggle > span { display: none; }
            .alm-selector-workspace { grid-template-columns: 60px minmax(0, 1fr); }
            .alm-selector-tabs { padding: 10px 5px; gap: 6px; }
            .alm-selector-tab { min-height: 62px; padding: 9px 2px; font-size: 9px; line-height: 13px; }
            .alm-selector-tab > svg { width: 19px; height: 19px; }
            .alm-selector-tab b { font-size: 8px; right: 0; }
            .alm-selector-overlay .alm-selector-toolbar { padding: 16px 14px; gap: 12px; }
            .alm-selector-overlay .alm-selector-toolbar h2 { font-size: 17px; }
            .alm-selector-toolbar-top { gap: 10px; }
            .alm-selector-toolbar .alm-lora-local-heading { flex-direction: column; gap: 3px; }
            .alm-selector-toolbar .alm-lora-breadcrumb { max-width: 150px; }
            .alm-selector-button { min-height: 30px; padding: 0 8px; font-size: 11px; }
            .alm-selector-toolbar .alm-kind-tab { padding: 0 7px; font-size: 11px; }
            .alm-selector-sort > summary { max-width: 130px; gap: 4px; padding: 0 4px; font-size: 11px; }
            .alm-selector-menu { min-width: 180px; }
            .alm-selector-footer { padding: 0 12px; }
            .alm-selector-footer > div { gap: 8px; }
            .alm-selector-escape { display: none; }
        }
        @media (prefers-reduced-motion: reduce) { .alm-selector-tab { transition: none; } }
    `;
    document.head.appendChild(style);
}
