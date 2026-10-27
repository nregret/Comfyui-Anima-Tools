import { app } from "../../scripts/app.js";
import {
    API,
    CIVITAI_CATEGORY_FILTERS,
    HIGH_PRIORITY_PREVIEW_LOADS,
    INITIAL_PREVIEW_LOADS,
    ROOT_LOCAL_FOLDER,
    SEARCH_PAGE_SIZE,
} from "./lora_manager/constants.js";
import { apiGet, apiPost, fetchModelDetail, getSearchCache, peekModelDetail, setSearchCache, unseenSearchItems } from "./lora_manager/api.js";
import { animateCardsIn, bindCardMedia, loadMoreSkeletonCount, observeCardMedia, preconnectMediaHosts, renderCardMedia, renderCardSkeletons } from "./lora_manager/card_media.js";
import { ACTIVE_DOWNLOAD_STATUSES, patchDownloadPage, patchDownloadProgress, renderDownloadPage, renderDownloadProgress, handleDownloadDetailsClick, hydrateDownloadDetails, trackDownloadRates } from "./lora_manager/downloads.js";
import {
    bindFavoriteFolderSidebar,
    bindSearchCombo,
    ensureNotificationHost,
    renderActiveFilterChips,
    renderCollectionEmptyState,
    renderFavoriteCardMark,
    renderFavoriteControls,
    syncFavoriteControls,
    renderFavoriteFolderSidebar,
    renderPromoLinks,
    syncFavoriteCardMark,
    updateNotificationHost,
} from "./lora_manager/components.js";
import {
    bindDetailInteractions,
    formatBytes,
    formatStatCount,
    galleryItemsForModel,
    galleryItemsForUrl,
    isDetailDrawerOpen,
    isEarlyAccess,
    modelFacts,
    modelStats,
    renderDescriptionSkeleton,
    renderDetailDismiss,
    renderDetailFacts,
    renderDetailGallery,
    renderDetailSkeleton,
    renderDetailTags,
    renderEarlyAccessNotice,
    renderMatchRow,
    setDetailDrawer,
    setDetailLoading,
    swapDetail,
} from "./lora_manager/detail.js";
import {
    favoriteEntryForLocal,
    favoriteEntryForRemote,
    favoriteItemForLocal,
    favoriteItemForRemote,
    favoriteModel,
    filterFavoriteItems,
    localAssetForFavorite,
} from "./lora_manager/favorites.js";
import { t } from "./lora_manager/i18n.js";
import {
    createPreviewMedia,
    findModelPreviewSource,
    isModelPreviewFiltered,
} from "./lora_manager/media.js";
import { injectStyles } from "./lora_manager/styles.js";
import { observeThemeChanges } from "./lora_manager/theme.js";
import { injectSelectorStyles } from "./lora_manager/selector_styles.js";
import { selectorIcon, renderSelectorCombo, renderSelectorSearch, renderSelectorToolbar, renderSelectorSort, renderSelectorStats, animateSelectorFolder, bindSelectorMenus } from "./lora_manager/selector_ui.js";
import { ensureLoraDataWidget, paintStrengthRange, syncLoraWidgets } from "./lora_manager/lora_widgets.js";

const NODE_NAME = "AnimaMultiLoraLoader";
const LOCKED_BASE_MODEL = "Anima";
const TERMINAL_DOWNLOAD_STATUSES = new Set(["completed", "failed", "cancelled"]);

let overlay = null;
let popupBody = null;
let notificationHost = null;
let pollTimer = null;
let pollBusy = false;
let searchController = null;
let searchSequence = 0;
let toastTimer = null;
let renderedPopupTab = "";
let lastRemoteSelectAt = 0;
let remoteQueryTimer = 0;
// Discover, Local and Favorites each keep their own detail selection.
const SELECTION_FIELDS = ["selectedRemote", "selectedVersionId", "selectedFileName", "selectedAssetId"];
const EMPTY_SELECTION = { selectedRemote: null, selectedVersionId: "", selectedFileName: "", selectedAssetId: "" };
const tabSelections = {};
let localMetadataBatch = {
    running: false,
    cancelRequested: false,
    total: 0,
    completed: 0,
    matched: 0,
    notFound: 0,
    failed: 0,
    current: "",
};

const popup = {
    node: null,
    tab: "discover",
    discoverQuery: "",
    localQuery: "",
    sort: "Highest Rated",
    selectedBaseModel: "",
    selectedCategory: "",
    selectedTag: "",
    selectedLocalFolder: "",
    expandedLocalFolders: {},
    taxonomy: { baseModels: [], tags: [] },
    remoteItems: [],
    contentFilterActive: false,
    nextCursor: "",
    sparseResults: false,
    remoteLoading: false,
    remoteResetting: false,
    selectedRemote: null,
    selectedVersionId: "",
    selectedFileName: "",
    libraryItems: [],
    libraryLoading: false,
    config: { save_preview: true },
    selectedAssetId: "",
    favoritesLoading: false,
    favoriteItems: [],
    favoriteFolders: [],
    favoriteQuery: "",
    selectedFavoriteKey: "",
    selectedFavoriteFolderId: "",
    favoriteFolderEditor: null,
    detailOpen: false,
    downloads: {},
    pendingApply: new Map(),
    scroll: {
        nav: 0,
        discover: 0,
        local: 0,
        favorites: 0,
        applied: 0,
        downloads: 0,
    },
    error: "",
    toast: "",
    toastAction: null,
};

app.registerExtension({
    name: "AnimaTools.multiLoraLoader",
    async setup() {
        injectStyles();
        observeThemeChanges();
    },
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_NAME) return;

        const originalCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const result = originalCreated?.apply(this, arguments);
            this._almLoras = readJsonWidget(this) || [];
            syncNodeWidgets(this, this._almLoras);
            return result;
        };

        const originalConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function (info) {
            const restored = parseLoraJson(info?.widgets_values_named?.lora_list_json)
                ?? findSerializedLoraList(info?.widgets_values);
            const result = originalConfigure?.apply(this, arguments);
            syncNodeWidgets(this, restored ?? readJsonWidget(this) ?? [], { restoring: true });
            return result;
        };
    },
});

function normalizeLoraEntry(value) {
    if (!value || typeof value !== "object") return null;
    const name = String(value.name || "").trim().replaceAll("\\", "/");
    if (!name) return null;
    const strength = Number(value.strength_model);
    const normalized = {
        name,
        strength_model: Number.isFinite(strength) ? strength : 1,
        enabled: value.enabled !== false,
    };
    [
        "display_name",
        "storage_root_id",
        "model_id",
        "version_id",
        "version_name",
        "preview_url",
        "civitai_url",
        "base_model",
    ].forEach((key) => {
        if (value[key] !== undefined && value[key] !== null && String(value[key]) !== "") {
            normalized[key] = value[key];
        }
    });
    if (Array.isArray(value.trained_words)) {
        normalized.trained_words = value.trained_words.map(String).filter(Boolean);
    }
    return normalized;
}

function normalizeLoraList(value) {
    return (Array.isArray(value) ? value : []).map(normalizeLoraEntry).filter(Boolean);
}

function parseLoraJson(value) {
    if (typeof value !== "string" || !value.trim().startsWith("[")) return null;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? normalizeLoraList(parsed) : null;
    } catch (_) {
        return null;
    }
}

function findSerializedLoraList(values) {
    if (!Array.isArray(values)) return null;
    for (const value of values) {
        const parsed = parseLoraJson(value);
        if (parsed) return parsed;
    }
    return null;
}

function readJsonWidget(node) {
    return parseLoraJson(node?.widgets?.find((widget) => widget.name === "lora_list_json")?.value);
}

function writeNodeData(node, loras) {
    if (!node) return;
    node._almLoras = normalizeLoraList(loras);
    const widget = node.widgets?.find((item) => item.name === "lora_list_json");
    if (widget) widget.value = JSON.stringify(node._almLoras);
    redrawNode(node);
}

function updateNodeLoras(node, value) {
    if (!node) return;
    const loras = normalizeLoraList(value);
    const widget = ensureLoraDataWidget(node);
    const changed = widget.value !== JSON.stringify(loras);
    const graph = node.graph;
    if (changed) graph?.beforeChange();
    try {
        syncNodeWidgets(node, loras);
    } finally {
        if (changed) graph?.afterChange();
    }
}

function redrawNode(node) {
    node?.setDirtyCanvas?.(true, true);
    app?.canvas?.setDirty?.(true, true);
}

function shortLoraName(entry, maxLength = 30) {
    const label = String(entry?.display_name || entry?.name || "LoRA").split("/").pop();
    return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
}

function normalizedTriggerWords(entry) {
    const seen = new Set();
    return (Array.isArray(entry?.trained_words) ? entry.trained_words : []).reduce((words, value) => {
        const word = String(value || "").trim();
        const key = word.toLocaleLowerCase();
        if (!word || seen.has(key)) return words;
        seen.add(key);
        words.push(word);
        return words;
    }, []);
}

function showNodeToast(message, severity = "info") {
    const toast = app?.extensionManager?.toast;
    if (typeof toast?.add === "function") {
        toast.add({
            severity,
            summary: t("LoRA Trigger Words"),
            detail: message,
            life: severity === "warn" ? 5200 : 3200,
        });
        return;
    }
    showToast(message);
}

function writeLegacyClipboardText(value) {
    const activeElement = document.activeElement;
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.focus({ preventScroll: true });
    input.select();
    let copied = false;
    try {
        copied = document.execCommand?.("copy") === true;
    } finally {
        input.remove();
        activeElement?.focus?.({ preventScroll: true });
    }
    return copied;
}

async function writeClipboardText(value) {
    // This runs directly inside the canvas pointer event, so the legacy path
    // retains user activation even in embedded browsers whose async clipboard
    // promise can remain pending indefinitely.
    if (writeLegacyClipboardText(value)) return;
    if (typeof navigator?.clipboard?.writeText === "function") {
        await navigator.clipboard.writeText(value);
        return;
    }
    throw new Error("Clipboard unavailable");
}

async function copyNodeLoraTriggerWords(entry) {
    const words = normalizedTriggerWords(entry);
    if (!words.length) {
        showNodeToast(
            t("This LoRA has no cached trigger words. The author may have written them in the model description."),
            "warn",
        );
        return;
    }
    try {
        await writeClipboardText(words.join(", "));
        showNodeToast(t("Copied {count} trigger words.", { count: words.length }), "success");
    } catch (_) {
        showNodeToast(t("Could not copy the trigger words."), "error");
    }
}

function syncNodeWidgets(node, value, options) {
    if (!node) return;
    ensureLoraDataWidget(node);
    writeNodeData(node, value);
    syncLoraWidgets(node, node._almLoras, {
        t,
        onEdit: (index, patch) => {
            const next = normalizeLoraList(node._almLoras);
            if (!next[index]) return;
            Object.assign(next[index], patch);
            updateNodeLoras(node, next);
        },
        onRemove: (index) => {
            const next = node._almLoras.filter((_, itemIndex) => itemIndex !== index);
            updateNodeLoras(node, next);
            if (popup.node === node && overlay?.classList.contains("show")) renderPopup();
        },
        onCopy: (entry) => { if (entry) void copyNodeLoraTriggerWords(entry); },
        onOpen: () => openPopup(node),
    }, options);
}

function loraKey(entry) {
    return `${String(entry?.storage_root_id || "")}::${String(entry?.name || "").toLocaleLowerCase()}`;
}

// Entries from older Anima workflows have no storage root; like the Python loader, they match any root.
function sameLora(a, b) {
    if (String(a?.name || "").toLocaleLowerCase() !== String(b?.name || "").toLocaleLowerCase()) return false;
    return !a?.storage_root_id || !b?.storage_root_id || a.storage_root_id === b.storage_root_id;
}

function addLoraToNode(entry) {
    addLoraToTargetNode(popup.node, entry, true);
}

function addLoraToTargetNode(node, entry, notify = false) {
    if (!node) return;
    const normalized = normalizeLoraEntry(entry);
    if (!normalized) return;
    const next = [...normalizeLoraList(node._almLoras)];
    const existingIndex = next.findIndex((item) => sameLora(item, normalized));
    if (existingIndex >= 0) {
        next[existingIndex] = {
            ...next[existingIndex],
            ...normalized,
            strength_model: next[existingIndex].strength_model,
            enabled: true,
        };
        if (notify) showToast(t("LoRA already applied; it has been enabled."));
    } else {
        next.push(normalized);
        if (notify) showToast(t("LoRA applied to node."));
    }
    updateNodeLoras(node, next);
    if (popup.node === node && overlay?.classList.contains("show")) {
        if (!updateRemoteDownloadState()) renderPopup();
    }
}

function openPopup(node) {
    popup.returnFocus = document.activeElement;
    popup.node = node;
    popup.error = "";
    popup.detailOpen = false;
    createOverlay();
    overlay.classList.add("show");
    renderPopup();
    overlay.querySelector(`[data-lora-tab="${popup.tab}"]`)?.focus({ preventScroll: true });
    void hydratePopup();
}

function createOverlay() {
    if (overlay) return;
    injectSelectorStyles();
    preconnectMediaHosts();
    popup.filtersOpen = window.matchMedia("(min-width: 1180px)").matches;
    overlay = document.createElement("div");
    overlay.className = "alm-overlay alm-lora-overlay alm-selector-overlay";
    overlay.innerHTML = `
        <div class="alm-shell alm-lora-shell alm-selector-shell" role="dialog" aria-modal="true" aria-label="${escapeAttr(t("LoRA Manager"))}">
            <div class="alm-topbar alm-lora-topbar alm-selector-topbar">
                <div class="alm-lora-heading alm-selector-heading">
                    ${selectorIcon("layers")}
                    <div class="alm-title">${escapeHtml(t("LoRA Manager"))}</div>
                </div>
                <div class="alm-topbar-actions">
                    <button class="alm-lora-filter-toggle alm-selector-filter-toggle" type="button" data-action="toggle-lora-filters" aria-label="${escapeAttr(t("Adjust filters"))}" aria-controls="alm-lora-filters">${selectorIcon("panel")}<span>${escapeHtml(t("Adjust filters"))}</span></button>
                    <button class="alm-lora-close alm-selector-close" type="button" data-action="close-lora-manager" aria-label="${escapeAttr(t("Close"))}" title="${escapeAttr(t("Close"))} (Esc)">${selectorIcon("close")}</button>
                </div>
            </div>
            <div class="alm-selector-workspace">
                <nav class="alm-lora-tabs alm-selector-tabs" role="tablist" aria-orientation="vertical" aria-label="${escapeAttr(t("LoRA Manager"))}"></nav>
                <div class="alm-layout alm-lora-layout alm-selector-layout">
                    <button class="alm-lora-filter-backdrop alm-selector-filter-backdrop" type="button" aria-label="${escapeAttr(t("Close"))}"></button>
                    <aside class="alm-nav alm-lora-nav alm-selector-nav" id="alm-lora-filters" aria-label="${escapeAttr(t("Adjust filters"))}"></aside>
                    <main class="alm-body alm-lora-body alm-selector-body" id="alm-lora-content" role="tabpanel"></main>
                </div>
            </div>
            <footer class="alm-selector-footer">
                <button class="alm-selector-node-status" type="button" data-action="view-applied-loras"></button>
                <div>${renderPromoLinks()}<span class="alm-selector-escape"><kbd>Esc</kbd> ${escapeHtml(t("Close"))}</span></div>
            </footer>
        </div>
    `;
    document.body.appendChild(overlay);
    popupBody = overlay.querySelector(".alm-lora-body");
    notificationHost = ensureNotificationHost(overlay.querySelector(".alm-lora-shell"));
    overlay.querySelector('[data-action="close-lora-manager"]').onclick = closePopup;
    overlay.querySelector('[data-action="toggle-lora-filters"]').onclick = () => setLoraFiltersOpen(!popup.filtersOpen);
    overlay.querySelector(".alm-lora-filter-backdrop").onclick = () => setLoraFiltersOpen(false);
    overlay.querySelector('[data-action="view-applied-loras"]').onclick = () => switchTab("applied");
    const handleKey = (event) => {
        if (!overlay.classList.contains("show")) return;
        event.stopPropagation();
        if (event.key === "Escape" && !event.defaultPrevented) {
            event.preventDefault();
            const menu = overlay.querySelector(".alm-selector-tools[open]");
            if (menu) {
                menu.open = false;
                menu.querySelector("summary").focus();
            } else if (isDetailDrawerOpen(overlay)) {
                popup.detailOpen = false;
                setDetailDrawer(overlay, false);
                overlay.querySelector(".alm-card.selected")?.focus({ preventScroll: true });
            } else if (popup.filtersOpen && window.matchMedia("(max-width: 1179px)").matches) setLoraFiltersOpen(false);
            else closePopup();
        }
        if (event.key !== "Tab") return;
        const controls = [...overlay.querySelectorAll('button, summary, input, select, textarea, a[href], [tabindex="0"]')]
            .filter((element) => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
        const target = event.shiftKey ? controls.at(-1) : controls[0];
        if (!overlay.contains(document.activeElement) || document.activeElement === (event.shiftKey ? controls[0] : controls.at(-1))) {
            event.preventDefault();
            target?.focus();
        }
    };
    overlay.addEventListener("keydown", handleKey);
    document.addEventListener("keydown", handleKey);
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) closePopup();
    });
    bindDetailInteractions(overlay, { onCloseDetail: () => { popup.detailOpen = false; } });
    bindCardMedia(overlay);
}

