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
    normalizePromptToken,
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

async function fetchFavorites() {
    try {
        const response = await fetch("/anima-tools/favorites");
        if (response.ok) return (await response.json()) || {};
    } catch (error) {
        console.error("[Anima Tools] Failed to load favorites", error);
    }
    return {};
}

function primaryMode(config) {
    return config.applyActions?.find(action => action.primary)?.mode;
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
 * Opens the popup for a node with one tab per selector. Selections are kept while
 * switching tabs, and applying writes every selector whose selection changed to its
 * own widget.
 */
export function openPromptSelector(node, title, selectors) {
    const widgetOf = selector => node.widgets.find(item => item.name === selector.widgetName);
    return startSession({
        title,
        selectors,
        createConfig: selector => selector.createConfig(widgetOf(selector)),
        initialItems: (selector, config, customs) => config.initialSelection(customs),
        commit: changed => {
            changed.forEach(entry => writeWidget(widgetOf(entry.selector), entry.config.buildOutput(entry.items, entry.mode)));
            node.triggerSlot?.(0);
        },
    });
}

/**
 * Opens the popup for one prompt text box: every tab writes into the same box.
 * box.picks remembers, per tab, the selected keys and the text that was written, so
 * reopening restores the selection and applying replaces only that tab's tags while
 * typed text and other tabs' tags stay in place.
 */
export function openBoxSelector(title, selectors, box, onApply) {
    return startSession({
        title,
        selectors,
        createConfig: selector => selector.createConfig({ value: box.text }),
        initialItems: (selector, config, customs) => {
            const keys = box.picks?.[selector.kind]?.keys || [];
            if (!keys.length) return [];
            const wanted = new Set(keys);
            const found = new Map();
            [...customs, ...config.data].forEach(item => {
                const key = config.selectionKey(item);
                if (wanted.has(key)) found.set(key, item);
            });
            return keys.map(key => found.get(key)).filter(Boolean);
        },
        commit: changed => {
            let tokens = splitPromptTokens(box.text);
            const picks = { ...box.picks };
            changed.forEach(entry => {
                const output = entry.config.buildOutput(entry.items, entry.mode);
                tokens = replacePromptTokens(tokens, splitPromptTokens(picks[entry.selector.kind]?.text), splitPromptTokens(output));
                if (entry.items.length) picks[entry.selector.kind] = { keys: entry.items.map(item => entry.config.selectionKey(item)), text: output };
                else delete picks[entry.selector.kind];
            });
            onApply({ ...box, text: tokens.length ? `${tokens.join(", ")}, ` : "", picks });
        },
    });
}

// Swaps the old tokens of one tab for its new ones at the position of the first old token, skipping duplicates.
export function replacePromptTokens(tokens, oldTokens, newTokens) {
    const old = new Set(oldTokens.map(normalizePromptToken));
    const first = tokens.findIndex(token => old.has(normalizePromptToken(token)));
    const kept = tokens.filter(token => !old.has(normalizePromptToken(token)));
    const present = new Set(kept.map(normalizePromptToken));
    const added = newTokens.filter(token => {
        const key = normalizePromptToken(token);
        if (present.has(key)) return false;
        present.add(key);
        return true;
    });
    const at = first < 0 ? kept.length : tokens.slice(0, first).filter(token => !old.has(normalizePromptToken(token))).length;
    kept.splice(at, 0, ...added);
    return kept;
}

async function startSession({ title, selectors, createConfig, initialItems, commit }) {
    const saved = localStorage.getItem(ACTIVE_SELECTOR_STORAGE_KEY);
    const selector = selectors.find(entry => entry.kind === saved && entry.ready()) || selectors.find(entry => entry.ready());
    if (!selector) {
        alert(t(selectors[0].loading));
        return;
    }
    const session = { title, selectors, createConfig, initialItems, commit, pending: new Map(), returnFocus: document.activeElement };
    // Every tab starts from its existing selection, so the tab badges count it before a tab is visited.
    const favorites = await fetchFavorites();
    selectors.filter(entry => entry.ready()).forEach(entry => {
        const config = createConfig(entry);
        const customs = createFavoriteStore(entry.kind, favorites[entry.kind] || {}, config.favoriteKey).customs();
        const selection = new Map(initialItems(entry, config, customs).map(item => [config.selectionKey(item), item]));
        const keys = [...selection.keys()].join("\n");
        session.pending.set(entry.kind, { selector: entry, config, items: [...selection.values()], keys, initialKeys: keys, mode: primaryMode(config) });
    });
    openSelector(selector, session);
}

async function openSelector(selector, session) {
    injectSelectorStyles();
    const token = openToken = {};
    const { kind } = selector;
    const favorites = (await fetchFavorites())[kind] || {};
    if (token !== openToken) return;
    localStorage.setItem(ACTIVE_SELECTOR_STORAGE_KEY, kind);
    const pending = session.pending.get(kind);
    const config = pending ? pending.config : session.createConfig(selector);
    const { data, labels, storage, pageSize } = config;
    const applyActions = config.applyActions || [{ label: t("Confirm & Apply"), primary: true }];
    const defaultMode = primaryMode(config);
    const store = createFavoriteStore(kind, favorites, config.favoriteKey);
    const selection = new Map();
    (pending ? pending.items : session.initialItems(selector, config, store.customs())).forEach(item => selection.set(config.selectionKey(item), item));
    const selectionKeys = () => [...selection.keys()].join("\n");
    const initialKeys = pending ? pending.initialKeys : selectionKeys();

    const saved = config.loadState();
    // A remembered favorites group that has since become empty would open on a blank page; start on All instead.
    const savedGroup = store.groups().some(group => group.id === saved.collection) && store.count(saved.collection) > 0;
    const state = {
        collection: savedGroup ? saved.collection : "all",
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
        imageIndex: new Map(),
        defaultImage: Number(localStorage.getItem(`anima-selector-sample-${kind}`)) || 0,
        sections: [],
        detailActions: [],
        // { def, mode: "add-root" | "add-child" | "rename" | "delete", value, label } while a tree row is edited inline.
        treeEdit: null,
        // { item, preset } while config.editor fills the details panel; editor holds its mounted element and handle.
        editing: null,
        editor: null,
        filtersOpen: window.matchMedia("(min-width: 1180px)").matches,
        expanded: new Set(),
        collapsedFilters: new Set(),
        optionQueries: {},
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
    let filterDefs = [];
    loadFilterDefs(saved.filters);

    const overlay = document.createElement("div");
    overlay.className = "anima-sel-overlay";
    overlay.dataset.kind = kind;
    overlay.innerHTML = `
        <div class="anima-sel-shell" role="dialog" aria-modal="true" aria-label="${escapeHtml(session.title)}" style="--anima-card-aspect: ${config.cardAspect}">
            <header class="anima-sel-topbar">
                <nav class="anima-sel-kinds" aria-label="${escapeHtml(session.title)}"></nav>
                <div class="anima-sel-topbar-actions">
                    <button class="anima-sel-filter-toggle" type="button" data-action="toggle-filters" aria-label="${escapeHtml(t("Adjust Filters"))}">${selectorIcon("panel")}<span>${escapeHtml(t("Adjust Filters"))}</span></button>
                    <div class="anima-sel-links">
                        <a href="${PROMO_LINKS.afdian}" target="_blank" rel="noopener noreferrer" class="is-afdian">💗 ${escapeHtml(t("Support on Afdian"))}</a>
                        <button type="button" data-action="copy-qq" title="${escapeHtml(t("Click to copy the group number"))}">${escapeHtml(t("QQ Group"))} ${PROMO_LINKS.qqGroup}</button>
                    </div>
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
                            <div class="anima-sel-gallery">
                                <div class="anima-sel-results"></div>
                                <div class="anima-sel-pager"></div>
                            </div>
                            <aside class="anima-sel-detail" aria-label="${escapeHtml(t("Details"))}"></aside>
                        </div>
                    </main>
                </div>
            </div>
            <footer class="anima-sel-footer">
                <div class="anima-sel-footer-side">
                    <button class="anima-sel-status" type="button" data-action="tab" data-tab="selected">${selectorIcon("check")}<span></span></button>
                    <div class="anima-sel-links">
                        <a href="${PROMO_LINKS.github}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(t("Open GitHub"))}">${selectorIcon("github")}GitHub</a>
                        <a href="${PROMO_LINKS.afdian}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(t("Support on Afdian"))}" class="is-afdian">💗 爱发电</a>
                    </div>
                    <span class="anima-sel-escape"><kbd>Esc</kbd> ${escapeHtml(t("Close"))}</span>
                </div>
                <div class="anima-sel-footer-actions">
                    <button class="anima-sel-button" type="button" data-action="close">${escapeHtml(t("Cancel"))}</button>
                    <button class="anima-sel-button" type="button" data-action="clear-selected" ${selection.size ? "" : "disabled"}>${selectorIcon("trash")}${escapeHtml(t("Clear Selected"))}</button>
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

    // Builds the filters from config and keeps only the given values that still exist as options.
    function loadFilterDefs(values) {
        filterDefs = config.filters(ctx);
        filterDefs.forEach(def => {
            const valid = new Set(def.options.map(option => option.value));
            const value = values?.[def.id];
            state.filters[def.id] = def.multiple
                ? (Array.isArray(value) ? value.filter(entry => valid.has(entry)) : [])
                : (valid.has(value) ? value : null);
            expandToSelection(def);
        });
    }

    // Adapters that edit their own data in place (My Tags) call this through tools.refresh.
    function refreshData() {
        loadFilterDefs(state.filters);
        const kept = new Set(data);
        selection.forEach((item, key) => {
            if (!item.isCustom && !kept.has(item)) selection.delete(key);
        });
        if (state.focus && !state.focus.isCustom && !kept.has(state.focus)) state.focus = null;
        renderTabs();
        renderNav();
        refreshItems();
        renderDetail();
    }

    const tools = {
        host: shell,
        toast,
        refresh: refreshData,
        filters: () => state.filters,
        edit: (item = null, preset = []) => {
            state.editing = { item, preset };
            state.focus = item;
            syncFocusMarks();
            splitEl.classList.add("is-detail-open");
            renderDetail();
        },
        closeEditor: (item = null) => {
            state.editing = null;
            state.focus = item;
            syncFocusMarks();
            renderDetail();
        },
    };

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
            ${(config.navActions || []).map((action, index) => `<button class="anima-sel-button anima-sel-nav-action ${action.primary ? "is-primary" : ""}" type="button" data-action="nav-tool" data-index="${index}">${selectorIcon(action.icon)}${escapeHtml(action.label)}</button>`).join("")}
            ${groupsHtml}
            ${filterDefs.map(filterSectionHtml).join("")}
        `;
    }

    function expandKey(def, value) {
        return `${def.id}\u001f${value}`;
    }

    // Tree filters list parents before children; each option names its parent value.
    function expandToSelection(def) {
        if (!def.tree) return;
        const byValue = new Map(def.options.map(option => [option.value, option]));
        filterValues(def).forEach(value => {
            for (let parent = byValue.get(value)?.parent; parent; parent = byValue.get(parent)?.parent) state.expanded.add(expandKey(def, parent));
        });
    }

    function optionRowsHtml(def) {
        const values = filterValues(def);
        const query = (state.optionQueries[def.id] || "").trim().toLowerCase();
        const byValue = new Map(def.options.map(option => [option.value, option]));
        const parents = new Set(def.options.map(option => option.parent).filter(Boolean));
        const shown = option => {
            if (query) return option.label.toLowerCase().includes(query);
            for (let parent = option.parent; parent; parent = byValue.get(parent)?.parent) {
                if (!state.expanded.has(expandKey(def, parent))) return false;
            }
            return true;
        };
        const id = escapeHtml(def.id);
        const edit = state.treeEdit?.def === def.id ? state.treeEdit : null;
        const inputRow = (depth, value) => `<div class="anima-sel-tree-edit" style="--depth: ${depth}"><input class="anima-sel-tree-input" data-tree-input value="${escapeHtml(value)}" placeholder="${escapeHtml(t("Category name, Enter to save"))}" maxlength="60" autocomplete="off"></div>`;
        // Editable rows carry their tools as spans inside the option button, like the tree toggle.
        const tool = (action, icon, label, value) => `<span class="${action === "tree-delete" ? "is-danger" : ""}" data-action="${action}" data-filter="${id}" data-value="${value}" title="${escapeHtml(label)}">${selectorIcon(icon)}</span>`;
        const rows = def.options.filter(shown).flatMap(option => {
            const active = values.includes(option.value);
            const value = escapeHtml(option.value);
            const depth = query ? 0 : option.depth || 0;
            if (edit?.value === option.value && edit.mode === "rename") return [inputRow(depth, option.label)];
            if (edit?.value === option.value && edit.mode === "delete") {
                return [`<div class="anima-sel-tree-confirm" style="--depth: ${depth}"><span>${escapeHtml(t("Delete \"{name}\"?", { name: option.label }))}<small>${escapeHtml(def.edit.removeHint)}</small></span><span><button class="anima-sel-button is-danger" type="button" data-action="tree-confirm-delete">${escapeHtml(t("Delete"))}</button><button class="anima-sel-button" type="button" data-action="tree-cancel">${escapeHtml(t("Cancel"))}</button></span></div>`];
            }
            const open = state.expanded.has(expandKey(def, option.value));
            const toggle = !def.tree ? ""
                : parents.has(option.value) && !query ? `<span class="anima-sel-option-toggle ${open ? "open" : ""}" data-action="tree-toggle" data-filter="${id}" data-value="${value}">${selectorIcon("chevron")}</span>`
                : `<span class="anima-sel-option-toggle"></span>`;
            const tools = def.edit && option.editable ? `<span class="anima-sel-option-tools">
                ${option.nestable ? tool("tree-add-child", "folder", t("New Subcategory"), value) : ""}
                ${tool("tree-add-item", "plus", t("New Entry"), value)}
                ${tool("tree-rename", "edit", t("Rename"), value)}
                ${tool("tree-delete", "trash", t("Delete"), value)}
            </span>` : "";
            const row = `<button class="anima-sel-option ${active ? "active" : ""} ${def.multiple ? "is-check" : ""}" type="button" role="option" aria-selected="${active}" data-action="filter-option" data-filter="${id}" data-value="${value}" style="--depth: ${depth}" title="${escapeHtml([option.label, option.hint].filter(Boolean).join(" / "))}">${toggle}${def.multiple ? '<span class="anima-sel-option-check"></span>' : ""}<span class="anima-sel-option-label">${escapeHtml(option.label)}</span>${option.hint ? `<span class="anima-sel-option-hint">${escapeHtml(option.hint)}</span>` : ""}${tools}${option.count === undefined ? "" : `<small>${option.count}</small>`}</button>`;
            return edit?.value === option.value && edit.mode === "add-child" ? [row, inputRow(depth + 1, "")] : [row];
        });
        if (edit?.mode === "add-root") rows.push(inputRow(0, ""));
        const all = def.tree && !query ? `<button class="anima-sel-option ${values.length ? "" : "active"}" type="button" data-action="filter-clear" data-filter="${id}"><span class="anima-sel-option-toggle"></span><span class="anima-sel-option-label">${escapeHtml(t("All"))}</span><small>${data.length}</small></button>` : "";
        const empty = def.edit && !query ? "" : `<div class="anima-sel-option-empty">${escapeHtml(t("No matching options"))}</div>`;
        return all + (rows.join("") || empty);
    }

    function startTreeEdit(target, mode) {
        const def = filterDefs.find(entry => entry.id === target.dataset.filter);
        const value = target.dataset.value ?? null;
        state.collapsedFilters.delete(def.id);
        if (mode === "add-child") state.expanded.add(expandKey(def, value));
        state.treeEdit = { def: def.id, mode, value, label: def.options.find(option => option.value === value)?.label || "" };
        refreshFilterSection(def);
        const input = navEl.querySelector("[data-tree-input]");
        input?.focus();
        input?.select();
    }

    function endTreeEdit() {
        const def = filterDefs.find(entry => entry.id === state.treeEdit?.def);
        state.treeEdit = null;
        if (def) refreshFilterSection(def);
    }

    // The def's edit callbacks save and report problems themselves; a falsy result keeps the row in edit mode.
    async function commitTreeEdit(name) {
        const edit = state.treeEdit;
        if (!edit || edit.busy || edit.mode === "delete") return;
        const def = filterDefs.find(entry => entry.id === edit.def);
        name = name.trim();
        if (!name || (edit.mode === "rename" && name === edit.label)) {
            endTreeEdit();
            return;
        }
        edit.busy = true;
        const result = edit.mode === "add-root" ? await def.edit.addRoot(name, tools)
            : edit.mode === "add-child" ? await def.edit.addChild(edit.value, name, tools)
            : await def.edit.rename(edit.value, name, tools);
        edit.busy = false;
        if (state.treeEdit !== edit) return;
        if (!result) {
            navEl.querySelector("[data-tree-input]")?.focus();
            return;
        }
        // rename returns the renamed option's new value, so an active filter or open branch on it follows.
        if (edit.mode === "rename") {
            if (state.filters[def.id] === edit.value) state.filters[def.id] = result;
            if (state.expanded.has(expandKey(def, edit.value))) state.expanded.add(expandKey(def, result));
        }
        state.treeEdit = null;
        refreshData();
    }

    async function commitTreeDelete() {
        const edit = state.treeEdit;
        const def = filterDefs.find(entry => entry.id === edit.def);
        if (!await def.edit.remove(edit.value, tools)) return;
        if (state.treeEdit === edit) state.treeEdit = null;
        refreshData();
    }

    function filterSectionHtml(def) {
        const id = escapeHtml(def.id);
        const collapsed = state.collapsedFilters.has(def.id);
        const searchable = def.options.length > 12;
        return `
            <section class="anima-sel-nav-group anima-sel-filter ${collapsed ? "is-collapsed" : ""}" data-filter="${id}">
                <div class="anima-sel-nav-title">
                    <button class="anima-sel-filter-head" type="button" data-action="filter-collapse" data-filter="${id}" aria-expanded="${!collapsed}">${selectorIcon("chevron")}<span>${escapeHtml(def.label)}</span></button>
                    ${filterValues(def).length ? `<button class="anima-sel-filter-clear" type="button" data-action="filter-clear" data-filter="${id}">${escapeHtml(t("Clear"))}</button>` : ""}
                    ${def.edit ? `<button class="anima-sel-nav-add" type="button" data-action="tree-add-root" data-filter="${id}" title="${escapeHtml(t("New Category"))}" aria-label="${escapeHtml(t("New Category"))}">${selectorIcon("plus")}</button>` : ""}
                </div>
                ${collapsed ? "" : `
                    ${searchable ? `<label class="anima-sel-filter-search">${selectorIcon("search")}<input data-filter-search="${id}" value="${escapeHtml(state.optionQueries[def.id] || "")}" placeholder="${escapeHtml(t("Search options..."))}" aria-label="${escapeHtml(t("Search options..."))}" autocomplete="off"></label>` : ""}
                    <div class="anima-sel-option-list ${searchable && !def.tree ? "is-scroll" : ""}" role="listbox" aria-label="${escapeHtml(def.label)}" aria-multiselectable="${Boolean(def.multiple)}">${optionRowsHtml(def)}</div>
                `}
            </section>`;
    }

    // Chevron rotation per toggle in a filter section: the section head and every tree parent.
    function chevronTransforms(section) {
        return new Map([...section.querySelectorAll('[data-action="filter-collapse"] svg, [data-action="tree-toggle"] svg')]
            .map(svg => [svg.closest("[data-value]")?.dataset.value ?? "", svg]));
    }

    // Re-render one section in place, keeping the scroll position of its option list. With animate, the section
    // height and the toggled chevron move from the old state: growing shows the new rows while the section opens,
    // shrinking keeps the old rows visible until the section has closed.
    function refreshFilterSection(def, animate = false) {
        const selector = `.anima-sel-filter[data-filter="${CSS.escape(def.id)}"]`;
        const section = navEl.querySelector(selector);
        if (!section) return;
        const scroll = section.querySelector(".anima-sel-option-list")?.scrollTop || 0;
        const from = section.offsetHeight;
        section.insertAdjacentHTML("afterend", filterSectionHtml(def));
        const next = section.nextElementSibling;
        const list = next.querySelector(".anima-sel-option-list");
        if (list) list.scrollTop = scroll;
        navEl.querySelector('[data-action="reset-filters"]')?.toggleAttribute("disabled", !hasActiveFilters());
        if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            section.remove();
            return;
        }
        const to = next.offsetHeight;
        const timing = { duration: 220, easing: "cubic-bezier(.2, .8, .2, 1)" };
        const oldChevrons = chevronTransforms(section);
        const newChevrons = chevronTransforms(next);
        const shrinking = to < from;
        const shown = shrinking ? section : next;
        oldChevrons.forEach((svg, key) => {
            const target = newChevrons.get(key);
            const before = getComputedStyle(svg).transform;
            const after = target && getComputedStyle(target).transform;
            if (after && before !== after) (shrinking ? svg : target).animate([{ transform: before }, { transform: after }], { ...timing, fill: "forwards" });
        });
        if (shrinking) {
            next.hidden = true;
            section.removeAttribute("data-filter");
            section.style.pointerEvents = "none";
        } else {
            section.remove();
        }
        shown.style.overflow = "hidden";
        shown.animate([{ height: `${from}px` }, { height: `${to}px` }], timing).finished.then(() => {
            shown.style.overflow = "";
            if (!shrinking) return;
            section.remove();
            next.hidden = false;
        });
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
        const sampleCount = config.images && data.length ? imagesOf(data[0]).length : 0;
        actionsEl.innerHTML = `
            ${(config.toolbarActions || []).map((action, index) => `<button class="anima-sel-button ${action.primary ? "is-primary" : ""} ${action.iconOnly ? "is-icon" : ""}" type="button" data-action="toolbar-tool" data-index="${index}" title="${escapeHtml(action.label)}" aria-label="${escapeHtml(action.label)}">${selectorIcon(action.icon)}${action.iconOnly ? "" : escapeHtml(action.label)}</button>`).join("")}
            ${sampleCount > 1 ? `
                <div class="anima-sel-sample-toggle" role="group" aria-label="${escapeHtml(t("Sample image"))}">
                    <span>${escapeHtml(t("Sample image"))}</span>
                    ${Array.from({ length: sampleCount }, (_, index) => `<button type="button" data-action="default-image" data-image="${index}" aria-pressed="${index === state.defaultImage}" title="${escapeHtml(t("Show sample image {index} on every card", { index: index + 1 }))}">${index + 1}</button>`).join("")}
                </div>
            ` : ""}
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

    // config.images lists several samples per item (fallback URLs each); the card and the details show the same one.
    // The toolbar picks the sample for every card, a card's own switch overrides it for that item.
    const imagesOf = item => item.isCustom ? [] : config.images?.(item) || [config.imageUrls(item)];
    const imageIndexOf = item => state.imageIndex.get(keyOf(item)) ?? state.defaultImage;
    const shownUrls = item => {
        const images = imagesOf(item);
        return images[imageIndexOf(item)] || images[0] || [];
    };

    function imageSwitchHtml(item, className) {
        const count = imagesOf(item).length;
        if (count < 2) return "";
        const current = imageIndexOf(item);
        return `<div class="${className}">${Array.from({ length: count }, (_, index) => {
            const label = escapeHtml(t("Sample image {index}", { index: index + 1 }));
            return `<button type="button" data-action="show-image" data-image="${index}" aria-pressed="${index === current}" title="${label}" aria-label="${label}">${index + 1}</button>`;
        }).join("")}</div>`;
    }

    function showImage(item, index) {
        state.imageIndex.set(keyOf(item), index);
        const card = resultsEl.querySelector(`.anima-sel-card[data-index="${state.pageItems.findIndex(entry => keyOf(entry) === keyOf(item))}"]`);
        if (card) {
            const thumb = card.querySelector(".anima-sel-thumb");
            thumb.querySelector("img")?.remove();
            const img = document.createElement("img");
            img.alt = "";
            img.decoding = "async";
            thumb.append(img);
            thumb.classList.add("is-loading");
            bindImage(img, shownUrls(item));
            card.querySelectorAll('[data-action="show-image"]').forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.image) === index)));
        }
        if (state.focus && keyOf(state.focus) === keyOf(item)) renderDetail();
    }

    function cardHtml(item, index) {
        const info = cardInfo(item);
        const selected = selection.has(keyOf(item));
        const focused = state.focus && keyOf(state.focus) === keyOf(item);
        const favorite = store.isFavorite(item);
        const note = item.isCustom ? "" : store.record(item)?.nickname;
        const hasImage = shownUrls(item).length > 0;
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
                ${imageSwitchHtml(item, "anima-sel-card-switch")}
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
            const tab = currentTab();
            const [icon, title, hint] = tab === "selected" ? ["applied", t("No items selected yet"), t("Pick cards from All or Favorites first.")]
                : tab === "favorites" && !state.query.trim() && !hasActiveFilters() ? ["star", t("No favorites yet"), t("Open a card's details in All and click Favorite to add it here.")]
                : ["search", labels.empty, labels.emptyHint || t("Try another search or clear filters.")];
            resultsEl.innerHTML = `
                <div class="anima-sel-empty">
                    ${selectorIcon(icon)}
                    <h3>${escapeHtml(title)}</h3>
                    <p>${escapeHtml(hint)}</p>
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
            bindImage(img, shownUrls(item), { lazy: true });
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
            <div class="anima-sel-pager-controls">
                ${pageButton("first", "first", t("First"), state.page <= 1)}
                ${pageButton("prev", "prev", t("Prev"), state.page <= 1)}
                <span class="anima-sel-pager-page"><input data-page-input value="${state.page}" inputmode="numeric" aria-label="${escapeHtml(t("Page"))}"><span>/ ${pages}</span></span>
                ${pageButton("next", "next", t("Next"), state.page >= pages)}
                ${pageButton("last", "last", t("Last"), state.page >= pages)}
            </div>
            <div class="anima-sel-pager-stats">${escapeHtml(labels.total({ total, start, end }))}</div>
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
            body = `<div class="anima-sel-tag-list">${tags.map((tag, tagIndex) => `<button class="anima-sel-tag ${tag.hint ? "has-hint" : ""}" type="button" data-action="copy-tag" data-section="${index}" data-tag="${tagIndex}" title="${escapeHtml(t("Copy"))}: ${escapeHtml(tag.value)}">${tag.hint ? `${escapeHtml(tag.hint)}<small>${escapeHtml(tag.value)}</small>` : escapeHtml(tag.value)}</button>`).join("")}</div>`;
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
        // The editor is mounted once per edit; later renders only let it update its own options.
        if (state.editing) {
            if (state.editor?.editing === state.editing && state.editor.element.isConnected) {
                state.editor.handle?.refresh?.();
                return;
            }
            const element = document.createElement("div");
            element.className = "anima-sel-detail-scroll";
            detailEl.replaceChildren(element);
            state.editor = { editing: state.editing, element, handle: config.editor(element, state.editing, tools) };
            return;
        }
        state.editor = null;
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
        state.detailActions = detail.actions || [];
        const selected = selection.has(keyOf(item));
        const favorite = store.isFavorite(item);
        const record = store.record(item);
        const note = item.isCustom ? "" : record?.nickname;
        const urls = shownUrls(item);
        const groupIds = record?.groupIds || [];
        detailEl.innerHTML = `
            <button class="anima-sel-detail-dismiss" type="button" data-action="detail-close" aria-label="${escapeHtml(t("Close"))}">${selectorIcon("close")}</button>
            <div class="anima-sel-detail-scroll">
                <div class="anima-sel-detail-preview">
                    <div class="anima-sel-thumb ${urls.length ? "is-loading" : ""}">${placeholderHtml(item, detail.title)}${urls.length ? '<img class="anima-sel-preview-bg" alt=""><img alt="">' : ""}</div>
                    ${imageSwitchHtml(item, "anima-sel-preview-switch")}
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
                ${state.detailActions.length ? `<div class="anima-sel-detail-tools">${state.detailActions.map((action, index) => `<button class="anima-sel-button ${action.danger ? "is-danger" : ""}" type="button" data-action="detail-tool" data-index="${index}">${selectorIcon(action.icon)}<span>${escapeHtml(action.label)}</span></button>`).join("")}</div>` : ""}
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
        state.editing = null;
        state.focus = item;
        syncFocusMarks();
        renderDetail();
        if (openDrawer) splitEl.classList.add("is-detail-open");
    }

    function updateSelectionUi(item) {
        if (item) syncCard(item);
        renderTabs();
        overlay.querySelectorAll('[data-action="clear-selected"]').forEach(button => button.toggleAttribute("disabled", !selection.size));
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
        session.pending.set(kind, { selector, config, items: [...selection.values()], keys: selectionKeys(), initialKeys, mode });
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
        session.commit(changed);
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
        "filter-option": target => {
            const def = filterDefs.find(entry => entry.id === target.dataset.filter);
            setFilterValue(def, target.dataset.value);
            if (def.tree && filterValues(def).includes(target.dataset.value)) state.expanded.add(expandKey(def, target.dataset.value));
            refreshFilterSection(def);
            afterFilterChange();
        },
        "tree-toggle": target => {
            const def = filterDefs.find(entry => entry.id === target.dataset.filter);
            const key = expandKey(def, target.dataset.value);
            if (!state.expanded.delete(key)) state.expanded.add(key);
            refreshFilterSection(def, true);
        },
        "filter-collapse": target => {
            const def = filterDefs.find(entry => entry.id === target.dataset.filter);
            if (!state.collapsedFilters.delete(def.id)) state.collapsedFilters.add(def.id);
            refreshFilterSection(def, true);
        },
        "filter-clear": target => {
            const def = filterDefs.find(entry => entry.id === target.dataset.filter);
            clearFilter(def);
            refreshFilterSection(def);
            afterFilterChange();
        },
        "chip-remove": target => {
            const def = filterDefs.find(entry => entry.id === target.dataset.filter);
            setFilterValue(def, target.dataset.value);
            refreshFilterSection(def);
            afterFilterChange();
        },
        "reset-filters": () => {
            filterDefs.forEach(clearFilter);
            renderNav();
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
        "toolbar-tool": target => config.toolbarActions[Number(target.dataset.index)].run(tools),
        "nav-tool": target => config.navActions[Number(target.dataset.index)].run(tools),
        // An action with confirmLabel asks for a second click instead of opening a dialog.
        "detail-tool": target => {
            const action = state.detailActions[Number(target.dataset.index)];
            if (action.confirmLabel && !target.classList.contains("is-armed")) {
                target.classList.add("is-armed");
                target.querySelector("span").textContent = action.confirmLabel;
                return;
            }
            action.run(state.focus, tools);
        },
        "tree-add-root": target => startTreeEdit(target, "add-root"),
        "tree-add-child": target => startTreeEdit(target, "add-child"),
        "tree-rename": target => startTreeEdit(target, "rename"),
        "tree-delete": target => startTreeEdit(target, "delete"),
        "tree-cancel": endTreeEdit,
        "tree-confirm-delete": commitTreeDelete,
        "tree-add-item": target => filterDefs.find(entry => entry.id === target.dataset.filter).edit.addItem(target.dataset.value, tools),
        "default-image": target => {
            state.defaultImage = Number(target.dataset.image);
            localStorage.setItem(`anima-selector-sample-${kind}`, state.defaultImage);
            state.imageIndex.clear();
            renderToolbar();
            renderResults();
            renderDetail();
        },
        "show-image": target => {
            const card = target.closest(".anima-sel-card");
            showImage(card ? state.pageItems[Number(card.dataset.index)] : state.focus, Number(target.dataset.image));
        },
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
        "copy-qq": () => copyText(PROMO_LINKS.qqGroup, () => toast(t("Copied: {text}", { text: PROMO_LINKS.qqGroup }))),
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
        } else if (event.target.matches("[data-filter-search]")) {
            const def = filterDefs.find(entry => entry.id === event.target.dataset.filterSearch);
            state.optionQueries[def.id] = event.target.value;
            event.target.closest(".anima-sel-filter").querySelector(".anima-sel-option-list").innerHTML = optionRowsHtml(def);
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
        if (event.target.matches("[data-tree-input]") && (event.key === "Enter" || event.key === "Escape")) {
            event.preventDefault();
            if (event.key === "Enter") commitTreeEdit(event.target.value);
            else endTreeEdit();
            return;
        }
        if (event.key === "Escape" && state.editing && detailEl.contains(event.target)) {
            event.preventDefault();
            tools.closeEditor(state.editing.item);
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            const menu = overlay.querySelector(".anima-sel-menu-wrap[open]");
            const popover = [...overlay.querySelectorAll(".anima-sel-favorite-popover")].find(entry => !entry.hidden);
            if (menu) {
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

    // Leaving an inline tree input saves it, like renaming a file.
    navEl.addEventListener("focusout", event => {
        if (event.target.matches("[data-tree-input]") && event.target.isConnected) commitTreeEdit(event.target.value);
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
