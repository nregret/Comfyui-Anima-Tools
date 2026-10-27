/**
 * Shared frontend primitives for Anima visual selectors.
 *
 * This module contains no selector business state. It owns the selector
 * stylesheet, icons and small DOM helpers used by anima_gallery_selector.js.
 */

export function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.innerText = text;
    return el;
}

function fallbackCopy(text, callback) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    callback?.();
}

export function copyText(text, callback) {
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => callback?.())
            .catch(() => fallbackCopy(text, callback));
        return;
    }
    fallbackCopy(text, callback);
}

export function debounce(fn, ms) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

export function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }[character]));
}

export function splitPromptTokens(value) {
    if (Array.isArray(value)) return value.flatMap(splitPromptTokens);
    return String(value || "")
        .split(",")
        .map(part => part.replace(/^_raw_:/, "").trim())
        .filter(Boolean);
}

export function normalizePromptToken(value) {
    return String(value || "").replace(/^_raw_:/, "").trim().toLowerCase();
}

export function shuffleInPlace(items) {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}

export function formatCount(value) {
    const number = Number(value) || 0;
    if (number >= 1000) return `${(number / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return String(number);
}

const ICON_PATHS = {
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    star: '<path class="anima-sel-star-path" d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
    applied: '<path d="M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.7 1.6-1.5 0-.4-.2-.8-.4-1.1-.3-.3-.4-.6-.4-1 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.4-4-7.9-9-7.9Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7.2" r="1"/><circle cx="15.2" cy="7.8" r="1"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    shirt: '<path d="M8.5 3 3 6l2 4.5 2.2-1V21h9.6V9.5l2.2 1L21 6l-5.5-3c-.6 1.5-1.9 2.4-3.5 2.4S9.1 4.5 8.5 3Z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    pose: '<circle cx="12" cy="4.5" r="2"/><path d="m5 9 7 1 7-1M12 10v5l-3.5 6M12 15l3.5 6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    chevron: '<path d="m8 10 4 4 4-4"/>',
    first: '<path d="m17 6-6 6 6 6M7 6v12"/>',
    prev: '<path d="m15 6-6 6 6 6"/>',
    next: '<path d="m9 6 6 6-6 6"/>',
    last: '<path d="m7 6 6 6-6 6M17 6v12"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    folder: '<path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    tag: '<path d="M20 13 13 20a2 2 0 0 1-2.8 0L3 12.8V3h9.8l7.2 7.2a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/><path d="M14 3v6h6M8 13h8M8 17h6"/>',
    language: '<path d="M3 5h12M9 3v2M5 9c1.5 3 4 5 7 6M13 5c-1 4-4 8-9 10"/><path d="m13 21 4-9 4 9M14.5 18h5"/>',
    sort: '<path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3"/>',
};

export function selectorIcon(name) {
    if (name === "github") {
        return '<svg class="anima-sel-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.53 2.87 8.37 6.84 9.72.5.1.68-.22.68-.49v-1.88c-2.78.62-3.37-1.22-3.37-1.22-.45-1.19-1.11-1.51-1.11-1.51-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.98c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9v2.8c0 .27.18.59.69.49A10.13 10.13 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z"/></svg>';
    }
    return `<svg class="anima-sel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
}

export function showToast(host, message, { tone = "" } = {}) {
    const notice = createEl("div", `anima-sel-toast${tone ? ` is-${tone}` : ""}`, message);
    notice.setAttribute("role", "status");
    host.appendChild(notice);
    setTimeout(() => {
        notice.classList.add("is-leaving");
        setTimeout(() => notice.remove(), 220);
    }, 1600);
    return notice;
}

/**
 * Secondary dialog rendered inside the selector shell.
 * onConfirm receives the field values and may return false to keep the dialog open.
 */