function closePopup() {
    overlay?.querySelectorAll("video").forEach((video) => video.pause());
    overlay?.classList.remove("show");
    if (popup.returnFocus?.isConnected) popup.returnFocus.focus({ preventScroll: true });
}

function setLoraFiltersOpen(open) {
    popup.filtersOpen = open;
    overlay.querySelector(".alm-lora-layout").classList.toggle("filters-open", open);
    overlay.querySelector('[data-action="toggle-lora-filters"]').setAttribute("aria-expanded", String(open));
    if (!open && overlay.querySelector(".alm-lora-nav").contains(document.activeElement)) {
        overlay.querySelector('[data-action="toggle-lora-filters"]').focus();
    }
}

async function hydratePopup() {
    await Promise.allSettled([
        loadPopupConfig(),
        loadLibrary(false),
        loadFavorites(false),
        loadDownloads(false),
        loadLoraTaxonomy(),
        popup.remoteItems.length ? Promise.resolve() : searchRemote(true),
    ]);
}

async function loadPopupConfig() {
    try {
        popup.config = await apiGet("/config");
    } catch (_) {
        popup.config = popup.config || { save_preview: true };
    }
}

function applyFavoriteStore(data = {}) {
    popup.favoriteItems = Array.isArray(data.items) ? data.items : [];
    popup.favoriteFolders = Array.isArray(data.folders) ? data.folders : [];
    if (popup.selectedFavoriteKey && !popup.favoriteItems.some((item) => item.key === popup.selectedFavoriteKey)) {
        popup.selectedFavoriteKey = "";
    }
    if (popup.selectedFavoriteFolderId
        && !popup.favoriteFolders.some((folder) => folder.id === popup.selectedFavoriteFolderId)) {
        popup.selectedFavoriteFolderId = "";
    }
}

async function loadFavorites(shouldRender = true) {
    popup.favoritesLoading = true;
    try {
        applyFavoriteStore(await apiGet("/favorites"));
    } catch (error) {
        popup.error = error.message;
    }
    popup.favoritesLoading = false;
    if (!overlay?.classList.contains("show")) return;
    if (shouldRender) {
        renderPopup();
        return;
    }
    rerenderNavPreservingScroll();
    syncVisibleFavoriteCardMarks();
    if (popup.tab === "discover" && popup.selectedRemote) updateRemoteDetail();
    if (popup.tab === "local" && popup.selectedAssetId) updateLocalDetail();
}

function selectedFavorite() {
    return popup.favoriteItems.find((item) => item.key === popup.selectedFavoriteKey) || null;
}

function remoteFavorite(model = popup.selectedRemote) {
    return favoriteEntryForRemote(popup.favoriteItems, model, "lora");
}

function localFavorite(asset) {
    return favoriteEntryForLocal(popup.favoriteItems, asset, "lora");
}

function syncVisibleFavoriteCardMarks() {
    if (!popupBody) return;
    if (popup.tab === "discover") {
        popupBody.querySelectorAll("[data-remote-id]").forEach((card) => {
            const model = popup.remoteItems.find((item) => String(item.id || "") === String(card.dataset.remoteId || ""));
            syncFavoriteCardMark(card, Boolean(model && remoteFavorite(model)));
        });
    }
    if (popup.tab === "local") {
        popupBody.querySelectorAll("[data-local-id]").forEach((card) => {
            const asset = popup.libraryItems.find((item) => String(item.id || "") === String(card.dataset.localId || ""));
            syncFavoriteCardMark(card, Boolean(asset && localFavorite(asset)));
        });
    }
}

async function setFavoriteItem(item, favorite, folderId) {
    const payload = { item, favorite };
    if (folderId !== undefined) payload.folder_id = folderId;
    const data = await apiPost("/favorites/item", payload);
    applyFavoriteStore(data);
    return data;
}

function refreshFavoriteSurface() {
    rerenderNavPreservingScroll();
    syncVisibleFavoriteCardMarks();
    if (popup.tab === "discover") {
        const favorite = remoteFavorite();
        syncFavoriteControls(popupBody, Boolean(favorite), favorite?.folder_id);
        return;
    }
    if (popup.tab === "local") {
        const asset = popup.libraryItems.find((item) => item.id === popup.selectedAssetId);
        const favorite = localFavorite(asset);
        syncFavoriteControls(popupBody, Boolean(favorite), favorite?.folder_id);
        return;
    }
    renderPopup();
}

async function toggleRemoteFavorite(model = popup.selectedRemote) {
    if (!model) return;
    const existing = remoteFavorite(model);
    try {
        await setFavoriteItem(existing || favoriteItemForRemote(model, "lora"), !existing);
        showToast(t(existing ? "Removed favorite" : "Marked favorite"));
        refreshFavoriteSurface();
    } catch (error) {
        popup.error = error.message;
        renderPopup();
    }
}

async function toggleLocalFavorite(asset) {
    if (!asset) return;
    const existing = localFavorite(asset);
    try {
        await setFavoriteItem(existing || favoriteItemForLocal(asset, "lora"), !existing);
        showToast(t(existing ? "Removed favorite" : "Marked favorite"));
        refreshFavoriteSurface();
    } catch (error) {
        popup.error = error.message;
        renderPopup();
    }
}

async function assignFavoriteFolder(item, folderId) {
    if (!item) return;
    try {
        await setFavoriteItem(item, true, folderId || "");
        showToast(t("Favorite moved"));
        refreshFavoriteSurface();
    } catch (error) {
        popup.error = error.message;
        renderPopup();
    }
}

async function saveFavoriteFolder(editor) {
    const name = String(editor?.value || "").trim();
    if (!name) return;
    try {
        applyFavoriteStore(await apiPost("/favorites/folder", {
            action: editor.mode === "rename" ? "rename" : "create",
            folder_id: editor.id || "",
            name,
        }));
        popup.favoriteFolderEditor = null;
        showToast(t(editor.mode === "rename" ? "Favorite folder renamed" : "Favorite folder created"));
        renderPopup();
    } catch (error) {
        popup.error = error.message;
        renderPopup();
    }
}

async function deleteFavoriteFolder(folderId) {
    if (!folderId || !confirm(t("Delete this favorite folder? Its items will remain in All Favorites without a folder."))) return;
    try {
        applyFavoriteStore(await apiPost("/favorites/folder", { action: "delete", folder_id: folderId }));
        popup.favoriteFolderEditor = null;
        showToast(t("Favorite folder deleted"));
        renderPopup();
    } catch (error) {
        popup.error = error.message;
        renderPopup();
    }
}

function normalizeTaxonomyItems(value) {
    return (Array.isArray(value) ? value : [])
        .map((item) => ({ name: String(item?.name || "").trim(), count: Number(item?.count || 0) }))
        .filter((item) => item.name);
}

async function loadLoraTaxonomy() {
    try {
        const data = await apiGet("/taxonomy?kind=lora");
        popup.taxonomy = {
            baseModels: normalizeTaxonomyItems(data?.baseModels),
            tags: normalizeTaxonomyItems(data?.tags),
        };
        if (overlay?.classList.contains("show")) renderNav();
    } catch (_) {
        popup.taxonomy = popup.taxonomy || { baseModels: [], tags: [] };
    }
}

function filterOptions(items, selected = "") {
    const names = (Array.isArray(items) ? items : []).map((item) => String(item?.name || item || "").trim()).filter(Boolean);
    if (selected && !names.some((name) => name.toLocaleLowerCase() === selected.toLocaleLowerCase())) names.unshift(selected);
    return Array.from(new Set(names));
}

function loraBaseModelOptions() {
    const local = popup.libraryItems.map((item) => item.base_model).filter(Boolean);
    return filterOptions([...(popup.taxonomy?.baseModels || []), ...local], popup.selectedBaseModel);
}

function navCount(tab) {
    if (tab === "local") return popup.libraryItems.length;
    if (tab === "favorites") return popup.favoriteItems.filter((item) => item.asset_kind === "lora").length;
    if (tab === "applied") return popup.node?._almLoras?.length || 0;
    if (tab === "downloads") {
        return loraDownloads().filter((job) => ACTIVE_DOWNLOAD_STATUSES.has(job.status)).length;
    }
    return "";
}

