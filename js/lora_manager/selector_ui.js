import { t } from "./i18n.js";

const menuOverlays = new WeakSet();

function closeFavoritePopover(section, restoreFocus = false) {
    const toggle = section.querySelector("[data-favorite-organize-toggle]");
    section.classList.remove("is-organizing");
    section.querySelector(".alm-favorite-popover").hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (restoreFocus) toggle.focus({ preventScroll: true });
}

export function selectorIcon(name) {
    const paths = {
        layers: '<path d="m3 7 9-4 9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4"/>',
        discover: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/>',
        local: '<path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z"/>',
        favorites: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
        applied: '<path d="M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01"/>',
        downloads: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
        close: '<path d="m6 6 12 12M18 6 6 18"/>',
        refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 6a8 8 0 0 1 13 3M5 15a8 8 0 0 0 13 3"/>',
        panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
        more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
        search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
        match: '<path d="m14 4 6 6M4 20 16 8M15 3l1-1m5 5 1-1M5 5v4M3 7h4m11 10v4m-2-2h4"/>',
        settings: '<circle cx="12" cy="12" r="3"/><path d="m10 3-.7 2.2-2 .9L5 5.7 3 9l1.6 1.7v2.6L3 15l2 3.3 2.3-.4 2 .9L10 21h4l.7-2.2 2-.9 2.3.4 2-3.3-1.6-1.7v-2.6L21 9l-2-3.3-2.3.4-2-.9L14 3h-4Z"/>',
        chevron: '<path d="m8 10 4 4 4-4"/>',
        heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
        file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/><path d="M14 3v6h6M8 13h8M8 17h6"/>',
        tag: '<path d="M20 13 13 20a2 2 0 0 1-2.8 0L3 12.8V3h9.8l7.2 7.2a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1"/>',
        lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    };
    return `<svg class="alm-selector-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}


export function renderSelectorCombo(options) {
    const value = String(options.value || "");
    const items = [...new Set(options.items.map((item) => String(item?.name || item)).filter(Boolean))];
    return `
        <div class="alm-combo ${value ? "has-value" : ""}" data-combo="${escapeAttr(options.id)}">
            <button class="alm-combo-control" type="button" data-combo-toggle aria-haspopup="listbox" aria-expanded="false" title="${escapeAttr(value || options.placeholder)}">
                <span class="alm-combo-value ${value ? "" : "placeholder"}">${escapeHtml(value || options.placeholder)}</span>
                ${selectorIcon("chevron")}
            </button>
            <button class="alm-combo-clear" type="button" data-combo-clear aria-label="${escapeAttr(options.clearTitle)}" ${value ? "" : "hidden"}>${selectorIcon("close")}</button>
            <div class="alm-combo-popover" data-combo-popover>
                <div class="alm-selector-combo-search">${selectorIcon("search")}<input class="alm-combo-search" data-combo-search placeholder="${escapeAttr(options.searchPlaceholder)}" aria-label="${escapeAttr(options.searchPlaceholder)}" autocomplete="off" /></div>
                <div class="alm-combo-list" data-combo-list role="listbox">
                    ${items.map((item) => `<button class="alm-combo-option ${item === value ? "active" : ""}" type="button" role="option" aria-selected="${item === value}" data-combo-option="${escapeAttr(item)}"><span>${escapeHtml(item)}</span></button>`).join("")}
                    <div class="alm-combo-empty" data-combo-empty ${items.length ? "hidden" : ""}>${escapeHtml(options.emptyText)}</div>
                </div>
            </div>
        </div>
    `;
}


export function renderSelectorSearch(options) {
    return `
        <div class="alm-search-wrap alm-selector-search ${options.loading ? "is-loading" : ""}">
            ${selectorIcon("search")}
            <input class="alm-input alm-search" ${options.inputAttrs} value="${escapeAttr(options.value)}" placeholder="${escapeAttr(options.placeholder)}" aria-label="${escapeAttr(options.placeholder)}" autocomplete="off" />
            <span class="alm-search-spinner" aria-hidden="true" ${options.loading ? "" : "hidden"}></span>
            <button class="alm-search-clear alm-selector-search-clear" type="button" data-action="${escapeAttr(options.clearAction)}" aria-label="${escapeAttr(t("Clear search"))}" ${options.value ? "" : "hidden"}>${selectorIcon("close")}</button>
        </div>
    `;
}


export function renderSelectorToolbar(options) {
    return `
        <header class="alm-toolbar alm-selector-toolbar ${options.className || ""}">
            <div class="alm-selector-toolbar-top">
                <div class="alm-selector-page-heading">${options.headingHtml || `<h2>${escapeHtml(options.title)}</h2>`}</div>
                <div class="alm-selector-actions">${options.actionsHtml || ""}</div>
            </div>
            <div class="alm-selector-search-row">${options.searchHtml}</div>
            ${options.filterBarHtml ? `<div class="alm-selector-filter-chips">${options.filterBarHtml}</div>` : ""}
        </header>
    `;
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[character]);
}


function escapeAttr(value) {
    return escapeHtml(value);
}

export function bindSelectorMenus(root) {
    const overlay = root.closest(".alm-selector-overlay");
    if (overlay && !menuOverlays.has(overlay)) {
        menuOverlays.add(overlay);
        const closeOutside = (event) => {
            overlay.querySelectorAll(".alm-combo.open").forEach((combo) => {
                if (combo.contains(event.target)) return;
                combo.classList.remove("open");
                combo.querySelector("[data-combo-toggle]")?.setAttribute("aria-expanded", "false");
            });
            overlay.querySelectorAll(".alm-selector-tools[open]").forEach((menu) => {
                if (!menu.contains(event.target)) menu.open = false;
            });
            overlay.querySelectorAll(".alm-favorite-controls.is-organizing").forEach((section) => {
                if (!section.contains(event.target)) closeFavoritePopover(section);
            });
        };
        overlay.addEventListener("pointerdown", closeOutside, true);
        overlay.addEventListener("focusin", closeOutside, true);
    }
    root.querySelectorAll("[data-favorite-organize-toggle]").forEach((toggle) => {
        const section = toggle.closest(".alm-favorite-controls");
        const popover = section.querySelector(".alm-favorite-popover");
        toggle.onclick = () => {
            if (section.classList.contains("is-organizing")) { closeFavoritePopover(section); return; }
            popover.hidden = false;
            section.classList.add("is-organizing");
            section.classList.remove("opens-above");
            const boundary = section.closest(".alm-detail")?.getBoundingClientRect();
            if (boundary && popover.getBoundingClientRect().bottom > boundary.bottom - 12) section.classList.add("opens-above");
            toggle.setAttribute("aria-expanded", "true");
            popover.querySelector("select")?.focus({ preventScroll: true });
        };
        section.onkeydown = (event) => {
            if (event.key !== "Escape" || !section.classList.contains("is-organizing")) return;
            event.preventDefault();
            event.stopPropagation();
            closeFavoritePopover(section, true);
        };
        popover.onchange = () => closeFavoritePopover(section, true);
    });
    root.querySelectorAll('.alm-selector-tools').forEach((menu) => {
        const summary = menu.querySelector("summary");
        const items = [...menu.querySelectorAll("button")].filter((button) => !button.disabled);
        summary.onkeydown = (event) => {
            if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
            event.preventDefault();
            menu.open = true;
            (event.key === "ArrowDown" ? items[0] : items.at(-1))?.focus();
        };
        menu.onkeydown = (event) => {
            const index = items.indexOf(event.target);
            if (index < 0 || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
                : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
            items[next]?.focus();
        };
        menu.onfocusout = (event) => { if (!menu.contains(event.relatedTarget)) menu.open = false; };
        menu.addEventListener("toggle", () => {
            if (!menu.open) return;
            root.querySelectorAll('.alm-selector-tools[open]').forEach((other) => { if (other !== menu) other.open = false; });
        });
        menu.querySelectorAll('button').forEach((button) => button.addEventListener("click", () => { menu.open = false; }));
    });
}

export function renderSelectorSort(selectedSort) {
    return `
        <details class="alm-selector-tools alm-selector-sort">
            <summary aria-label="${escapeAttr(t("Sort"))}" aria-haspopup="menu"><span>${escapeHtml(t(selectedSort))}</span>${selectorIcon("chevron")}</summary>
            <div class="alm-selector-menu" role="menu" aria-label="${escapeAttr(t("Sort"))}">
                ${["Highest Rated", "Most Downloaded", "Newest"].map((sort) => `<button type="button" role="menuitemradio" aria-checked="${selectedSort === sort}" data-selector-sort="${sort}">${escapeHtml(t(sort))}</button>`).join("")}
            </div>
        </details>
    `;
}

export function renderSelectorStats(downloads, likes, size = "") {
    return `<div class="alm-card-stat-row" aria-label="${escapeAttr(t("Model stats"))}">
        <span class="alm-card-stat-chip is-downloads" title="${escapeAttr(t("Download count"))}">${selectorIcon("downloads")}<span>${escapeHtml(downloads)}</span></span>
        <span class="alm-card-stat-chip is-likes" title="${escapeAttr(t("Likes"))}">${selectorIcon("heart")}<span>${escapeHtml(likes)}</span></span>
        ${size ? `<span class="alm-card-stat-chip is-size" title="${escapeAttr(t("Size"))}"><span>${escapeHtml(size)}</span></span>` : ""}
    </div>`;
}

export function animateSelectorFolder(button, update) {
    if (button.dataset.selectorAnimating) return;
    const nav = button.closest(".alm-selector-nav");
    const attribute = button.hasAttribute("data-lora-folder-toggle") ? "data-lora-folder-toggle" : "data-local-folder-toggle";
    const value = button.getAttribute(attribute);
    const focused = document.activeElement === button;
    const findButton = () => [...nav.querySelectorAll(`[${attribute}]`)].find((item) => item.getAttribute(attribute) === value);
    const refresh = () => {
        update();
        const next = findButton();
        if (focused) next?.focus({ preventScroll: true });
        return next;
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { refresh(); return; }
    const expanded = button.getAttribute("aria-expanded") === "true";
    const target = expanded ? button : refresh();
    const children = target?.closest(".alm-folder-node")?.querySelector(":scope > .alm-folder-children");
    if (!children) { if (expanded) refresh(); return; }
    target.dataset.selectorAnimating = "true";
    const height = children.scrollHeight;
    target.classList.toggle("expanded", !expanded);
    target.setAttribute("aria-expanded", String(!expanded));
    children.style.overflow = "clip";
    const animation = children.animate([
        { height: expanded ? `${height}px` : "0px", opacity: expanded ? 1 : .35 },
        { height: expanded ? "0px" : `${height}px`, opacity: expanded ? .35 : 1 },
    ], { duration: 210, easing: "cubic-bezier(.2,.7,.2,1)" });
    animation.finished.catch(() => {}).finally(() => {
        delete target.dataset.selectorAnimating;
        children.style.removeProperty("overflow");
        if (expanded && nav.isConnected) refresh();
    });
}
