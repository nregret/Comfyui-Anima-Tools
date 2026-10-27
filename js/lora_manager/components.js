import { PROMO_LINKS } from "../anima_promo_links.js";
import { t } from "./i18n.js";

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
}

function githubIcon() {
    return `
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.53 2.87 8.37 6.84 9.72.5.1.68-.22.68-.49v-1.88c-2.78.62-3.37-1.22-3.37-1.22-.45-1.19-1.11-1.51-1.11-1.51-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.98c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9v2.8c0 .27.18.59.69.49A10.13 10.13 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z"/>
        </svg>
    `;
}

export function renderPromoLinks() {
    return `
        <div class="alm-promo-links" aria-label="${escapeAttr(t("Project Links"))}">
            <a class="alm-promo-link alm-promo-github" href="${escapeAttr(PROMO_LINKS.github)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(t("Open GitHub"))}" aria-label="${escapeAttr(t("Open GitHub"))}">
                ${githubIcon()}
            </a>
            <a class="alm-promo-link alm-promo-afdian" href="${escapeAttr(PROMO_LINKS.afdian)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(t("Support on Afdian"))}" aria-label="${escapeAttr(t("Support on Afdian"))}">
                <span>💗 爱发电</span>
            </a>
        </div>
    `;
}

export function ensureNotificationHost(shell) {
    if (!shell) return null;
    let host = shell.querySelector(":scope > .alm-notification-host");
    if (host) return host;
    host = document.createElement("div");
    host.className = "alm-notification-host";
    host.setAttribute("aria-live", "polite");
    host.setAttribute("aria-atomic", "true");
    const topbar = shell.querySelector(":scope > .alm-topbar");
    if (topbar) topbar.insertAdjacentElement("afterend", host);
    else shell.prepend(host);
    return host;
}

// Notices animate in when inserted; rewriting an unchanged notice on every
// render or poll would replay that animation and make it flicker.
const renderedNotices = new WeakMap();

export function updateNotificationHost(host, options = {}) {
    if (!host) return false;
    const error = String(options.error || "").trim();
    const toast = String(options.toast || "").trim();
    const signature = JSON.stringify([error, toast, options.toastAction?.label || "", typeof options.onDismissError === "function"]);
    if (renderedNotices.get(host) !== signature) {
        renderedNotices.set(host, signature);
        host.innerHTML = renderNotices(error, toast, options);
    }
    const dismiss = host.querySelector(".alm-notice-dismiss");
    if (dismiss) dismiss.onclick = options.onDismissError;
    const action = host.querySelector(".alm-notice-action");
    if (action) action.onclick = options.toastAction.onClick;
    return true;
}

function renderNotices(error, toast, options) {
    return `
        ${error ? `
            <div class="alm-notice alm-error" role="alert">
                <i class="alm-notice-icon" aria-hidden="true">!</i>
                <span>${escapeHtml(error)}</span>
                ${typeof options.onDismissError === "function" ? `<button class="alm-notice-dismiss" type="button" aria-label="${escapeAttr(t("Dismiss"))}">×</button>` : ""}
            </div>
        ` : ""}
        ${toast ? `
            <div class="alm-notice alm-toast" role="status">
                <i class="alm-notice-icon" aria-hidden="true">✓</i>
                <span>${escapeHtml(toast)}</span>
                ${options.toastAction ? `<button class="alm-notice-action" type="button">${escapeHtml(options.toastAction.label)}</button>` : ""}
            </div>
        ` : ""}
    `;
}

export function renderToolbarSearchField(options = {}) {
    const value = String(options.value || "");
    const inputAttrs = options.inputAttrs ? ` ${String(options.inputAttrs).trim()}` : "";
    const inputClass = String(options.className || "").replace(/[^a-z0-9_-]+/gi, " ").trim();
    const clearAction = String(options.clearAction || "clear-search");
    const loading = options.loading === true;
    return `
        <div class="alm-search-wrap ${loading ? "is-loading" : ""}">
            <span class="alm-search-mark" aria-hidden="true"></span>
            <input class="alm-input alm-search${inputClass ? ` ${escapeAttr(inputClass)}` : ""}"${inputAttrs} value="${escapeAttr(value)}" placeholder="${escapeAttr(options.placeholder || t("Search"))}" autocomplete="off" />
            <span class="alm-search-spinner" aria-hidden="true" ${loading ? "" : "hidden"}></span>
            <button class="alm-search-clear" type="button" data-action="${escapeAttr(clearAction)}" title="${escapeAttr(t("Clear search"))}" aria-label="${escapeAttr(t("Clear search"))}" ${value ? "" : "hidden"}>×</button>
        </div>
    `;
}