export function openFormDialog(host, {
    title,
    message = "",
    fields = [],
    confirmText,
    cancelText,
    danger = false,
    onConfirm,
}) {
    const dialog = createEl("div", "anima-sel-dialog");
    dialog.innerHTML = `
        <form class="anima-sel-dialog-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
            <h3>${escapeHtml(title)}</h3>
            ${message ? `<p>${escapeHtml(message)}</p>` : ""}
            ${fields.map((field, index) => field.multiline
                ? `<textarea class="anima-sel-input is-multiline" data-field="${index}" rows="${field.rows || 4}" placeholder="${escapeHtml(field.placeholder)}">${escapeHtml(field.value)}</textarea>`
                : `<input class="anima-sel-input" data-field="${index}" type="text" value="${escapeHtml(field.value)}" placeholder="${escapeHtml(field.placeholder)}" autocomplete="off">`).join("")}
            <div class="anima-sel-dialog-actions">
                <button class="anima-sel-button" type="button" data-dialog-cancel>${escapeHtml(cancelText)}</button>
                <button class="anima-sel-button ${danger ? "is-danger" : "is-primary"}" type="submit">${escapeHtml(confirmText)}</button>
            </div>
        </form>
    `;
    const form = dialog.querySelector("form");
    const inputs = [...dialog.querySelectorAll("[data-field]")];
    const buttons = [...dialog.querySelectorAll("button")];
    const returnFocus = document.activeElement;
    const close = () => {
        dialog.remove();
        if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
    dialog.querySelector("[data-dialog-cancel]").onclick = close;
    dialog.onpointerdown = event => {
        if (event.target === dialog) close();
    };
    dialog.onkeydown = event => {
        event.stopPropagation();
        if (event.key === "Escape") {
            event.preventDefault();
            close();
        }
        if (event.key === "Enter" && event.target.tagName === "TEXTAREA" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            form.requestSubmit();
        }
    };
    form.onsubmit = async event => {
        event.preventDefault();
        buttons.forEach(button => button.disabled = true);
        const keepOpen = await onConfirm(inputs.map(input => input.value.trim())) === false;
        if (!keepOpen) {
            close();
            return;
        }
        buttons.forEach(button => button.disabled = false);
        inputs[0]?.focus();
    };
    host.appendChild(dialog);
    (inputs[0] || buttons.at(-1)).focus();
    return dialog;
}

const SELECTOR_CSS = String.raw`
@keyframes animaSelIn { from { opacity: 0; transform: translateY(6px) scale(.995); } to { opacity: 1; transform: none; } }
@keyframes animaSelMenuIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: none; } }
@keyframes animaSelShimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
@keyframes animaSelFavorite { 0% { transform: scale(.8); } 55% { transform: scale(1.15); } 100% { transform: scale(1); } }
@keyframes animaSelLoading { from { background-position: -70% 0; } to { background-position: 170% 0; } }
.anima-sel-overlay {
    --anima-panel: var(--comfy-menu-bg, var(--base-background, var(--p-content-background, #202124)));
    --anima-text: var(--fg-color, var(--base-foreground, var(--p-text-color, #f2f3f5)));
    --anima-accent: var(--primary-background, var(--p-primary-color, #31b9f4));
    --sel-tint: color-mix(in srgb, var(--anima-accent) 25%, #8b9099);
    --sel-surface: color-mix(in srgb, var(--anima-panel) 84%, var(--sel-tint) 16%);
    --sel-rail: color-mix(in srgb, var(--anima-panel) 94%, var(--sel-tint) 6%);
    --sel-field: color-mix(in srgb, var(--anima-panel) 72%, var(--sel-tint) 28%);
    --sel-hover: color-mix(in srgb, var(--anima-text) 7%, var(--sel-surface));
    --sel-menu: color-mix(in srgb, var(--anima-panel) 74%, var(--sel-tint) 26%);
    --sel-line: color-mix(in srgb, var(--anima-text) 10%, transparent);
    --sel-text: var(--anima-text);
    --sel-muted: color-mix(in srgb, var(--anima-text) 62%, var(--sel-surface));
    --sel-accent: color-mix(in srgb, var(--anima-accent) 70%, color-mix(in srgb, var(--anima-text) 60%, #808080));
    --sel-selected: color-mix(in srgb, var(--anima-accent) 16%, var(--sel-surface));
    --sel-primary: color-mix(in srgb, var(--anima-accent) 55%, #2b3a4f);
    --sel-favorite: color-mix(in srgb, #e8a924 78%, var(--anima-text));
    --sel-good: color-mix(in srgb, #38b26d 78%, var(--anima-text));
    --sel-danger: color-mix(in srgb, #e5484d 82%, var(--anima-text));
    --sel-macaron-pink: color-mix(in srgb, #f7a8c8 88%, var(--anima-text));
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(5, 7, 10, .62);
    color: var(--sel-text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
    font-size: 12px;
    font-weight: 400;
    line-height: 1.5;
}
.anima-sel-overlay *, .anima-sel-overlay *::before, .anima-sel-overlay *::after { box-sizing: border-box; }
.anima-sel-overlay [hidden] { display: none !important; }
.anima-sel-overlay :where(button, input, textarea, summary) { margin: 0; font: inherit; color: inherit; }
.anima-sel-overlay ::selection { background: var(--sel-selected); color: var(--sel-text); }
.anima-sel-overlay input, .anima-sel-overlay textarea { caret-color: var(--sel-accent); }
.anima-sel-overlay :is(button, summary, input, textarea, a, [tabindex="0"]):focus-visible { outline: 2px solid var(--sel-accent); outline-offset: -2px; }
.anima-sel-icon { display: block; flex: 0 0 auto; width: 16px; height: 16px; }
.anima-sel-shell {
    position: relative;
    display: flex;
    flex-direction: column;
    width: min(1780px, calc(100vw - 32px));
    height: calc(100dvh - 32px);
    border-radius: 12px;
    overflow: hidden;
    background: var(--sel-surface);
    box-shadow: 0 24px 80px rgba(0, 0, 0, .4);
    animation: animaSelIn .2s cubic-bezier(.2,.7,.2,1);
}
.anima-sel-overlay.is-switching .anima-sel-shell { animation: none; }
.anima-sel-topbar { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 20px; min-height: 58px; padding: 12px 20px; border-bottom: 1px solid var(--sel-line); background: var(--sel-surface); }
.anima-sel-kinds { display: flex; align-items: center; gap: 4px; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.anima-sel-kind { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 7px; height: 34px; padding: 0 12px; border: 0; border-radius: 7px; background: transparent; color: var(--sel-muted); font-size: 13px; font-weight: 500; white-space: nowrap; cursor: pointer; transition: background-color .16s ease, color .16s ease; }
.anima-sel-kind > svg { width: 18px; height: 18px; }
.anima-sel-kind:hover { background: var(--sel-hover); color: var(--sel-text); }
.anima-sel-kind.active { background: var(--sel-selected); color: var(--sel-accent); }
.anima-sel-kind b { min-width: 20px; padding: 0 6px; border-radius: 10px; background: var(--anima-accent); color: var(--anima-panel); box-shadow: 0 0 0 3px color-mix(in srgb, var(--anima-accent) 28%, transparent); font-size: 11px; font-weight: 700; line-height: 18px; text-align: center; font-variant-numeric: tabular-nums; }
.anima-sel-topbar-actions { display: flex; align-items: center; gap: 12px; }
.anima-sel-close, .anima-sel-filter-toggle, .anima-sel-reset, .anima-sel-tab, .anima-sel-status { display: inline-flex; align-items: center; justify-content: center; border: 0; background: transparent; color: var(--sel-muted); cursor: pointer; }
.anima-sel-close { width: 32px; height: 32px; padding: 0; border-radius: 6px; }
.anima-sel-close svg { width: 18px; height: 18px; }
.anima-sel-close:hover { background: var(--sel-hover); color: var(--sel-text); }
.anima-sel-filter-toggle { gap: 7px; min-height: 32px; padding: 0 10px; border-radius: 6px; }
.anima-sel-filter-toggle:hover { background: var(--sel-hover); color: var(--sel-text); }
.anima-sel-filter-toggle[aria-expanded="true"] { background: var(--sel-selected); color: var(--sel-accent); }
.anima-sel-workspace { display: grid; flex: 1 1 auto; grid-template-columns: 76px minmax(0, 1fr); min-height: 0; overflow: hidden; }
.anima-sel-tabs { display: flex; flex-direction: column; align-items: stretch; gap: 8px; min-width: 0; padding: 14px 8px; overflow-y: auto; border-right: 1px solid var(--sel-line); background: var(--sel-rail); scrollbar-width: thin; }
.anima-sel-tab { position: relative; flex: 0 0 auto; flex-direction: column; gap: 7px; min-height: 66px; padding: 10px 3px; border-radius: 8px; font-size: 10px; font-weight: 450; line-height: 14px; text-align: center; transition: background-color .16s ease, color .16s ease; }
.anima-sel-tab > svg { width: 21px; height: 21px; }
.anima-sel-tab > span { max-width: 100%; overflow-wrap: anywhere; }
.anima-sel-tab:hover { background: var(--sel-hover); color: var(--sel-text); }
.anima-sel-tab.active { background: var(--sel-selected); color: var(--sel-accent); }
.anima-sel-tab b { position: absolute; top: 5px; right: 2px; min-width: 16px; padding: 0 3px; border-radius: 4px; background: var(--sel-rail); color: var(--sel-muted); font-size: 9px; font-weight: 500; line-height: 14px; font-variant-numeric: tabular-nums; }
.anima-sel-tab.active b { background: var(--sel-accent); color: var(--anima-panel); }
.anima-sel-layout { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); min-width: 0; min-height: 0; overflow: hidden; }
.anima-sel-layout.has-filters.filters-open { grid-template-columns: 220px minmax(0, 1fr); }
.anima-sel-nav { display: none; }
.anima-sel-layout.has-filters.filters-open > .anima-sel-nav { display: flex; flex-direction: column; min-height: 0; padding: 20px 14px; overflow: hidden auto; border-right: 1px solid var(--sel-line); background: var(--sel-surface); scrollbar-width: thin; scrollbar-color: var(--sel-line) transparent; }
.anima-sel-filter-backdrop { display: none; }
.anima-sel-nav-heading { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 22px; }
.anima-sel-nav-heading h2 { margin: 0; color: var(--sel-text); font-size: 13px; font-weight: 600; }
.anima-sel-reset { padding: 2px 0; font-size: 10px; text-decoration: underline; text-underline-offset: 3px; }
.anima-sel-reset:hover:not(:disabled) { color: var(--sel-text); }
.anima-sel-reset:disabled { opacity: .45; cursor: default; }
.anima-sel-nav-group { display: flex; flex: 0 0 auto; flex-direction: column; gap: 9px; margin: 0 0 22px; }
.anima-sel-nav-group:last-child { margin-bottom: 0; }
.anima-sel-nav-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--sel-muted); font-size: 11px; font-weight: 500; }
.anima-sel-nav-add { display: grid; place-items: center; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 5px; background: transparent; color: var(--sel-muted); cursor: pointer; }
.anima-sel-nav-add:hover { background: var(--sel-hover); color: var(--sel-accent); }
.anima-sel-nav-add svg { width: 14px; height: 14px; }
.anima-sel-group-list { display: grid; gap: 2px; }
.anima-sel-group-row { position: relative; display: flex; align-items: center; min-width: 0; border-radius: 5px; }
.anima-sel-group-row:hover { background: var(--sel-hover); }
.anima-sel-group-row.active { background: var(--sel-selected); }
.anima-sel-nav-btn { display: flex; flex: 1 1 auto; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; min-height: 32px; padding: 6px 8px; border: 0; border-radius: 5px; background: transparent; color: var(--sel-muted); font-size: 12px; line-height: 20px; text-align: left; cursor: pointer; }
.anima-sel-group-row:hover .anima-sel-nav-btn { color: var(--sel-text); }
.anima-sel-group-row.active .anima-sel-nav-btn { color: var(--sel-accent); }
.anima-sel-nav-btn > span { display: flex; align-items: center; gap: 8px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.anima-sel-nav-btn > span svg { width: 14px; height: 14px; }
.anima-sel-nav-btn b { flex: 0 0 auto; color: var(--sel-muted); font-size: 10px; font-weight: 400; font-variant-numeric: tabular-nums; }
.anima-sel-group-tools { display: none; flex: 0 0 auto; gap: 2px; padding-right: 4px; }
.anima-sel-group-row:hover .anima-sel-group-tools, .anima-sel-group-row:focus-within .anima-sel-group-tools { display: flex; }
.anima-sel-group-row:hover .anima-sel-nav-btn b, .anima-sel-group-row:focus-within .anima-sel-nav-btn b { display: none; }
.anima-sel-group-tools button { display: grid; place-items: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--sel-muted); cursor: pointer; }
.anima-sel-group-tools button:hover { background: var(--sel-field); color: var(--sel-text); }
.anima-sel-group-tools button.is-danger:hover { color: var(--sel-danger); }
.anima-sel-group-tools svg { width: 13px; height: 13px; }
.anima-sel-combo { position: relative; width: 100%; min-width: 0; }
.anima-sel-combo.open { z-index: 20; }
.anima-sel-combo-control { position: relative; display: flex; align-items: center; width: 100%; min-height: 38px; padding: 10px 30px 10px 11px; border: 1px solid transparent; border-radius: 7px; background: var(--sel-field); color: var(--sel-text); font-size: 12px; line-height: 16px; text-align: left; cursor: pointer; }
.anima-sel-combo-control:hover { border-color: var(--sel-line); background: var(--sel-hover); }
.anima-sel-combo.has-value .anima-sel-combo-control { padding-right: 50px; background: var(--sel-selected); color: var(--sel-accent); }
.anima-sel-combo-value { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.anima-sel-combo-value.placeholder { color: var(--sel-muted); }
.anima-sel-combo-control > svg { position: absolute; top: 50%; right: 9px; width: 17px; height: 17px; color: var(--sel-muted); transform: translateY(-50%); transition: transform .16s ease; }
.anima-sel-combo.open .anima-sel-combo-control > svg { transform: translateY(-50%) rotate(180deg); }
.anima-sel-combo-clear { position: absolute; top: 9px; right: 26px; display: grid; place-items: center; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--sel-muted); cursor: pointer; }
.anima-sel-combo-clear:hover { background: var(--sel-hover); color: var(--sel-text); }
.anima-sel-combo-clear svg { width: 13px; height: 13px; }
.anima-sel-combo-popover { position: absolute; top: calc(100% + 6px); left: 0; right: 0; display: none; padding: 6px; border-radius: 9px; background: var(--sel-menu); color: var(--sel-text); box-shadow: 0 16px 40px rgba(0, 0, 0, .36); }
.anima-sel-combo.open .anima-sel-combo-popover { display: block; animation: animaSelMenuIn .17s cubic-bezier(.2,.7,.2,1); }
.anima-sel-combo-search { position: relative; margin-bottom: 5px; }
.anima-sel-combo-search > svg { position: absolute; top: 9px; left: 9px; width: 14px; height: 14px; color: var(--sel-muted); pointer-events: none; }
.anima-sel-combo-search input { width: 100%; height: 32px; padding: 7px 9px 7px 30px; border: 0; border-radius: 5px; outline: 0; background: var(--sel-rail); color: var(--sel-text); font-size: 12px; }
.anima-sel-combo-search input::placeholder { color: var(--sel-muted); }
.anima-sel-combo-list { display: grid; gap: 1px; max-height: 280px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--sel-line) transparent; }
.anima-sel-combo-option { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 33px; padding: 7px 8px; border: 0; border-radius: 5px; background: transparent; color: var(--sel-text); font-size: 12px; line-height: 18px; text-align: left; cursor: pointer; }
.anima-sel-combo-option > span { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.anima-sel-combo-option > small { flex: 0 0 auto; color: var(--sel-muted); font-size: 10px; font-variant-numeric: tabular-nums; }
.anima-sel-combo-option:hover { background: var(--sel-hover); }
.anima-sel-combo-option.active { background: var(--sel-selected); color: var(--sel-accent); }
.anima-sel-combo-option.active::after { content: ""; flex: 0 0 auto; width: 5px; height: 9px; margin: 0 3px 3px 0; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(45deg); }
.anima-sel-combo-empty { padding: 10px 8px; color: var(--sel-muted); }
.anima-sel-body { display: flex; flex-direction: column; min-width: 0; min-height: 0; background: var(--sel-rail); }
.anima-sel-toolbar { display: flex; flex: 0 0 auto; flex-direction: column; gap: 14px; padding: 20px; border-bottom: 1px solid var(--sel-line); background: var(--sel-surface); }
.anima-sel-toolbar-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-width: 0; }
.anima-sel-page-heading { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.anima-sel-page-heading h2 { margin: 0; overflow: hidden; color: var(--sel-text); font-size: 19px; font-weight: 600; line-height: 26px; text-overflow: ellipsis; white-space: nowrap; }
.anima-sel-total { flex: 0 0 auto; color: var(--sel-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.anima-sel-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 8px; }
.anima-sel-button, .anima-sel-menu-wrap > summary { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 32px; padding: 0 10px; border: 1px solid transparent; border-radius: 6px; background: var(--sel-field); color: var(--sel-text); font-size: 12px; font-weight: 450; line-height: 18px; white-space: nowrap; list-style: none; cursor: pointer; transition: background-color .16s ease, border-color .16s ease, color .16s ease; }
.anima-sel-menu-wrap > summary::-webkit-details-marker { display: none; }
.anima-sel-button:hover:not(:disabled), .anima-sel-menu-wrap > summary:hover { background: var(--sel-hover); color: var(--sel-accent); }
.anima-sel-button:disabled { opacity: .45; cursor: default; }
.anima-sel-button.is-icon, .anima-sel-menu-wrap > summary.is-icon { width: 32px; padding: 0; }
.anima-sel-button.is-primary { background: var(--sel-primary); color: #fff; }
.anima-sel-button.is-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--sel-primary) 86%, #000); color: #fff; }
.anima-sel-button.is-danger { background: color-mix(in srgb, var(--sel-danger) 12%, var(--sel-surface)); color: var(--sel-danger); }
.anima-sel-button.is-danger:hover:not(:disabled) { background: color-mix(in srgb, var(--sel-danger) 20%, var(--sel-surface)); color: var(--sel-danger); }
.anima-sel-menu-wrap { position: relative; }
.anima-sel-menu-wrap[open] > summary { background: var(--sel-selected); color: var(--sel-accent); }
.anima-sel-menu-wrap.is-plain > summary { background: transparent; color: var(--sel-muted); }
.anima-sel-menu { position: absolute; top: calc(100% + 7px); right: 0; z-index: 30; min-width: 190px; max-width: min(290px, calc(100vw - 100px)); padding: 6px; border-radius: 9px; background: var(--sel-menu); color: var(--sel-text); box-shadow: 0 16px 40px rgba(0, 0, 0, .36); animation: animaSelMenuIn .17s cubic-bezier(.2,.7,.2,1); }
.anima-sel-menu button { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 36px; padding: 8px 10px; border: 0; border-radius: 5px; background: transparent; color: var(--sel-text); font-size: 12px; line-height: 18px; text-align: left; white-space: nowrap; cursor: pointer; }
.anima-sel-menu button:hover, .anima-sel-menu button:focus-visible { background: var(--sel-hover); }
.anima-sel-menu button:disabled { opacity: .45; cursor: default; }
.anima-sel-menu button.is-danger { color: var(--sel-danger); }
.anima-sel-menu button[aria-checked="true"] { background: var(--sel-selected); color: var(--sel-accent); }
.anima-sel-menu button[aria-checked="true"]::after { content: ""; width: 5px; height: 9px; margin: 0 3px 3px auto; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(45deg); }
.anima-sel-menu hr { height: 1px; margin: 5px 4px; border: 0; background: var(--sel-line); }
.anima-sel-search { position: relative; width: 100%; min-width: 0; }
.anima-sel-search > svg { position: absolute; top: 50%; left: 13px; width: 17px; height: 17px; color: var(--sel-muted); transform: translateY(-50%); pointer-events: none; }
.anima-sel-search input { width: 100%; height: 42px; padding: 10px 42px 10px 40px; border: 1px solid transparent; border-radius: 8px; outline: 0; background: var(--sel-field); color: var(--sel-text); font-size: 12px; line-height: 20px; }
.anima-sel-search input::placeholder { color: var(--sel-muted); opacity: 1; }
.anima-sel-search input:hover { border-color: var(--sel-line); }
.anima-sel-search input:focus { border-color: var(--sel-accent); }
.anima-sel-search input::-webkit-search-cancel-button { display: none; }
.anima-sel-search-clear { position: absolute; top: 50%; right: 7px; display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 5px; background: transparent; color: var(--sel-muted); transform: translateY(-50%); cursor: pointer; }
.anima-sel-search-clear:hover { background: var(--sel-hover); color: var(--sel-text); }
.anima-sel-search-clear svg { width: 15px; height: 15px; }
.anima-sel-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
.anima-sel-chip { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; padding: 4px 6px 4px 8px; border: 0; border-radius: 5px; background: var(--sel-selected); color: var(--sel-accent); font-size: 11px; cursor: pointer; }
.anima-sel-chip small { color: inherit; font-size: 10px; opacity: .75; }
.anima-sel-chip b { overflow: hidden; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.anima-sel-chip svg { width: 11px; height: 11px; }
.anima-sel-chip:hover { background: var(--sel-hover); }
.anima-sel-split { position: relative; display: grid; flex: 1 1 auto; grid-template-columns: minmax(0, 1fr) clamp(300px, 22vw, 380px); min-height: 0; overflow: hidden; }
.anima-sel-split.is-loading::before { content: ""; position: absolute; z-index: 4; inset: 0 0 auto; height: 2px; background: linear-gradient(90deg, transparent, var(--sel-accent), transparent) no-repeat; background-size: 40% 100%; animation: animaSelLoading 1s linear infinite; pointer-events: none; }
.anima-sel-results { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 172px), 1fr)); grid-auto-rows: max-content; align-content: start; gap: 16px; min-width: 0; height: 100%; padding: 20px; overflow-y: auto; scrollbar-gutter: stable; scrollbar-width: thin; scrollbar-color: var(--sel-line) transparent; }
.anima-sel-card { position: relative; display: block; min-width: 0; aspect-ratio: var(--anima-card-aspect, 2 / 3); overflow: hidden; border: 1px solid var(--sel-line); border-radius: 9px; background: var(--sel-surface); cursor: pointer; user-select: none; transition: border-color .16s ease, box-shadow .16s ease; }
.anima-sel-card:hover { border-color: var(--sel-muted); }
.anima-sel-card.is-focused { box-shadow: 0 0 0 1px var(--sel-muted); }
.anima-sel-card.is-selected { border-color: var(--sel-accent); box-shadow: 0 0 0 1px var(--sel-accent); }
.anima-sel-card:focus-visible { outline: 2px solid var(--sel-accent); outline-offset: 2px; }
.anima-sel-thumb { position: absolute; inset: 0; overflow: hidden; background: var(--sel-field); }
.anima-sel-thumb img { position: absolute; inset: 0; z-index: 1; display: block; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity .32s ease; }
.anima-sel-thumb img.is-loaded { opacity: 1; }
.anima-sel-thumb.is-loading::after { content: ""; position: absolute; inset: 0; z-index: 2; background: linear-gradient(105deg, transparent 22%, color-mix(in srgb, var(--sel-text) 9%, transparent) 44%, transparent 66%); animation: animaSelShimmer 1.35s ease-in-out infinite; }
.anima-sel-placeholder { position: absolute; inset: 0; display: grid; place-items: center; color: color-mix(in srgb, var(--sel-text) 28%, transparent); font-size: 46px; font-weight: 600; }
.anima-sel-placeholder.is-custom { align-content: center; gap: 8px; font-size: 13px; }
.anima-sel-placeholder.is-custom svg { width: 34px; height: 34px; margin: 0 auto; }
.anima-sel-check { position: absolute; top: 9px; left: 9px; z-index: 3; display: grid; place-items: center; width: 22px; height: 22px; border: 1.5px solid rgba(255, 255, 255, .55); border-radius: 6px; background: rgba(12, 17, 25, .45); color: transparent; transition: background-color .16s ease, border-color .16s ease; }
.anima-sel-check svg { width: 14px; height: 14px; stroke-width: 2.4; }
.anima-sel-card.is-selected .anima-sel-check { border-color: var(--sel-primary); background: var(--sel-primary); color: #fff; }
.anima-sel-card-badges { position: absolute; top: 9px; left: 38px; right: 44px; z-index: 3; display: flex; flex-wrap: wrap; gap: 5px; pointer-events: none; }
.anima-sel-badge { max-width: 100%; overflow: hidden; padding: 4px 7px; border-radius: 4px; background: var(--sel-menu); color: var(--sel-text); font-size: 10px; font-weight: 500; line-height: 13px; text-overflow: ellipsis; white-space: nowrap; }
.anima-sel-card-tools { position: absolute; top: 9px; right: 9px; z-index: 3; display: flex; flex-direction: column; gap: 6px; }
.anima-sel-card-btn { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 5px; background: var(--sel-menu); color: var(--sel-muted); opacity: 0; cursor: pointer; transition: opacity .16s ease, color .16s ease, background-color .16s ease; }
.anima-sel-card:hover .anima-sel-card-btn, .anima-sel-card:focus-within .anima-sel-card-btn, .anima-sel-card-btn.is-active { opacity: 1; }
.anima-sel-card-btn:hover { color: var(--sel-text); }
.anima-sel-card-btn.is-favorite:hover { color: var(--sel-favorite); }
.anima-sel-card-btn.is-active, .anima-sel-card-btn.is-active:hover { background: #e09b17; color: #fff; box-shadow: 0 2px 8px rgba(0, 0, 0, .3); }
.anima-sel-overlay .is-active .anima-sel-star-path { fill: currentColor; }
.anima-sel-card-btn.is-active svg { animation: animaSelFavorite .26s cubic-bezier(.16,1,.3,1); }
.anima-sel-card-body { position: absolute; inset: auto 0 0; z-index: 2; display: grid; gap: 4px; padding: 42px 12px 12px; background: linear-gradient(0deg, rgba(12, 17, 25, .96), rgba(12, 17, 25, .78) 62%, transparent); pointer-events: none; }
.anima-sel-card-title { overflow: hidden; color: #f2f5fa; font-size: 13px; font-weight: 550; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }
.anima-sel-card-note { overflow: hidden; color: color-mix(in srgb, var(--anima-accent) 55%, #fff); font-size: 10.5px; line-height: 15px; text-overflow: ellipsis; white-space: nowrap; }
.anima-sel-card-meta { overflow: hidden; color: #b8c4d4; font-size: 10px; line-height: 15px; text-overflow: ellipsis; white-space: nowrap; }
.anima-sel-card-stats { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
.anima-sel-stat { display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 6px; border: 1px solid rgba(255, 255, 255, .14); border-radius: 5px; background: rgba(255, 255, 255, .1); color: #f4f5f7; font-size: 10px; font-weight: 550; font-variant-numeric: tabular-nums; }
.anima-sel-stat svg { width: 12px; height: 12px; color: color-mix(in srgb, var(--anima-accent) 45%, #fff); }
.anima-sel-stat.is-warm { background: rgba(224, 155, 23, .16); border-color: rgba(232, 169, 36, .22); color: #f4d48e; }
.anima-sel-create-card { display: grid; place-items: center; align-content: center; gap: 10px; min-width: 0; aspect-ratio: var(--anima-card-aspect, 2 / 3); padding: 18px; border: 1px dashed color-mix(in srgb, var(--sel-accent) 45%, transparent); border-radius: 9px; background: transparent; color: var(--sel-accent); font-size: 12px; font-weight: 500; text-align: center; cursor: pointer; transition: background-color .16s ease, border-color .16s ease; }
.anima-sel-create-card svg { width: 30px; height: 30px; }
.anima-sel-create-card:hover { border-color: var(--sel-accent); background: var(--sel-selected); }
.anima-sel-empty { grid-column: 1 / -1; display: grid; justify-items: center; gap: 6px; padding: 70px 20px; color: var(--sel-muted); text-align: center; }
.anima-sel-empty svg { width: 30px; height: 30px; margin-bottom: 6px; }
.anima-sel-empty h3 { margin: 0; color: var(--sel-text); font-size: 15px; font-weight: 550; }
.anima-sel-empty p { margin: 0; font-size: 12px; }
.anima-sel-detail { position: relative; min-width: 0; overflow: hidden; border-left: 1px solid var(--sel-line); background: var(--sel-surface); }
.anima-sel-detail-scroll { height: 100%; padding: 16px 18px 24px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--sel-line) transparent; }
.anima-sel-detail-dismiss { display: none; }
.anima-sel-detail-preview { position: relative; height: clamp(220px, 34vh, 380px); overflow: hidden; border-radius: 7px; background: var(--sel-rail); }
.anima-sel-detail-preview .anima-sel-thumb img { object-fit: contain; }
.anima-sel-detail-preview .anima-sel-thumb img.anima-sel-preview-bg { inset: -20px; z-index: 0; width: calc(100% + 40px); height: calc(100% + 40px); object-fit: cover; filter: blur(26px) saturate(1.1) brightness(.5); }
.anima-sel-detail-preview .anima-sel-thumb img.anima-sel-preview-bg.is-loaded { opacity: .9; }
.anima-sel-detail-head { margin: 14px 0 16px; }
.anima-sel-detail-head h2 { margin: 0; color: var(--sel-text); font-size: 17px; font-weight: 550; line-height: 23px; overflow-wrap: anywhere; }
.anima-sel-detail-head p { margin: 6px 0 0; color: var(--sel-muted); font-size: 11px; line-height: 17px; overflow-wrap: anywhere; }
.anima-sel-detail-note { margin-top: 8px; color: color-mix(in srgb, var(--sel-accent) 80%, var(--sel-text)); font-size: 11px; }
.anima-sel-detail-actions { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; margin: 0 0 16px; }
.anima-sel-detail-actions .anima-sel-button { min-height: 38px; }
.anima-sel-detail-actions .anima-sel-button.is-selected-state { background: var(--sel-selected); color: var(--sel-accent); }
.anima-sel-favorite-controls { position: relative; display: flex; align-items: stretch; height: 38px; border-radius: 6px; background: var(--sel-field); }
.anima-sel-favorite-controls.is-active { background: color-mix(in srgb, var(--sel-favorite) 16%, var(--sel-surface)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sel-favorite) 55%, transparent); }
.anima-sel-favorite-controls > button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 11px; border: 0; background: transparent; color: var(--sel-text); cursor: pointer; }
.anima-sel-favorite-controls > button:first-child { border-radius: 6px 0 0 6px; }
.anima-sel-favorite-controls > button:first-child svg { color: var(--sel-favorite); }
.anima-sel-favorite-controls.is-active > button:first-child { color: var(--sel-favorite); font-weight: 600; }
.anima-sel-favorite-controls > button:hover:not(:disabled) { background: var(--sel-hover); }
.anima-sel-favorite-controls > button:last-of-type:not(:first-child) { width: 34px; padding: 0; border-left: 1px solid var(--sel-line); border-radius: 0 6px 6px 0; color: var(--sel-muted); }
.anima-sel-favorite-controls > button:disabled { opacity: .35; cursor: default; }
.anima-sel-favorite-popover { position: absolute; top: calc(100% + 7px); right: 0; z-index: 12; display: grid; gap: 2px; width: 224px; max-height: 260px; padding: 8px; overflow-y: auto; border-radius: 8px; background: var(--sel-menu); box-shadow: 0 8px 24px rgba(0, 0, 0, .3); animation: animaSelMenuIn .17s cubic-bezier(.16,1,.3,1); }
.anima-sel-favorite-popover > b { padding: 4px 6px 6px; color: var(--sel-text); font-size: 12px; font-weight: 500; }
.anima-sel-favorite-popover label { display: flex; align-items: center; gap: 8px; min-height: 32px; padding: 6px; border-radius: 5px; color: var(--sel-text); cursor: pointer; }
.anima-sel-favorite-popover label:hover { background: var(--sel-hover); }
.anima-sel-favorite-popover label span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.anima-sel-overlay input[type="checkbox"] { accent-color: var(--sel-primary); }
.anima-sel-section { margin: 16px 0; padding: 12px; border: 1px solid var(--sel-line); border-radius: 8px; }
.anima-sel-section.is-accent { border-color: color-mix(in srgb, var(--sel-accent) 30%, transparent); background: var(--sel-selected); }
.anima-sel-section-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.anima-sel-section-title { display: flex; align-items: center; gap: 7px; margin: 0; color: var(--sel-text); font-size: 12px; font-weight: 600; }
.anima-sel-section.is-accent .anima-sel-section-title { color: var(--sel-accent); }
.anima-sel-section-title svg { width: 15px; height: 15px; }
.anima-sel-copy-all { display: inline-flex; align-items: center; gap: 5px; min-height: 26px; padding: 0 8px; border: 1px solid color-mix(in srgb, var(--sel-accent) 35%, transparent); border-radius: 6px; background: transparent; color: var(--sel-accent); font-size: 10px; font-weight: 500; cursor: pointer; }
.anima-sel-copy-all:hover { border-color: transparent; background: var(--sel-primary); color: #fff; }
.anima-sel-copy-all svg { width: 12px; height: 12px; }
.anima-sel-tag-list { display: flex; flex-wrap: wrap; gap: 6px; }
.anima-sel-tag { max-width: 100%; padding: 4px 9px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--sel-accent) 28%, transparent); border-radius: 6px; background: var(--sel-surface); color: var(--sel-accent); font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: 11px; line-height: 16px; text-align: left; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.anima-sel-tag:hover { border-color: transparent; background: var(--sel-primary); color: #fff; }
.anima-sel-tag small { margin-left: 4px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; opacity: .72; }
.anima-sel-muted-line { color: var(--sel-muted); font-size: 11px; }
.anima-sel-info-list { display: grid; margin: 0; }
.anima-sel-info-list > div { display: grid; grid-template-columns: 64px minmax(0, 1fr); align-items: start; gap: 12px; padding: 7px 0; font-size: 11px; line-height: 17px; }
.anima-sel-info-list > div:first-child { padding-top: 0; }
.anima-sel-info-list dt { color: var(--sel-muted); }
.anima-sel-info-list dd { margin: 0; color: var(--sel-text); overflow-wrap: anywhere; }
.anima-sel-field-label { display: block; margin: 0 0 8px; color: var(--sel-text); font-size: 12px; font-weight: 600; }
.anima-sel-input { width: 100%; min-height: 36px; padding: 8px 10px; border: 1px solid transparent; border-radius: 6px; outline: 0; background: var(--sel-field); color: var(--sel-text); font-size: 12px; line-height: 18px; }
.anima-sel-input::placeholder { color: var(--sel-muted); }
.anima-sel-input:hover { border-color: var(--sel-line); }
.anima-sel-input:focus { border-color: var(--sel-accent); }
.anima-sel-input.is-multiline { min-height: 96px; resize: vertical; font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; }
.anima-sel-danger-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 18px; padding-top: 12px; border-top: 1px solid var(--sel-line); }
.anima-sel-danger-row > span { display: grid; gap: 2px; min-width: 0; }
.anima-sel-danger-row b { color: var(--sel-text); font-size: 12px; font-weight: 500; }
.anima-sel-danger-row small { color: var(--sel-muted); font-size: 10px; }
.anima-sel-empty-detail { display: grid; align-content: center; justify-items: center; gap: 8px; height: 100%; padding: 30px; color: var(--sel-muted); text-align: center; }
.anima-sel-empty-detail svg { width: 28px; height: 28px; }
.anima-sel-empty-detail h3 { margin: 0; color: var(--sel-text); font-size: 15px; font-weight: 550; }
.anima-sel-empty-detail p { max-width: 240px; margin: 0; font-size: 12px; line-height: 19px; }
.anima-sel-pager { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 14px; min-height: 48px; padding: 8px 20px; border-top: 1px solid var(--sel-line); background: var(--sel-surface); }
.anima-sel-pager-stats { min-width: 0; overflow: hidden; color: var(--sel-muted); text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
.anima-sel-pager-controls { display: flex; flex: 0 0 auto; align-items: center; gap: 6px; }
.anima-sel-pager-controls .anima-sel-button { width: 30px; min-height: 30px; padding: 0; background: transparent; color: var(--sel-muted); }
.anima-sel-pager-controls .anima-sel-button:hover:not(:disabled) { background: var(--sel-hover); color: var(--sel-text); }
.anima-sel-pager-page { display: inline-flex; align-items: center; gap: 6px; margin: 0 4px; color: var(--sel-muted); font-variant-numeric: tabular-nums; }
.anima-sel-pager-page input { width: 46px; height: 30px; padding: 0 4px; border: 1px solid transparent; border-radius: 5px; outline: 0; background: var(--sel-field); color: var(--sel-text); font-size: 12px; text-align: center; }
.anima-sel-pager-page input:focus { border-color: var(--sel-accent); }
.anima-sel-footer { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 16px; min-height: 52px; padding: 8px 16px; border-top: 1px solid var(--sel-line); background: var(--sel-rail); color: var(--sel-muted); }
.anima-sel-footer-side { display: flex; align-items: center; gap: 16px; min-width: 0; }
.anima-sel-status { gap: 7px; min-width: 0; padding: 5px 0; font-size: 11px; }
.anima-sel-status:hover { color: var(--sel-text); }
.anima-sel-status svg { width: 14px; height: 14px; }
.anima-sel-status span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.anima-sel-status b { color: var(--sel-accent); font-weight: 600; font-variant-numeric: tabular-nums; }
.anima-sel-links { display: flex; align-items: center; gap: 4px; }
.anima-sel-links a { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 5px; border-radius: 4px; color: var(--sel-muted); font-size: 11px; text-decoration: none; }
.anima-sel-links a:hover { background: var(--sel-hover); color: var(--sel-text); }
.anima-sel-links a.is-afdian { color: var(--sel-macaron-pink); font-weight: 600; }
.anima-sel-links svg { width: 14px; height: 14px; }
.anima-sel-escape { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; white-space: nowrap; }
.anima-sel-escape kbd { padding: 1px 4px; border: 1px solid var(--sel-line); border-radius: 4px; color: var(--sel-muted); font: inherit; }
.anima-sel-footer-actions { display: flex; align-items: center; gap: 8px; }
.anima-sel-footer-actions .anima-sel-button { min-height: 34px; padding: 0 14px; }
.anima-sel-toasts { position: absolute; top: 18px; left: 50%; z-index: 80; display: grid; justify-items: center; gap: 8px; width: min(420px, calc(100% - 32px)); transform: translateX(-50%); pointer-events: none; }
.anima-sel-toast { max-width: 100%; padding: 9px 14px; border-radius: 7px; background: var(--sel-menu); color: var(--sel-text); box-shadow: 0 12px 30px rgba(0, 0, 0, .3); font-size: 12px; line-height: 18px; animation: animaSelMenuIn .2s cubic-bezier(.2,.7,.2,1); transition: opacity .2s ease; }
.anima-sel-toast.is-error { color: var(--sel-danger); }
.anima-sel-toast.is-leaving { opacity: 0; }
.anima-sel-dialog { position: absolute; inset: 0; z-index: 70; display: grid; place-items: center; padding: 20px; background: rgba(5, 7, 10, .55); }
.anima-sel-dialog-card { display: grid; gap: 12px; width: min(420px, 100%); padding: 20px; border-radius: 10px; background: var(--sel-surface); box-shadow: 0 24px 64px rgba(0, 0, 0, .45); animation: animaSelIn .18s cubic-bezier(.2,.7,.2,1); }
.anima-sel-dialog-card h3 { margin: 0; color: var(--sel-text); font-size: 15px; font-weight: 600; }
.anima-sel-dialog-card p { margin: 0; color: var(--sel-muted); font-size: 12px; line-height: 19px; }
.anima-sel-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.anima-sel-dialog-actions .anima-sel-button { min-height: 34px; padding: 0 14px; }
.anima-sel-overlay :is(.anima-sel-detail-scroll, .anima-sel-results)::-webkit-scrollbar, .anima-sel-nav::-webkit-scrollbar { width: 5px; height: 5px; }
.anima-sel-overlay ::-webkit-scrollbar-thumb { border-radius: 4px; background: var(--sel-line); }
@media (hover: hover) {
    .anima-sel-card:hover .anima-sel-thumb img.is-loaded { transform: scale(1.03); }
    .anima-sel-thumb img { transition: opacity .32s ease, transform .3s ease; }
}
@media (max-width: 1179px) {
    .anima-sel-layout.has-filters.filters-open { grid-template-columns: minmax(0, 1fr); }
    .anima-sel-layout.has-filters.filters-open > .anima-sel-nav { position: absolute; z-index: 6; inset: 0 auto 0 0; width: 248px; max-width: calc(100% - 40px); box-shadow: 12px 0 30px rgba(0, 0, 0, .25); }
    .anima-sel-layout.has-filters.filters-open > .anima-sel-filter-backdrop { position: absolute; z-index: 5; inset: 0; display: block; padding: 0; border: 0; background: rgba(0, 0, 0, .4); cursor: pointer; }
}
@media (max-width: 980px) {
    .anima-sel-split { grid-template-columns: minmax(0, 1fr); }
    .anima-sel-detail { position: absolute; z-index: 5; inset: 0 0 0 auto; width: min(400px, 100%); box-shadow: -18px 0 40px rgba(0, 0, 0, .35); transform: translateX(100%); visibility: hidden; transition: transform .22s cubic-bezier(.2,.7,.2,1), visibility 0s linear .22s; }
    .anima-sel-split.is-detail-open > .anima-sel-detail { transform: none; visibility: visible; transition: transform .22s cubic-bezier(.2,.7,.2,1); }
    .anima-sel-detail-dismiss { position: absolute; top: 22px; right: 24px; z-index: 10; display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 6px; background: var(--sel-menu); color: var(--sel-text); box-shadow: 0 4px 14px rgba(0, 0, 0, .3); cursor: pointer; }
}
@media (max-width: 720px) {
    .anima-sel-shell { width: 100vw; height: 100dvh; border-radius: 0; }
    .anima-sel-topbar { min-height: 54px; padding: 10px 14px; }
    .anima-sel-kind { padding: 0 9px; }
    .anima-sel-filter-toggle { width: 32px; padding: 0; }
    .anima-sel-filter-toggle > span, .anima-sel-escape, .anima-sel-links { display: none; }
    .anima-sel-workspace { grid-template-columns: 60px minmax(0, 1fr); }
    .anima-sel-tabs { gap: 6px; padding: 10px 5px; }
    .anima-sel-tab { min-height: 62px; padding: 9px 2px; font-size: 9px; line-height: 13px; }
    .anima-sel-toolbar { gap: 12px; padding: 16px 14px; }
    .anima-sel-page-heading h2 { font-size: 17px; }
    .anima-sel-results { gap: 12px; padding: 14px; }
    .anima-sel-pager { padding: 8px 14px; }
    .anima-sel-pager-stats { display: none; }
    .anima-sel-footer { padding: 8px 12px; }
}
@media (prefers-reduced-motion: reduce) {
    .anima-sel-overlay *, .anima-sel-overlay *::before, .anima-sel-overlay *::after { transition: none !important; animation: none !important; }
}
`;

export function injectSelectorStyles() {
    if (document.getElementById("anima-selector-style")) return;
    const style = document.createElement("style");
    style.id = "anima-selector-style";
    style.textContent = SELECTOR_CSS;
    document.head.appendChild(style);
}
