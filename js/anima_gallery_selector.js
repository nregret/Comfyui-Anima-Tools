/**
 * Shared popup shell for the Anima tag selectors (artist, character, clothing,
 * background, pose). Selector adapters provide data, filters, card metadata and
 * prompt output; this module owns layout, selection, favorites, paging and the
 * selector tabs of one prompt node.
 */
import { t } from "./i18n.js";
import { markImageLoaded, isImageLoaded } from "./anima_image_utils.js";
import { PROMO_LINKS } from "./anima_promo_links.js";
import {
    copyText,
    debounce,
    escapeHtml,
    formatCount,
    injectSelectorStyles,
    openFormDialog,
    selectorIcon,
    showToast,
    splitPromptTokens,
} from "./anima_selector_ui.js";

const DEFAULT_GROUP = "default";
const ACTIVE_SELECTOR_STORAGE_KEY = "anima-prompt-selector-active";
const TABS = [
    { id: "all", icon: "grid", label: "All" },
    { id: "favorites", icon: "star", label: "Favorites" },
    { id: "selected", icon: "applied", label: "Selected" },
];

let closeActiveSelector = null;
let openToken = null;

async function fetchFavoriteSection(kind) {
    try {
        const response = await fetch("/anima-tools/favorites");
        if (response.ok) return (await response.json())?.[kind] || {};
    } catch (error) {
        console.error(`[Anima Tools] Failed to load ${kind} favorites`, error);
    }
    return {};
}

export function createFavoriteStore(kind, section, favoriteKey) {
    let groups = (Array.isArray(section.groups) ? section.groups : []).filter(group => group?.id);
    if (!groups.some(group => group.id === DEFAULT_GROUP)) {
        groups.unshift({ id: DEFAULT_GROUP, name: "Default Favorites", isSystem: true });
    }
    let customs = [];
    let records = new Map();
    for (const item of Array.isArray(section.items) ? section.items : []) {
        if (!item) continue;
        if (item.isCustom) {
            customs.push(item);
            continue;
        }
        const key = favoriteKey(item);
        if (!key) continue;
        if (!Array.isArray(item.groupIds) || !item.groupIds.length) item.groupIds = [DEFAULT_GROUP];
        records.set(key, item);
    }

    async function persist() {
        try {
            const response = await fetch("/anima-tools/favorites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [kind]: { groups, items: [...customs, ...records.values()] } }),
            });
            if (!response.ok) throw new Error(await response.text());
            return true;
        } catch (error) {
            console.error(`[Anima Tools] Failed to save ${kind} favorites`, error);
            return false;
        }
    }

    // Mutations apply immediately so the UI can re-render optimistically; a failed save restores the snapshot.
    async function commit(mutate) {
        const snapshot = JSON.stringify({ groups, customs, records: [...records] });
        mutate();
        if (await persist()) return true;
        const restored = JSON.parse(snapshot);
        groups = restored.groups;
        customs = restored.customs;
        records = new Map(restored.records);
        return false;
    }

    const inGroup = (item, groupId) => item.groupIds?.includes(groupId);

    return {
        groups: () => groups,
        customs: () => customs,
        record: item => item.isCustom ? item : records.get(favoriteKey(item)),
        isFavorite: item => !item.isCustom && records.has(favoriteKey(item)),
        keysIn: groupId => new Set([...records].filter(([, record]) => inGroup(record, groupId)).map(([key]) => key)),
        customsIn: groupId => customs.filter(item => inGroup(item, groupId)),
        count: groupId => customs.filter(item => inGroup(item, groupId)).length
            + [...records.values()].filter(record => inGroup(record, groupId)).length,
        total: () => customs.length + records.size,
        toggleFavorite: (item, createRecord) => commit(() => {
            const key = favoriteKey(item);
            if (records.has(key)) records.delete(key);
            else records.set(key, { ...createRecord(item), nickname: "", groupIds: [DEFAULT_GROUP] });
        }),
        setGroup: (item, groupId, enabled) => commit(() => {
            const record = records.get(favoriteKey(item));
            record.groupIds = record.groupIds.filter(id => id !== groupId);
            if (enabled) record.groupIds.push(groupId);
            if (!record.groupIds.length) records.delete(favoriteKey(item));
        }),
        setNote: (item, note) => commit(() => {
            const record = item.isCustom ? customs.find(custom => custom.name === item.name) : records.get(favoriteKey(item));
            if (record) record.nickname = note;
        }),
        addCustom: item => commit(() => customs.push(item)),
        removeCustom: item => commit(() => {
            customs = customs.filter(custom => custom.name !== item.name);
        }),
        addGroup: (id, name) => commit(() => groups.push({ id, name, isSystem: false })),
        renameGroup: (id, name) => commit(() => {
            groups.find(group => group.id === id).name = name;
        }),
        // Items that only lived in the removed group move to the default group instead of disappearing.
        removeGroup: id => commit(() => {
            groups = groups.filter(group => group.id !== id);
            [...customs, ...records.values()].forEach(item => {
                if (!inGroup(item, id)) return;
                item.groupIds = item.groupIds.filter(groupId => groupId !== id);
                if (!item.groupIds.length) item.groupIds = [DEFAULT_GROUP];
            });
        }),
    };
}

function readNumber(key) {
    return parseInt(localStorage.getItem(key), 10) || 0;
}

function writeWidget(widget, value) {
    widget.value = value;
    if (widget.inputEl) {
        widget.inputEl.value = value;
        widget.inputEl.dispatchEvent(new Event("input"));
    }
    widget.callback?.(value);
}

function initialOf(text) {
    const clean = String(text || "").replace(/[^\p{L}\p{N}]/gu, "");
    return (clean[0] || "?").toUpperCase();
}

/**
 * Opens the popup for a prompt node with one tab per selector. Selections are kept
 * while switching tabs, and applying writes every selector whose selection changed
 * to its own widget.
 */
export function openPromptSelector(node, title, selectors) {
    const saved = localStorage.getItem(ACTIVE_SELECTOR_STORAGE_KEY);
    const selector = selectors.find(entry => entry.kind === saved && entry.ready()) || selectors.find(entry => entry.ready());
    if (!selector) {
        alert(t(selectors[0].loading));
        return;
    }
    openSelector(selector, { node, title, selectors, pending: new Map(), returnFocus: document.activeElement });
}