export function renderSearchToolbar(options = {}) {
    const title = String(options.title || "");
    const subtitle = String(options.subtitle || "");
    const headingHtml = options.headingHtml == null ? "" : String(options.headingHtml);
    const className = String(options.className || "").replace(/[^a-z0-9_-]+/gi, " ").trim();
    const filterBarHtml = String(options.filterBarHtml || "").trim();
    return `
        <div class="alm-toolbar alm-search-toolbar${className ? ` ${escapeAttr(className)}` : ""}${filterBarHtml ? " has-filter-bar" : ""}">
            <div class="alm-search-toolbar-main">
                <div class="alm-search-toolbar-heading" title="${escapeAttr([title, subtitle].filter(Boolean).join(" · "))}">
                    ${headingHtml || `
                        ${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""}
                        <h2>${escapeHtml(title)}</h2>
                    `}
                </div>
                ${String(options.searchHtml || "")}
            </div>
            <div class="alm-search-toolbar-actions">${String(options.actionsHtml || "")}</div>
            ${filterBarHtml ? `<div class="alm-search-toolbar-filters">${filterBarHtml}</div>` : ""}
        </div>
    `;
}

export function renderActiveFilterChips(chips = [], clearAllAction = "reset-all-filters") {
    const valid = (Array.isArray(chips) ? chips : []).filter((chip) => chip && chip.value);
    if (!valid.length) return "";
    return `
        <div class="alm-active-filters" role="region" aria-label="${escapeAttr(t("Adjust filters"))}">
            <div class="alm-active-filter-list">
                ${valid.map((chip) => `
                    <button class="alm-active-filter-chip" type="button" data-action="${escapeAttr(chip.clearAction || "")}" data-clear-filter="${escapeAttr(chip.key)}" title="${escapeAttr(`${chip.label}: ${chip.value}`)}">
                        <small>${escapeHtml(chip.label)}:</small>
                        <b>${escapeHtml(chip.value)}</b>
                        <i aria-hidden="true">×</i>
                    </button>
                `).join("")}
            </div>
            ${valid.length > 1 ? `
                <button class="alm-reset-filters-btn" type="button" data-action="${escapeAttr(clearAllAction)}">${escapeHtml(t("Reset filters"))}</button>
            ` : ""}
        </div>
    `;
}

export function renderSearchCombo(options = {}) {
    const id = String(options.id || "combo");
    const value = String(options.value || "").trim();
    const items = (Array.isArray(options.items) ? options.items : [])
        .map((item) => String(item?.name || item || "").trim())
        .filter(Boolean);
    const uniqueItems = Array.from(new Set(items));
    const display = value || options.placeholder || "Choose...";
    const clearAttr = options.clearAttr ? ` ${String(options.clearAttr).trim()}` : "";
    return `
        <div class="alm-combo ${value ? "has-value" : ""}" data-combo="${escapeAttr(id)}">
            <button class="alm-combo-control" type="button" data-combo-toggle aria-haspopup="listbox" aria-expanded="false" title="${escapeAttr(display)}">
                <span class="alm-combo-value ${value ? "" : "placeholder"}">${escapeHtml(display)}</span>
                <span class="alm-combo-arrow" aria-hidden="true">⌄</span>
            </button>
            <button class="alm-combo-clear" type="button" data-combo-clear${clearAttr} title="${escapeAttr(options.clearTitle || t("Clear"))}" aria-label="${escapeAttr(options.clearTitle || t("Clear"))}" ${value ? "" : "hidden"}>×</button>
            <div class="alm-combo-popover" data-combo-popover>
                <input class="alm-combo-search" data-combo-search value="" placeholder="${escapeAttr(options.searchPlaceholder || "Search...")}" autocomplete="off" />
                <div class="alm-combo-list" data-combo-list role="listbox">
                    ${uniqueItems.map((name) => `
                        <button class="alm-combo-option ${value && name.toLowerCase() === value.toLowerCase() ? "active" : ""}" type="button" data-combo-option="${escapeAttr(name)}" role="option" aria-selected="${value && name.toLowerCase() === value.toLowerCase() ? "true" : "false"}">
                            <span>${escapeHtml(name)}</span>
                        </button>
                    `).join("")}
                    <div class="alm-combo-empty" data-combo-empty ${uniqueItems.length ? "hidden" : ""}>${escapeHtml(options.emptyText || "No options found")}</div>
                </div>
            </div>
        </div>
    `;
}