function renderNav() {
    const nav = overlay?.querySelector(".alm-lora-nav");
    if (!nav) return;
    const openCombo = nav.querySelector(".alm-combo.open");
    const comboState = openCombo ? {
        id: openCombo.dataset.combo,
        query: openCombo.querySelector("[data-combo-search]").value,
        focused: openCombo.contains(document.activeElement),
    } : null;
    const tabs = overlay.querySelector(".alm-lora-tabs");
    overlay.querySelector(".alm-selector-node-status").innerHTML = `${selectorIcon("layers")}<span>${escapeHtml(t("Applied to Node"))}</span><b>${navCount("applied")}</b>`;
    const items = [
        ["discover", "Discover"],
        ["local", "Local LoRAs"],
        ["favorites", "Favorites"],
        ["applied", "Applied"],
        ["downloads", "Downloads"],
    ];
    if (!tabs.children.length) tabs.innerHTML = items.map(([id, label]) => `
        <button class="alm-lora-tab alm-selector-tab ${popup.tab === id ? "active" : ""}" type="button" role="tab" id="alm-lora-tab-${id}" data-lora-tab="${id}" aria-controls="alm-lora-content" aria-selected="${popup.tab === id}" tabindex="${popup.tab === id ? 0 : -1}">
            ${selectorIcon(id)}<span>${escapeHtml(t(label))}</span>
            ${navCount(id) !== "" ? `<b>${navCount(id)}</b>` : ""}
        </button>
    `).join("");
    tabs.querySelectorAll("[data-lora-tab]").forEach((button) => {
        const active = button.dataset.loraTab === popup.tab;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
        button.tabIndex = active ? 0 : -1;
        const badge = button.querySelector("b");
        if (badge) badge.textContent = navCount(button.dataset.loraTab);
    });
    const hasFilters = ["discover", "local", "favorites"].includes(popup.tab);
    overlay.querySelector(".alm-lora-layout").classList.toggle("has-filters", hasFilters);
    overlay.querySelector('[data-action="toggle-lora-filters"]').hidden = !hasFilters;
    popupBody.setAttribute("aria-labelledby", `alm-lora-tab-${popup.tab}`);
    setLoraFiltersOpen(popup.filtersOpen);
    nav.innerHTML = `
        <div class="alm-lora-filter-heading alm-selector-filter-heading">
            <h2>${escapeHtml(t(popup.tab === "favorites" ? "Favorites" : "Adjust filters"))}</h2>
            ${popup.tab === "local" && popup.selectedBaseModel || popup.tab === "discover" && (popup.selectedCategory || popup.selectedTag) ? `<button class="alm-lora-reset alm-selector-reset" type="button" data-action="reset-lora-sidebar-filters">${escapeHtml(t("Reset filters"))}</button>` : ""}
        </div>
        ${["discover", "local"].includes(popup.tab) ? `
            <div class="alm-nav-group alm-category-group alm-lora-filter-group">
                <div class="alm-nav-title">${escapeHtml(t("Base Model"))}</div>
                <div class="alm-search-picker">
                    ${popup.tab === "discover" ? renderLockedBaseModel() : renderSelectorCombo({
                        id: "lora-base-model",
                        value: popup.selectedBaseModel,
                        items: loraBaseModelOptions(),
                        placeholder: t("Choose a base model"),
                        searchPlaceholder: t("Search base models..."),
                        emptyText: t("No base models found"),
                        clearTitle: t("Clear base model"),
                    })}
                </div>
            </div>
        ` : ""}
        ${popup.tab === "discover" ? `
            <div class="alm-nav-group alm-category-group alm-lora-filter-group">
                <div class="alm-nav-title">${escapeHtml(t("Filter by Category"))}</div>
                <div class="alm-search-picker">
                    ${renderSelectorCombo({
                        id: "lora-category",
                        value: popup.selectedCategory ? t(CIVITAI_CATEGORY_FILTERS.find((item) => item.value === popup.selectedCategory)?.label || popup.selectedCategory) : "",
                        items: [t("All"), ...CIVITAI_CATEGORY_FILTERS.map((item) => t(item.label))],
                        placeholder: t("All"),
                        searchPlaceholder: t("Search"),
                        emptyText: t("No options found"),
                        clearTitle: t("Clear"),
                    })}
                </div>
            </div>
            <div class="alm-nav-group alm-category-group alm-lora-filter-group">
                <div class="alm-nav-title">${escapeHtml(t("Search Tags"))}</div>
                <div class="alm-search-picker">
                    ${renderSelectorCombo({
                        id: "lora-tag",
                        value: popup.selectedTag,
                        items: filterOptions(popup.taxonomy?.tags, popup.selectedTag),
                        placeholder: t("Choose a tag"),
                        searchPlaceholder: t("Search tags..."),
                        emptyText: t("No tags found"),
                        clearTitle: t("Clear tag"),
                    })}
                </div>
            </div>
        ` : ""}
        ${popup.tab === "local" ? renderLocalFolderSidebar() : ""}
        ${popup.tab === "favorites" ? renderLoraFavoriteSidebar() : ""}
    `;
    tabs.querySelectorAll("[data-lora-tab]").forEach((button, index, buttons) => {
        button.onclick = () => {
            switchTab(button.dataset.loraTab);
            tabs.querySelector(`[data-lora-tab="${popup.tab}"]`)?.focus({ preventScroll: true });
        };
        button.onkeydown = (event) => {
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
                : (index + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
            buttons[next].click();
            tabs.querySelector(`[data-lora-tab="${popup.tab}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
        };
    });
    const resetFilters = nav.querySelector('[data-action="reset-lora-sidebar-filters"]');
    if (resetFilters) resetFilters.onclick = resetLoraFilters;
    bindLocalFolderControls(nav);
    const selectBaseModel = (value) => {
        if (popup.selectedBaseModel === value) return;
        popup.selectedBaseModel = value;
        popup.selectedRemote = null;
        popup.selectedAssetId = "";
        popup.scroll.local = 0;
        rerenderNavPreservingScroll();
        if (!updateLocalFolderView()) renderPopup({ preserveScroll: false });
        nav.querySelector('[data-combo="lora-base-model"] [data-combo-toggle]')?.focus({ preventScroll: true });
    };
    bindSearchCombo(nav.querySelector('[data-combo="lora-base-model"]'), selectBaseModel);
    bindSearchCombo(nav.querySelector('[data-combo="lora-category"]'), (value) => {
        const category = CIVITAI_CATEGORY_FILTERS.find((item) => t(item.label) === value)?.value || "";
        if (popup.selectedCategory === category) return;
        popup.selectedCategory = category;
        popup.selectedRemote = null;
        void searchRemote(true);
    });
    const selectTag = (value) => {
        if (popup.selectedTag === value) return;
        popup.selectedTag = value;
        popup.selectedRemote = null;
        void searchRemote(true);
    };
    bindSearchCombo(nav.querySelector('[data-combo="lora-tag"]'), selectTag);
    if (popup.tab === "favorites") bindLoraFavoriteSidebar(nav);
    if (comboState) {
        const combo = [...nav.querySelectorAll(".alm-combo")].find((item) => item.dataset.combo === comboState.id);
        if (combo) {
            combo.querySelector("[data-combo-toggle]").click();
            const input = combo.querySelector("[data-combo-search]");
            input.value = comboState.query;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            if (comboState.focused) requestAnimationFrame(() => {
                input.focus({ preventScroll: true });
                input.setSelectionRange(input.value.length, input.value.length);
            });
        }
    }
}

// Discover is fixed to Anima LoRAs; the base model picker only filters local files.
function renderLockedBaseModel() {
    return `<div class="alm-combo has-value is-locked" title="${escapeAttr(t("Anima Tools only searches LoRAs for the Anima base model."))}">
        <div class="alm-combo-control"><span class="alm-combo-value">${escapeHtml(LOCKED_BASE_MODEL)}</span>${selectorIcon("lock")}</div>
    </div>`;
}

function updateDownloadNavCount() {
    const button = overlay?.querySelector('[data-lora-tab="downloads"]');
    if (!button) return false;
    let badge = button.querySelector("b");
    if (!badge) {
        badge = document.createElement("b");
        button.appendChild(badge);
    }
    badge.textContent = String(navCount("downloads"));
    return true;
}

function resetLoraFilters() {
    popup.selectedBaseModel = "";
    popup.selectedCategory = "";
    popup.selectedTag = "";
    popup.selectedRemote = null;
    if (popup.tab === "discover") void searchRemote(true);
    else renderPopup({ preserveScroll: false });
}

function loraFavoriteItems() {
    return popup.favoriteItems.filter((item) => item.asset_kind === "lora");
}

function renderLoraFavoriteSidebar() {
    return renderFavoriteFolderSidebar({
        folders: popup.favoriteFolders,
        items: loraFavoriteItems(),
        selectedId: popup.selectedFavoriteFolderId,
        editor: popup.favoriteFolderEditor,
    });
}

function bindLoraFavoriteSidebar(root) {
    bindFavoriteFolderSidebar(root, {
        onSelect: (folderId) => {
            if (popup.selectedFavoriteFolderId === folderId) return;
            popup.selectedFavoriteFolderId = folderId;
            popup.selectedFavoriteKey = "";
            popup.favoriteFolderEditor = null;
            popup.scroll.favorites = 0;
            renderPopup({ preserveScroll: false });
        },
        onEdit: (editor) => {
            popup.favoriteFolderEditor = editor;
            rerenderNavPreservingScroll();
        },
        onSave: (editor) => void saveFavoriteFolder(editor),
        onDelete: (folderId) => void deleteFavoriteFolder(folderId),
    });
}

function renderLocalFolderSidebar() {
    const tree = localFolderTree();
    return `
        <div class="alm-nav-group alm-category-group alm-lora-filter-group alm-lora-folder-group">
            <div class="alm-nav-title">${escapeHtml(t("Local Folders"))}</div>
            <button class="alm-nav-btn alm-lora-folder-all ${popup.selectedLocalFolder ? "" : "active"}" data-lora-folder="">
                <span class="alm-lora-folder-label"><i class="alm-lora-folder-glyph is-library" aria-hidden="true"></i>${escapeHtml(t("All LoRAs"))}</span>
                <b>${tree.count}</b>
            </button>
            ${renderLocalFolderTree(tree)}
            ${!tree.count ? `<div class="alm-nav-note">${escapeHtml(t("Local folders appear after scanning your model files."))}</div>` : ""}
        </div>
    `;
}

function renderLocalFolderTree(tree) {
    if (!tree?.count) return "";
    return `
        <div class="alm-folder-tree alm-lora-folder-tree">
            ${tree.rootFileCount ? renderLocalRootFilesNode(tree.rootFileCount) : ""}
            ${tree.children.map((node) => renderLocalFolderNode(node, 0)).join("")}
        </div>
    `;
}

function renderLocalRootFilesNode(count) {
    return `
        <div class="alm-folder-node" style="--alm-folder-depth: 0">
            <div class="alm-folder-row">
                <span class="alm-folder-spacer" aria-hidden="true"></span>
                <button class="alm-nav-btn alm-folder-select alm-lora-folder-select ${popup.selectedLocalFolder === ROOT_LOCAL_FOLDER ? "active" : ""}" data-lora-folder="${ROOT_LOCAL_FOLDER}" title="${escapeAttr(t("Root files"))}">
                    <span class="alm-lora-folder-label"><i class="alm-lora-folder-glyph is-file" aria-hidden="true"></i>${escapeHtml(t("Root files"))}</span>
                    <b>${count}</b>
                </button>
            </div>
        </div>
    `;
}

function renderLocalFolderNode(node, depth) {
    const expanded = isLocalFolderExpanded(node.path);
    const hasChildren = node.children.length > 0;
    const selected = popup.selectedLocalFolder === node.path;
    const inPath = !selected && popup.selectedLocalFolder.startsWith(`${node.path}/`);
    return `
        <div class="alm-folder-node" style="--alm-folder-depth: ${Math.min(depth, 8)}">
            <div class="alm-folder-row">
                ${hasChildren ? `
                    <button class="alm-folder-toggle ${expanded ? "expanded" : ""}" data-lora-folder-toggle="${escapeAttr(node.path)}" aria-label="${escapeAttr(`${expanded ? "Collapse" : "Expand"} ${node.path}`)}" aria-expanded="${expanded ? "true" : "false"}"></button>
                ` : `<span class="alm-folder-spacer" aria-hidden="true"></span>`}
                <button class="alm-nav-btn alm-folder-select alm-lora-folder-select ${selected ? "active" : ""} ${inPath ? "is-ancestor" : ""}" data-lora-folder="${escapeAttr(node.path)}" title="${escapeAttr(node.path)}">
                    <span class="alm-lora-folder-label"><i class="alm-lora-folder-glyph" aria-hidden="true"></i>${escapeHtml(node.name)}</span>
                    <b>${node.count}</b>
                </button>
            </div>
            ${hasChildren && expanded ? `<div class="alm-folder-children">${node.children.map((child) => renderLocalFolderNode(child, depth + 1)).join("")}</div>` : ""}
        </div>
    `;
}

function bindLocalFolderControls(root) {
    root?.querySelectorAll("[data-lora-folder]").forEach((button) => {
        button.onclick = () => selectLocalFolder(button.dataset.loraFolder || "");
    });
    root?.querySelectorAll("[data-lora-folder-toggle]").forEach((button) => {
        button.onclick = (event) => {
            event.stopPropagation();
            const expanded = button.classList.contains("expanded");
            animateSelectorFolder(button, () => toggleLocalFolder(button.dataset.loraFolderToggle || "", expanded));
        };
    });
}

function rerenderNavPreservingScroll() {
    const nav = overlay?.querySelector(".alm-lora-nav");
    if (!nav) return;
    const scrollTop = nav.scrollTop;
    renderNav();
    nav.scrollTop = scrollTop;
}

function selectLocalFolder(value) {
    const folder = normalizeLocalFolderPath(value);
    if (popup.selectedLocalFolder === folder) return;
    popup.selectedLocalFolder = folder;
    popup.selectedAssetId = "";
    popup.scroll.local = 0;
    expandLocalFolderAncestors(folder);
    rerenderNavPreservingScroll();
    if (!updateLocalFolderView()) renderPopup({ preserveScroll: false });
}

function toggleLocalFolder(value, expanded) {
    const folder = normalizeLocalFolderPath(value);
    if (!folder || folder === ROOT_LOCAL_FOLDER) return;
    popup.expandedLocalFolders[folder] = !expanded;
    rerenderNavPreservingScroll();
}

function expandLocalFolderAncestors(value) {
    const folder = normalizeLocalFolderPath(value);
    if (!folder || folder === ROOT_LOCAL_FOLDER) return;
    const parts = splitLocalPath(folder);
    for (let index = 1; index <= parts.length; index += 1) {
        popup.expandedLocalFolders[parts.slice(0, index).join("/")] = true;
    }
}

function isLocalFolderExpanded(path) {
    if (Object.prototype.hasOwnProperty.call(popup.expandedLocalFolders, path)) return Boolean(popup.expandedLocalFolders[path]);
    return false;
}

function switchTab(tab) {
    if (tab !== popup.tab) {
        tabSelections[popup.tab] = Object.fromEntries(SELECTION_FIELDS.map((field) => [field, popup[field]]));
        Object.assign(popup, tabSelections[tab] || EMPTY_SELECTION);
        popup.detailOpen = false;
    }
    popup.tab = tab;
    popup.error = "";
    if (tab === "favorites") void loadFavorites(true);
    renderPopup();
    if (tab === "local" && !popup.libraryItems.length) void loadLibrary(false);
    if (tab === "downloads") void loadDownloads(true);
}

function popupScrollElement() {
    if (!popupBody) return null;
    if (popup.tab === "applied") return popupBody.querySelector(".alm-lora-applied-list");
    if (popup.tab === "downloads") return popupBody.querySelector(".alm-download-list");
    return popupBody.querySelector(".alm-lora-results");
}

function rememberPopupScroll() {
    const nav = overlay?.querySelector(".alm-lora-nav");
    if (nav) popup.scroll.nav = nav.scrollTop;
    if (!renderedPopupTab || !popupBody) return;
    let element = null;
    if (renderedPopupTab === "applied") element = popupBody.querySelector(".alm-lora-applied-list");
    else if (renderedPopupTab === "downloads") element = popupBody.querySelector(".alm-download-list");
    else element = popupBody.querySelector(".alm-lora-results");
    if (element) popup.scroll[renderedPopupTab] = element.scrollTop;
}

function restorePopupScroll() {
    const apply = () => {
        const nav = overlay?.querySelector(".alm-lora-nav");
        if (nav) nav.scrollTop = Number(popup.scroll.nav || 0);
        const element = popupScrollElement();
        if (element) element.scrollTop = Number(popup.scroll[popup.tab] || 0);
    };
    apply();
    requestAnimationFrame(() => {
        apply();
        if (popup.tab === "discover") maybeAutoLoadMoreLoras(popupScrollElement());
    });
}

function bindPopupScroll() {
    const nav = overlay?.querySelector(".alm-lora-nav");
    if (nav) nav.onscroll = () => { popup.scroll.nav = nav.scrollTop; };
    const element = popupScrollElement();
    if (!element) return;
    element.onscroll = () => {
        popup.scroll[popup.tab] = element.scrollTop;
        if (popup.tab === "discover") maybeAutoLoadMoreLoras(element);
    };
}

function maybeAutoLoadMoreLoras(element) {
    if (!element || popup.tab !== "discover" || popup.remoteLoading || !popup.nextCursor) return;
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining > Math.max(720, element.clientHeight * 0.8)) return;
    void searchRemote(false);
}

function capturePopupFocus() {
    const active = document.activeElement;
    if (!popupBody?.contains(active) || !active?.matches?.("input[data-field], textarea[data-field]")) return null;
    return {
        field: active.dataset.field || "",
        start: Number.isInteger(active.selectionStart) ? active.selectionStart : null,
        end: Number.isInteger(active.selectionEnd) ? active.selectionEnd : null,
        direction: active.selectionDirection || "none",
    };
}

function restorePopupFocus(snapshot) {
    if (!popupBody || !snapshot?.field) return;
    const apply = () => {
        const input = Array.from(popupBody.querySelectorAll("input[data-field], textarea[data-field]"))
            .find((item) => item.dataset.field === snapshot.field);
        if (!input) return;
        try {
            input.focus({ preventScroll: true });
        } catch (_) {
            input.focus();
        }
        if (snapshot.start !== null && snapshot.end !== null) {
            const length = String(input.value || "").length;
            input.setSelectionRange?.(
                Math.min(snapshot.start, length),
                Math.min(snapshot.end, length),
                snapshot.direction,
            );
        }
    };
    apply();
    requestAnimationFrame(apply);
}

function renderPopup(options = {}) {
    if (!overlay || !popupBody) return;
    const focusedField = capturePopupFocus();
    if (options.preserveScroll !== false) rememberPopupScroll();
    else popup.scroll[popup.tab] = 0;
    renderNav();
    const content = popup.tab === "local"
        ? renderLocal()
        : popup.tab === "favorites"
            ? renderFavorites()
        : popup.tab === "applied"
            ? renderApplied()
            : popup.tab === "downloads"
                ? renderDownloads()
                : renderDiscover();
    popupBody.innerHTML = content;
    renderedPopupTab = popup.tab;
    updatePopupMessages();
    bindPopupEvents();
    bindPopupScroll();
    observeCardMedia(popupBody);
    restorePopupScroll();
    restorePopupFocus(focusedField);
}

function updatePopupMessages() {
    return updateNotificationHost(notificationHost, {
        error: popup.error,
        toast: popup.toast,
        toastAction: popup.toastAction && {
            label: popup.toastAction.label,
            onClick: () => {
                const { onClick } = popup.toastAction;
                popup.toast = "";
                popup.toastAction = null;
                updatePopupMessages();
                onClick();
            },
        },
        onDismissError: () => {
            popup.error = "";
            updatePopupMessages();
        },
    });
}

function updateSelectedCard(selector, selectedId) {
    popupBody?.querySelectorAll(selector).forEach((card) => {
        card.classList.toggle("selected", String(card.dataset.remoteId || card.dataset.localId || "") === String(selectedId || ""));
    });
}

function loraDetailAside(subject, html, className = "") {
    return `<aside class="alm-detail alm-lora-detail ${className}" data-detail-subject="${escapeAttr(subject)}">${renderDetailDismiss()}${html}</aside>`;
}

function remoteDetailAside() {
    return loraDetailAside(popup.selectedRemote ? `remote:${popup.selectedRemote.id}` : "", renderRemoteDetail());
}

function localDetailAside() {
    const asset = popup.libraryItems.find((item) => String(item.id) === String(popup.selectedAssetId)) || null;
    return loraDetailAside(asset ? `local:${asset.id}` : "", asset
        ? renderLocalDetail(asset)
        : renderEmptyDetail(t("Select a local LoRA"), t("Apply it to this node or manage its local file and Civitai metadata."), "library"));
}

function favoriteDetailAside() {
    const item = selectedFavorite();
    return loraDetailAside(item ? `favorite:${item.key}` : "", item
        ? renderFavoriteDetail(item)
        : renderEmptyDetail(t("Select a favorite"), t("Favorite details and available actions will stay here."), "favorites"));
}

function replaceLoraDetail(asideHtml) {
    const existing = popupBody?.querySelector(".alm-split.has-detail > .alm-lora-detail");
    if (!existing) return false;
    const template = document.createElement("template");
    template.innerHTML = asideHtml.trim();
    swapDetail(existing, template.content.firstElementChild);
    bindPopupEvents();
    return true;
}

function updateRemoteDetail() {
    if (popup.tab !== "discover") return false;
    updateSelectedCard("[data-remote-id]", popup.selectedRemote?.id);
    return replaceLoraDetail(remoteDetailAside());
}

function updateLocalDetail() {
    if (popup.tab !== "local") return false;
    updateSelectedCard("[data-local-id]", popup.selectedAssetId);
    return replaceLoraDetail(localDetailAside());
}

function openDetailDrawer() {
    popup.detailOpen = true;
    setDetailDrawer(popupBody, true);
}

function updateSelectedLocalCard() {
    if (popup.tab !== "local") return false;
    const asset = popup.libraryItems.find((item) => String(item.id) === String(popup.selectedAssetId));
    const card = [...(popupBody?.querySelectorAll("[data-local-id]") || [])]
        .find((item) => String(item.dataset.localId || "") === String(popup.selectedAssetId || ""));
    if (!asset || !card) return false;
    const index = Math.max(0, filteredLocalItems().findIndex((item) => String(item.id) === String(asset.id)));
    const template = document.createElement("template");
    template.innerHTML = renderLocalCard(asset, index).trim();
    const replacement = template.content.firstElementChild;
    if (!replacement) return false;
    if (card.dataset.previewKey === replacement.dataset.previewKey) {
        const currentThumb = card.querySelector(".alm-thumb");
        const nextThumb = replacement.querySelector(".alm-thumb");
        if (currentThumb && nextThumb) {
            currentThumb.remove();
            nextThumb.replaceWith(currentThumb);
        }
    }
    card.replaceWith(replacement);
    bindPopupEvents();
    observeCardMedia(popupBody);
    return true;
}

function setRemoteLoadingMore(visible) {
    if (popup.tab !== "discover") return false;
    const results = popupBody?.querySelector(".alm-lora-results");
    if (!results) return false;
    results.querySelectorAll(".alm-load-more-skeleton").forEach((item) => item.remove());
    results.parentElement.classList.toggle("is-searching-more", visible && popup.sparseResults);
    if (visible && !popup.sparseResults) results.insertAdjacentHTML("beforeend", renderCardSkeletons(loadMoreSkeletonCount(results), { loadMore: true }));
    return true;
}

function appendRemoteItems(items, startIndex) {
    if (popup.tab !== "discover") return false;
    const results = popupBody?.querySelector(".alm-lora-results");
    if (!results) return false;
    setRemoteLoadingMore(false);
    if (items.length) {
        results.insertAdjacentHTML("beforeend", items.map((model, index) => renderRemoteCard(model, startIndex + index)).join(""));
        animateCardsIn([...results.querySelectorAll(":scope > .alm-card[data-remote-id]")].slice(startIndex));
        bindPopupEvents();
        observeCardMedia(popupBody);
    }
    maybeAutoLoadMoreLoras(results);
    return true;
}

function renderLoraActiveFilterBar() {
    const chips = [];
    if (popup.tab === "local" && popup.selectedBaseModel) {
        chips.push({
            key: "base_model",
            label: t("Base Model"),
            value: popup.selectedBaseModel,
            clearAction: "clear-lora-filter-base",
        });
    }
    if (popup.tab === "discover" && popup.selectedCategory) {
        const categoryItem = CIVITAI_CATEGORY_FILTERS.find((item) => item.value === popup.selectedCategory);
        chips.push({
            key: "category",
            label: t("Category"),
            value: t(categoryItem?.label || popup.selectedCategory),
            clearAction: "clear-lora-filter-category",
        });
    }
    if (popup.tab === "discover" && popup.selectedTag) {
        chips.push({
            key: "tag",
            label: t("Search Tags"),
            value: popup.selectedTag,
            clearAction: "clear-lora-filter-tag",
        });
    }
    return renderActiveFilterChips(chips, "reset-lora-filters");
}

function renderDiscover() {
    const toolbar = renderSelectorToolbar({
        title: t("Discover Anima LoRAs"),
        searchHtml: renderSelectorSearch({
            value: popup.discoverQuery,
            inputAttrs: 'data-field="remote-query"',
            placeholder: t("Search Civitai LoRAs..."),
            clearAction: "clear-lora-search",
            loading: popup.remoteLoading,
        }),
        actionsHtml: `
            ${renderSelectorSort(popup.sort)}
            <button class="alm-selector-button is-icon" type="button" data-action="search-loras" title="${escapeAttr(t("Refresh"))}" aria-label="${escapeAttr(t("Refresh"))}">${selectorIcon("refresh")}</button>
        `,
        filterBarHtml: renderLoraActiveFilterBar(),
    });
    return `
        <section class="alm-page alm-lora-page">
            ${toolbar}
            <div class="alm-split has-detail alm-lora-split ${popup.detailOpen ? "is-detail-open" : ""} ${popup.remoteLoading && !popup.remoteResetting && popup.sparseResults ? "is-searching-more" : ""}">
                <div class="alm-results alm-lora-results">
                    ${renderRemoteResults()}
                </div>
                ${remoteDetailAside()}
            </div>
        </section>
    `;
}

function renderRemoteResults() {
    if (!popup.remoteItems.length && popup.remoteLoading) return renderCardSkeletons(30);
    if (!popup.remoteItems.length) return renderCollectionEmptyState({
        kind: "discover",
        kicker: t("Discover"),
        title: t("No matching {kind} found", { kind: "LoRA" }),
        description: t("Try another keyword or loosen the filters to explore more from Civitai."),
        hints: [t("Change keywords"), t("Adjust filters")],
    });
    return `
        ${popup.remoteItems.map((model, index) => renderRemoteCard(model, index)).join("")}
        ${popup.remoteLoading && !popup.remoteResetting && !popup.sparseResults ? renderCardSkeletons(loadMoreSkeletonCount(popupBody?.querySelector(".alm-lora-results")), { loadMore: true }) : ""}
    `;
}

function versionsFor(model) {
    return Array.isArray(model?.modelVersions) ? model.modelVersions : [];
}

function selectedVersion() {
    const versions = versionsFor(popup.selectedRemote);
    return versions.find((item) => String(item.id) === String(popup.selectedVersionId)) || versions[0] || null;
}

function filesFor(version) {
    return Array.isArray(version?.files) ? version.files : [];
}

function primaryFileName(version) {
    const files = filesFor(version);
    return String((files.find((item) => item.primary) || files[0])?.name || "");
}

function selectedFile() {
    const files = filesFor(selectedVersion());
    return files.find((item) => String(item.name || item.id) === String(popup.selectedFileName))
        || files.find((item) => item.primary)
        || files[0]
        || null;
}

function rawPreview(model, version = versionsFor(model)[0]) {
    const image = findModelPreviewSource(model, version, { preferImage: true });
    return typeof image === "string" ? image : image?.url || image?.thumbnailUrl || "";
}

function remotePreviewMedia(model, version = versionsFor(model)[0], width = 450) {
    const source = findModelPreviewSource(model, version);
    if (source) return createPreviewMedia(source, width);
    const messageKey = isModelPreviewFiltered(model, popup.contentFilterActive)
        ? "Preview hidden by content settings"
        : "No Preview";
    return { url: "", type: "image", emptyText: t(messageKey) };
}

function cardMediaOptions(index) {
    return { eager: index < INITIAL_PREVIEW_LOADS, priority: index < HIGH_PRIORITY_PREVIEW_LOADS ? "high" : "auto" };
}

function renderRemoteCard(model, index = 0) {
    const version = versionsFor(model)[0] || {};
    const media = remotePreviewMedia(model, version);
    const selected = String(popup.selectedRemote?.id || "") === String(model.id || "");
    const installed = findLocalForRemote(model, version);
    const favorite = remoteFavorite(model);
    const creator = model.creator?.username ? `@${model.creator.username}` : "";
    const stats = modelStats(model, version);
    const firstFile = filesFor(version).find((item) => item.primary) || filesFor(version)[0] || {};
    const sizeText = firstFile.sizeKB ? formatBytes(firstFile.sizeKB * 1024) : "";
    const preview = renderCardMedia(media, cardMediaOptions(index));
    return `
        <article class="alm-card alm-lora-card ${selected ? "selected" : ""}" data-remote-id="${escapeAttr(model.id)}" tabindex="0">
            ${renderFavoriteCardMark(Boolean(favorite))}
            <div class="alm-card-top-badges">
                ${version.baseModel ? `<div class="alm-card-badge">${escapeHtml(version.baseModel)}</div>` : ""}
                ${isEarlyAccess(version) ? `<div class="alm-card-badge is-early-access" title="${escapeAttr(t("Early Access"))}" aria-label="${escapeAttr(t("Early Access"))}">${selectorIcon("lock")}</div>` : ""}
                <div class="alm-card-status-slot">${installed ? `<span class="alm-card-status is-installed">✓ ${escapeHtml(t("Installed"))}</span>` : ""}</div>
            </div>
            <div class="alm-thumb">${preview}</div>
            <div class="alm-card-body">
                ${creator ? `<div class="alm-card-creator">${escapeHtml(creator)}</div>` : ""}
                <div class="alm-card-title">${escapeHtml(model.name || "Untitled")}</div>
                ${renderSelectorStats(formatStatCount(stats.downloadCount), formatStatCount(stats.likeCount), sizeText)}
            </div>
        </article>
    `;
}

function renderRemoteDetail() {
    const model = popup.selectedRemote;
    if (!model) {
        return popup.remoteLoading
            ? renderDetailSkeleton()
            : renderEmptyDetail(t("Select a LoRA"), t("Choose a LoRA to view versions, trigger words, and apply it to this node."), "discover");
    }
    const versions = versionsFor(model);
    const version = selectedVersion() || {};
    const files = filesFor(version);
    const file = selectedFile();
    const favorite = remoteFavorite(model);
    const pending = pendingForRemote(model, version);
    const words = (Array.isArray(version.trainedWords) ? version.trainedWords : [])
        .map((word) => String(word || "").trim())
        .filter(Boolean);
    const stats = modelStats(model, version);
    const modelUrl = `https://civitai.red/models/${encodeURIComponent(model.id || "")}${version.id ? `?modelVersionId=${encodeURIComponent(version.id)}` : ""}`;
    return `
        <div class="alm-detail-scroll">
            ${renderDetailGallery(galleryItemsForModel(model, version), model.name || "", remotePreviewMedia(model, version).emptyText)}
            <div class="alm-detail-head">
                <div>
                    <a class="alm-detail-title-link" href="${escapeAttr(modelUrl)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(t("Open model page"))}"><h2>${escapeHtml(model.name || "Untitled")}</h2><span class="alm-external-icon" aria-hidden="true">↗</span></a>
                    <p>${escapeHtml(model.creator?.username || t("Unknown creator"))}</p>
                    <div class="alm-detail-meta">
                        ${renderDetailFacts(modelFacts(model, version, file || {}))}
                        ${renderSelectorStats(formatStatCount(stats.downloadCount), formatStatCount(stats.likeCount))}
                    </div>
                </div>
            </div>
            <section class="alm-detail-download-card">
                ${versions.length > 1 ? `
                    <div class="alm-detail-field-block">
                        <label class="alm-label">${selectorIcon("layers")}${escapeHtml(t("Version"))}</label>
                        <select class="alm-input alm-full" data-field="remote-version">
                            ${versions.map((item) => `<option value="${escapeAttr(item.id)}" ${String(item.id) === String(version.id) ? "selected" : ""}>${escapeHtml(`${item.name || item.id} · ${item.baseModel || "Other"}`)}</option>`).join("")}
                        </select>
                    </div>
                ` : `<input type="hidden" data-field="remote-version" value="${escapeAttr(version.id || "")}" />`}
                ${files.length > 1 ? `
                    <div class="alm-detail-field-block">
                        <label class="alm-label">${selectorIcon("file")}${escapeHtml(t("File"))}</label>
                        <select class="alm-input alm-full" data-field="remote-file">
                            ${files.map((item) => `<option value="${escapeAttr(item.name || item.id)}" ${String(item.name || item.id) === String(file?.name || file?.id || "") ? "selected" : ""}>${escapeHtml(`${item.name || String(item.id)}${item.sizeKB ? ` · ${formatBytes(item.sizeKB * 1024)}` : ""}`)}</option>`).join("")}
                        </select>
                    </div>
                ` : ""}
                ${findLocalForRemote(model, version) ? "" : renderEarlyAccessNotice(model, version)}
                <div class="alm-detail-action-hub ${pending ? "" : "is-inline-cta"}">
                    <div data-remote-download-state>${renderRemoteDownloadState(model, version, file)}</div>
                    ${renderFavoriteControls({
                        favorite: Boolean(favorite),
                        folders: popup.favoriteFolders,
                        folderId: favorite?.folder_id || "",
                        toggleAction: "favorite-remote-lora",
                        folderAction: "assign-remote-favorite-folder",
                        compact: true,
                    })}
                </div>
            </section>
            ${words.length ? `
                <section class="alm-selector-triggers" aria-label="${escapeAttr(t("Trigger Words"))}">
                <div class="alm-section-head">
                    <div class="alm-section-title">${selectorIcon("tag")}${escapeHtml(t("Trigger Words"))}</div>
                    ${words.length > 1 ? `<button class="alm-copy-all-btn" type="button" data-copy="${escapeAttr(words.join(", "))}">${escapeHtml(t("Copy All ({count})", { count: words.length }))}</button>` : ""}
                </div>
                <div class="alm-trained">${words.slice(0, 16).map((word) => `<button type="button" data-copy="${escapeAttr(word)}">${escapeHtml(word)}</button>`).join("")}</div>
                </section>
            ` : ""}
            ${renderDetailTags(model.tags, popup.tab === "discover")}
            <details class="alm-selector-section" data-section="description" open>
                <summary>${selectorIcon("file")}<span>${escapeHtml(t("Description"))}</span></summary>
                <div class="alm-selector-section-body"><div class="alm-description">${"description" in model ? sanitizeDescriptionHtml(model.description || version.description || "") : renderDescriptionSkeleton()}</div></div>
            </details>
        </div>
    `;
}

function renderRemoteDownloadState(model = popup.selectedRemote, version = selectedVersion(), file = selectedFile()) {
    const local = findLocalForRemote(model, version);
    const pending = pendingForRemote(model, version);
    const sizeText = file?.sizeKB ? formatBytes(file.sizeKB * 1024) : "";
    const downloadLabel = pending
        ? t("Downloading...")
        : !file
            ? t("No downloadable file")
            : sizeText
                ? t("Download & Apply ({size})", { size: sizeText })
                : t("Download and Apply");
    return `
        ${pending ? renderDownloadProgress(pending.job) : ""}
        <div class="alm-lora-detail-actions">
            ${local
                ? `<button class="alm-primary alm-download-cta alm-full" type="button" data-action="apply-installed">${escapeHtml(t(isAppliedAsset(local) ? "Applied" : "Apply to Node"))}</button>`
                : `<button class="alm-primary alm-download-cta alm-full" type="button" data-action="download-apply" title="${escapeAttr(downloadLabel)}" ${pending || !file ? "disabled" : ""}><span class="alm-download-cta-copy"><span>${escapeHtml(pending ? t("Downloading...") : !file ? t("No downloadable file") : t("Download and Apply"))}</span>${!pending && file && sizeText ? `<small>${escapeHtml(sizeText)}</small>` : ""}</span></button>`}
        </div>
    `;
}

function updateRemoteDownloadState() {
    if (popup.tab !== "discover" || !popup.selectedRemote) return false;
    const host = popupBody?.querySelector("[data-remote-download-state]");
    if (!host) return false;
    if (patchDownloadProgress(host, pendingForRemote(popup.selectedRemote, selectedVersion())?.job)) return true;
    host.innerHTML = renderRemoteDownloadState();
    host.parentElement.classList.toggle("is-inline-cta", !pendingForRemote(popup.selectedRemote, selectedVersion()));
    bindRemoteDownloadEvents(host);
    return true;
}

function filteredLoraFavorites() {
    return filterFavoriteItems(popup.favoriteItems, {
        assetKind: "lora",
        folderId: popup.selectedFavoriteFolderId,
        query: popup.favoriteQuery,
    });
}

function renderFavorites() {
    const toolbar = renderSelectorToolbar({
        title: t("Favorites"),
        className: "alm-lora-favorites-toolbar",
        searchHtml: renderSelectorSearch({
            value: popup.favoriteQuery,
            inputAttrs: 'data-field="favorite-query"',
            placeholder: t("Search favorites..."),
            clearAction: "clear-lora-favorite-search",
        }),
        actionsHtml: `<span class="alm-selector-total">${filteredLoraFavorites().length}</span>`,
    });
    return `
        <section class="alm-page alm-lora-page alm-lora-favorites-page">
            ${toolbar}
            <div class="alm-split has-detail alm-lora-split ${popup.detailOpen ? "is-detail-open" : ""}">
                <div class="alm-results alm-lora-results">${renderFavoriteResults()}</div>
                ${favoriteDetailAside()}
            </div>
        </section>
    `;
}

function renderFavoriteResults() {
    const items = filteredLoraFavorites();
    if (popup.favoritesLoading && !items.length) return renderCardSkeletons(30);
    return items.length
        ? items.map(renderFavoriteCard).join("")
        : renderCollectionEmptyState({
            kind: "favorites",
            kicker: t("Favorites"),
            title: popup.favoriteQuery ? t("No matching favorites") : t("Your favorites will appear here"),
            description: popup.favoriteQuery
                ? t("Try another keyword or clear the current search.")
                : popup.selectedFavoriteFolderId
                    ? t("This folder is empty. Move a favorite here to start organizing it.")
                    : t("Save models from Discover or your local library for quick access later."),
            hints: [t("Remote models"), t("Local models"), t("Custom folders")],
        });
}

function renderFavoriteCard(item, index = 0) {
    const model = favoriteModel(item);
    const local = localAssetForFavorite(item, popup.libraryItems);
    const media = model ? remotePreviewMedia(model, versionsFor(model)[0]) : createPreviewMedia(item.preview_url || (local?.has_preview ? local.thumb_url : ""), 450);
    const preview = renderCardMedia(media, cardMediaOptions(index));
    return `
        <article class="alm-card alm-lora-card alm-favorite-card ${popup.selectedFavoriteKey === item.key ? "selected" : ""}" data-favorite-key="${escapeAttr(item.key)}" tabindex="0">
            <div class="alm-thumb">${preview}</div>
            <div class="alm-card-badge">${escapeHtml(item.base_model || "LoRA")}</div>
            <div class="alm-card-body">
                <div class="alm-card-title">${escapeHtml(item.name || "Untitled")}</div>
                <div class="alm-card-tags">${local ? `<span class="installed">${escapeHtml(t("Installed"))}</span>` : ""}</div>
            </div>
        </article>
    `;
}

function renderFavoriteDetail(item) {
    const model = favoriteModel(item);
    if (model) return renderRemoteDetail();
    const local = localAssetForFavorite(item, popup.libraryItems);
    if (local) return renderLocalDetail(local);
    return `
        <div class="alm-detail-scroll">
            ${renderDetailGallery(galleryItemsForUrl(item.preview_url || ""), item.name || "")}
            <div class="alm-detail-head"><div><h2>${escapeHtml(item.name || "Untitled")}</h2><p>LoRA · ${escapeHtml(item.creator || t("Unknown creator"))}</p></div></div>
            ${renderFavoriteControls({
                favorite: true,
                folders: popup.favoriteFolders,
                folderId: item.folder_id,
                toggleAction: "remove-selected-favorite",
                folderAction: "assign-selected-favorite-folder",
            })}
        </div>
    `;
}

function updateFavoriteDetail() {
    if (popup.tab !== "favorites") return false;
    popupBody?.querySelectorAll("[data-favorite-key]").forEach((card) => {
        card.classList.toggle("selected", card.dataset.favoriteKey === popup.selectedFavoriteKey);
    });
    return replaceLoraDetail(favoriteDetailAside());
}

async function selectFavoriteItem(item) {
    popup.selectedFavoriteKey = item.key;
    const model = favoriteModel(item);
    const showRemote = (remote) => {
        const version = versionsFor(remote)[0] || {};
        popup.selectedRemote = remote;
        popup.selectedVersionId = String(version.id || "");
        popup.selectedFileName = primaryFileName(version);
        popup.selectedAssetId = "";
        if (!updateFavoriteDetail()) renderPopup();
    };
    if (!model) {
        const local = localAssetForFavorite(item, popup.libraryItems);
        popup.selectedRemote = null;
        popup.selectedAssetId = local?.id || "";
        if (!updateFavoriteDetail()) renderPopup();
        return;
    }
    const prefetched = peekModelDetail(model.id);
    showRemote(prefetched || model);
    if (prefetched) return;
    // The saved snapshot can be a trimmed search card; show the live record.
    setDetailLoading(popupBody, true);
    const full = await fetchModelDetail(model.id).catch(() => null);
    if (popup.tab !== "favorites" || popup.selectedFavoriteKey !== item.key) return;
    setDetailLoading(popupBody, false);
    if (full) showRemote(full);
}

function renderEmptyDetail(title, description, kind = "model") {
    return `
        <div class="alm-detail-scroll alm-empty-detail-scroll">
            <div class="alm-empty-detail" data-empty-kind="${escapeAttr(kind)}">
                <div class="alm-empty-detail-art" aria-hidden="true">
                    <span class="alm-empty-detail-orbit orbit-one"></span>
                    <span class="alm-empty-detail-orbit orbit-two"></span>
                    <span class="alm-empty-detail-card card-back"></span>
                    <span class="alm-empty-detail-card card-front"><i></i><i></i><i></i></span>
                    <span class="alm-empty-detail-spark spark-one"></span>
                    <span class="alm-empty-detail-spark spark-two"></span>
                </div>
                <div class="alm-empty-detail-copy">
                    <span class="alm-empty-detail-kicker">${escapeHtml(t("Details"))}</span>
                    <h2>${escapeHtml(title)}</h2>
                    <p>${escapeHtml(description)}</p>
                </div>
                <div class="alm-empty-detail-features" aria-hidden="true"><span>${escapeHtml(t("Preview"))}</span><span>${escapeHtml(t("Metadata"))}</span><span>${escapeHtml(t("Actions"))}</span></div>
            </div>
        </div>
    `;
}

async function searchRemote(reset = true) {
    if (!reset && (popup.remoteLoading || !popup.nextCursor)) return;
    if (reset) {
        searchController?.abort();
        searchSequence += 1;
        if (!popup.remoteItems.length) {
            popup.nextCursor = "";
            setDiscoverSelection(null);
        }
    }
    const params = new URLSearchParams({
        kind: "lora",
        query: popup.discoverQuery,
        sort: popup.sort,
        limit: String(SEARCH_PAGE_SIZE),
    });
    params.set("base_model", LOCKED_BASE_MODEL);
    if (popup.selectedCategory) params.set("category", popup.selectedCategory);
    if (popup.selectedTag) params.set("tag", popup.selectedTag);
    if (!reset) params.set("cursor", popup.nextCursor);
    const path = `/search?${params.toString()}`;
    const cached = getSearchCache(path);
    if (cached) {
        popup.remoteLoading = false;
        popup.remoteResetting = false;
        const applied = applyRemoteSearch(cached, reset);
        if (!reset && appendRemoteItems(applied.items, applied.startIndex)) return;
        showRemoteResults(reset);
        return;
    }

    if (reset) {
        popup.remoteItems = [];
        popup.nextCursor = "";
        setDiscoverSelection(null);
        popup.scroll.discover = 0;
    }
    const controller = new AbortController();
    const sequence = ++searchSequence;
    searchController = controller;
    popup.remoteLoading = true;
    popup.remoteResetting = reset;
    popup.error = "";
    if (popup.tab === "discover" && (reset || !setRemoteLoadingMore(true))) renderPopup({ preserveScroll: !reset });
    let applied = null;
    try {
        const data = await apiGet(path, { signal: controller.signal });
        if (sequence !== searchSequence) return;
        setSearchCache(path, data);
        applied = applyRemoteSearch(data, reset);
    } catch (error) {
        if (error?.name !== "AbortError" && sequence === searchSequence) popup.error = error.message;
    } finally {
        if (sequence === searchSequence) {
            popup.remoteLoading = false;
            popup.remoteResetting = false;
        }
        if (searchController === controller) searchController = null;
    }
    if (sequence !== searchSequence) return;
    if (!reset) {
        if (applied && appendRemoteItems(applied.items, applied.startIndex)) return;
        setRemoteLoadingMore(false);
        updatePopupMessages();
        return;
    }
    showRemoteResults(true);
}

// A search can finish after the user moved to another tab; only Discover is redrawn.
function showRemoteResults(reset) {
    if (popup.tab !== "discover") {
        rerenderNavPreservingScroll();
        return;
    }
    renderPopup({ preserveScroll: !reset });
    if (reset) animateCardsIn(popupBody.querySelectorAll(".alm-lora-results > .alm-card[data-remote-id]"));
    if (reset && popup.selectedRemote) void selectRemote(popup.selectedRemote);
}

function setDiscoverSelection(model) {
    const version = versionsFor(model)[0] || {};
    const selection = { selectedRemote: model, selectedVersionId: String(version.id || ""), selectedFileName: primaryFileName(version) };
    if (popup.tab === "discover") Object.assign(popup, selection);
    else tabSelections.discover = { ...EMPTY_SELECTION, ...tabSelections.discover, ...selection };
}

function applyRemoteSearch(data, reset) {
    const items = unseenSearchItems(reset ? [] : popup.remoteItems, data?.items);
    const startIndex = reset ? 0 : popup.remoteItems.length;
    popup.remoteItems = reset ? items : [...popup.remoteItems, ...items];
    popup.contentFilterActive = data?.content_filter_active === true;
    if (reset) setDiscoverSelection(items[0] || null);
    // A page that adds nothing new ends the list instead of loading forever.
    popup.nextCursor = reset || items.length ? data?.metadata?.nextCursor || "" : "";
    // A thin page means the rest is a slow, mostly empty scan (e.g. a keyword
    // inside a base model): keep searching behind a progress bar instead of
    // placeholder cards that may never be filled.
    popup.sparseResults = items.length < SEARCH_PAGE_SIZE / 2;
    return { items, startIndex };
}

async function selectRemote(model) {
    const isCurrent = () => popup.tab === "discover" && String(popup.selectedRemote?.id || "") === String(model.id || "");
    const prefetched = peekModelDetail(model.id);
    setDiscoverSelection(prefetched || model);
    if (!updateRemoteDetail()) renderPopup();
    // Arrow-key browsing selects in quick succession; only fetch where it settles.
    const rapid = performance.now() - lastRemoteSelectAt < 350;
    lastRemoteSelectAt = performance.now();
    if (prefetched) return;
    setDetailLoading(popupBody, true);
    if (rapid) await new Promise((resolve) => setTimeout(resolve, 250));
    if (!isCurrent()) return;
    const full = await fetchModelDetail(model.id).catch(() => null);
    if (!isCurrent()) return;
    setDetailLoading(popupBody, false);
    if (!full) return;
    const detailVersion = versionsFor(full).find((item) => String(item.id) === popup.selectedVersionId) || versionsFor(full)[0] || {};
    popup.selectedRemote = full;
    popup.selectedVersionId = String(detailVersion.id || "");
    popup.selectedFileName = primaryFileName(detailVersion);
    if (!updateRemoteDetail()) renderPopup();
}

function findLocalForRemote(model, version) {
    const modelId = String(model?.id || "");
    const versionId = String(version?.id || "");
    return popup.libraryItems.find((item) => {
        if (String(item.model_id || "") !== modelId) return false;
        return !versionId || !item.version_id || String(item.version_id) === versionId;
    }) || null;
}

function pendingForRemote(model, version) {
    for (const [taskId, value] of popup.pendingApply.entries()) {
        if (String(value.modelId) === String(model?.id || "") && String(value.versionId) === String(version?.id || "")) {
            const job = popup.downloads[taskId];
            if (job && ACTIVE_DOWNLOAD_STATUSES.has(job.status)) return { taskId, value, job };
        }
    }
    return null;
}

async function downloadAndApply() {
    const model = popup.selectedRemote;
    const version = selectedVersion();
    const file = selectedFile();
    if (!model || !version || !file) return;
    popup.error = "";
    try {
        const queued = await apiPost("/download", { kind: "lora", model, version, file, overrides: {} });
        popup.pendingApply.set(queued.task_id, {
            node: popup.node,
            modelId: model.id,
            versionId: version.id,
            displayName: model.name,
            previewUrl: rawPreview(model, version),
            trainedWords: Array.isArray(version.trainedWords) ? version.trainedWords : [],
            baseModel: version.baseModel || "",
            resolution: queued.resolution || {},
        });
        popup.downloads[queued.task_id] = {
            id: queued.task_id,
            status: "pending",
            progress: 0,
            total: 0,
            root_kind: "loras",
            filename: queued.resolution?.filename || file.name,
        };
        showToast(t("Download queued; it will be applied when complete."));
        startDownloadPolling();
        updateDownloadNavCount();
        if (!updateRemoteDownloadState()) renderPopup();
    } catch (error) {
        popup.error = error.message;
        if (!updatePopupMessages()) renderPopup();
    }
}

function renderLocal() {
    const toolbar = renderSelectorToolbar({
        title: t("Local LoRAs"),
        className: "alm-lora-local-toolbar",
        headingHtml: `
            <div class="alm-lora-local-heading">
                <h2>${escapeHtml(t("Local LoRAs"))}</h2>
                <div class="alm-lora-folder-context" data-lora-folder-context>${renderLocalFolderBreadcrumb()}</div>
            </div>
        `,
        searchHtml: renderSelectorSearch({
            value: popup.localQuery,
            inputAttrs: 'data-field="local-query"',
            placeholder: t("Filter local LoRAs..."),
            clearAction: "clear-lora-local-search",
        }),
        actionsHtml: `
            ${localMetadataBatch.running
                ? `<button class="alm-selector-button" data-action="cancel-match-local-loras">${escapeHtml(t("Stop matching"))}</button>`
                : ""}
            <button class="alm-selector-button" type="button" data-action="refresh-local-loras" ${localMetadataBatch.running ? "disabled" : ""}>${selectorIcon("refresh")}<span>${escapeHtml(t(popup.libraryLoading ? "Scanning..." : "Refresh"))}</span></button>
            <details class="alm-selector-tools">
                <summary class="is-icon" aria-label="${escapeAttr(t("Actions"))}" title="${escapeAttr(t("Actions"))}" aria-haspopup="menu">${selectorIcon("more")}</summary>
                <div class="alm-selector-menu" role="menu" aria-label="${escapeAttr(t("Actions"))}">
                    <button type="button" role="menuitem" data-action="match-missing-local-loras" ${localMetadataBatch.running ? "disabled" : ""}>${selectorIcon("match")}<span>${escapeHtml(t("Match missing Civitai info"))}</span></button>
                </div>
            </details>
        `,
        filterBarHtml: renderLoraActiveFilterBar(),
    });
    return `
        <section class="alm-page alm-lora-page">
            ${toolbar}
            ${renderLocalMetadataBatchStatus()}
            <div class="alm-split has-detail alm-lora-split ${popup.detailOpen ? "is-detail-open" : ""}">
                <div class="alm-results alm-lora-results">
                    ${renderLocalResults()}
                </div>
                ${localDetailAside()}
            </div>
        </section>
    `;
}

function renderLocalResults() {
    const items = filteredLocalItems();
    if (popup.libraryLoading && !items.length) return renderCardSkeletons(30);
    if (!items.length) return renderCollectionEmptyState({
        kind: "library",
        kicker: t("Library"),
        title: t("No local {kind} found", { kind: "LoRA" }),
        description: t("Try changing the current filters or refresh the local model library."),
        hints: [t("Change filters"), t("Refresh library")],
    });
    return items.map(renderLocalCard).join("");
}

function renderLocalFolderBreadcrumb() {
    const folder = normalizeLocalFolderPath(popup.selectedLocalFolder);
    const parts = folder && folder !== ROOT_LOCAL_FOLDER ? splitLocalPath(folder) : [];
    const crumbs = [{ path: "", label: t("All LoRAs") }];
    if (folder === ROOT_LOCAL_FOLDER) crumbs.push({ path: ROOT_LOCAL_FOLDER, label: t("Root files") });
    else {
        parts.forEach((part, index) => {
            crumbs.push({ path: parts.slice(0, index + 1).join("/"), label: part });
        });
    }
    return `
        <span class="alm-lora-folder-context-label">${escapeHtml(t("Current folder"))}</span>
        <div class="alm-lora-breadcrumb" aria-label="${escapeAttr(t("Current folder"))}">
            ${crumbs.map((crumb, index) => `
                ${index ? `<span class="alm-lora-breadcrumb-separator" aria-hidden="true">›</span>` : ""}
                <button class="${index === crumbs.length - 1 ? "active" : ""}" data-lora-folder="${escapeAttr(crumb.path)}" title="${escapeAttr(crumb.path || t("All LoRAs"))}">${escapeHtml(crumb.label)}</button>
            `).join("")}
        </div>
    `;
}

function updateLocalFolderView(options = {}) {
    if (popup.tab !== "local") return false;
    const results = popupBody?.querySelector(".alm-lora-results");
    const detail = popupBody?.querySelector(".alm-lora-detail");
    const context = popupBody?.querySelector("[data-lora-folder-context]");
    if (!results || !detail || !context) return false;
    const preserveSelection = options.preserveSelection === true && Boolean(popup.selectedAssetId);
    const scrollTop = options.preserveScroll === true ? results.scrollTop : 0;
    context.innerHTML = renderLocalFolderBreadcrumb();
    results.innerHTML = renderLocalResults();
    results.scrollTop = scrollTop;
    if (!preserveSelection) popup.selectedAssetId = "";
    updateLocalDetail();
    observeCardMedia(popupBody);
    return true;
}

function filteredLocalItems() {
    const query = popup.localQuery.trim().toLocaleLowerCase();
    const selectedFolder = normalizeLocalFolderPath(popup.selectedLocalFolder);
    return popup.libraryItems.filter((item) => {
        if (popup.selectedBaseModel && String(item.base_model || "").toLocaleLowerCase() !== popup.selectedBaseModel.toLocaleLowerCase()) return false;
        if (selectedFolder && !assetMatchesLocalFolder(item, selectedFolder)) return false;
        if (!query) return true;
        return [item.name, item.filename, item.relative_path, item.creator, ...(item.tags || [])]
            .some((value) => String(value || "").toLocaleLowerCase().includes(query));
    });
}

function renderLocalCard(asset, index = 0) {
    const favorite = localFavorite(asset);
    return `
        <article class="alm-card alm-lora-card asset ${popup.selectedAssetId === asset.id ? "selected" : ""}" data-local-id="${escapeAttr(asset.id)}" data-preview-key="${escapeAttr(asset.thumb_url || "")}" tabindex="0">
            ${renderFavoriteCardMark(Boolean(favorite))}
            <div class="alm-thumb">${renderCardMedia(asset.has_preview ? asset.thumb_url : "", cardMediaOptions(index))}</div>
            ${asset.base_model ? `<div class="alm-card-badge">${escapeHtml(asset.base_model)}</div>` : ""}
            <div class="alm-card-body">
                <div class="alm-card-title">${escapeHtml(asset.name || asset.filename)}</div>
                <div class="alm-card-tags">
                    ${isAppliedAsset(asset) ? `<span class="installed">${escapeHtml(t("Applied"))}</span>` : ""}
                </div>
            </div>
        </article>
    `;
}

function localFolderTree() {
    const root = { count: 0, rootFileCount: 0, children: new Map() };
    popup.libraryItems.forEach((item) => {
        root.count += 1;
        const parts = itemLocalFolderParts(item);
        if (!parts.length) {
            root.rootFileCount += 1;
            return;
        }
        let children = root.children;
        let currentPath = "";
        parts.forEach((part) => {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            if (!children.has(part)) children.set(part, { name: part, path: currentPath, count: 0, children: new Map() });
            const node = children.get(part);
            node.count += 1;
            children = node.children;
        });
    });
    return {
        count: root.count,
        rootFileCount: root.rootFileCount,
        children: sortLocalFolderNodes(root.children),
    };
}

function sortLocalFolderNodes(children) {
    return Array.from(children.values())
        .map((node) => ({ ...node, children: sortLocalFolderNodes(node.children) }))
        .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }));
}

function assetMatchesLocalFolder(asset, selectedFolder) {
    const folder = itemLocalFolderParts(asset).join("/");
    if (selectedFolder === ROOT_LOCAL_FOLDER) return !folder;
    return folder === selectedFolder || folder.startsWith(`${selectedFolder}/`);
}

function itemLocalFolderParts(asset) {
    if (typeof asset?.folder_path === "string") return splitLocalPath(asset.folder_path);
    const parts = splitLocalPath(asset?.relative_path);
    parts.pop();
    return parts;
}

function normalizeLocalFolderPath(value) {
    if (value === ROOT_LOCAL_FOLDER) return ROOT_LOCAL_FOLDER;
    return splitLocalPath(value).join("/");
}

function splitLocalPath(value) {
    return String(value || "")
        .replaceAll("\\", "/")
        .split("/")
        .filter((part) => part && part !== ".");
}

function renderLocalDetail(asset) {
    const favorite = localFavorite(asset);
    const civitaiUrl = asset.civitai_url || (asset.model_id ? `https://civitai.red/models/${encodeURIComponent(asset.model_id)}${asset.version_id ? `?modelVersionId=${encodeURIComponent(asset.version_id)}` : ""}` : "");
    const words = normalizedTriggerWords(asset);
    const title = escapeHtml(asset.name || asset.filename);
    return `
        <div class="alm-detail-scroll">
            ${renderDetailGallery(galleryItemsForUrl(asset.has_preview ? asset.thumb_url : ""), asset.name || asset.filename)}
            <div class="alm-detail-head"><div>
                ${civitaiUrl
                    ? `<a class="alm-detail-title-link" href="${escapeAttr(civitaiUrl)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(t("Open model page"))}"><h2>${title}</h2><span class="alm-external-icon" aria-hidden="true">↗</span></a>`
                    : `<h2>${title}</h2>`}
                <p>${escapeHtml([asset.creator, asset.version_name].filter(Boolean).join(" · ") || t("Local file"))}</p>
                <div class="alm-detail-meta">${renderDetailFacts([asset.base_model !== "Other" ? asset.base_model : "", formatBytes(asset.size)])}</div>
            </div></div>
            <section class="alm-detail-download-card">
                <div class="alm-detail-action-hub is-inline-cta">
                    <button class="alm-primary alm-download-cta" type="button" data-action="apply-local">${escapeHtml(t(isAppliedAsset(asset) ? "Applied" : "Apply to Node"))}</button>
                    ${renderFavoriteControls({
                        favorite: Boolean(favorite),
                        folders: popup.favoriteFolders,
                        folderId: favorite?.folder_id || "",
                        toggleAction: "favorite-local",
                        folderAction: "assign-local-favorite-folder",
                        compact: true,
                    })}
                </div>
                ${renderMatchRow(localAssetHasCivitaiMatch(asset), asset, "match-local", localMetadataBatch.running)}
            </section>
            <section class="alm-selector-triggers" aria-label="${escapeAttr(t("Trigger Words"))}">
                <div class="alm-section-head">
                    <div class="alm-section-title">${selectorIcon("tag")}${escapeHtml(t("Trigger Words"))}</div>
                    ${words.length > 1 ? `<button class="alm-copy-all-btn" type="button" data-copy="${escapeAttr(words.join(", "))}">${escapeHtml(t("Copy All ({count})", { count: words.length }))}</button>` : ""}
                </div>
                <div class="alm-trained">${words.length ? words.slice(0, 16).map((word) => `<button type="button" data-copy="${escapeAttr(word)}">${escapeHtml(word)}</button>`).join("") : `<span>${escapeHtml(t("No trained words cached."))}</span>`}</div>
            </section>
            ${renderDetailTags(asset.tags, false)}
            <details class="alm-selector-section" data-section="file" open>
                <summary>${selectorIcon("file")}<span>${escapeHtml(t("File"))}</span></summary>
                <div class="alm-selector-section-body">
                    <div class="alm-info-list alm-lora-file-info">
                        <div><span>${escapeHtml(t("File"))}</span><b>${escapeHtml(asset.filename || "")}</b></div>
                        <div><span>${escapeHtml(t("Relative Path"))}</span><b>${escapeHtml(asset.relative_path || asset.filename)}</b></div>
                        <div><span>${escapeHtml(t("Absolute Path"))}</span><b>${escapeHtml(asset.absolute_path || "")}</b></div>
                    </div>
                    <div class="alm-detail-file-actions">
                        <button class="alm-secondary alm-detail-local-cta" type="button" data-action="open-local-folder">${selectorIcon("local")}<span>${escapeHtml(t("Open Folder"))}</span></button>
                        <button class="alm-danger" type="button" data-action="delete-local">${escapeHtml(t("Delete"))}</button>
                    </div>
                </div>
            </details>
        </div>
    `;
}

function assetPayload(asset) {
    return {
        root_kind: "loras",
        relative_path: asset.relative_path,
        storage_root_id: asset.storage_root_id || "",
    };
}

function localAssetHasCivitaiMatch(asset) {
    const matchStatus = String(asset?.metadata_match_status || "").toLowerCase();
    return Boolean(
        asset?.model_id
        || matchStatus === "matched"
        || (asset?.source === "civitai" && asset?.version_id)
    );
}

function localAssetNeedsCivitaiMetadata(asset) {
    const wantsPreview = popup.config?.save_preview !== false;
    return !localAssetHasCivitaiMatch(asset) || (wantsPreview && !asset.has_preview);
}

function localMetadataBatchText() {
    if (!localMetadataBatch.running && !localMetadataBatch.total) return "";
    if (localMetadataBatch.cancelRequested && localMetadataBatch.running) {
        return t("Stopping after current model...");
    }
    return t("Matching metadata {completed}/{total} · matched {matched} · not found {notFound} · failed {failed}", {
        completed: localMetadataBatch.completed,
        total: localMetadataBatch.total,
        matched: localMetadataBatch.matched,
        notFound: localMetadataBatch.notFound,
        failed: localMetadataBatch.failed,
    });
}

function renderLocalMetadataBatchStatus() {
    if (!localMetadataBatch.running && !localMetadataBatch.total) return "";
    const pct = localMetadataBatch.total
        ? Math.round((localMetadataBatch.completed / localMetadataBatch.total) * 100)
        : 0;
    return `
        <div class="alm-library-match-status" data-local-match-status>
            <div class="alm-library-match-progress"><span style="width:${pct}%"></span></div>
            <b>${escapeHtml(localMetadataBatchText())}</b>
            <span data-local-match-current>${escapeHtml(localMetadataBatch.current || "")}</span>
        </div>
    `;
}

function updateLocalMetadataBatchStatus() {
    const status = popupBody?.querySelector("[data-local-match-status]");
    if (!status) return;
    const pct = localMetadataBatch.total
        ? Math.round((localMetadataBatch.completed / localMetadataBatch.total) * 100)
        : 0;
    const progress = status.querySelector(".alm-library-match-progress span");
    const label = status.querySelector("b");
    const current = status.querySelector("[data-local-match-current]");
    if (progress) progress.style.width = `${pct}%`;
    if (label) label.textContent = localMetadataBatchText();
    if (current) current.textContent = localMetadataBatch.current || "";
}

async function matchMissingLocalLoraMetadata() {
    if (localMetadataBatch.running) return;
    const candidates = filteredLocalItems().filter(localAssetNeedsCivitaiMetadata);
    if (!candidates.length) {
        showToast(t("All visible models already have Civitai metadata and previews"));
        return;
    }
    if (!confirm(t("Match Civitai information for {count} visible models? Hashing large files may take a while.", { count: candidates.length }))) {
        return;
    }
    localMetadataBatch = {
        running: true,
        cancelRequested: false,
        total: candidates.length,
        completed: 0,
        matched: 0,
        notFound: 0,
        failed: 0,
        current: "",
    };
    renderPopup();
    for (const asset of candidates) {
        if (localMetadataBatch.cancelRequested) break;
        localMetadataBatch.current = asset.name || asset.filename || "";
        updateLocalMetadataBatchStatus();
        try {
            const data = await apiPost("/asset/metadata", assetPayload(asset));
            if (data.matched) localMetadataBatch.matched += 1;
            else localMetadataBatch.notFound += 1;
        } catch (error) {
            localMetadataBatch.failed += 1;
            console.warn("[Anima Tools] LoRA metadata match failed:", asset.absolute_path, error);
        } finally {
            localMetadataBatch.completed += 1;
            updateLocalMetadataBatchStatus();
        }
    }
    const cancelled = localMetadataBatch.cancelRequested;
    localMetadataBatch.running = false;
    localMetadataBatch.current = "";
    await loadLibrary(true, false);
    if (overlay?.classList.contains("show")) {
        if (popup.tab === "local") renderPopup();
        else rerenderNavPreservingScroll();
    }
    showToast(t(cancelled ? "Metadata matching stopped" : "Metadata matching completed"));
}

function cancelLocalLoraMetadataMatch() {
    if (!localMetadataBatch.running) return;
    localMetadataBatch.cancelRequested = true;
    updateLocalMetadataBatchStatus();
}

function entryFromAsset(asset) {
    return {
        name: asset.relative_path || asset.filename,
        display_name: asset.name || asset.filename,
        storage_root_id: asset.storage_root_id || "",
        strength_model: 1,
        enabled: true,
        model_id: asset.model_id || "",
        version_id: asset.version_id || "",
        version_name: asset.version_name || "",
        preview_url: asset.thumb_url || "",
        civitai_url: asset.civitai_url || "",
        base_model: asset.base_model || "",
        trained_words: Array.isArray(asset.trained_words) ? asset.trained_words : [],
    };
}

function isAppliedAsset(asset) {
    const assetEntry = entryFromAsset(asset);
    return normalizeLoraList(popup.node?._almLoras).some((entry) => sameLora(entry, assetEntry));
}

async function loadLibrary(force = false, shouldRender = true) {
    const previousSignature = localLibrarySignature(popup.libraryItems);
    popup.libraryLoading = true;
    if (shouldRender && overlay?.classList.contains("show")) updateLocalLibraryLoadingState();
    try {
        const data = await apiGet(`/library${force ? "?force=true" : ""}`);
        popup.libraryItems = (Array.isArray(data?.items) ? data.items : []).filter((item) => item.root_kind === "loras");
        const selectedFolder = normalizeLocalFolderPath(popup.selectedLocalFolder);
        if (selectedFolder && !popup.libraryItems.some((item) => assetMatchesLocalFolder(item, selectedFolder))) popup.selectedLocalFolder = "";
        if (popup.selectedAssetId && !popup.libraryItems.some((item) => item.id === popup.selectedAssetId)) popup.selectedAssetId = "";
    } catch (error) {
        popup.error = error.message;
    }
    popup.libraryLoading = false;
    if (!shouldRender || !overlay?.classList.contains("show")) return;
    const libraryChanged = previousSignature !== localLibrarySignature(popup.libraryItems);
    rerenderNavPreservingScroll();
    if (popup.tab !== "local") return;
    updateLocalLibraryLoadingState();
    updatePopupMessages();
    const waitingForFirstPaint = Boolean(popupBody?.querySelector(".alm-lora-results .alm-skeleton-card"));
    if (libraryChanged || waitingForFirstPaint) updateLocalFolderView({ preserveSelection: true, preserveScroll: true });
}

function localLibrarySignature(items) {
    return (Array.isArray(items) ? items : []).map((item) => [
        item.id,
        item.name,
        item.relative_path,
        item.thumb_url,
        item.base_model,
        item.metadata_match_status,
        item.model_id,
        item.version_id,
        item.favorite ? 1 : 0,
    ].join("\u001f")).join("\u001e");
}

function updateLocalLibraryLoadingState() {
    if (popup.tab !== "local") return;
    const refresh = popupBody?.querySelector('[data-action="refresh-local-loras"]');
    if (!refresh) return;
    refresh.textContent = t(popup.libraryLoading ? "Scanning..." : "Refresh");
    refresh.disabled = popup.libraryLoading || localMetadataBatch.running;
}

async function manageSelectedAsset(action) {
    const asset = popup.libraryItems.find((item) => item.id === popup.selectedAssetId);
    if (!asset) return;
    if (action === "favorite") { await toggleLocalFavorite(asset); return; }
    popup.error = "";
    let deleted = false;
    const matchButton = popupBody?.querySelector('[data-action="match-local"]');
    if (action === "match" && matchButton) {
        matchButton.disabled = true;
        matchButton.textContent = t("Hashing asset...");
    }
    try {
        if (action === "apply") {
            addLoraToNode(entryFromAsset(asset));
            return;
        }
        if (action === "match") {
            showToast(t("Hashing asset..."));
            const data = await apiPost("/asset/metadata", assetPayload(asset));
            await loadLibrary(true, false);
            showToast(t(data.matched ? "Civitai metadata and preview updated" : "No Civitai match found; SHA256 saved"));
        } else if (action === "open") {
            await apiPost("/asset/open-folder", assetPayload(asset));
            showToast(t("Folder opened"));
        } else if (action === "delete") {
            if (!confirm(t("Delete this LoRA file and its companion metadata?"))) return;
            await apiPost("/asset/delete", assetPayload(asset));
            const next = normalizeLoraList(popup.node?._almLoras).filter((entry) => !sameLora(entry, entryFromAsset(asset)));
            updateNodeLoras(popup.node, next);
            popup.selectedAssetId = "";
            await loadLibrary(true, false);
            deleted = true;
            showToast(t("Asset deleted"));
        }
    } catch (error) {
        popup.error = error.message;
    }
    if (popup.tab === "local") {
        if (deleted) {
            rerenderNavPreservingScroll();
            updateLocalFolderView({ preserveScroll: true });
        } else {
            updateSelectedLocalCard();
            updateLocalDetail();
            updatePopupMessages();
        }
        return;
    }
    renderPopup();
}

const GRIP_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>';

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function appliedLoras() {
    return normalizeLoraList(popup.node?._almLoras);
}

// Rows are keyed by LoRA plus occurrence so legacy duplicates stay distinct.
function appliedRowKeys(loras) {
    const seen = new Map();
    return loras.map((entry) => {
        const key = loraKey(entry);
        seen.set(key, (seen.get(key) || 0) + 1);
        return `${key}#${seen.get(key)}`;
    });
}

function appliedAsset(entry) {
    return popup.libraryItems.find((asset) => sameLora(entryFromAsset(asset), entry)) || null;
}

function appliedTriggerWords(entry) {
    const words = normalizedTriggerWords(entry);
    return words.length ? words : normalizedTriggerWords(appliedAsset(entry) || {});
}

function renderAppliedSummary(loras) {
    return escapeHtml(t("{count} LoRAs · {enabled} enabled", { count: loras.length, enabled: loras.filter((entry) => entry.enabled).length }));
}

function renderAppliedToolbarActions(loras) {
    if (!loras.length) return "";
    const allEnabled = loras.every((entry) => entry.enabled);
    return `
        <span class="alm-applied-note">${escapeHtml(t("LoRAs run from top to bottom."))}</span>
        <button class="alm-secondary" type="button" data-applied-action="toggle-all">${escapeHtml(t(allEnabled ? "Disable all" : "Enable all"))}</button>
        <button class="alm-danger" type="button" data-applied-action="clear">${escapeHtml(t("Remove All"))}</button>
    `;
}

function renderAppliedRows(loras) {
    if (!loras.length) {
        return renderCollectionEmptyState({
            kind: "applied",
            kicker: t("Applied to Node"),
            title: t("Nothing applied to this node yet"),
            description: t("Choose a local LoRA or download one from Discover, then apply it to this node."),
            hints: [t("Browse LoRAs"), t("Tune strengths"), t("Reorder anytime")],
        });
    }
    const keys = appliedRowKeys(loras);
    return `<ol class="alm-applied-rows" aria-label="${escapeAttr(t("Execution order"))}">${loras.map((entry, index) => renderAppliedRow(entry, index, keys[index])).join("")}</ol>`;
}

function renderAppliedRow(entry, index, key) {
    const name = entry.display_name || shortLoraName(entry, 80);
    const local = appliedAsset(entry);
    const words = appliedTriggerWords(entry);
    const strength = Number(entry.strength_model);
    const preview = local && !local.has_preview ? "" : entry.preview_url || local?.thumb_url || "";
    const missing = popup.libraryItems.length && !popup.libraryLoading && !local;
    return `
        <li class="alm-applied-row ${entry.enabled ? "" : "is-disabled"}" data-applied-index="${index}" data-applied-key="${escapeAttr(key)}">
            <button class="alm-applied-handle" type="button" data-applied-handle aria-label="${escapeAttr(t("Reorder {name}", { name }))}" title="${escapeAttr(t("Drag, or press ↑/↓ to reorder"))}">${GRIP_ICON}</button>
            <span class="alm-applied-order">${String(index + 1).padStart(2, "0")}</span>
            <div class="alm-applied-thumb">${renderCardMedia(preview, { eager: true })}</div>
            <div class="alm-applied-info">
                <button class="alm-applied-name" type="button" data-applied-action="locate" ${local ? "" : "disabled"} title="${escapeAttr(local ? t("Show in Local LoRAs") : entry.name)}">${escapeHtml(name)}</button>
                <span class="alm-applied-meta">
                    ${entry.base_model ? `<i>${escapeHtml(entry.base_model)}</i>` : ""}
                    ${missing ? `<i class="is-warning">${escapeHtml(t("File missing"))}</i>` : ""}
                    <span title="${escapeAttr(entry.name)}">${escapeHtml(entry.name)}</span>
                </span>
            </div>
            <div class="alm-applied-strength">
                <input type="range" min="${Math.min(-4, strength)}" max="${Math.max(4, strength)}" step="0.05" value="${escapeAttr(strength)}" data-applied-range aria-label="${escapeAttr(`${t("Strength")}: ${name}`)}" title="${escapeAttr(t("Double-click to reset to 1.00"))}" />
                <input class="alm-input" type="number" step="0.05" value="${strength.toFixed(2)}" data-applied-number aria-label="${escapeAttr(`${t("Strength")}: ${name}`)}" />
            </div>
            <button class="alm-applied-words" type="button" data-applied-action="copy-words" ${words.length ? "" : "disabled"} title="${escapeAttr(words.length ? words.join(", ") : t("No trained words cached."))}" aria-label="${escapeAttr(t("Copy trigger words"))}">${selectorIcon("tag")}<b>${words.length}</b></button>
            <button class="alm-applied-toggle ${entry.enabled ? "is-on" : ""}" type="button" data-applied-action="toggle" aria-pressed="${entry.enabled}" aria-label="${escapeAttr(`${t("Enabled")}: ${name}`)}" title="${escapeAttr(t(entry.enabled ? "Disable LoRA" : "Enable LoRA"))}">
                <i aria-hidden="true"></i><span>${escapeHtml(t(entry.enabled ? "Enabled" : "Disabled"))}</span>
            </button>
            <button class="alm-applied-remove" type="button" data-applied-action="remove" aria-label="${escapeAttr(`${t("Remove from node")}: ${name}`)}" title="${escapeAttr(t("Remove from node"))}">${selectorIcon("close")}</button>
        </li>
    `;
}

function renderApplied() {
    const loras = appliedLoras();
    return `
        <section class="alm-page alm-lora-page alm-applied-page">
            <div class="alm-toolbar alm-selector-utility-toolbar alm-applied-toolbar">
                <div class="alm-dl-heading"><h2>${escapeHtml(t("Applied to Node"))}</h2><span data-applied-summary>${renderAppliedSummary(loras)}</span></div>
                <div class="alm-applied-toolbar-actions" data-applied-toolbar>${renderAppliedToolbarActions(loras)}</div>
            </div>
            <div class="alm-lora-applied-list">${renderAppliedRows(loras)}</div>
        </section>
    `;
}

function paintAppliedRanges(root) {
    root.querySelectorAll("[data-applied-range]").forEach((range) => paintStrengthRange(range, Number(range.value)));
}

/**
 * Write the new list to the node, then redraw the rows and slide every row
 * from where it was to where it now sits (FLIP), keeping keyboard focus.
 */
function commitApplied(mutate) {
    const list = popupBody?.querySelector(".alm-lora-applied-list");
    const before = new Map();
    list?.querySelectorAll("[data-applied-key]").forEach((row) => before.set(row.dataset.appliedKey, row.getBoundingClientRect().top));
    const focusedRow = document.activeElement?.closest?.("[data-applied-key]");
    const control = focusedRow ? [...document.activeElement.attributes].find((attribute) => attribute.name.startsWith("data-applied-")) : null;
    const focusKey = focusedRow?.dataset.appliedKey;
    const next = appliedLoras();
    mutate(next);
    updateNodeLoras(popup.node, next);
    rerenderNavPreservingScroll();
    if (popup.tab !== "applied" || !list) return;
    popupBody.querySelector("[data-applied-summary]").innerHTML = renderAppliedSummary(next);
    popupBody.querySelector("[data-applied-toolbar]").innerHTML = renderAppliedToolbarActions(next);
    list.innerHTML = renderAppliedRows(next);
    paintAppliedRanges(list);
    observeCardMedia(list);
    list.querySelectorAll("[data-applied-key]").forEach((row) => {
        const top = before.get(row.dataset.appliedKey);
        const delta = top === undefined ? 0 : top - row.getBoundingClientRect().top;
        if (delta && !prefersReducedMotion()) row.animate([{ transform: `translateY(${delta}px)` }, { transform: "none" }], { duration: 220, easing: "cubic-bezier(.2,.7,.2,1)" });
    });
    const controlSelector = control ? `[${control.name}="${CSS.escape(control.value)}"]` : "[data-applied-handle]";
    if (focusKey) list.querySelector(`[data-applied-key="${CSS.escape(focusKey)}"] ${controlSelector}`)?.focus({ preventScroll: true });
}

function moveApplied(from, to) {
    if (from === to) return;
    commitApplied((list) => {
        const [entry] = list.splice(from, 1);
        list.splice(to, 0, entry);
    });
}

function removeApplied(index, row) {
    const previous = appliedLoras();
    const name = shortLoraName(previous[index], 60);
    const finish = () => {
        commitApplied((list) => list.splice(index, 1));
        showToast(t("Removed {name}", { name }), { label: t("Undo"), onClick: () => restoreApplied(previous) });
    };
    if (!row || prefersReducedMotion()) {
        finish();
        return;
    }
    row.style.pointerEvents = "none";
    row.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(16px)" }], { duration: 160, easing: "ease-in", fill: "forwards" }).finished.then(finish, finish);
}

function restoreApplied(previous) {
    commitApplied((list) => list.splice(0, list.length, ...previous));
    showToast(t("Restored"));
}

function locateApplied(entry) {
    const asset = appliedAsset(entry);
    if (!asset) return;
    switchTab("local");
    popup.selectedAssetId = asset.id;
    if (!updateLocalDetail()) renderPopup();
    popupBody.querySelector(`[data-local-id="${CSS.escape(asset.id)}"]`)?.scrollIntoView({ block: "center" });
}

function startAppliedDrag(event, handle) {
    const row = handle.closest(".alm-applied-row");
    const rows = [...row.parentElement.children];
    if (rows.length < 2) return;
    event.preventDefault();
    const from = rows.indexOf(row);
    const tops = rows.map((item) => item.getBoundingClientRect().top);
    const step = tops[1] - tops[0];
    const startY = event.clientY;
    let to = from;
    row.classList.add("is-dragging");
    const move = (moveEvent) => {
        const offset = moveEvent.clientY - startY;
        to = Math.max(0, Math.min(rows.length - 1, from + Math.round(offset / step)));
        row.style.transform = `translateY(${offset}px)`;
        rows.forEach((item, index) => {
            if (item === row) return;
            const shift = from < to && index > from && index <= to ? -step : from > to && index >= to && index < from ? step : 0;
            item.style.transform = shift ? `translateY(${shift}px)` : "";
        });
    };
    const end = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", end);
        document.removeEventListener("pointercancel", end);
        row.classList.remove("is-dragging");
        if (to === from) {
            rows.forEach((item) => { item.style.transform = ""; });
            return;
        }
        moveApplied(from, to);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
}

function bindAppliedPage(root) {
    const page = root?.querySelector(".alm-applied-page");
    if (!page) return;
    paintAppliedRanges(page);
    const rowIndex = (element) => Number(element.closest("[data-applied-index]")?.dataset.appliedIndex);
    const commitStrength = (input) => {
        const index = rowIndex(input);
        const value = Number(input.value);
        if (!Number.isFinite(value)) return;
        commitApplied((list) => { list[index].strength_model = value; });
    };
    page.onclick = (event) => {
        const button = event.target.closest("[data-applied-action]");
        if (!button) return;
        const loras = appliedLoras();
        const index = rowIndex(button);
        const action = button.dataset.appliedAction;
        if (action === "remove") removeApplied(index, button.closest(".alm-applied-row"));
        else if (action === "toggle") commitApplied((list) => { list[index].enabled = !list[index].enabled; });
        else if (action === "locate") locateApplied(loras[index]);
        else if (action === "copy-words") {
            const words = appliedTriggerWords(loras[index]);
            writeClipboardText(words.join(", "))
                .then(() => showToast(t("Copied {count} trigger words.", { count: words.length })))
                .catch(() => showToast(t("Could not copy the trigger words.")));
        }
        else if (action === "toggle-all") {
            const enable = !loras.every((entry) => entry.enabled);
            commitApplied((list) => list.forEach((entry) => { entry.enabled = enable; }));
        } else if (action === "clear") {
            commitApplied((list) => list.splice(0, list.length));
            showToast(t("Removed all LoRAs"), { label: t("Undo"), onClick: () => restoreApplied(loras) });
        }
    };
    page.oninput = (event) => {
        const range = event.target.closest("[data-applied-range]");
        if (!range) return;
        paintStrengthRange(range, Number(range.value));
        range.closest(".alm-applied-strength").querySelector("[data-applied-number]").value = Number(range.value).toFixed(2);
    };
    page.onchange = (event) => {
        if (event.target.matches("[data-applied-range], [data-applied-number]")) commitStrength(event.target);
    };
    page.ondblclick = (event) => {
        const range = event.target.closest("[data-applied-range]");
        if (!range) return;
        range.value = "1";
        commitStrength(range);
    };
    page.onkeydown = (event) => {
        if (event.target.matches("[data-applied-number]") && event.key === "Enter") {
            event.preventDefault();
            commitStrength(event.target);
            return;
        }
        if (!event.target.matches("[data-applied-handle]") || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault();
        const index = rowIndex(event.target);
        const target = index + (event.key === "ArrowUp" ? -1 : 1);
        if (target >= 0 && target < appliedLoras().length) moveApplied(index, target);
    };
    page.onpointerdown = (event) => {
        const handle = event.target.closest("[data-applied-handle]");
        if (handle && event.button === 0) startAppliedDrag(event, handle);
    };
}

function downloadPageOptions() {
    return { title: t("LoRA Downloads"), jobs: loraDownloads(), actionsFor: loraDownloadActions };
}

function renderDownloads() {
    return renderDownloadPage(downloadPageOptions());
}

function updateDownloadView() {
    return popup.tab === "downloads" && patchDownloadPage(popupBody, downloadPageOptions());
}

function downloadedLora(job) {
    const target = String(job.target_path || "").replaceAll("\\", "/").toLocaleLowerCase();
    return popup.libraryItems.find((item) => String(item.absolute_path || "").replaceAll("\\", "/").toLocaleLowerCase() === target)
        || popup.libraryItems.find((item) => job.version_id && String(item.version_id || "") === String(job.version_id))
        || popup.libraryItems.find((item) => job.relative_path && String(item.relative_path || "").toLocaleLowerCase() === String(job.relative_path).toLocaleLowerCase())
        || null;
}

function loraDownloadActions(job) {
    const taskButton = (action, label, className = "alm-secondary") => `<button class="${className}" type="button" data-action="${action}" data-task-id="${escapeAttr(job.id)}">${escapeHtml(t(label))}</button>`;
    if (ACTIVE_DOWNLOAD_STATUSES.has(job.status)) return job.status === "cancelling" ? "" : taskButton("cancel-download", "Cancel");
    return `
        ${["failed", "cancelled"].includes(job.status) ? taskButton("retry-download", "Retry", "alm-primary") : ""}
        <button class="alm-dl-remove" type="button" data-action="remove-download" data-task-id="${escapeAttr(job.id)}" title="${escapeAttr(t("Remove record"))}" aria-label="${escapeAttr(t("Remove record"))}">${selectorIcon("close")}</button>
    `;
}

function loraDownloads() {
    return Object.values(popup.downloads || {})
        .filter((job) => job.root_kind === "loras")
        .sort((left, right) => Number(right.created_at || 0) - Number(left.created_at || 0));
}

async function loadDownloads(shouldRender = true) {
    try {
        popup.downloads = await apiGet("/download-status");
    } catch (_) {
        popup.downloads = popup.downloads || {};
    }
    trackDownloadRates(Object.values(popup.downloads));
    if (hasActiveDownloads()) startDownloadPolling();
    updateDownloadNavCount();
    if (shouldRender && overlay?.classList.contains("show") && !updateDownloadView() && !updateRemoteDownloadState()) {
        renderPopup();
    }
}

function startDownloadPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => void pollDownloads(), 800);
}

async function pollDownloads() {
    if (pollBusy) return;
    pollBusy = true;
    try {
        popup.downloads = await apiGet("/download-status");
        trackDownloadRates(Object.values(popup.downloads));
        for (const [taskId, pending] of [...popup.pendingApply.entries()]) {
            const job = popup.downloads[taskId];
            if (!job || !TERMINAL_DOWNLOAD_STATUSES.has(job.status)) continue;
            if (job.status === "completed") {
                popup.pendingApply.delete(taskId);
                await finishPendingApply(job, pending);
            } else if (job.status === "failed" && !pending.failureNotified) {
                pending.failureNotified = true;
                popup.error = job.error || t("Download failed.");
            }
        }
        const active = hasActiveDownloads();
        if (!active && pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
        updateDownloadNavCount();
        if (overlay?.classList.contains("show")) {
            if (popup.tab === "downloads") {
                if (!updateDownloadView()) renderPopup();
            } else if (popup.tab === "discover" && popup.selectedRemote) {
                if (!updateRemoteDownloadState()) renderPopup();
            }
            updatePopupMessages();
        }
    } catch (_) {
        // Keep the existing state and retry on the next poll.
    } finally {
        pollBusy = false;
    }
}

async function finishPendingApply(job, pending) {
    await loadLibrary(true, false);
    const asset = downloadedLora(job);
    if (!asset) {
        popup.error = t("Download completed, but the LoRA was not found in the refreshed local library.");
        return;
    }
    addLoraToTargetNode(pending.node || popup.node, {
        ...entryFromAsset(asset),
        display_name: pending.displayName || asset.name,
        // Without a saved preview the local URL only serves a placeholder.
        preview_url: (asset.has_preview ? asset.thumb_url : pending.previewUrl || asset.thumb_url) || "",
        trained_words: asset.trained_words?.length ? asset.trained_words : pending.trainedWords,
        base_model: asset.base_model || pending.baseModel || "",
    }, false);
    showToast(t("Download completed and LoRA applied."));
}

function hasActiveDownloads() {
    return loraDownloads().some((job) => ACTIVE_DOWNLOAD_STATUSES.has(job.status))
        || [...popup.pendingApply.keys()].some((taskId) => ACTIVE_DOWNLOAD_STATUSES.has(popup.downloads[taskId]?.status || ""));
}

async function cancelDownload(taskId) {
    try {
        await apiPost("/download/cancel", { task_id: taskId });
        await loadDownloads(true);
    } catch (error) {
        popup.error = error.message;
        renderPopup();
    }
}

async function retryDownload(taskId) {
    try {
        const pending = popup.pendingApply.get(taskId);
        const data = await apiPost("/download/retry", { task_id: taskId });
        if (pending) {
            popup.pendingApply.delete(taskId);
            popup.pendingApply.set(data.task_id, pending);
        }
        await loadDownloads(true);
    } catch (error) {
        popup.error = error.message;
        renderPopup();
    }
}

async function removeDownloadRecord(taskId) {
    try {
        await apiPost("/download/remove", { task_id: taskId });
        popup.pendingApply.delete(taskId);
        showToast(t("Download record removed."));
        await loadDownloads(true);
    } catch (error) {
        popup.error = error.message;
        renderPopup();
    }
}

async function clearFinishedDownloadRecords() {
    const taskIds = loraDownloads()
        .filter((job) => TERMINAL_DOWNLOAD_STATUSES.has(job.status))
        .map((job) => String(job.id || ""))
        .filter(Boolean);
    if (!taskIds.length || !confirm(t("Clear all finished LoRA download records?"))) return;
    try {
        const data = await apiPost("/download/remove", { task_ids: taskIds });
        taskIds.forEach((taskId) => popup.pendingApply.delete(taskId));
        showToast(t("{count} download records cleared.", { count: Number(data.removed || 0) }));
        await loadDownloads(true);
    } catch (error) {
        popup.error = error.message;
        renderPopup();
    }
}

function bindPopupEvents() {
    bindLocalFolderControls(popupBody);
    popupBody?.querySelectorAll("[data-favorite-key]").forEach((card) => {
        card.onclick = () => {
            openDetailDrawer();
            if (card.dataset.favoriteKey === popup.selectedFavoriteKey) return;
            const item = popup.favoriteItems.find((entry) => entry.key === card.dataset.favoriteKey);
            if (item) selectFavoriteItem(item);
        };
    });
    popupBody?.querySelectorAll("[data-remote-id]").forEach((card) => {
        const favBtn = card.querySelector("[data-card-favorite]");
        if (favBtn) {
            favBtn.onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                const model = popup.remoteItems.find((item) => String(item.id) === String(card.dataset.remoteId));
                if (model) void toggleRemoteFavorite(model);
            };
        }
        card.onclick = () => {
            openDetailDrawer();
            if (String(popup.selectedRemote?.id || "") === String(card.dataset.remoteId || "")) return;
            const model = popup.remoteItems.find((item) => String(item.id) === String(card.dataset.remoteId));
            if (model) void selectRemote(model);
        };
    });
    popupBody?.querySelectorAll("[data-detail-tag]").forEach((button) => {
        button.onclick = () => {
            popup.selectedTag = button.dataset.detailTag;
            popup.detailOpen = false;
            void searchRemote(true);
        };
    });
    bindLocalCards(popupBody);

    const clearFilterBase = popupBody?.querySelector('[data-action="clear-lora-filter-base"]');
    if (clearFilterBase) clearFilterBase.onclick = () => {
        popup.selectedBaseModel = "";
        popup.selectedRemote = null;
        renderPopup({ preserveScroll: false });
    };
    const clearFilterCategory = popupBody?.querySelector('[data-action="clear-lora-filter-category"]');
    if (clearFilterCategory) clearFilterCategory.onclick = () => {
        popup.selectedCategory = "";
        popup.selectedRemote = null;
        void searchRemote(true);
    };
    const clearFilterTag = popupBody?.querySelector('[data-action="clear-lora-filter-tag"]');
    if (clearFilterTag) clearFilterTag.onclick = () => {
        popup.selectedTag = "";
        popup.selectedRemote = null;
        void searchRemote(true);
    };
    const resetFilters = popupBody?.querySelector('[data-action="reset-lora-filters"]');
    if (resetFilters) resetFilters.onclick = resetLoraFilters;

    const remoteQuery = popupBody?.querySelector('[data-field="remote-query"]');
    const clearSearch = popupBody?.querySelector('[data-action="clear-lora-search"]');
    if (remoteQuery) {
        remoteQuery.oninput = () => {
            popup.discoverQuery = remoteQuery.value;
            if (clearSearch) clearSearch.hidden = !popup.discoverQuery;
            clearTimeout(remoteQueryTimer);
            remoteQueryTimer = setTimeout(() => void searchRemote(true), 300);
        };
        remoteQuery.onkeydown = (event) => {
            if (event.key !== "Enter") return;
            clearTimeout(remoteQueryTimer);
            void searchRemote(true);
        };
    }
    popupBody?.querySelectorAll('[data-selector-sort]').forEach((button) => {
        button.onclick = () => {
            popup.sort = button.dataset.selectorSort;
            void searchRemote(true);
        };
    });
    bindSelectorMenus(popupBody);
    const search = popupBody?.querySelector('[data-action="search-loras"]');
    if (search) search.onclick = () => void searchRemote(true);
    if (clearSearch) clearSearch.onclick = () => {
        popup.discoverQuery = "";
        if (remoteQuery) remoteQuery.value = "";
        clearSearch.hidden = true;
        void searchRemote(true);
    };

    const favoriteQuery = popupBody?.querySelector('[data-field="favorite-query"]');
    const clearFavoriteQuery = popupBody?.querySelector('[data-action="clear-lora-favorite-search"]');
    const updateFavoriteResults = () => {
        const results = popupBody?.querySelector(".alm-lora-favorites-page .alm-lora-results");
        if (!results) return;
        results.innerHTML = renderFavoriteResults();
        bindPopupEvents();
        observeCardMedia(popupBody);
    };
    if (favoriteQuery) favoriteQuery.oninput = () => {
        popup.favoriteQuery = favoriteQuery.value;
        if (clearFavoriteQuery) clearFavoriteQuery.hidden = !popup.favoriteQuery;
        updateFavoriteResults();
    };
    if (clearFavoriteQuery) clearFavoriteQuery.onclick = () => {
        popup.favoriteQuery = "";
        if (favoriteQuery) {
            favoriteQuery.value = "";
            favoriteQuery.focus();
        }
        clearFavoriteQuery.hidden = true;
        updateFavoriteResults();
    };

    const switchRemoteVersion = (nextVersionId) => {
        if (!nextVersionId || String(popup.selectedVersionId) === String(nextVersionId)) return;
        popup.selectedVersionId = String(nextVersionId);
        const nextVersion = selectedVersion();
        popup.selectedFileName = primaryFileName(nextVersion);
        if (!updateRemoteDetail() && !updateFavoriteDetail()) renderPopup();
    };
    const version = popupBody?.querySelector('[data-field="remote-version"]');
    if (version) version.onchange = () => switchRemoteVersion(version.value);
    const file = popupBody?.querySelector('[data-field="remote-file"]');
    if (file) file.onchange = () => {
        popup.selectedFileName = file.value;
        updateRemoteDownloadState();
    };
    bindRemoteDownloadEvents(popupBody);
    const favoriteRemote = popupBody?.querySelector('[data-action="favorite-remote-lora"]');
    if (favoriteRemote) favoriteRemote.onclick = () => void toggleRemoteFavorite();
    const remoteFavoriteFolder = popupBody?.querySelector('[data-action="assign-remote-favorite-folder"]');
    if (remoteFavoriteFolder) remoteFavoriteFolder.onchange = () => void assignFavoriteFolder(remoteFavorite(), remoteFavoriteFolder.value);
    const selectedFavoriteItem = selectedFavorite();
    const removeSelectedFavorite = popupBody?.querySelector('[data-action="remove-selected-favorite"]');
    if (removeSelectedFavorite) removeSelectedFavorite.onclick = () => void setFavoriteItem(selectedFavoriteItem, false).then(() => {
        showToast(t("Removed favorite"));
        renderPopup();
    }).catch((error) => {
        popup.error = error.message;
        renderPopup();
    });
    const selectedFavoriteFolder = popupBody?.querySelector('[data-action="assign-selected-favorite-folder"]');
    if (selectedFavoriteFolder) selectedFavoriteFolder.onchange = () => void assignFavoriteFolder(selectedFavoriteItem, selectedFavoriteFolder.value);
    popupBody?.querySelectorAll("[data-copy]").forEach((button) => {
        button.onclick = async () => {
            try {
                await navigator.clipboard.writeText(button.dataset.copy || "");
                button.classList.add("is-copied");
                setTimeout(() => button.classList.remove("is-copied"), 1400);
                showToast(t("Copied"));
            } catch (_) {
                showToast(t("Copy failed"));
            }
        };
    });

    const updateLocalSearchResults = () => {
        const results = popupBody?.querySelector(".alm-lora-results");
        if (!results) return;
        results.innerHTML = renderLocalResults();
        bindLocalCards(results);
        observeCardMedia(popupBody);
    };
    const localQuery = popupBody?.querySelector('[data-field="local-query"]');
    const clearLocalQuery = popupBody?.querySelector('[data-action="clear-lora-local-search"]');
    if (localQuery) localQuery.oninput = () => {
        popup.localQuery = localQuery.value;
        if (clearLocalQuery) clearLocalQuery.hidden = !popup.localQuery;
        updateLocalSearchResults();
    };
    if (clearLocalQuery) clearLocalQuery.onclick = () => {
        popup.localQuery = "";
        if (localQuery) {
            localQuery.value = "";
            localQuery.focus();
        }
        clearLocalQuery.hidden = true;
        updateLocalSearchResults();
    };
    const refreshLocal = popupBody?.querySelector('[data-action="refresh-local-loras"]');
    if (refreshLocal) refreshLocal.onclick = () => void loadLibrary(true);
    const matchMissingLocal = popupBody?.querySelector('[data-action="match-missing-local-loras"]');
    if (matchMissingLocal) matchMissingLocal.onclick = () => void matchMissingLocalLoraMetadata();
    const cancelLocalMatch = popupBody?.querySelector('[data-action="cancel-match-local-loras"]');
    if (cancelLocalMatch) cancelLocalMatch.onclick = () => cancelLocalLoraMetadataMatch();
    const localActions = {
        "apply-local": "apply",
        "match-local": "match",
        "favorite-local": "favorite",
        "open-local-folder": "open",
        "delete-local": "delete",
    };
    Object.entries(localActions).forEach(([selector, action]) => {
        const button = popupBody?.querySelector(`[data-action="${selector}"]`);
        if (button) button.onclick = () => void manageSelectedAsset(action);
    });
    const localFavoriteFolder = popupBody?.querySelector('[data-action="assign-local-favorite-folder"]');
    if (localFavoriteFolder) {
        const asset = popup.libraryItems.find((item) => item.id === popup.selectedAssetId);
        localFavoriteFolder.onchange = () => void assignFavoriteFolder(localFavorite(asset), localFavoriteFolder.value);
    }

    bindAppliedPage(popupBody);
    bindLoraDownloadEvents(popupBody);
}

function bindLocalCards(root) {
    root?.querySelectorAll("[data-local-id]").forEach((card) => {
        const favBtn = card.querySelector("[data-card-favorite]");
        if (favBtn) {
            favBtn.onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                const asset = popup.libraryItems.find((item) => String(item.id) === String(card.dataset.localId));
                if (asset) void toggleLocalFavorite(asset);
            };
        }
        card.onclick = () => {
            openDetailDrawer();
            if (String(popup.selectedAssetId || "") === String(card.dataset.localId || "")) return;
            popup.selectedAssetId = card.dataset.localId;
            if (!updateLocalDetail()) renderPopup();
        };
    });
}