async function openSelector(selector, session) {
    injectSelectorStyles();
    const token = openToken = {};
    const { kind } = selector;
    const widget = session.node.widgets.find(entry => entry.name === selector.widgetName);
    const config = selector.createConfig(widget);
    const { data, labels, storage, pageSize } = config;
    const favorites = await fetchFavoriteSection(kind);
    if (token !== openToken) return;
    localStorage.setItem(ACTIVE_SELECTOR_STORAGE_KEY, kind);
    const applyActions = config.applyActions || [{ label: t("Confirm & Apply"), primary: true }];
    const defaultMode = applyActions.find(action => action.primary)?.mode;
    const store = createFavoriteStore(kind, favorites, config.favoriteKey);
    const selection = new Map();
    const pending = session.pending.get(kind);
    (pending ? pending.items : config.initialSelection(store.customs())).forEach(item => selection.set(config.selectionKey(item), item));
    const selectionKeys = () => [...selection.keys()].join("\n");
    const initialKeys = pending ? pending.initialKeys : selectionKeys();

    const saved = config.loadState();
    const state = {
        collection: saved.collection === "all" || store.groups().some(group => group.id === saved.collection) ? saved.collection : "all",
        lastGroup: DEFAULT_GROUP,
        showSelected: false,
        filters: {},
        sort: localStorage.getItem(storage.sort),
        displayMode: config.displayModes ? localStorage.getItem(config.displayModes.storageKey) : "",
        query: "",
        page: readNumber(storage.page) || 1,
        items: [],
        pageItems: [],
        focus: null,
        sections: [],
        filtersOpen: window.matchMedia("(min-width: 1180px)").matches,
    };
    if (!config.sortOptions.some(option => option.value === state.sort)) state.sort = config.defaultSort;
    if (config.displayModes && !config.displayModes.options.some(option => option.value === state.displayMode)) {
        state.displayMode = config.displayModes.defaultValue;
    }
    if (state.collection !== "all") state.lastGroup = state.collection;

    const ctx = {
        get displayMode() { return state.displayMode; },
        isFavorite: item => store.isFavorite(item),
    };
    let filterDefs = config.filters(ctx);
    filterDefs.forEach(def => {
        const valid = new Set(def.options.map(option => option.value));
        const value = saved.filters?.[def.id];
        state.filters[def.id] = def.multiple
            ? (Array.isArray(value) ? value.filter(entry => valid.has(entry)) : [])
            : (valid.has(value) ? value : null);
    });

    const overlay = document.createElement("div");
    overlay.className = "anima-sel-overlay";
    overlay.dataset.kind = kind;
    overlay.innerHTML = `
        <div class="anima-sel-shell" role="dialog" aria-modal="true" aria-label="${escapeHtml(session.title)}" style="--anima-card-aspect: ${config.cardAspect}">
            <header class="anima-sel-topbar">
                <nav class="anima-sel-kinds" aria-label="${escapeHtml(session.title)}"></nav>
                <div class="anima-sel-topbar-actions">
                    <button class="anima-sel-filter-toggle" type="button" data-action="toggle-filters" aria-label="${escapeHtml(t("Adjust Filters"))}">${selectorIcon("panel")}<span>${escapeHtml(t("Adjust Filters"))}</span></button>
                    <button class="anima-sel-close" type="button" data-action="close" aria-label="${escapeHtml(t("Close"))}" title="${escapeHtml(t("Close"))} (Esc)">${selectorIcon("close")}</button>
                </div>
            </header>
            <div class="anima-sel-workspace">
                <nav class="anima-sel-tabs" role="tablist" aria-orientation="vertical"></nav>
                <div class="anima-sel-layout">
                    <button class="anima-sel-filter-backdrop" type="button" data-action="close-filters" aria-label="${escapeHtml(t("Close"))}"></button>
                    <aside class="anima-sel-nav" aria-label="${escapeHtml(t("Adjust Filters"))}"></aside>
                    <main class="anima-sel-body">
                        <header class="anima-sel-toolbar">
                            <div class="anima-sel-toolbar-top">
                                <div class="anima-sel-page-heading"><h2></h2><span class="anima-sel-total"></span></div>
                                <div class="anima-sel-actions"></div>
                            </div>
                            <label class="anima-sel-search">
                                ${selectorIcon("search")}
                                <input type="search" placeholder="${escapeHtml(labels.search)}" aria-label="${escapeHtml(labels.search)}" autocomplete="off" data-search>
                                <button class="anima-sel-search-clear" type="button" data-action="search-clear" aria-label="${escapeHtml(t("Clear search"))}" hidden>${selectorIcon("close")}</button>
                            </label>
                            <div class="anima-sel-chips" hidden></div>
                        </header>
                        <div class="anima-sel-split">
                            <div class="anima-sel-results"></div>
                            <aside class="anima-sel-detail" aria-label="${escapeHtml(t("Details"))}"></aside>
                        </div>
                        <div class="anima-sel-pager"></div>
                    </main>
                </div>
            </div>
            <footer class="anima-sel-footer">
                <div class="anima-sel-footer-side">
                    <button class="anima-sel-status" type="button" data-action="tab" data-tab="selected">${selectorIcon("check")}<span></span></button>
                    <div class="anima-sel-links">
                        <a href="${PROMO_LINKS.github}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(t("Open GitHub"))}">${selectorIcon("github")}GitHub</a>
                        <a href="${PROMO_LINKS.afdian}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(t("Support on Afdian"))}">爱发电</a>
                    </div>
                    <span class="anima-sel-escape"><kbd>Esc</kbd> ${escapeHtml(t("Close"))}</span>
                </div>
                <div class="anima-sel-footer-actions">
                    <button class="anima-sel-button" type="button" data-action="close">${escapeHtml(t("Cancel"))}</button>
                    ${applyActions.map((action, index) => `<button class="anima-sel-button ${action.primary ? "is-primary" : ""}" type="button" data-action="apply" data-apply="${index}">${escapeHtml(action.label)}</button>`).join("")}
                </div>
            </footer>
            <div class="anima-sel-toasts" aria-live="polite"></div>
        </div>
    `;

    const shell = overlay.querySelector(".anima-sel-shell");
    const kindsEl = overlay.querySelector(".anima-sel-kinds");
    const tabsEl = overlay.querySelector(".anima-sel-tabs");
    const layoutEl = overlay.querySelector(".anima-sel-layout");
    const navEl = overlay.querySelector(".anima-sel-nav");
    const filterToggle = overlay.querySelector('[data-action="toggle-filters"]');
    const headingEl = overlay.querySelector(".anima-sel-page-heading h2");
    const totalEl = overlay.querySelector(".anima-sel-total");
    const actionsEl = overlay.querySelector(".anima-sel-actions");
    const searchInput = overlay.querySelector("[data-search]");
    const searchClear = overlay.querySelector('[data-action="search-clear"]');
    const chipsEl = overlay.querySelector(".anima-sel-chips");
    const splitEl = overlay.querySelector(".anima-sel-split");
    const resultsEl = overlay.querySelector(".anima-sel-results");
    const detailEl = overlay.querySelector(".anima-sel-detail");
    const pagerEl = overlay.querySelector(".anima-sel-pager");
    const statusEl = overlay.querySelector(".anima-sel-status span");
    const toastHost = overlay.querySelector(".anima-sel-toasts");

    const imageLoaders = new WeakMap();
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            observer.unobserve(entry.target);
            imageLoaders.get(entry.target)?.();
        });
    }, { root: resultsEl, rootMargin: "400px 0px" });

    const toast = (message, tone) => showToast(toastHost, message, { tone });
    const currentTab = () => state.showSelected ? "selected" : (state.collection === "all" ? "all" : "favorites");
    const groupName = group => group.id === DEFAULT_GROUP ? t("My Favorites") : group.name;
    const isNarrow = query => window.matchMedia(query).matches;
    const totalPages = () => Math.max(1, Math.ceil(state.items.length / pageSize));
    const hasActiveFilters = () => filterDefs.some(def => def.multiple ? state.filters[def.id].length : state.filters[def.id]);
    const keyOf = item => config.selectionKey(item);

    function filterValues(def) {
        const value = state.filters[def.id];
        return def.multiple ? value : (value ? [value] : []);
    }

    function optionLabel(def, value) {
        return def.options.find(option => option.value === value)?.label || value;
    }

    function persistState() {
        config.saveState({ collection: state.collection, filters: state.filters });
    }

    function computeItems() {
        let customs = [];
        let items = [];
        const tab = currentTab();
        if (tab === "selected") {
            selection.forEach(item => (item.isCustom ? customs : items).push(item));
        } else if (tab === "favorites") {
            const keys = store.keysIn(state.collection);
            items = data.filter(item => keys.has(config.favoriteKey(item)));
            customs = store.customsIn(state.collection);
        } else {
            items = data.slice();
        }
        if (tab !== "selected") {
            const active = filterDefs.filter(def => filterValues(def).length);
            if (active.length) items = items.filter(item => active.every(def => def.test(item, state.filters[def.id])));
        }
        const query = state.query.trim().toLowerCase();
        if (query) {
            items = items.filter(item => config.matches(item, query));
            customs = customs.filter(item => [item.nickname, item.name, item.customContent].join(" ").toLowerCase().includes(query));
        }
        return [...customs, ...config.sort(items, state.sort, ctx)];
    }

    function refreshItems({ resetPage = false } = {}) {
        state.items = computeItems();
        if (resetPage) {
            state.page = 1;
            resultsEl.scrollTop = 0;
            localStorage.setItem(storage.scroll, 0);
        }
        state.page = Math.min(Math.max(1, state.page), totalPages());
        localStorage.setItem(storage.page, state.page);
        renderToolbar();
        renderResults();
        renderPager();
    }

    function renderTabs() {
        const counts = { favorites: store.total(), selected: selection.size };
        kindsEl.innerHTML = session.selectors.map(entry => {
            const active = entry.kind === kind;
            const count = active ? selection.size : session.pending.get(entry.kind)?.items.length;
            return `<button class="anima-sel-kind ${active ? "active" : ""}" type="button" data-action="kind" data-kind="${entry.kind}" aria-current="${active}">${selectorIcon(entry.icon)}<span>${escapeHtml(t(entry.label))}</span>${count ? `<b>${formatCount(count)}</b>` : ""}</button>`;
        }).join("");
        tabsEl.innerHTML = TABS.map(tab => {
            const active = currentTab() === tab.id;
            return `<button class="anima-sel-tab ${active ? "active" : ""}" type="button" role="tab" aria-selected="${active}" data-action="tab" data-tab="${tab.id}">${selectorIcon(tab.icon)}<span>${escapeHtml(t(tab.label))}</span><b>${counts[tab.id] ? formatCount(counts[tab.id]) : ""}</b></button>`;
        }).join("");
        statusEl.textContent = labels.selected(selection.size);
    }

    function renderNav() {
        const tab = currentTab();
        const visible = tab !== "selected" && (tab === "favorites" || filterDefs.length > 0);
        layoutEl.classList.toggle("has-filters", visible);
        layoutEl.classList.toggle("filters-open", visible && state.filtersOpen);
        filterToggle.hidden = !visible;
        filterToggle.setAttribute("aria-expanded", String(visible && state.filtersOpen));
        if (!visible) {
            navEl.innerHTML = "";
            return;
        }
        const groupsHtml = tab !== "favorites" ? "" : `
            <section class="anima-sel-nav-group">
                <div class="anima-sel-nav-title"><span>${escapeHtml(t("Favorite Groups"))}</span><button class="anima-sel-nav-add" type="button" data-action="group-create" title="${escapeHtml(t("Create Group"))}" aria-label="${escapeHtml(t("Create Group"))}">${selectorIcon("plus")}</button></div>
                <div class="anima-sel-group-list">
                    ${store.groups().map(group => `
                        <div class="anima-sel-group-row ${state.collection === group.id ? "active" : ""}">
                            <button class="anima-sel-nav-btn" type="button" data-action="group" data-group="${escapeHtml(group.id)}" aria-current="${state.collection === group.id}"><span>${selectorIcon(group.id === DEFAULT_GROUP ? "star" : "folder")}${escapeHtml(groupName(group))}</span><b>${store.count(group.id)}</b></button>
                            ${group.id === DEFAULT_GROUP ? "" : `<span class="anima-sel-group-tools">
                                <button type="button" data-action="group-rename" data-group="${escapeHtml(group.id)}" title="${escapeHtml(t("Rename Group"))}" aria-label="${escapeHtml(t("Rename Group"))}">${selectorIcon("edit")}</button>
                                <button class="is-danger" type="button" data-action="group-delete" data-group="${escapeHtml(group.id)}" title="${escapeHtml(t("Delete Group"))}" aria-label="${escapeHtml(t("Delete Group"))}">${selectorIcon("trash")}</button>
                            </span>`}
                        </div>
                    `).join("")}
                </div>
            </section>`;
        navEl.innerHTML = `
            <div class="anima-sel-nav-heading"><h2>${escapeHtml(t("Adjust Filters"))}</h2>${filterDefs.length ? `<button class="anima-sel-reset" type="button" data-action="reset-filters" ${hasActiveFilters() ? "" : "disabled"}>${escapeHtml(t("Reset Filters"))}</button>` : ""}</div>
            ${groupsHtml}
            ${filterDefs.map(def => `
                <section class="anima-sel-nav-group">
                    <div class="anima-sel-nav-title"><span>${escapeHtml(def.label)}</span></div>
                    <div class="anima-sel-combo" data-filter="${escapeHtml(def.id)}">
                        <button class="anima-sel-combo-control" type="button" data-action="combo-toggle" aria-haspopup="listbox" aria-expanded="false"><span class="anima-sel-combo-value"></span>${selectorIcon("chevron")}</button>
                        <button class="anima-sel-combo-clear" type="button" data-action="filter-clear" aria-label="${escapeHtml(t("Clear"))}">${selectorIcon("close")}</button>
                        <div class="anima-sel-combo-popover">
                            ${def.options.length > 8 ? `<div class="anima-sel-combo-search">${selectorIcon("search")}<input data-combo-search placeholder="${escapeHtml(t("Search options..."))}" aria-label="${escapeHtml(t("Search options..."))}" autocomplete="off"></div>` : ""}
                            <div class="anima-sel-combo-list" role="listbox" aria-multiselectable="${Boolean(def.multiple)}">
                                ${def.options.map(option => `<button class="anima-sel-combo-option" type="button" role="option" data-action="filter-option" data-value="${escapeHtml(option.value)}"><span>${escapeHtml(option.label)}</span>${option.count === undefined ? "" : `<small>${option.count}</small>`}</button>`).join("")}
                                <div class="anima-sel-combo-empty" data-combo-empty hidden>${escapeHtml(t("No matching options"))}</div>
                            </div>
                        </div>
                    </div>
                </section>
            `).join("")}
        `;
        navEl.querySelectorAll(".anima-sel-combo").forEach(syncCombo);
    }

    function syncCombo(combo) {
        const def = filterDefs.find(entry => entry.id === combo.dataset.filter);
        const values = filterValues(def);
        const text = values.length > 1 ? t("{count} selected", { count: values.length }) : (values.length ? optionLabel(def, values[0]) : t("Any"));
        const valueEl = combo.querySelector(".anima-sel-combo-value");
        valueEl.textContent = text;
        valueEl.classList.toggle("placeholder", !values.length);
        combo.querySelector(".anima-sel-combo-control").title = values.map(value => optionLabel(def, value)).join(", ");
        combo.classList.toggle("has-value", values.length > 0);
        combo.querySelector(".anima-sel-combo-clear").hidden = !values.length;
        combo.querySelectorAll(".anima-sel-combo-option").forEach(option => {
            const active = values.includes(option.dataset.value);
            option.classList.toggle("active", active);
            option.setAttribute("aria-selected", String(active));
        });
        navEl.querySelector('[data-action="reset-filters"]')?.toggleAttribute("disabled", !hasActiveFilters());
    }

    function setComboOpen(combo, open) {
        combo.classList.toggle("open", open);
        combo.querySelector(".anima-sel-combo-control").setAttribute("aria-expanded", String(open));
        if (!open) return;
        overlay.querySelectorAll(".anima-sel-combo.open").forEach(other => other !== combo && setComboOpen(other, false));
        const search = combo.querySelector("[data-combo-search]");
        (search || combo.querySelector(".anima-sel-combo-option.active") || combo.querySelector(".anima-sel-combo-option"))?.focus({ preventScroll: true });
    }

    function filterCombo(input) {
        const query = input.value.trim().toLowerCase();
        const combo = input.closest(".anima-sel-combo");
        let visible = 0;
        combo.querySelectorAll(".anima-sel-combo-option").forEach(option => {
            const match = !query || option.textContent.toLowerCase().includes(query);
            option.hidden = !match;
            if (match) visible++;
        });
        combo.querySelector("[data-combo-empty]").hidden = visible > 0;
    }

    function menuHtml({ label, icon, current, iconOnly, plain, items }) {
        return `
            <details class="anima-sel-menu-wrap ${plain ? "is-plain" : ""}">
                <summary class="${iconOnly ? "is-icon" : ""}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" aria-haspopup="menu">${selectorIcon(icon)}${current ? `<span>${escapeHtml(current)}</span>${selectorIcon("chevron")}` : ""}</summary>
                <div class="anima-sel-menu" role="menu" aria-label="${escapeHtml(label)}">${items}</div>
            </details>
        `;
    }

    function radioItems(options, current, action) {
        return options.map(option => `<button type="button" role="menuitemradio" aria-checked="${option.value === current}" data-action="${action}" data-value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</button>`).join("");
    }

    function renderToolbar() {
        const tab = currentTab();
        const group = store.groups().find(entry => entry.id === state.collection);
        headingEl.textContent = tab === "selected" ? t("Selected Items") : (tab === "favorites" ? groupName(group) : labels.all);
        totalEl.textContent = state.items.length.toLocaleString();
        const sortLabel = config.sortOptions.find(option => option.value === state.sort)?.label;
        const modes = config.displayModes;
        actionsEl.innerHTML = `
            ${menuHtml({ label: t("Sort"), icon: "sort", current: sortLabel, plain: true, items: radioItems(config.sortOptions, state.sort, "sort") })}
            ${modes ? menuHtml({ label: t("Display Language"), icon: "language", current: modes.options.find(option => option.value === state.displayMode)?.label, plain: true, items: radioItems(modes.options, state.displayMode, "display-mode") }) : ""}
            ${menuHtml({
                label: t("More Actions"),
                icon: "more",
                iconOnly: true,
                items: `
                    <button type="button" role="menuitem" data-action="copy-selected">${selectorIcon("copy")}${escapeHtml(t("Copy Selected"))}</button>
                    <hr>
                    <button class="is-danger" type="button" role="menuitem" data-action="clear-selected" ${selection.size ? "" : "disabled"}>${selectorIcon("trash")}${escapeHtml(t("Clear Selected"))}</button>
                `,
            })}
        `;
        const chips = tab === "selected" ? [] : filterDefs.flatMap(def => filterValues(def).map(value => `
            <button class="anima-sel-chip" type="button" data-action="chip-remove" data-filter="${escapeHtml(def.id)}" data-value="${escapeHtml(value)}" title="${escapeHtml(t("Clear"))}"><small>${escapeHtml(def.label)}</small><b>${escapeHtml(optionLabel(def, value))}</b>${selectorIcon("close")}</button>
        `));
        chipsEl.innerHTML = chips.join("");
        chipsEl.hidden = !chips.length;
    }

    function statHtml(stat) {
        return `<span class="anima-sel-stat ${stat.tone ? `is-${stat.tone}` : ""}" title="${escapeHtml(stat.title || "")}">${stat.icon ? selectorIcon(stat.icon) : ""}<span>${escapeHtml(stat.text)}</span></span>`;
    }

    function cardInfo(item) {
        if (!item.isCustom) return config.card(item, ctx);
        return { title: item.nickname || item.name, meta: item.customContent };
    }

    function placeholderHtml(item, title) {
        return item.isCustom
            ? `<span class="anima-sel-placeholder is-custom">${selectorIcon("file")}</span>`
            : `<span class="anima-sel-placeholder">${escapeHtml(initialOf(title))}</span>`;
    }

    function cardHtml(item, index) {
        const info = cardInfo(item);
        const selected = selection.has(keyOf(item));
        const focused = state.focus && keyOf(state.focus) === keyOf(item);
        const favorite = store.isFavorite(item);
        const note = item.isCustom ? "" : store.record(item)?.nickname;
        const hasImage = !item.isCustom && config.imageUrls(item).length > 0;
        return `
            <article class="anima-sel-card ${selected ? "is-selected" : ""} ${focused ? "is-focused" : ""}" data-index="${index}" tabindex="0" role="checkbox" aria-checked="${selected}" aria-label="${escapeHtml(info.title)}">
                <div class="anima-sel-thumb ${hasImage ? "is-loading" : ""}">${placeholderHtml(item, info.title)}${hasImage ? '<img alt="" decoding="async">' : ""}</div>
                <span class="anima-sel-check">${selectorIcon("check")}</span>
                ${item.isCustom ? `<div class="anima-sel-card-badges"><span class="anima-sel-badge">${escapeHtml(t("Custom"))}</span></div>` : ""}
                <div class="anima-sel-card-tools">
                    ${item.isCustom ? "" : `<button class="anima-sel-card-btn is-favorite ${favorite ? "is-active" : ""}" type="button" data-action="card-favorite" aria-pressed="${favorite}" title="${escapeHtml(favorite ? t("Remove from favorites") : t("Add to favorites"))}" aria-label="${escapeHtml(favorite ? t("Remove from favorites") : t("Add to favorites"))}">${selectorIcon("star")}</button>`}
                    <button class="anima-sel-card-btn" type="button" data-action="card-inspect" title="${escapeHtml(t("Details"))}" aria-label="${escapeHtml(t("Details"))}">${selectorIcon("info")}</button>
                </div>
                <div class="anima-sel-card-body">
                    <div class="anima-sel-card-title" title="${escapeHtml(info.tooltip || info.title)}">${escapeHtml(info.title)}</div>
                    ${note ? `<div class="anima-sel-card-note">${escapeHtml(note)}</div>` : ""}
                    ${info.meta ? `<div class="anima-sel-card-meta">${escapeHtml(info.meta)}</div>` : ""}
                    ${info.stats?.length ? `<div class="anima-sel-card-stats">${info.stats.map(statHtml).join("")}</div>` : ""}
                </div>
            </article>
        `;
    }

    function bindImage(img, urls, { lazy = false, onLoad } = {}) {
        const thumb = img.closest(".anima-sel-thumb");
        const queue = [...urls];
        const cached = queue.findIndex(url => isImageLoaded(url));
        if (cached > 0) queue.unshift(...queue.splice(cached, 1));
        const loadNext = () => {
            const url = queue.shift();
            if (!url) {
                img.remove();
                thumb.classList.remove("is-loading");
                return;
            }
            img.onload = () => {
                img.classList.add("is-loaded");
                thumb.classList.remove("is-loading");
                markImageLoaded(url);
                onLoad?.(url);
            };
            img.onerror = loadNext;
            img.src = url;
        };
        if (!lazy || isImageLoaded(queue[0])) {
            loadNext();
            return;
        }
        imageLoaders.set(img, loadNext);
        observer.observe(img);
    }

    function renderResults() {
        observer.disconnect();
        const start = (state.page - 1) * pageSize;
        state.pageItems = state.items.slice(start, start + pageSize);
        const showCreate = currentTab() === "favorites" && state.collection !== DEFAULT_GROUP && state.page === 1;
        if (!state.pageItems.length && !showCreate) {
            const selectedTab = currentTab() === "selected";
            resultsEl.innerHTML = `
                <div class="anima-sel-empty">
                    ${selectorIcon(selectedTab ? "applied" : "search")}
                    <h3>${escapeHtml(selectedTab ? t("No items selected yet") : labels.empty)}</h3>
                    <p>${escapeHtml(selectedTab ? t("Pick cards from All or Favorites first.") : t("Try another search or clear filters."))}</p>
                </div>
            `;
            return;
        }
        resultsEl.innerHTML = `
            ${showCreate ? `<button class="anima-sel-create-card" type="button" data-action="custom-create">${selectorIcon("plus")}<span>${escapeHtml(t("Create Custom Item"))}</span></button>` : ""}
            ${state.pageItems.map(cardHtml).join("")}
        `;
        resultsEl.querySelectorAll(".anima-sel-card img").forEach(img => {
            const item = state.pageItems[Number(img.closest(".anima-sel-card").dataset.index)];
            bindImage(img, config.imageUrls(item), { lazy: true });
        });
    }

    function syncCard(item) {
        const index = state.pageItems.findIndex(entry => keyOf(entry) === keyOf(item));
        const card = resultsEl.querySelector(`.anima-sel-card[data-index="${index}"]`);
        if (!card) return;
        const selected = selection.has(keyOf(item));
        card.classList.toggle("is-selected", selected);
        card.setAttribute("aria-checked", String(selected));
    }

    function syncFocusMarks() {
        const focusKey = state.focus ? keyOf(state.focus) : null;
        resultsEl.querySelectorAll(".anima-sel-card").forEach(card => {
            card.classList.toggle("is-focused", keyOf(state.pageItems[Number(card.dataset.index)]) === focusKey);
        });
    }

    function renderPager() {
        const total = state.items.length;
        const pages = totalPages();
        const start = total ? (state.page - 1) * pageSize + 1 : 0;
        const end = Math.min(state.page * pageSize, total);
        const pageButton = (target, icon, label, disabled) => `<button class="anima-sel-button" type="button" data-action="page" data-page="${target}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" ${disabled ? "disabled" : ""}>${selectorIcon(icon)}</button>`;
        pagerEl.innerHTML = `
            <div class="anima-sel-pager-stats">${escapeHtml(labels.total({ total, start, end }))}</div>
            <div class="anima-sel-pager-controls">
                ${pageButton("first", "first", t("First"), state.page <= 1)}
                ${pageButton("prev", "prev", t("Prev"), state.page <= 1)}
                <span class="anima-sel-pager-page"><input data-page-input value="${state.page}" inputmode="numeric" aria-label="${escapeHtml(t("Page"))}"><span>/ ${pages}</span></span>
                ${pageButton("next", "next", t("Next"), state.page >= pages)}
                ${pageButton("last", "last", t("Last"), state.page >= pages)}
            </div>
        `;
    }

    function goToPage(page) {
        if (!Number.isFinite(page) || page < 1 || page > totalPages()) {
            renderPager();
            return;
        }
        state.page = page;
        localStorage.setItem(storage.page, page);
        resultsEl.scrollTop = 0;
        localStorage.setItem(storage.scroll, 0);
        renderResults();
        renderPager();
    }

    function sectionHtml(section, index) {
        const tags = section.tags || [];
        let body = `<div class="anima-sel-muted-line">${escapeHtml(section.emptyText || t("No tags available"))}</div>`;
        if (section.loading) body = `<div class="anima-sel-muted-line">${escapeHtml(t("Loading official tags..."))}</div>`;
        else if (tags.length) {
            body = `<div class="anima-sel-tag-list">${tags.map((tag, tagIndex) => `<button class="anima-sel-tag" type="button" data-action="copy-tag" data-section="${index}" data-tag="${tagIndex}" title="${escapeHtml(t("Copy"))}: ${escapeHtml(tag.value)}">${escapeHtml(tag.value)}${tag.hint ? `<small>${escapeHtml(tag.hint)}</small>` : ""}</button>`).join("")}</div>`;
        }
        return `
            <section class="anima-sel-section ${section.accent ? "is-accent" : ""}">
                <div class="anima-sel-section-head">
                    <h3 class="anima-sel-section-title">${selectorIcon(section.icon || "tag")}${escapeHtml(section.title)}</h3>
                    ${tags.length && !section.loading ? `<button class="anima-sel-copy-all" type="button" data-action="copy-section" data-section="${index}">${selectorIcon("copy")}${escapeHtml(t("Copy All"))}</button>` : ""}
                </div>
                ${body}
            </section>
        `;
    }

    function renderDetail() {
        const item = state.focus;
        if (!item) {
            detailEl.innerHTML = `
                <div class="anima-sel-empty-detail">
                    ${selectorIcon("info")}
                    <h3>${escapeHtml(t("Select a card to view details"))}</h3>
                    <p>${escapeHtml(t("Click a card to select it, or use its info button to view details only."))}</p>
                </div>
            `;
            return;
        }
        const detail = item.isCustom
            ? { title: item.nickname || item.name, subtitle: t("Custom"), sections: [{ title: t("Prompt Tags"), icon: "tag", accent: true, tags: splitPromptTokens(item.customContent).map(value => ({ value })) }] }
            : config.detail(item, ctx);
        state.sections = detail.sections;
        const selected = selection.has(keyOf(item));
        const favorite = store.isFavorite(item);
        const record = store.record(item);
        const note = item.isCustom ? "" : record?.nickname;
        const urls = item.isCustom ? [] : config.imageUrls(item);
        const groupIds = record?.groupIds || [];
        detailEl.innerHTML = `
            <button class="anima-sel-detail-dismiss" type="button" data-action="detail-close" aria-label="${escapeHtml(t("Close"))}">${selectorIcon("close")}</button>
            <div class="anima-sel-detail-scroll">
                <div class="anima-sel-detail-preview">
                    <div class="anima-sel-thumb ${urls.length ? "is-loading" : ""}">${placeholderHtml(item, detail.title)}${urls.length ? '<img class="anima-sel-preview-bg" alt=""><img alt="">' : ""}</div>
                </div>
                <div class="anima-sel-detail-head">
                    <h2>${escapeHtml(detail.title)}</h2>
                    ${detail.subtitle ? `<p>${escapeHtml(detail.subtitle)}</p>` : ""}
                    ${note ? `<div class="anima-sel-detail-note">${escapeHtml(note)}</div>` : ""}
                </div>
                <div class="anima-sel-detail-actions">
                    <button class="anima-sel-button ${selected ? "is-selected-state" : "is-primary"}" type="button" data-action="detail-select" aria-pressed="${selected}">${selectorIcon("check")}${escapeHtml(selected ? t("Selected") : t("Select"))}</button>
                    ${item.isCustom ? "" : `
                        <div class="anima-sel-favorite-controls ${favorite ? "is-active" : ""}">
                            <button type="button" data-action="detail-favorite" aria-pressed="${favorite}">${selectorIcon("star")}<span>${escapeHtml(favorite ? t("Favorited") : t("Favorite"))}</span></button>
                            <button type="button" data-action="organize" aria-expanded="false" title="${escapeHtml(t("Manage Groups"))}" aria-label="${escapeHtml(t("Manage Groups"))}" ${favorite ? "" : "disabled"}>${selectorIcon("folder")}</button>
                            <div class="anima-sel-favorite-popover" hidden>
                                <b>${escapeHtml(t("Add to groups"))}</b>
                                ${store.groups().map(group => `<label><input type="checkbox" data-group-toggle="${escapeHtml(group.id)}" ${groupIds.includes(group.id) ? "checked" : ""}><span>${escapeHtml(groupName(group))}</span></label>`).join("")}
                            </div>
                        </div>
                    `}
                </div>
                ${detail.sections.map(sectionHtml).join("")}
                ${detail.facts?.length ? `<dl class="anima-sel-info-list">${detail.facts.map(fact => `<div><dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(fact.value)}</dd></div>`).join("")}</dl>` : ""}
                ${favorite || item.isCustom ? `
                    <div class="anima-sel-section">
                        <label class="anima-sel-field-label" for="anima-sel-note-${kind}">${escapeHtml(t("Nickname / Note"))}</label>
                        <input class="anima-sel-input" id="anima-sel-note-${kind}" data-note value="${escapeHtml(item.isCustom ? item.nickname : note)}" placeholder="${escapeHtml(t("Enter a nickname or descriptive note..."))}" autocomplete="off">
                    </div>
                ` : ""}
                ${item.isCustom ? `
                    <div class="anima-sel-danger-row">
                        <span><b>${escapeHtml(t("Delete Custom Item"))}</b><small>${escapeHtml(t("This removes the custom item from all groups."))}</small></span>
                        <button class="anima-sel-button is-danger" type="button" data-action="custom-delete">${selectorIcon("trash")}${escapeHtml(t("Delete"))}</button>
                    </div>
                ` : ""}
            </div>
        `;
        const [background, image] = detailEl.querySelectorAll(".anima-sel-detail-preview img");
        if (image) {
            bindImage(image, urls, {
                onLoad: url => {
                    background.onload = () => background.classList.add("is-loaded");
                    background.src = url;
                },
            });
        }
        if (detail.pending) {
            config.loadDetail(item).finally(() => {
                if (state.focus === item) renderDetail();
            });
        }
    }

    function focusItem(item, { openDrawer = false } = {}) {
        state.focus = item;
        syncFocusMarks();
        renderDetail();
        if (openDrawer) splitEl.classList.add("is-detail-open");
    }

    function updateSelectionUi(item) {
        if (item) syncCard(item);
        renderTabs();
        actionsEl.querySelector('[data-action="clear-selected"]')?.toggleAttribute("disabled", !selection.size);
        if (state.focus && (!item || keyOf(item) === keyOf(state.focus))) renderDetail();
    }

    function toggleSelection(item) {
        const key = keyOf(item);
        if (selection.has(key)) selection.delete(key);
        else selection.set(key, item);
        updateSelectionUi(item);
    }

    function afterFavoritesChange() {
        renderTabs();
        if (currentTab() === "favorites") {
            renderNav();
            refreshItems();
        } else {
            renderResults();
        }
        renderDetail();
    }

    async function runFavoriteChange(pending) {
        afterFavoritesChange();
        if (await pending) return true;
        toast(t("Failed to save favorites"), "error");
        afterFavoritesChange();
        return false;
    }

    function switchTab(tab) {
        if (tab === "selected") state.showSelected = true;
        else {
            state.showSelected = false;
            if (tab === "all") state.collection = "all";
            else state.collection = store.groups().some(group => group.id === state.lastGroup) ? state.lastGroup : DEFAULT_GROUP;
            persistState();
        }
        renderTabs();
        renderNav();
        refreshItems({ resetPage: true });
    }

    function setFiltersOpen(open) {
        state.filtersOpen = open;
        layoutEl.classList.toggle("filters-open", open);
        filterToggle.setAttribute("aria-expanded", String(open));
        if (!open && navEl.contains(document.activeElement)) filterToggle.focus();
    }

    function afterFilterChange() {
        persistState();
        refreshItems({ resetPage: true });
    }

    function setFilterValue(def, value) {
        if (def.multiple) {
            const values = state.filters[def.id];
            state.filters[def.id] = values.includes(value) ? values.filter(entry => entry !== value) : [...values, value];
        } else {
            state.filters[def.id] = state.filters[def.id] === value ? null : value;
        }
    }

    function clearFilter(def) {
        state.filters[def.id] = def.multiple ? [] : null;
    }

    function selectedPromptText() {
        const output = config.buildOutput([...selection.values()], applyActions[0].mode);
        const tokens = splitPromptTokens(output);
        return tokens.length ? `${tokens.join(", ")}, ` : "";
    }

    // Tabs that were not active on apply use their primary apply mode.
    function stash(mode = defaultMode) {
        session.pending.set(kind, { config, widget, items: [...selection.values()], keys: selectionKeys(), initialKeys, mode });
    }

    async function apply(action, button) {
        stash(action.mode);
        const changed = [...session.pending.values()].filter(entry => entry.keys !== entry.initialKeys);
        const loading = changed.filter(entry => entry.config.prepareApply);
        if (loading.length) {
            overlay.querySelectorAll('[data-action="apply"]').forEach(entry => entry.disabled = true);
            button.textContent = t("Loading official tags...");
            await Promise.all(loading.map(entry => entry.config.prepareApply(entry.items)));
        }
        changed.forEach(entry => writeWidget(entry.widget, entry.config.buildOutput(entry.items, entry.mode)));
        session.node.triggerSlot?.(0);
        close();
    }

    function close() {
        if (!overlay.isConnected) return;
        observer.disconnect();
        overlay.remove();
        closeActiveSelector = null;
        if (session.returnFocus?.isConnected) session.returnFocus.focus({ preventScroll: true });
    }

    function closeFavoritePopover(controls, restoreFocus = false) {
        const toggle = controls.querySelector('[data-action="organize"]');
        controls.querySelector(".anima-sel-favorite-popover").hidden = true;
        toggle.setAttribute("aria-expanded", "false");
        if (restoreFocus) toggle.focus({ preventScroll: true });
    }

    function groupDialog(title, value, onSubmit) {
        openFormDialog(shell, {
            title,
            fields: [{ value, placeholder: value ? t("Enter new group name...") : t("Enter group name...") }],
            confirmText: t("OK"),
            cancelText: t("Cancel"),
            onConfirm: async ([name]) => {
                if (!name) return false;
                if (await onSubmit(name)) return true;
                toast(t("Failed to save favorites"), "error");
                return false;
            },
        });
    }

    function confirmDialog(title, message, onConfirm) {
        openFormDialog(shell, {
            title,
            message,
            confirmText: t("Delete"),
            cancelText: t("Cancel"),
            danger: true,
            onConfirm,
        });
    }

    const actions = {
        "close": close,
        "kind": target => {
            const next = session.selectors.find(entry => entry.kind === target.dataset.kind);
            if (next.kind === kind) return;
            if (!next.ready()) {
                toast(t(next.loading));
                return;
            }
            stash();
            openSelector(next, session);
        },
        "toggle-filters": () => setFiltersOpen(!state.filtersOpen),
        "close-filters": () => setFiltersOpen(false),
        "tab": target => switchTab(target.dataset.tab),
        "group": target => {
            state.collection = target.dataset.group;
            state.lastGroup = state.collection;
            persistState();
            renderNav();
            refreshItems({ resetPage: true });
            if (isNarrow("(max-width: 1179px)")) setFiltersOpen(false);
        },
        "group-create": () => groupDialog(t("Create New Group"), "", async name => {
            const ok = await store.addGroup(`group_${Date.now()}`, name);
            renderNav();
            return ok;
        }),
        "group-rename": target => {
            const group = store.groups().find(entry => entry.id === target.dataset.group);
            groupDialog(t("Rename Group"), group.name, async name => {
                const ok = await store.renameGroup(group.id, name);
                renderNav();
                renderToolbar();
                return ok;
            });
        },
        "group-delete": target => {
            const id = target.dataset.group;
            confirmDialog(t("Delete Group"), t("Are you sure you want to delete this group? Items inside won't be deleted."), async () => {
                const ok = await store.removeGroup(id);
                if (!ok) {
                    toast(t("Failed to save favorites"), "error");
                    return false;
                }
                if (state.collection === id) state.collection = DEFAULT_GROUP;
                if (state.lastGroup === id) state.lastGroup = DEFAULT_GROUP;
                persistState();
                renderTabs();
                renderNav();
                refreshItems();
                renderDetail();
                return true;
            });
        },
        "combo-toggle": target => {
            const combo = target.closest(".anima-sel-combo");
            setComboOpen(combo, !combo.classList.contains("open"));
        },
        "filter-option": target => {
            const combo = target.closest(".anima-sel-combo");
            const def = filterDefs.find(entry => entry.id === combo.dataset.filter);
            setFilterValue(def, target.dataset.value);
            syncCombo(combo);
            if (!def.multiple) {
                setComboOpen(combo, false);
                combo.querySelector(".anima-sel-combo-control").focus({ preventScroll: true });
            }
            afterFilterChange();
        },
        "filter-clear": target => {
            const combo = target.closest(".anima-sel-combo");
            clearFilter(filterDefs.find(entry => entry.id === combo.dataset.filter));
            syncCombo(combo);
            afterFilterChange();
        },
        "chip-remove": target => {
            const def = filterDefs.find(entry => entry.id === target.dataset.filter);
            setFilterValue(def, target.dataset.value);
            navEl.querySelectorAll(".anima-sel-combo").forEach(syncCombo);
            afterFilterChange();
        },
        "reset-filters": () => {
            filterDefs.forEach(clearFilter);
            navEl.querySelectorAll(".anima-sel-combo").forEach(syncCombo);
            afterFilterChange();
        },
        "sort": target => {
            state.sort = target.dataset.value;
            localStorage.setItem(storage.sort, state.sort);
            refreshItems({ resetPage: true });
        },
        "display-mode": target => {
            state.displayMode = target.dataset.value;
            localStorage.setItem(config.displayModes.storageKey, state.displayMode);
            filterDefs = config.filters(ctx);
            renderNav();
            renderToolbar();
            renderResults();
            renderDetail();
        },
        "copy-selected": () => {
            const text = selectedPromptText();
            if (!text) {
                toast(labels.noSelection);
                return;
            }
            copyText(text, () => toast(t("Copied Successfully")));
        },
        "clear-selected": () => {
            selection.clear();
            updateSelectionUi();
            if (currentTab() === "selected") refreshItems({ resetPage: true });
            else resultsEl.querySelectorAll(".anima-sel-card.is-selected").forEach(card => {
                card.classList.remove("is-selected");
                card.setAttribute("aria-checked", "false");
            });
        },
        "search-clear": () => {
            searchInput.value = "";
            state.query = "";
            searchClear.hidden = true;
            refreshItems({ resetPage: true });
            searchInput.focus();
        },
        "card-favorite": target => {
            const item = state.pageItems[Number(target.closest(".anima-sel-card").dataset.index)];
            runFavoriteChange(store.toggleFavorite(item, config.favoriteRecord));
        },
        "card-inspect": target => focusItem(state.pageItems[Number(target.closest(".anima-sel-card").dataset.index)], { openDrawer: true }),
        "custom-create": () => openFormDialog(shell, {
            title: t("Create Custom Item"),
            fields: [
                { value: "", placeholder: t("Item Title (e.g. My Style A)...") },
                { value: "", placeholder: t("Enter prompt tags (e.g. masterpiece, highly detailed)..."), multiline: true },
            ],
            confirmText: t("Create"),
            cancelText: t("Cancel"),
            onConfirm: async ([title, content]) => {
                if (!title || !content) {
                    toast(t("Title and Content cannot be empty!"), "error");
                    return false;
                }
                if (!(await store.addCustom(config.customItem(title, content, state.collection)))) {
                    toast(t("Failed to save favorites"), "error");
                    return false;
                }
                renderTabs();
                renderNav();
                refreshItems();
                return true;
            },
        }),
        "page": target => {
            const pages = { first: 1, prev: state.page - 1, next: state.page + 1, last: totalPages() };
            goToPage(pages[target.dataset.page]);
        },
        "detail-close": () => {
            splitEl.classList.remove("is-detail-open");
            syncFocusMarks();
        },
        "detail-select": () => toggleSelection(state.focus),
        "detail-favorite": () => runFavoriteChange(store.toggleFavorite(state.focus, config.favoriteRecord)),
        "organize": target => {
            const controls = target.closest(".anima-sel-favorite-controls");
            const popover = controls.querySelector(".anima-sel-favorite-popover");
            if (!popover.hidden) {
                closeFavoritePopover(controls);
                return;
            }
            popover.hidden = false;
            target.setAttribute("aria-expanded", "true");
            popover.querySelector("input")?.focus({ preventScroll: true });
        },
        "copy-section": target => {
            const tags = state.sections[Number(target.dataset.section)].tags.map(tag => tag.value);
            copyText(`${tags.join(", ")}, `, () => toast(t("Copied Successfully")));
        },
        "copy-tag": target => {
            const tag = state.sections[Number(target.dataset.section)].tags[Number(target.dataset.tag)].value;
            copyText(tag, () => toast(t("Copied: {text}", { text: tag })));
        },
        "custom-delete": () => {
            const item = state.focus;
            confirmDialog(t("Delete Custom Item"), t("Are you sure you want to delete this custom item?"), async () => {
                if (!(await store.removeCustom(item))) {
                    toast(t("Failed to save favorites"), "error");
                    return false;
                }
                selection.delete(keyOf(item));
                state.focus = null;
                splitEl.classList.remove("is-detail-open");
                renderTabs();
                renderNav();
                refreshItems();
                renderDetail();
                return true;
            });
        },
        "apply": target => apply(applyActions[Number(target.dataset.apply)], target),
    };

    overlay.addEventListener("click", event => {
        if (event.target === overlay) {
            close();
            return;
        }
        const target = event.target.closest("[data-action]");
        if (target && overlay.contains(target) && !target.disabled) {
            target.closest(".anima-sel-menu-wrap")?.removeAttribute("open");
            actions[target.dataset.action](target, event);
            return;
        }
        const card = event.target.closest(".anima-sel-card");
        if (card) {
            const item = state.pageItems[Number(card.dataset.index)];
            toggleSelection(item);
            focusItem(item);
        }
    });

    overlay.addEventListener("pointerdown", event => {
        overlay.querySelectorAll(".anima-sel-combo.open").forEach(combo => !combo.contains(event.target) && setComboOpen(combo, false));
        overlay.querySelectorAll(".anima-sel-menu-wrap[open]").forEach(menu => !menu.contains(event.target) && menu.removeAttribute("open"));
        overlay.querySelectorAll(".anima-sel-favorite-controls").forEach(controls => {
            if (!controls.contains(event.target) && !controls.querySelector(".anima-sel-favorite-popover").hidden) closeFavoritePopover(controls);
        });
    }, true);

    overlay.addEventListener("toggle", event => {
        if (!event.target.open) return;
        overlay.querySelectorAll(".anima-sel-menu-wrap[open]").forEach(menu => menu !== event.target && menu.removeAttribute("open"));
    }, true);

    const applySearch = debounce(() => refreshItems({ resetPage: true }), 140);
    overlay.addEventListener("input", event => {
        if (event.target === searchInput) {
            state.query = searchInput.value;
            searchClear.hidden = !searchInput.value;
            applySearch();
        } else if (event.target.matches("[data-combo-search]")) {
            filterCombo(event.target);
        }
    });

    overlay.addEventListener("change", async event => {
        const target = event.target;
        if (target.matches("[data-page-input]")) {
            goToPage(parseInt(target.value, 10));
        } else if (target.matches("[data-note]")) {
            const item = state.focus;
            if (!(await store.setNote(item, target.value.trim()))) toast(t("Failed to save favorites"), "error");
            renderResults();
            if (state.focus === item) renderDetail();
        } else if (target.matches("[data-group-toggle]")) {
            const pending = store.setGroup(state.focus, target.dataset.groupToggle, target.checked);
            renderTabs();
            if (currentTab() === "favorites") {
                renderNav();
                refreshItems();
            }
            if (!(await pending)) {
                toast(t("Failed to save favorites"), "error");
                afterFavoritesChange();
            } else if (!store.isFavorite(state.focus)) {
                renderResults();
                renderDetail();
            }
        }
    });

    const saveScroll = debounce(() => localStorage.setItem(storage.scroll, resultsEl.scrollTop), 120);
    resultsEl.addEventListener("scroll", saveScroll, { passive: true });

    overlay.addEventListener("keydown", event => {
        event.stopPropagation();
        if (event.key === "Escape") {
            event.preventDefault();
            const combo = overlay.querySelector(".anima-sel-combo.open");
            const menu = overlay.querySelector(".anima-sel-menu-wrap[open]");
            const popover = [...overlay.querySelectorAll(".anima-sel-favorite-popover")].find(entry => !entry.hidden);
            if (combo) {
                setComboOpen(combo, false);
                combo.querySelector(".anima-sel-combo-control").focus({ preventScroll: true });
            } else if (menu) {
                menu.removeAttribute("open");
                menu.querySelector("summary").focus({ preventScroll: true });
            } else if (popover) {
                closeFavoritePopover(popover.closest(".anima-sel-favorite-controls"), true);
            } else if (state.filtersOpen && layoutEl.classList.contains("has-filters") && isNarrow("(max-width: 1179px)")) {
                setFiltersOpen(false);
            } else if (splitEl.classList.contains("is-detail-open") && isNarrow("(max-width: 980px)")) {
                splitEl.classList.remove("is-detail-open");
                resultsEl.querySelector(".anima-sel-card.is-focused")?.focus({ preventScroll: true });
            } else {
                close();
            }
            return;
        }
        if ((event.key === "Enter" || event.key === " ") && event.target.classList.contains("anima-sel-card")) {
            event.preventDefault();
            event.target.click();
            return;
        }
        if (event.key === "Enter" && event.target.matches("[data-page-input]")) {
            goToPage(parseInt(event.target.value, 10));
            return;
        }
        if (event.key !== "Tab") return;
        const controls = [...shell.querySelectorAll('button, summary, input, textarea, a[href], [tabindex="0"]')]
            .filter(element => !element.disabled && element.getClientRects().length);
        const edge = event.shiftKey ? controls[0] : controls.at(-1);
        if (!shell.contains(document.activeElement) || document.activeElement === edge) {
            event.preventDefault();
            (event.shiftKey ? controls.at(-1) : controls[0])?.focus();
        }
    });

    // A tab switch replaces the open popup only once the next one is ready, without replaying the entrance animation.
    overlay.classList.toggle("is-switching", Boolean(closeActiveSelector));
    closeActiveSelector?.();
    document.body.appendChild(overlay);
    closeActiveSelector = close;

    renderTabs();
    renderNav();
    state.items = computeItems();
    state.page = Math.min(state.page, totalPages());
    renderToolbar();
    renderResults();
    renderPager();
    renderDetail();
    const savedScroll = readNumber(storage.scroll);
    if (savedScroll) requestAnimationFrame(() => resultsEl.scrollTop = savedScroll);
    searchInput.focus({ preventScroll: true });
}