export function bindSearchCombo(combo, applyValue) {
    if (!combo || typeof applyValue !== "function") return;
    const toggle = combo.querySelector("[data-combo-toggle]");
    const clearBtn = combo.querySelector("[data-combo-clear]");
    const searchInput = combo.querySelector("[data-combo-search]");
    const options = Array.from(combo.querySelectorAll("[data-combo-option]"));
    const empty = combo.querySelector("[data-combo-empty]");
    let activeIndex = Math.max(0, options.findIndex((option) => option.classList.contains("active")));

    const visibleOptions = () => options.filter((option) => !option.hidden);
    const positionPopover = () => {
        const bounds = (combo.closest(".alm-nav") || document.documentElement).getBoundingClientRect();
        const rect = combo.getBoundingClientRect();
        const spaceAbove = Math.max(0, rect.top - bounds.top - 8);
        const spaceBelow = Math.max(0, bounds.bottom - rect.bottom - 8);
        const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
        const available = Math.max(120, Math.floor(openUp ? spaceAbove : spaceBelow));
        combo.classList.toggle("open-up", openUp);
        combo.style.setProperty("--alm-combo-available-height", `${available}px`);
    };
    const setOpen = (open) => {
        if (open) {
            document.querySelectorAll(".alm-combo.open").forEach((item) => {
                if (item !== combo) {
                    item.classList.remove("open");
                    item.querySelector("[data-combo-toggle]")?.setAttribute("aria-expanded", "false");
                }
            });
            positionPopover();
        }
        combo.classList.toggle("open", open);
        toggle?.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) {
            filterOptions("");
            requestAnimationFrame(() => {
                searchInput?.focus();
                searchInput?.select();
            });
        }
    };
    const setActive = (index, behavior = {}) => {
        const visible = visibleOptions();
        if (!visible.length) {
            activeIndex = -1;
            options.forEach((option) => option.classList.remove("is-key-active"));
            return;
        }
        activeIndex = (index + visible.length) % visible.length;
        options.forEach((option) => option.classList.remove("is-key-active"));
        const option = visible[activeIndex];
        option.classList.add("is-key-active");
        if (behavior.scroll !== false) option.scrollIntoView({ block: "nearest" });
    };
    const filterOptions = (query) => {
        const clean = String(query || "").trim().toLowerCase();
        let visibleCount = 0;
        options.forEach((option) => {
            const value = String(option.dataset.comboOption || "");
            const match = !clean || value.toLowerCase().includes(clean);
            option.hidden = !match;
            if (match) visibleCount += 1;
        });
        if (empty) empty.hidden = visibleCount > 0;
        const visible = visibleOptions();
        const selectedIndex = visible.findIndex((option) => option.classList.contains("active"));
        setActive(selectedIndex >= 0 ? selectedIndex : 0);
    };
    const choose = (value) => {
        setOpen(false);
        applyValue(value);
    };

    toggle.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setOpen(!combo.classList.contains("open"));
    };
    if (clearBtn) {
        clearBtn.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            choose("");
        };
    }
    searchInput.oninput = () => filterOptions(searchInput.value);
    searchInput.onkeydown = (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            toggle?.focus();
            return;
        }
        if (event.key === "Tab") {
            setOpen(false);
            return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setActive(activeIndex + (event.key === "ArrowDown" ? 1 : -1), { scroll: true });
            return;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            const option = visibleOptions()[activeIndex];
            if (option) {
                choose(option.dataset.comboOption || "");
            } else {
                const typed = String(searchInput.value || "").trim();
                if (typed) choose(typed);
            }
        }
    };
    options.forEach((option) => {
        option.onpointerdown = (event) => {
            event.preventDefault();
            event.stopPropagation();
            choose(option.dataset.comboOption || "");
        };
        option.onmouseenter = () => setActive(visibleOptions().indexOf(option), { scroll: false });
    });
}