function bindRemoteDownloadEvents(root) {
    const installed = root?.querySelector('[data-action="apply-installed"]');
    if (installed) installed.onclick = () => {
        const asset = findLocalForRemote(popup.selectedRemote, selectedVersion());
        if (asset) addLoraToNode(entryFromAsset(asset));
    };
    const download = root?.querySelector('[data-action="download-apply"]');
    if (download) download.onclick = () => void downloadAndApply();
}

function bindLoraDownloadEvents(root) {
    const page = root?.querySelector(".alm-dl-page");
    if (!page) return;
    hydrateDownloadDetails(page);
    // Rows are patched in place while polling, so actions are delegated.
    page.onclick = (event) => {
        if (handleDownloadDetailsClick(event)) return;
        const button = event.target.closest("[data-action]");
        const taskId = button?.dataset.taskId || "";
        const actions = {
            "cancel-download": () => cancelDownload(taskId),
            "retry-download": () => retryDownload(taskId),
            "remove-download": () => removeDownloadRecord(taskId),
            "clear-downloads": () => clearFinishedDownloadRecords(),
            "open-download-folder": () => apiPost("/asset/open-folder", { root_kind: button.dataset.rootKind, relative_path: button.dataset.relativePath })
                .then(() => showToast(t("Folder opened")), (error) => showToast(error.message)),
        };
        void actions[button?.dataset.action]?.();
    };
}