export function renderCollectionEmptyState(options = {}) {
    const kind = String(options.kind || "default").replace(/[^a-z0-9_-]+/gi, "-");
    const hints = (Array.isArray(options.hints) ? options.hints : [])
        .map((hint) => String(hint || "").trim())
        .filter(Boolean);
    return `
        <div class="alm-empty-state" data-empty-kind="${escapeAttr(kind)}" role="status">
            <div class="alm-empty-detail-art" aria-hidden="true">
                <span class="alm-empty-detail-orbit orbit-one"></span>
                <span class="alm-empty-detail-orbit orbit-two"></span>
                <span class="alm-empty-detail-card card-back"></span>
                <span class="alm-empty-detail-card card-front"><i></i><i></i><i></i></span>
                <span class="alm-empty-state-symbol"></span>
                <span class="alm-empty-detail-spark spark-one"></span>
                <span class="alm-empty-detail-spark spark-two"></span>
            </div>
            <div class="alm-empty-detail-copy">
                ${options.kicker ? `<span class="alm-empty-detail-kicker">${escapeHtml(options.kicker)}</span>` : ""}
                <h2>${escapeHtml(options.title || t("Nothing here yet"))}</h2>
                ${options.description ? `<p>${escapeHtml(options.description)}</p>` : ""}
            </div>
            ${hints.length ? `<div class="alm-empty-detail-features" aria-hidden="true">${hints.map((hint) => `<span>${escapeHtml(hint)}</span>`).join("")}</div>` : ""}
        </div>
    `;
}

function renderFavoriteStar() {
    return '<svg class="alm-favorite-star" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>';
}

export function renderFavoriteControls(options = {}) {
    const favorite = options.favorite === true;
    const folders = Array.isArray(options.folders) ? options.folders : [];
    const folderId = String(options.folderId || "");
    const toggleAction = String(options.toggleAction || "toggle-favorite");
    const folderAction = String(options.folderAction || "assign-favorite-folder");
    const compact = options.compact === true;
    return `
        <section class="alm-favorite-controls ${favorite ? "is-active" : ""} ${compact ? "is-compact" : ""}" aria-label="${escapeAttr(t("Favorite"))}">
            <button class="alm-favorite-toggle ${favorite ? "is-active" : ""}" data-action="${escapeAttr(toggleAction)}" type="button" aria-pressed="${favorite}" title="${escapeAttr(t(favorite ? "Click to remove from favorites" : "Save for later without downloading"))}">
                <span class="alm-favorite-toggle-star" aria-hidden="true">${renderFavoriteStar()}</span>
                <span class="alm-favorite-toggle-copy">
                    <b>${escapeHtml(t(favorite ? "Favorited" : "Favorite"))}</b>
                    ${compact ? "" : `<small>${escapeHtml(t(favorite ? "Click to remove from favorites" : "Save for later without downloading"))}</small>`}
                </span>
            </button>
            <button class="alm-favorite-organize" data-favorite-organize-toggle type="button" aria-label="${escapeAttr(t("Favorite Folder"))}" aria-expanded="false" title="${escapeAttr(t(favorite ? "Favorite Folder" : "Favorite to organize"))}" ${favorite ? "" : "disabled"}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z"/></svg>
            </button>
            <div class="alm-favorite-popover" hidden>
                <label class="alm-favorite-folder-select" title="${escapeAttr(t("Favorite Folder"))}">
                    <span>${escapeHtml(t("Favorite Folder"))}</span>
                    <select class="alm-input" data-action="${escapeAttr(folderAction)}">
                        <option value="" ${folderId ? "" : "selected"}>${escapeHtml(t("No folder"))}</option>
                        ${folders.map((folder) => `<option value="${escapeAttr(folder.id)}" ${folderId === String(folder.id) ? "selected" : ""}>${escapeHtml(folder.name)}</option>`).join("")}
                    </select>
                </label>
            </div>
        </section>
    `;
}

export function renderFavoriteCardMark(favorite, interactive = true) {
    if (!interactive) {
        return favorite
            ? `<span class="alm-card-favorite-mark is-active" title="${escapeAttr(t("Favorited"))}" aria-label="${escapeAttr(t("Favorited"))}"><span aria-hidden="true">${renderFavoriteStar()}</span></span>`
            : "";
    }
    return `
        <button
            class="alm-card-favorite-mark alm-card-favorite-btn ${favorite ? "is-active" : ""}"
            type="button"
            data-card-favorite
            title="${escapeAttr(t(favorite ? "Unfavorite" : "Favorite"))}"
            aria-label="${escapeAttr(t(favorite ? "Unfavorite" : "Favorite"))}"
            aria-pressed="${favorite ? "true" : "false"}"
        >
            <span aria-hidden="true">${renderFavoriteStar()}</span>
        </button>
    `;
}

export function syncFavoriteCardMark(card, favorite) {
    if (!card) return false;
    const current = [...card.children].find((child) => child.classList?.contains("alm-card-favorite-mark"));
    if (current && current.classList.contains("alm-card-favorite-btn")) {
        current.classList.toggle("is-active", Boolean(favorite));
        current.title = t(favorite ? "Unfavorite" : "Favorite");
        current.setAttribute("aria-label", t(favorite ? "Unfavorite" : "Favorite"));
        current.setAttribute("aria-pressed", favorite ? "true" : "false");
        return true;
    }
    if (!favorite) {
        current?.remove();
        return true;
    }
    if (!current) card.insertAdjacentHTML("afterbegin", renderFavoriteCardMark(true));
    return true;
}

export function syncFavoriteControls(root, favorite, folderId = "") {
    root?.querySelectorAll(".alm-favorite-controls").forEach((section) => {
        const toggle = section.querySelector(".alm-favorite-toggle");
        const organize = section.querySelector("[data-favorite-organize-toggle]");
        if (!toggle || !organize) return;
        section.classList.toggle("is-active", favorite);
        toggle.classList.toggle("is-active", favorite);
        toggle.setAttribute("aria-pressed", String(favorite));
        toggle.title = t(favorite ? "Click to remove from favorites" : "Save for later without downloading");
        toggle.querySelector("b").textContent = t(favorite ? "Favorited" : "Favorite");
        const hint = toggle.querySelector("small");
        if (hint) hint.textContent = toggle.title;
        organize.disabled = !favorite;
        organize.title = t(favorite ? "Favorite Folder" : "Favorite to organize");
        const select = section.querySelector("select");
        if (select) select.value = folderId || "";
        if (!favorite) {
            section.classList.remove("is-organizing");
            section.querySelector(".alm-favorite-popover").hidden = true;
            organize.setAttribute("aria-expanded", "false");
        }
    });
}