function showToast(message, action = null) {
    popup.toast = message;
    popup.toastAction = action;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        popup.toast = "";
        popup.toastAction = null;
        if (overlay?.classList.contains("show") && !updatePopupMessages()) renderPopup();
    }, action ? 6000 : 2600);
    if (overlay?.classList.contains("show") && !updatePopupMessages()) renderPopup();
}

function sanitizeDescriptionHtml(html) {
    const raw = String(html || "").trim();
    if (!raw) return `<span class="alm-muted">${escapeHtml(t("No description available."))}</span>`;
    const allowed = new Set(["p", "br", "strong", "b", "em", "i", "u", "a", "ul", "ol", "li", "pre", "code", "blockquote", "h1", "h2", "h3", "h4"]);
    const template = document.createElement("template");
    template.innerHTML = raw.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
    const renderNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent || "");
        if (node.nodeType !== Node.ELEMENT_NODE) return "";
        const tag = node.tagName.toLowerCase();
        const children = Array.from(node.childNodes).map(renderNode).join("");
        if (!allowed.has(tag)) return children;
        if (tag === "br") return "<br>";
        if (tag === "a") {
            const href = String(node.getAttribute("href") || "").trim();
            const safeHref = /^(https?:)?\/\//i.test(href) || href.startsWith("#") ? href : "";
            return safeHref ? `<a href="${escapeAttr(safeHref)}" target="_blank" rel="noopener noreferrer">${children || escapeHtml(safeHref)}</a>` : children;
        }
        return `<${tag}>${children}</${tag}>`;
    };
    const cleaned = Array.from(template.content.childNodes).map(renderNode).join("").trim();
    if (cleaned) return cleaned;
    const text = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return text ? `<p>${escapeHtml(text)}</p>` : `<span class="alm-muted">${escapeHtml(t("No description available."))}</span>`;
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