export function renderFavoriteFolderSidebar(options = {}) {
    const folders = Array.isArray(options.folders) ? options.folders : [];
    const items = Array.isArray(options.items) ? options.items : [];
    const selectedId = String(options.selectedId || "");
    const editor = options.editor && typeof options.editor === "object" ? options.editor : null;
    const countFor = (folderId) => items.filter((item) => String(item?.folder_id || "") === folderId).length;
    return `
        <div class="alm-nav-group alm-favorite-folder-group">
            <div class="alm-favorite-folder-head">
                <div class="alm-nav-title">${escapeHtml(t("Local Favorites"))}</div>
                <button class="alm-favorite-folder-add" data-favorite-folder-add type="button" title="${escapeAttr(t("New Favorite Folder"))}" aria-label="${escapeAttr(t("New Favorite Folder"))}"><span aria-hidden="true"></span></button>
            </div>
            ${editor ? `
                <div class="alm-favorite-folder-editor" data-favorite-folder-editor data-mode="${escapeAttr(editor.mode || "create")}" data-folder-id="${escapeAttr(editor.id || "")}">
                    <input class="alm-input" data-favorite-folder-name value="${escapeAttr(editor.value || "")}" placeholder="${escapeAttr(t(editor.mode === "rename" ? "Rename Favorite Folder" : "New Favorite Folder"))}" maxlength="80" autocomplete="off" />
                    <button data-favorite-folder-save type="button" title="${escapeAttr(t("Save"))}">✓</button>
                    <button data-favorite-folder-cancel type="button" title="${escapeAttr(t("Cancel"))}">×</button>
                </div>
            ` : ""}
            <button class="alm-nav-btn ${selectedId ? "" : "active"}" data-favorite-folder="">
                <span>${escapeHtml(t("All Favorites"))}</span><b>${items.length}</b>
            </button>
            <div class="alm-favorite-folder-list">
                ${folders.map((folder) => `
                    <div class="alm-favorite-folder-row">
                        <button class="alm-nav-btn ${selectedId === String(folder.id) ? "active" : ""}" data-favorite-folder="${escapeAttr(folder.id)}" title="${escapeAttr(folder.name)}">
                            <span>${escapeHtml(folder.name)}</span><b>${countFor(String(folder.id))}</b>
                        </button>
                        <div class="alm-favorite-folder-actions">
                            <button data-favorite-folder-rename="${escapeAttr(folder.id)}" data-folder-name="${escapeAttr(folder.name)}" type="button" title="${escapeAttr(t("Rename"))}" aria-label="${escapeAttr(t("Rename"))}">✎</button>
                            <button data-favorite-folder-delete="${escapeAttr(folder.id)}" type="button" title="${escapeAttr(t("Delete"))}" aria-label="${escapeAttr(t("Delete"))}">×</button>
                        </div>
                    </div>
                `).join("")}
            </div>
        </div>
    `;
}

export function bindFavoriteFolderSidebar(root, callbacks = {}) {
    if (!root) return;
    root.querySelectorAll("[data-favorite-folder]").forEach((button) => {
        button.onclick = () => callbacks.onSelect?.(button.dataset.favoriteFolder || "");
    });
    const add = root.querySelector("[data-favorite-folder-add]");
    if (add) add.onclick = () => callbacks.onEdit?.({ mode: "create", id: "", value: "" });
    root.querySelectorAll("[data-favorite-folder-rename]").forEach((button) => {
        button.onclick = (event) => {
            event.stopPropagation();
            callbacks.onEdit?.({
                mode: "rename",
                id: button.dataset.favoriteFolderRename || "",
                value: button.dataset.folderName || "",
            });
        };
    });
    root.querySelectorAll("[data-favorite-folder-delete]").forEach((button) => {
        button.onclick = (event) => {
            event.stopPropagation();
            callbacks.onDelete?.(button.dataset.favoriteFolderDelete || "");
        };
    });
    const editor = root.querySelector("[data-favorite-folder-editor]");
    const input = editor?.querySelector("[data-favorite-folder-name]");
    const save = editor?.querySelector("[data-favorite-folder-save]");
    const cancel = editor?.querySelector("[data-favorite-folder-cancel]");
    const submit = () => callbacks.onSave?.({
        mode: editor?.dataset.mode || "create",
        id: editor?.dataset.folderId || "",
        value: input?.value || "",
    });
    if (save) save.onclick = submit;
    if (cancel) cancel.onclick = () => callbacks.onEdit?.(null);
    if (input) {
        input.onkeydown = (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                submit();
            } else if (event.key === "Escape") {
                event.preventDefault();
                callbacks.onEdit?.(null);
            }
        };
        requestAnimationFrame(() => {
            input.focus({ preventScroll: true });
            input.select();
        });
    }
}
