import { app } from "../../scripts/app.js";
import { t } from "./i18n.js";
import { markImageLoaded, isImageLoaded, clearImageLoadedCache } from "./anima_image_utils.js";
import { createPromoLinks } from "./anima_promo_links.js";

app.registerExtension({
    name: "AnimaMultiLoraLoader.extension",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "AnimaMultiLoraLoader") {
            const origOnCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                origOnCreated?.apply(this, arguments);

                // Initialize private state
                this._loraData = [];
                this._dynamicWidgets = [];

                // 同步隐藏并初始化，与其它选择器的同步模式保持 100% 绝对一致
                hideJsonWidgetFully(this);
                syncLoraWidgets(this, this._loraData);
            };

            // Hook configure to restore workflow state properly
            const origOnConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function (info) {
                // Pre-configure: Extract and restore the dynamic widgets structure before LiteGraph reads values
                if (info && info.widgets_values) {
                    for (const val of info.widgets_values) {
                        const parsedLoraData = parseLoraJsonValue(val);
                        if (parsedLoraData) {
                            syncLoraWidgets(this, parsedLoraData);
                            break;
                        }
                    }
                }

                origOnConfigure?.apply(this, arguments);
                const jsonLoraData = getJsonWidgetLoraData(this);
                if (jsonLoraData) {
                    syncLoraWidgets(this, jsonLoraData);
                }
                hideJsonWidgetFully(this);
            };

            const origOnResize = nodeType.prototype.onResize;
            nodeType.prototype.onResize = function () {
                const result = origOnResize?.apply(this, arguments);
                updateLoraWidgetLabels(this);
                return result;
            };

            const origOnDrawForeground = nodeType.prototype.onDrawForeground;
            nodeType.prototype.onDrawForeground = function () {
                const result = origOnDrawForeground?.apply(this, arguments);
                updateLoraWidgetLabelsIfNeeded(this);
                return result;
            };
        }
    }
});

function hideWidgetDomElement(element) {
    if (!element?.style) return;
    if (element === document.body || element === document.documentElement) return;
    if (element.querySelector?.("canvas, #graph-canvas, .graph-canvas")) return;
    element.style.setProperty("display", "none", "important");
    element.style.setProperty("visibility", "hidden", "important");
    element.style.setProperty("opacity", "0", "important");
    element.style.setProperty("pointer-events", "none", "important");
    element.style.setProperty("position", "absolute", "important");
    element.style.setProperty("left", "-100000px", "important");
    element.style.setProperty("top", "-100000px", "important");
    element.style.setProperty("width", "0px", "important");
    element.style.setProperty("height", "0px", "important");
    element.style.setProperty("min-width", "0px", "important");
    element.style.setProperty("min-height", "0px", "important");
    element.style.setProperty("max-width", "0px", "important");
    element.style.setProperty("max-height", "0px", "important");
    element.style.setProperty("padding", "0px", "important");
    element.style.setProperty("margin", "0px", "important");
    element.style.setProperty("border", "0", "important");
    element.style.setProperty("z-index", "-1", "important");
    element.setAttribute?.("aria-hidden", "true");
    try {
        if ("tabIndex" in element) element.tabIndex = -1;
    } catch (_) {}
}

function detachWidgetDom(widget) {
    const candidates = [
        widget?.element,
        widget?.inputEl,
        widget?.el,
        widget?.domElement,
        widget?.container,
        widget?.root,
        widget?.element?.parentElement,
        widget?.inputEl?.parentElement
    ];
    candidates.forEach(hideWidgetDomElement);
}

function safeSetWidgetProperty(widget, key, value) {
    try {
        widget[key] = value;
    } catch (_) {}
}

// Helper to reliably hide the json list widget
function hideJsonWidgetFully(node) {
    const jsonWidget = node.widgets?.find(w => w.name === "lora_list_json");
    if (jsonWidget) {
        safeSetWidgetProperty(jsonWidget, "type", "hidden");
        safeSetWidgetProperty(jsonWidget, "options", { ...(jsonWidget.options || {}), hidden: true });
        safeSetWidgetProperty(jsonWidget, "serialize", true);
        safeSetWidgetProperty(jsonWidget, "disabled", true);
        safeSetWidgetProperty(jsonWidget, "draw", () => {});
        safeSetWidgetProperty(jsonWidget, "computeSize", () => [0, 0]);
        safeSetWidgetProperty(jsonWidget, "mouse", () => false);
        safeSetWidgetProperty(jsonWidget, "onMouseDown", () => false);
        safeSetWidgetProperty(jsonWidget, "onMouseMove", () => false);
        safeSetWidgetProperty(jsonWidget, "onMouseUp", () => false);
        safeSetWidgetProperty(jsonWidget, "computedHeight", 0);
        safeSetWidgetProperty(jsonWidget, "y", -100000);
        safeSetWidgetProperty(jsonWidget, "last_y", -100000);
        detachWidgetDom(jsonWidget);
    }
}

function normalizeLoraEntry(lora) {
    if (!lora || !lora.name) return null;
    return {
        name: lora.name,
        strength_model: Number.isFinite(Number(lora.strength_model)) ? Number(lora.strength_model) : 1.0,
        enabled: lora.enabled !== false
    };
}

function normalizeLoraList(loras) {
    return (Array.isArray(loras) ? loras : []).map(normalizeLoraEntry).filter(Boolean);
}

function parseLoraJsonValue(value) {
    if (typeof value !== "string" || !value.trim().startsWith("[")) return null;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? normalizeLoraList(parsed) : null;
    } catch (_) {
        return null;
    }
}

function getJsonWidgetLoraData(node) {
    const jsonWidget = node.widgets?.find(w => w.name === "lora_list_json");
    return parseLoraJsonValue(jsonWidget?.value);
}

function getLoraBaseName(name) {
    let displayName = String(name || "");
    if (displayName.endsWith(".safetensors")) {
        displayName = displayName.slice(0, -12);
    }
    const lastSlash = Math.max(displayName.lastIndexOf("/"), displayName.lastIndexOf("\\"));
    if (lastSlash !== -1) {
        displayName = displayName.substring(lastSlash + 1);
    }
    return displayName || "LoRA";
}

function truncateForWidth(text, maxChars) {
    if (text.length <= maxChars) return text;
    if (maxChars <= 8) return text.slice(0, Math.max(1, maxChars - 1)) + "...";
    const head = Math.ceil((maxChars - 3) * 0.68);
    const tail = Math.max(0, maxChars - 3 - head);
    return `${text.slice(0, head)}...${tail > 0 ? text.slice(-tail) : ""}`;
}

function getAdaptiveLoraName(name, nodeWidth) {
    const fullName = getLoraBaseName(name);
    const width = Math.max(180, Number(nodeWidth || 240));
    const maxChars = Math.max(12, Math.floor((width - 70) / 7));
    return truncateForWidth(fullName, maxChars);
}

function getDeleteWidgetName(name, nodeWidth) {
    return `×  ${getAdaptiveLoraName(name, nodeWidth)}`;
}

function updateLoraWidgetLabels(node) {
    if (!node?.widgets) return;
    const width = node.size ? node.size[0] : 240;
    let changed = false;
    for (const widget of node.widgets) {
        if (widget?.__animaWidgetType === "delete_lora") {
            const nextName = getDeleteWidgetName(widget.__animaLoraName, width);
            if (widget.name !== nextName) {
                widget.name = nextName;
                changed = true;
            }
        }
    }
    node._animaLastLoraWidgetWidth = width;
    if (changed) {
        node.setDirtyCanvas?.(true, true);
    }
}

function updateLoraWidgetLabelsIfNeeded(node) {
    const width = node?.size ? node.size[0] : 0;
    if (!width || Math.abs(width - (node._animaLastLoraWidgetWidth || 0)) < 8) return;
    updateLoraWidgetLabels(node);
}

// Dynamic widget synchronization
function syncLoraWidgets(node, loras) {
    try {
        // 1. Record current width before any widgets change
        const currentWidth = node.size ? node.size[0] : 0;
        loras = normalizeLoraList(loras);
        node._loraData = loras;

        // 2. Physically remove all previous dynamic widgets matching certain prefixes or names
        if (node.widgets) {
            for (let i = node.widgets.length - 1; i >= 0; i--) {
                const w = node.widgets[i];
                if (w && w.name) {
                    const wName = typeof w.name === "string" ? w.name : String(w.name);
                    if (
                        w.__animaWidgetType ||
                        wName.startsWith("❌") || 
                        wName.startsWith("×") ||
                        wName.includes("Model Str") || 
                        wName.includes("Clip Str") || 
                        wName.includes("Strength") ||
                        wName === t("Open LoRA Selector") ||
                        wName === "Open LoRA Selector"
                    ) {
                        detachWidgetDom(w);
                        if (w.el && w.el.parentNode) w.el.parentNode.removeChild(w.el);
                        if (w.element && w.element.parentNode) w.element.parentNode.removeChild(w.element);
                        if (w.inputEl && w.inputEl.parentNode) w.inputEl.parentNode.removeChild(w.inputEl);
                        node.widgets.splice(i, 1);
                    }
                }
            }
        }
        node._dynamicWidgets = [];

        // 3. Add control widgets for each LoRA
        for (let i = 0; i < loras.length; i++) {
            const lora = loras[i];
            if (!lora || !lora.name) continue;

            const delBtn = node.addWidget("button", getDeleteWidgetName(lora.name, currentWidth), null, () => {
                const nextLoras = node._loraData.filter(x => x.name !== lora.name);
                node._loraData = nextLoras;
                updateJsonValue(node);
                syncLoraWidgets(node, nextLoras);
            });
            delBtn.__animaWidgetType = "delete_lora";
            delBtn.__animaLoraName = lora.name;
            delBtn.serialize = false;
            delBtn.computedHeight = 24;
            if (delBtn.el) {
                delBtn.el.style.cssText += `
                    color: #ef4444 !important;
                    border: 1px solid rgba(239, 68, 68, 0.32) !important;
                    background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(127, 29, 29, 0.12)) !important;
                    border-radius: 7px !important;
                    font-size: 11px !important;
                    text-align: left !important;
                    padding-left: 10px !important;
                    margin-top: 4px !important;
                    font-weight: 650 !important;
                `;
                delBtn.el.title = `Remove ${lora.name}`;
            }
            node._dynamicWidgets.push(delBtn);

            // Use zero-width space (\u200B) repeat sequence as unique suffix to prevent LiteGraph merge,
            // so that the rendered name has absolutely no extra bracket explanation, looking clean.
            const modelWidgetName = "   Strength" + "\u200B".repeat(i);

            const modelSlider = node.addWidget("slider", modelWidgetName, lora.strength_model ?? 1.0, (val) => {
                const nextValue = Number.parseFloat(val);
                if (!Number.isFinite(nextValue)) return;
                const roundedValue = Number(nextValue.toFixed(2));
                const currentLora = node._loraData.find(item => item.name === lora.name);
                if (currentLora) {
                    currentLora.strength_model = roundedValue;
                } else {
                    lora.strength_model = roundedValue;
                }
                modelSlider.value = roundedValue;
                updateJsonValue(node);
                node.setDirtyCanvas?.(true, true);
            }, { min: -4.0, max: 4.0, step: 0.1, precision: 2 });
            modelSlider.__animaWidgetType = "model_strength";
            modelSlider.__animaLoraName = lora.name;
            modelSlider.serialize = false;
            modelSlider.computedHeight = 18;
            node._dynamicWidgets.push(modelSlider);
        }

        // 4. Add Open LoRA Selector Button at the very bottom of the node
        const btnWidget = node.addWidget("button", t("Open LoRA Selector"), null, async () => {
            await openLoraSelectorModal(node);
        });
        if (btnWidget) {
            btnWidget.serialize = false;
        }
        
        // Style the button (matching artist selector blue sci-fi aesthetics)
        if (btnWidget && btnWidget.el) {
            btnWidget.el.style.cssText += `
                border: 1px solid rgba(11, 140, 233, 0.4) !important;
                background: linear-gradient(135deg, rgba(11, 140, 233, 0.1), rgba(2, 86, 145, 0.15)) !important;
                color: #7dd3fc !important;
                font-weight: 600 !important;
                margin-top: 8px !important;
                margin-bottom: 4px !important;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
            `;
            btnWidget.el.onmouseover = () => {
                btnWidget.el.style.boxShadow = "0 0 12px rgba(11, 140, 233, 0.35)";
                btnWidget.el.style.background = "linear-gradient(135deg, rgba(11, 140, 233, 0.25), rgba(2, 86, 145, 0.3))";
            };
            btnWidget.el.onmouseout = () => {
                btnWidget.el.style.boxShadow = "none";
                btnWidget.el.style.background = "linear-gradient(135deg, rgba(11, 140, 233, 0.1), rgba(2, 86, 145, 0.15))";
            };
        }
        node._dynamicWidgets.push(btnWidget);

        // 5. Recompute node size and refresh canvas
        hideJsonWidgetFully(node);
        
        const idealSize = node.computeSize();
        const w = Math.max(currentWidth, idealSize[0]);
        const h = idealSize[1];
        
        if (node.setSize) {
            node.setSize([w, h]);
        } else {
            node.size = [w, h];
        }
        updateLoraWidgetLabels(node);
        
        node.setDirtyCanvas(true, true);
    } catch (err) {
        console.error("[Anima Tools] Error in syncLoraWidgets:", err);
    }
}

function updateJsonValue(node) {
    const jsonWidget = node.widgets.find(w => w.name === "lora_list_json");
    if (jsonWidget) {
        node._loraData = normalizeLoraList(node._loraData || []);
        jsonWidget.value = JSON.stringify(node._loraData);
    }
}

// Global caching variables
let globalLoraConfig = null;
let globalLocalLoras = null;
let globalLoraManifest = null;
let globalFavorites = null;
const LORA_MANIFEST_WIDTH = 320;
const LORA_MANIFEST_CACHE_KEY = "loraManifest:v1:320";

function cacheGetSync(key) {
    try {
        const raw = localStorage.getItem(`anima-cache:${key}`);
        return raw ? JSON.parse(raw) : null;
    } catch (_) {
        return null;
    }
}

function cacheSetSync(key, value) {
    try {
        localStorage.setItem(`anima-cache:${key}`, JSON.stringify(value));
    } catch (_) {}
}

function openAnimaCacheDb() {
    return new Promise((resolve) => {
        if (!("indexedDB" in window)) {
            resolve(null);
            return;
        }
        const req = indexedDB.open("AnimaToolsCache", 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains("kv")) {
                db.createObjectStore("kv");
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
    });
}

async function cacheGet(key) {
    const syncValue = cacheGetSync(key);
    if (syncValue) return syncValue;
    const db = await openAnimaCacheDb();
    if (!db) return null;
    return new Promise((resolve) => {
        const tx = db.transaction("kv", "readonly");
        const req = tx.objectStore("kv").get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
    });
}

async function cacheSet(key, value) {
    cacheSetSync(key, value);
    const db = await openAnimaCacheDb();
    if (!db) return;
    return new Promise((resolve) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
    });
}

async function cacheDelete(key) {
    try {
        localStorage.removeItem(`anima-cache:${key}`);
    } catch (_) {}
    const db = await openAnimaCacheDb();
    if (!db) return;
    return new Promise((resolve) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
    });
}

function clearStaleLoader(loader, delay = 8000) {
    if (!loader) return;
    setTimeout(() => {
        if (loader.isConnected) {
            loader.remove();
        }
    }, delay);
}

function createPreviewLoader(container, delay = 160) {
    const loader = document.createElement("div");
    const spinner = document.createElement("div");
    spinner.className = "anima-spinner";
    loader.appendChild(spinner);
    const originalRemove = loader.remove.bind(loader);
    const timer = setTimeout(() => {
        if (loader.dataset.cancelled === "1") return;
        if (container.isConnected && !loader.isConnected) {
            container.appendChild(loader);
        }
    }, delay);
    loader.remove = () => {
        loader.dataset.cancelled = "1";
        clearTimeout(timer);
        originalRemove();
    };
    clearStaleLoader(loader);
    return loader;
}

const INITIAL_CARD_PREVIEW_LOADS = 16;
const LORA_CARD_PREVIEW_WIDTH = 450;
const LORA_DETAIL_PREVIEW_WIDTH = 450;
const LORA_LOCAL_CARD_PREVIEW_WIDTH = LORA_MANIFEST_WIDTH;
const CIVITAI_SEARCH_CACHE_TTL = 24 * 60 * 60 * 1000;
const CIVITAI_SEARCH_CACHE_VERSION = "v4-description-detail";
const CIVITAI_API_KEYS_URL = "https://civitai.com/user/account?tab=apiKeys";
const civitaiSearchCache = {
    key(url) {
        return `${CIVITAI_SEARCH_CACHE_VERSION}:${url}`;
    },
    get(url) {
        try {
            const raw = localStorage.getItem("anima-civitai-search-cache");
            if (!raw) return null;
            const cache = JSON.parse(raw);
            return cache[this.key(url)] || null;
        } catch (e) {
            return null;
        }
    },
    set(url, entry) {
        try {
            const raw = localStorage.getItem("anima-civitai-search-cache");
            let cache = raw ? JSON.parse(raw) : {};
            cache[this.key(url)] = entry;
            
            // Limit entries to prevent localStorage bloat
            const keys = Object.keys(cache);
            if (keys.length > 50) {
                keys.sort((a, b) => (cache[a].timestamp || 0) - (cache[b].timestamp || 0));
                keys.slice(0, keys.length - 50).forEach(k => delete cache[k]);
            }
            localStorage.setItem("anima-civitai-search-cache", JSON.stringify(cache));
        } catch (e) {
            if (e.name === "QuotaExceededError") {
                try { localStorage.removeItem("anima-civitai-search-cache"); } catch (_) {}
            }
        }
    },
    delete(url) {
        try {
            const raw = localStorage.getItem("anima-civitai-search-cache");
            if (!raw) return;
            let cache = JSON.parse(raw);
            delete cache[this.key(url)];
            localStorage.setItem("anima-civitai-search-cache", JSON.stringify(cache));
        } catch (e) {}
    }
};

function extractCivitaiImageId(url) {
    if (!url || !url.includes("civitai")) return "";
    try {
        const parsed = new URL(url);
        const cacheMatch = parsed.pathname.match(/\/civitai-media-cache\/([^/]+)/);
        if (cacheMatch) return cacheMatch[1];
        const uuidMatch = parsed.pathname.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        return uuidMatch ? uuidMatch[0] : "";
    } catch (_) {
        const uuidMatch = String(url).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        return uuidMatch ? uuidMatch[0] : "";
    }
}

function getOptimizedImageUrl(url, targetWidth = LORA_CARD_PREVIEW_WIDTH) {
    if (!url) return "";
    const imageId = extractCivitaiImageId(url);
    if (imageId) {
        return `https://image-b2.civitai.com/file/civitai-media-cache/${imageId}/${targetWidth}x%3Cauto%3E_so`;
    }
    if (url.includes("civitai.com") || url.includes("civitai")) {
        if (url.includes("/width=")) {
            url = url.replace(/\/width=\d+/g, `/width=${targetWidth}`);
        } else if (url.match(/[?&]width=\d+/)) {
            url = url.replace(/width=\d+/g, `width=${targetWidth}`);
        } else {
            url += (url.includes("?") ? "&" : "?") + `width=${targetWidth}`;
        }
    }
    return url;
}

function isRemoteHttpUrl(url) {
    return /^https?:\/\//i.test(String(url || ""));
}

function getRemotePreviewUrl(url, targetWidth = LORA_CARD_PREVIEW_WIDTH) {
    if (!url) return "";
    if (!isRemoteHttpUrl(url)) return url;

    const sourceUrl = getOptimizedImageUrl(url, targetWidth);
    const imageId = extractCivitaiImageId(url) || extractCivitaiImageId(sourceUrl);
    const params = new URLSearchParams({
        url: sourceUrl,
        width: String(targetWidth),
        miss: "error"
    });
    if (imageId) {
        params.set("image_id", imageId);
    }
    return `/anima-tools/lora/remote-preview?${params.toString()}`;
}

function isRemotePreviewProxyUrl(url) {
    return String(url || "").includes("/anima-tools/lora/remote-preview");
}

function withPreviewRetryBust(url) {
    return `${url}${url.includes("?") ? "&" : "?"}retry=${Date.now()}`;
}

function retryRemotePreviewLoad(element, previewUrl, maxRetries = 7) {
    if (!isRemotePreviewProxyUrl(previewUrl)) return false;
    const retryCount = parseInt(element.dataset.remoteRetryCount || "0", 10);
    if (retryCount >= maxRetries) return false;
    element.dataset.remoteRetryCount = String(retryCount + 1);
    const delay = [600, 1200, 2200, 3600, 5400, 7600, 10000][retryCount] || 10000;
    setTimeout(() => {
        if (!element.isConnected) return;
        element.src = withPreviewRetryBust(previewUrl);
    }, delay);
    return true;
}

function getPreviewImageUrl(image, targetWidth = LORA_CARD_PREVIEW_WIDTH) {
    if (!image) return "";
    return getRemotePreviewUrl(image.thumbnailUrl || image.url || "", targetWidth);
}

function getSkeletonHtml(count = 40) {
    let html = "";
    for (let i = 0; i < count; i++) {
        html += `
            <div class="anima-lora-card skeleton">
                <div class="anima-lora-card-clip">
                    <div class="anima-spinner"></div>
                    <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: 70px; background: linear-gradient(to top, rgba(10, 10, 15, 0.95) 0%, rgba(10, 10, 15, 0.6) 60%, rgba(10, 10, 15, 0) 100%); z-index: 5; pointer-events: none;"></div>
                </div>
            </div>
        `;
    }
    return html;
}

// ----------------- LoRA Selector Modal UI -----------------

async function openLoraSelectorModal(node) {
    // State
    let searchResults = [];
    let localLoras = [];
    let loraManifestItems = [];
    let loraManifestMap = new Map();
    let activeDownloads = {};
    let config = { custom_lora_dir: "", civitai_api_key: "" };
    
    // Favorites config
    let favoritesConfig = {
        lora: {
            groups: [{ id: "default", name: t("My Favorites"), isSystem: true }],
            items: []
        }
    };

    let query = "";
    let cursor = "";
    let pageHistory = [];
    let currentPageState = null;
    let isSearching = false;
    let searchRequestSeq = 0;
    let pollInterval = null;
    
    let currentCategory = "all"; // 'all', 'style', 'character', 'clothing', 'background', 'loaded', 'downloaded', 'favorites'
    let currentSort = "models_v9"; // Matches Civitai search sortBy values.
    let selectedModel = null; // Currently clicked model for previewing details
    let selectedVersion = null; // Selected version of the clicked model
    let selectedPreviewIndex = 0;
    let selectedPreviewUrl = "";
    let previewRenderGeneration = 0;
    let loraManifestSignature = "";
    let searchDebounceTimer = null;
    let previewCacheBust = "";
    let civitaiApiKeyDownloadWarningShown = false;
    const notifiedDownloadFailures = new Set();
    const startedDownloadTaskIds = new Set();
    const modelDetailCache = new Map();
    const modelDetailFetches = new Map();

    function getManifestSignature(manifestData) {
        const items = Array.isArray(manifestData?.items) ? manifestData.items : [];
        const customDir = manifestData?.custom_lora_dir || "";
        const customDirValid = manifestData?.custom_lora_dir_valid === true ? "1" : "0";
        const itemSignature = items.map(item => `${item.filename}|${item.cache_key || ""}|${item.mtime || ""}|${item.size || ""}|${item.source || ""}`).join("\n");
        return `${customDir}|${customDirValid}\n${itemSignature}`;
    }

    function formatStatCount(value) {
        const num = Number(value || 0);
        if (!Number.isFinite(num) || num <= 0) return "0";
        if (num >= 1000000) return `${(num / 1000000).toFixed(num >= 10000000 ? 0 : 1).replace(/\.0$/, "")}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(num >= 10000 ? 0 : 1).replace(/\.0$/, "")}K`;
        return String(Math.round(num));
    }

    function getModelStats(model, version = {}) {
        const modelStats = model?.stats || model?.metrics || {};
        const versionStats = version?.stats || version?.metrics || {};
        const downloadCount = modelStats.downloadCount ?? versionStats.downloadCount ?? 0;
        const likeCount = modelStats.thumbsUpCount ?? versionStats.thumbsUpCount ?? modelStats.favoriteCount ?? modelStats.collectedCount ?? 0;
        return { downloadCount, likeCount };
    }

    function getModelDescriptionHtml(model, version = {}) {
        const candidates = [
            model?.description,
            model?.descriptionHtml,
            model?.descriptionPlaintext,
            version?.description,
            version?.descriptionHtml,
            version?.descriptionPlaintext,
            model?.metadata?.description,
            version?.metadata?.description
        ];
        const found = candidates.find(value => typeof value === "string" && value.trim());
        return found ? found.trim() : "";
    }

    function resetSelectedPreviewState() {
        selectedPreviewIndex = 0;
        selectedPreviewUrl = "";
    }

    function showCopyFeedback(message) {
        const toast = document.createElement("div");
        toast.className = "anima-lora-copy-toast";
        toast.innerText = message;
        modalOverlay.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add("show"));
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 180);
        }, 1200);
    }

    async function copyTextToClipboard(text) {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) {
            throw new Error("Copy command failed");
        }
    }

    function mergeSelectedModelDetail(fullModel, preferredVersionId = null) {
        if (!fullModel || !selectedModel || String(selectedModel.id) !== String(fullModel.id)) return;
        const previousVersions = selectedModel.modelVersions || [];
        const detailVersions = Array.isArray(fullModel.modelVersions) ? fullModel.modelVersions : [];
        const mergedVersions = detailVersions.length > 0
            ? detailVersions.map(version => {
                const previous = previousVersions.find(item => String(item.id) === String(version.id)) || {};
                return {
                    ...previous,
                    ...version,
                    images: Array.isArray(version.images) && version.images.length ? version.images : (previous.images || []),
                    files: Array.isArray(version.files) && version.files.length ? version.files : (previous.files || []),
                    downloadUrl: version.downloadUrl || previous.downloadUrl || ""
                };
            })
            : previousVersions;

        selectedModel = {
            ...selectedModel,
            ...fullModel,
            creator: fullModel.creator || selectedModel.creator,
            modelVersions: mergedVersions
        };

        const versionId = preferredVersionId ?? selectedVersion?.id;
        const matchedVersion = mergedVersions.find(version => String(version.id) === String(versionId));
        if (matchedVersion) {
            selectedVersion = {
                ...selectedVersion,
                ...matchedVersion,
                images: Array.isArray(matchedVersion.images) && matchedVersion.images.length ? matchedVersion.images : (selectedVersion?.images || []),
                files: Array.isArray(matchedVersion.files) && matchedVersion.files.length ? matchedVersion.files : (selectedVersion?.files || []),
                downloadUrl: matchedVersion.downloadUrl || selectedVersion?.downloadUrl || ""
            };
        }
    }

    async function hydrateSelectedModelDetail(modelId, preferredVersionId = null) {
        const id = String(modelId || "");
        if (!id || Number.isNaN(Number(id))) return;
        if (getModelDescriptionHtml(selectedModel, selectedVersion) && modelDetailCache.has(id)) return;

        if (modelDetailCache.has(id)) {
            mergeSelectedModelDetail(modelDetailCache.get(id), preferredVersionId);
            renderModelDetail();
            return;
        }

        if (modelDetailFetches.has(id)) {
            await modelDetailFetches.get(id);
            if (modelDetailCache.has(id) && selectedModel && String(selectedModel.id) === id) {
                mergeSelectedModelDetail(modelDetailCache.get(id), preferredVersionId);
                renderModelDetail();
            }
            return;
        }

        const request = fetch(`/anima-tools/lora/model-detail?id=${encodeURIComponent(id)}`)
            .then(resp => resp.ok ? resp.json() : null)
            .then(data => {
                if (data?.success && data.model) {
                    modelDetailCache.set(id, data.model);
                }
            })
            .catch(error => console.error("[Anima Tools] Failed to fetch model detail", error))
            .finally(() => modelDetailFetches.delete(id));

        modelDetailFetches.set(id, request);
        await request;
        if (modelDetailCache.has(id) && selectedModel && String(selectedModel.id) === id) {
            mergeSelectedModelDetail(modelDetailCache.get(id), preferredVersionId);
            renderModelDetail();
        }
    }

    function applyManifest(manifestData) {
        const items = Array.isArray(manifestData?.items) ? manifestData.items : [];
        loraManifestItems = items;
        loraManifestMap = new Map(items.map(item => [item.filename, item]));
        localLoras = items.map(item => item.filename);
        globalLoraManifest = manifestData;
        globalLocalLoras = localLoras;
        loraManifestSignature = getManifestSignature(manifestData);
    }

    function getManifestItem(filename) {
        if (!filename) return null;
        if (loraManifestMap.has(filename)) return loraManifestMap.get(filename);
        return loraManifestItems.find(item => item.filename === filename || item.filename.endsWith(filename) || filename.endsWith(item.filename)) || null;
    }

    function getLocalPreviewUrl(filename, width = 320) {
        const item = getManifestItem(filename);
        const cacheBust = previewCacheBust ? `&cache_bust=${encodeURIComponent(previewCacheBust)}` : "";
        if (item && width === LORA_MANIFEST_WIDTH && item.thumb_url) {
            return `${item.thumb_url}${cacheBust}`;
        }
        const version = item?.cache_key ? `&v=${encodeURIComponent(item.cache_key)}` : "";
        return `/anima-tools/lora/local-preview?filename=${encodeURIComponent(filename)}&width=${width}${version}${previewCacheBust ? `&cache_bust=${encodeURIComponent(previewCacheBust)}` : ""}`;
    }

    function getConfiguredAnimaLoraDir() {
        const manifestDir = typeof globalLoraManifest?.custom_lora_dir === "string" ? globalLoraManifest.custom_lora_dir.trim() : "";
        const configDir = typeof config?.custom_lora_dir === "string" ? config.custom_lora_dir.trim() : "";
        return configDir || manifestDir;
    }

    function isConfiguredAnimaLoraDirValid() {
        const manifestDir = typeof globalLoraManifest?.custom_lora_dir === "string" ? globalLoraManifest.custom_lora_dir.trim() : "";
        const configDir = typeof config?.custom_lora_dir === "string" ? config.custom_lora_dir.trim() : "";
        if (configDir && manifestDir && configDir !== manifestDir && typeof config?.custom_lora_dir_valid === "boolean") {
            return config.custom_lora_dir_valid;
        }
        if (typeof globalLoraManifest?.custom_lora_dir_valid === "boolean") {
            return globalLoraManifest.custom_lora_dir_valid;
        }
        if (typeof config?.custom_lora_dir_valid === "boolean") {
            return config.custom_lora_dir_valid;
        }
        return false;
    }

    function getDownloadedManifestItems() {
        return loraManifestItems.filter(item => item?.source === "custom");
    }

    function loadCachedManifestSync() {
        if (globalLoraManifest) {
            applyManifest(globalLoraManifest);
            return true;
        }
        const cached = cacheGetSync(LORA_MANIFEST_CACHE_KEY);
        if (cached && Array.isArray(cached.items)) {
            applyManifest(cached);
            return true;
        }
        return false;
    }

    async function loadCachedManifest() {
        if (loadCachedManifestSync()) return true;
        const cached = await cacheGet(LORA_MANIFEST_CACHE_KEY);
        if (cached && Array.isArray(cached.items)) {
            applyManifest(cached);
            return true;
        }
        return false;
    }

    async function refreshManifest({ rerender = false } = {}) {
        try {
            const resp = await fetch(`/anima-tools/lora/manifest?width=${LORA_MANIFEST_WIDTH}`);
            if (!resp.ok) return false;
            const data = await resp.json();
            const oldSignature = loraManifestSignature;
            const newSignature = getManifestSignature(data);
            const changed = oldSignature !== newSignature;
            applyManifest(data);
            cacheSet(LORA_MANIFEST_CACHE_KEY, data);
            if (rerender && changed) {
                if (currentCategory === "downloaded") {
                    renderDownloadedOnly();
                } else if (currentCategory === "loaded") {
                    renderLoadedOnly();
                } else if (currentCategory === "favorites") {
                    renderFavoritesOnly();
                } else {
                    renderGrid();
                }
            }
            return changed;
        } catch (e) {
            console.error("[Anima Tools] Failed to refresh LoRA manifest", e);
            return false;
        }
    }

    async function clearLoraSelectorCaches() {
        previewCacheBust = String(Date.now());
        globalLoraManifest = null;
        globalLocalLoras = null;
        loraManifestItems = [];
        loraManifestMap = new Map();
        loraManifestSignature = "";
        clearImageLoadedCache();

        try {
            localStorage.removeItem("anima-civitai-search-cache");
        } catch (_) {}
        await cacheDelete(LORA_MANIFEST_CACHE_KEY);

        try {
            const resp = await fetch("/anima-tools/lora/clear-cache", { method: "POST" });
            if (!resp.ok) {
                console.warn("[Anima Tools] Backend cache clear failed", resp.status);
            }
        } catch (e) {
            console.warn("[Anima Tools] Backend cache clear request failed", e);
        }
    }

    // Modal DOM setup
    const modalOverlay = document.createElement("div");
    modalOverlay.id = "anima-lora-overlay";
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(10, 10, 15, 0.8);
        backdrop-filter: blur(15px);
        -webkit-backdrop-filter: blur(15px);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #f3f4f6;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const modalContainer = document.createElement("div");
    modalContainer.id = "anima-lora-container";
    modalContainer.style.cssText = `
        width: 95%;
        max-width: 1400px;
        height: 90%;
        background: #171718;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: animaFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    `;

    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    };

    // Inject styles
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
        @keyframes animaFadeIn {
            from { opacity: 0; transform: scale(0.97) translateY(8px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .anima-btn-primary {
            background: #0b8ce9;
            color: #ffffff;
            border: none;
            border-radius: 8px;
            padding: 8px 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }
        .anima-btn-primary:hover {
            background: #0076c7;
        }
        .anima-btn-primary:disabled {
            background: #2d2d30;
            color: #727275;
            cursor: not-allowed;
            border: 1px solid rgba(255,255,255,0.05);
        }
        .anima-btn-secondary {
            background: rgba(255, 255, 255, 0.08);
            color: #f3f4f6;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 8px 16px;
            cursor: pointer;
            transition: background 0.2s;
        }
        .anima-btn-secondary:hover {
            background: rgba(255, 255, 255, 0.15);
        }
        .anima-lora-pagination {
            padding: 14px 20px;
            background: linear-gradient(180deg, rgba(18,18,24,0.2), rgba(18,18,24,0.62));
            border-top: 1px solid rgba(255,255,255,0.06);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            flex-wrap: wrap;
            flex-shrink: 0;
            box-shadow: 0 -12px 32px rgba(0,0,0,0.18);
        }
        .anima-lora-pagination-stats {
            min-height: 36px;
            padding: 0 14px;
            border-radius: 999px;
            background: rgba(255,255,255,0.045);
            border: 1px solid rgba(255,255,255,0.07);
            color: #d4d4d8;
            font-size: 12.5px;
            font-weight: 750;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            white-space: nowrap;
            max-width: min(520px, 100%);
            overflow: hidden;
            text-overflow: ellipsis;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .anima-lora-pagination-stats::before {
            content: "";
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #0b8ce9;
            box-shadow: 0 0 14px rgba(11,140,233,0.72);
            flex: 0 0 auto;
        }
        .anima-lora-pagination-controls {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            flex-wrap: wrap;
            margin-left: auto;
        }
        .anima-lora-pagination-btn {
            min-height: 36px;
            padding: 0 13px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 999px;
            color: #d4d4d8;
            font-size: 12.5px;
            font-weight: 750;
            cursor: pointer;
            transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
        }
        .anima-lora-pagination-btn:hover:not(:disabled) {
            background: rgba(11,140,233,0.16);
            color: #fff;
            border-color: rgba(11,140,233,0.38);
            transform: translateY(-1px);
        }
        .anima-lora-pagination-btn:disabled {
            opacity: 0.35;
            cursor: not-allowed;
        }
        .anima-sidebar-btn {
            background: transparent;
            border: none;
            color: #9ca3af;
            padding: 8px 10px;
            border-radius: 8px;
            text-align: left;
            font-size: 12px;
            line-height: 1.25;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: flex-start;
            gap: 8px;
            width: 100%;
            white-space: normal;
        }
        .anima-sidebar-btn:hover {
            background: rgba(255, 255, 255, 0.04);
            color: #f3f4f6;
        }
        .anima-sidebar-btn.active {
            background: rgba(11, 140, 233, 0.15);
            color: #7dd3fc;
            font-weight: 600;
        }
        .anima-sidebar-section {
            margin: 10px 8px 4px;
            padding-top: 10px;
            border-top: 1px solid rgba(255, 255, 255, 0.06);
            color: #6b7280;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }
        .anima-sidebar-section:first-child {
            margin-top: 0;
            padding-top: 0;
            border-top: none;
        }
        .anima-sidebar-btn.anima-sidebar-special {
            background: rgba(255, 255, 255, 0.025);
            border: 1px solid rgba(255, 255, 255, 0.04);
        }
        .anima-sidebar-btn.anima-sidebar-special.active {
            background: rgba(11, 140, 233, 0.18);
            border-color: rgba(11, 140, 233, 0.28);
        }
        .anima-lora-card {
            background: #202022;
            border: 2px solid rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            overflow: hidden;
            display: block;
            position: relative;
            transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
            height: 280px;
            cursor: pointer;
            box-sizing: border-box;
            isolation: isolate;
            contain: layout paint style;
            content-visibility: auto;
            contain-intrinsic-size: 180px 280px;
        }
        .anima-lora-card:hover {
            transform: translateY(-2px);
            border-color: rgba(11, 140, 233, 0.4);
            box-shadow: 0 6px 14px rgba(0, 0, 0, 0.26);
        }
        .anima-lora-card.selected {
            border-color: #0b8ce9;
            box-shadow: 0 0 12px rgba(11, 140, 233, 0.3);
            background: #232327;
        }
        .anima-lora-card-clip {
            position: absolute;
            inset: 2px;
            z-index: 0;
            overflow: hidden;
            border-radius: 13px;
            clip-path: inset(0 round 13px);
            background: #0a0a10;
        }
        .anima-lora-favorite-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(5px);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 9;
            color: #9ca3af;
            font-size: 13px;
            transition: all 0.2s;
            opacity: 0;
        }
        .anima-lora-card:hover .anima-lora-favorite-btn,
        .anima-lora-favorite-btn.active {
            opacity: 1;
        }
        .anima-lora-favorite-btn:hover {
            transform: scale(1.1);
            background: rgba(0, 0, 0, 0.6);
        }
        .anima-lora-favorite-btn.active {
            color: #eab308 !important;
        }
        .anima-lora-card-stat-row {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-top: 6px;
            min-height: 20px;
            overflow: hidden;
        }
        .anima-lora-card-stat-chip {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            height: 20px;
            max-width: 76px;
            padding: 0 7px;
            border-radius: 999px;
            background: rgba(20, 20, 24, 0.78);
            border: 1px solid rgba(255, 255, 255, 0.12);
            color: #f8fafc;
            font-size: 10px;
            font-weight: 700;
            line-height: 1;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
            backdrop-filter: blur(8px);
            white-space: nowrap;
        }
        .anima-lora-card-stat-chip span {
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .anima-lora-copy-toast {
            position: fixed;
            left: 50%;
            bottom: 34px;
            transform: translateX(-50%) translateY(8px);
            padding: 8px 12px;
            border-radius: 999px;
            background: rgba(12, 140, 233, 0.92);
            border: 1px solid rgba(125, 211, 252, 0.55);
            color: #f8fafc;
            font-size: 12px;
            font-weight: 700;
            line-height: 1;
            box-shadow: 0 10px 30px rgba(12, 140, 233, 0.35);
            backdrop-filter: blur(12px);
            opacity: 0;
            transition: opacity 0.18s ease, transform 0.18s ease;
            pointer-events: none;
            z-index: 100002;
        }
        .anima-lora-copy-toast.show {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        .anima-download-bar {
            position: absolute;
            bottom: 0;
            left: 0;
            height: 4px;
            background: #10b981;
            width: 0%;
            transition: width 0.2s;
        }
        .anima-lora-desc {
            font-size: 12px;
            color: #cbd5e1;
            line-height: 1.6;
            letter-spacing: 0.02em;
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.3);
            padding: 12px 14px;
            border-radius: 8px;
            flex: 1 1 150px;
            min-height: 140px;
            max-height: none;
            box-sizing: border-box;
            border: 1px solid rgba(255, 255, 255, 0.04);
            box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
        }
        .anima-lora-desc::-webkit-scrollbar {
            width: 6px;
        }
        .anima-lora-desc::-webkit-scrollbar-track {
            background: transparent;
        }
        .anima-lora-desc::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
        }
        .anima-lora-desc::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.2);
        }
        .anima-lora-desc h1, .anima-lora-desc h2, .anima-lora-desc h3 {
            color: #7dd3fc;
            margin-top: 12px;
            margin-bottom: 6px;
            font-weight: 600;
        }
        .anima-lora-desc h1 { font-size: 14px; }
        .anima-lora-desc h2 { font-size: 13px; }
        .anima-lora-desc h3 { font-size: 12px; }
        .anima-lora-desc p {
            margin: 0 0 8px 0;
            color: #cbd5e1;
        }
        .anima-lora-desc ul, .anima-lora-desc ol {
            margin: 0 0 10px 0;
            padding-left: 18px;
        }
        .anima-lora-desc li {
            margin-bottom: 4px;
        }
        .anima-lora-desc img {
            max-width: 100%;
            height: auto;
            border-radius: 6px;
            margin: 8px 0;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .anima-lora-desc a {
            color: #38bdf8;
            text-decoration: none;
            border-bottom: 1px dashed rgba(56, 189, 248, 0.4);
            transition: all 0.2s;
        }
        .anima-lora-desc a:hover {
            color: #0ea5e9;
            border-bottom-color: #0ea5e9;
        }
        .anima-lora-tag {
            background: rgba(11, 140, 233, 0.12);
            color: #7dd3fc;
            border: 1px solid rgba(11, 140, 233, 0.25);
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 11px;
            cursor: pointer;
            display: inline-block;
            margin: 2px;
            transition: background 0.2s;
        }
        .anima-lora-tag:hover {
            background: rgba(11, 140, 233, 0.25);
        }
        .anima-lora-detail-preview-main {
            width: 100%;
            height: clamp(150px, 36vh, 420px);
            min-height: 140px;
            border-radius: 10px;
            background: #08080a;
            overflow: hidden;
            position: relative;
            flex: 0 1 auto;
        }
        .anima-lora-preview-bg {
            position: absolute;
            inset: -24px;
            width: calc(100% + 48px);
            height: calc(100% + 48px);
            object-fit: cover;
            filter: blur(22px) saturate(1.18) brightness(0.72);
            transform: scale(1.08);
            opacity: 0.82;
            z-index: 0;
            pointer-events: none;
        }
        .anima-lora-preview-bg-overlay {
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at center, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.42));
            z-index: 1;
            pointer-events: none;
        }
        .anima-lora-preview-nav {
            position: absolute;
            top: 50%;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            border: 1px solid rgba(255, 255, 255, 0.18);
            background: rgba(0, 0, 0, 0.55);
            color: #fff;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            font-weight: 700;
            line-height: 1;
            transform: translateY(-50%);
            z-index: 7;
            transition: background 0.16s ease, border-color 0.16s ease, transform 0.16s ease, opacity 0.16s ease;
            opacity: 0.82;
        }
        .anima-lora-preview-nav:hover {
            background: rgba(11, 140, 233, 0.78);
            border-color: rgba(125, 211, 252, 0.75);
            opacity: 1;
        }
        .anima-lora-preview-nav.prev {
            left: 10px;
        }
        .anima-lora-preview-nav.next {
            right: 10px;
        }
        .anima-shimmer {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: linear-gradient(90deg, rgba(20, 20, 30, 0.8) 25%, rgba(11, 140, 233, 0.12) 50%, rgba(20, 20, 30, 0.8) 75%) !important;
            background-size: 200% 100% !important;
            animation: animaShimmer 1.5s infinite linear !important;
            z-index: 2 !important;
            pointer-events: none !important;
        }
        .anima-lora-card.skeleton {
            background: #202022 !important;
            border-color: rgba(255, 255, 255, 0.05) !important;
            pointer-events: none !important;
            box-shadow: none !important;
        }
        #anima-lora-grid-container::-webkit-scrollbar,
        #anima-lora-detail-panel::-webkit-scrollbar {
            width: 8px;
        }
        #anima-lora-grid-container::-webkit-scrollbar-track,
        #anima-lora-detail-panel::-webkit-scrollbar-track {
            background: transparent;
        }
        #anima-lora-grid-container::-webkit-scrollbar-thumb,
        #anima-lora-detail-panel::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.08);
            border-radius: 4px;
        }
        #anima-lora-grid-container::-webkit-scrollbar-thumb:hover,
        #anima-lora-detail-panel::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.15);
        }
        .anima-spinner {
            position: absolute !important;
            top: 50% !important;
            left: 50% !important;
            width: 26px !important;
            height: 26px !important;
            border: 2.5px solid rgba(11, 140, 233, 0.15) !important;
            border-top: 2.5px solid #0b8ce9 !important;
            border-radius: 50% !important;
            animation: animaSpin 0.85s infinite linear !important;
            z-index: 3 !important;
        }
        @keyframes animaShimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
        @keyframes animaSpin {
            0% { transform: translate(-50%, -50%) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @media (max-height: 720px) {
            #anima-lora-container {
                height: 96vh !important;
            }
            #anima-lora-detail-panel {
                padding: 12px !important;
                gap: 9px !important;
            }
            .anima-lora-detail-preview-main {
                height: clamp(120px, 30vh, 240px);
                min-height: 120px;
            }
            .anima-lora-desc {
                min-height: 150px;
                padding: 10px 12px;
            }
        }
        @media (max-height: 560px) {
            .anima-lora-detail-preview-main {
                height: clamp(96px, 24vh, 145px);
                min-height: 96px;
            }
            .anima-lora-desc {
                min-height: 160px;
            }
        }
    `;
    document.head.appendChild(styleSheet);

    // --- Header Section ---
    const header = document.createElement("div");
    header.style.cssText = `
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        display: grid;
        grid-template-columns: 190px minmax(0, 1fr) 340px;
        align-items: center;
        gap: 20px;
        flex-shrink: 0;
    `;

    const titleContainer = document.createElement("div");
    titleContainer.style.cssText = "min-width: 0;";
    const title = document.createElement("h2");
    title.innerText = t("Anima LoRA Selector");
    title.style.cssText = "margin: 0; font-size: 18px; font-weight: 700; color: #ffffff; background: linear-gradient(90deg, #7dd3fc, #0b8ce9); -webkit-background-clip: text; -webkit-text-fill-color: transparent; white-space: nowrap;";
    const subTitle = document.createElement("p");
    subTitle.innerText = "Anima LoRA";
    subTitle.style.cssText = "margin: 4px 0 0 0; font-size: 11px; color: #9ca3af;";
    titleContainer.appendChild(title);
    titleContainer.appendChild(subTitle);

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = t("Search Anima LoRAs...");
    searchInput.style.cssText = `
        flex: 1;
        min-width: 220px;
        background: #222225;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
        padding: 10px 14px;
        color: #ffffff;
        outline: none;
        font-size: 14px;
        transition: border-color 0.2s;
    `;
    searchInput.onfocus = () => searchInput.style.borderColor = "#0b8ce9";
    searchInput.onblur = () => searchInput.style.borderColor = "rgba(255,255,255,0.1)";
    const runSearchFromInput = (forceRefresh = false) => {
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = null;
        }
        const nextQuery = searchInput.value.trim();
        if (query === nextQuery && !forceRefresh) return;
        query = nextQuery;
        cursor = "";
        executeSearch(false, forceRefresh);
    };
    const scheduleSearchFromInput = () => {
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            runSearchFromInput(false);
        }, 420);
    };
    searchInput.oninput = () => {
        scheduleSearchFromInput();
    };
    searchInput.onkeydown = (e) => {
        if (e.key === "Enter") {
            runSearchFromInput(false);
        } else if (e.key === "Escape" && searchInput.value) {
            searchInput.value = "";
            runSearchFromInput(false);
        }
    };

    const centerControls = document.createElement("div");
    centerControls.style.cssText = "display: flex; align-items: center; gap: 10px; min-width: 0; flex-wrap: wrap;";

    const filterRow = document.createElement("div");
    filterRow.style.cssText = "display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap;";

    // Sort Dropdown (Matching Civitai: Highest Rated, Most Downloaded, Newest, Most Liked)
    const sortSelect = document.createElement("select");
    sortSelect.style.cssText = `
        background: #222225;
        color: #fff;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
        padding: 10px;
        outline: none;
        font-size: 13px;
        cursor: pointer;
        max-width: 220px;
    `;
    const sortOptions = [
        { val: "models_v9", label: "相关 / Relevancy" },
        { val: "models_v9:metrics.thumbsUpCount:desc", label: "评分最高 / Highest Rated" },
        { val: "models_v9:metrics.downloadCount:desc", label: "下载最多 / Most Downloaded" },
        { val: "models_v9:metrics.favoriteCount:desc", label: "喜欢最多 / Most Liked" },
        { val: "models_v9:metrics.commentCount:desc", label: "讨论最多 / Most Discussed" },
        { val: "models_v9:metrics.collectedCount:desc", label: "收藏最多 / Most Collected" },
        { val: "models_v9:metrics.tippedAmountCount:desc", label: "打赏最多 / Most Buzz" },
        { val: "models_v9:createdAt:desc", label: "最新发布 / Newest" }
    ];
    sortOptions.forEach(opt => {
        const o = document.createElement("option");
        o.value = opt.val;
        o.innerText = opt.label;
        sortSelect.appendChild(o);
    });
    sortSelect.value = currentSort;
    sortSelect.onchange = () => {
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = null;
        }
        query = searchInput.value.trim();
        currentSort = sortSelect.value;
        cursor = "";
        executeSearch();
    };

    filterRow.appendChild(sortSelect);

    const refreshBtn = document.createElement("button");
    refreshBtn.className = "anima-btn-secondary";
    refreshBtn.innerText = t("Refresh");
    refreshBtn.title = t("Force Refresh / 强制刷新");
    refreshBtn.style.cssText = `
        padding: 8px 12px;
        border-radius: 10px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        transition: all 0.2s;
    `;
    refreshBtn.onmouseover = () => {
        refreshBtn.style.background = "rgba(255, 255, 255, 0.15)";
    };
    refreshBtn.onmouseout = () => {
        refreshBtn.style.background = "rgba(255, 255, 255, 0.08)";
    };
    refreshBtn.onclick = () => {
        runSearchFromInput(true);
    };
    filterRow.appendChild(refreshBtn);

    const clearCacheBtn = document.createElement("button");
    clearCacheBtn.className = "anima-btn-secondary";
    clearCacheBtn.innerText = t("Clear Cache");
    clearCacheBtn.title = t("Clear Cache / 清除本地缓存");
    clearCacheBtn.style.cssText = `
        padding: 8px 12px;
        border-radius: 10px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        transition: all 0.2s;
    `;
    clearCacheBtn.onmouseover = () => {
        clearCacheBtn.style.background = "rgba(255, 255, 255, 0.15)";
    };
    clearCacheBtn.onmouseout = () => {
        clearCacheBtn.style.background = "rgba(255, 255, 255, 0.08)";
    };
    clearCacheBtn.onclick = async () => {
        if (clearCacheBtn.disabled) return;
        const originalText = clearCacheBtn.innerText;
        clearCacheBtn.disabled = true;
        clearCacheBtn.innerText = t("Clearing...");
        try {
            await clearLoraSelectorCaches();
            await refreshManifest({ rerender: false });
            runSearchFromInput(true);
        } finally {
            clearCacheBtn.disabled = false;
            clearCacheBtn.innerText = originalText;
        }
    };
    filterRow.appendChild(clearCacheBtn);

    const actionRow = document.createElement("div");
    actionRow.style.cssText = "display: flex; align-items: center; justify-content: flex-end; gap: 12px;";

    const settingsBtn = document.createElement("button");
    settingsBtn.innerHTML = "⚙️";
    settingsBtn.className = "anima-btn-secondary";
    settingsBtn.style.padding = "10px";
    settingsBtn.title = "Settings / 设置";
    settingsBtn.onclick = () => openSettingsModal();

    actionRow.appendChild(createPromoLinks({ accentColor: "#0b8ce9" }));
    actionRow.appendChild(settingsBtn);
    centerControls.appendChild(searchInput);
    centerControls.appendChild(filterRow);

    header.appendChild(titleContainer);
    header.appendChild(centerControls);
    header.appendChild(actionRow);

    // --- Split Layout (Sidebar + List + Detail Sidebar) ---
    const modalBody = document.createElement("div");
    modalBody.style.cssText = `
        flex: 1;
        min-height: 0;
        display: flex;
        overflow: hidden;
        width: 100%;
        height: 100%;
    `;

    // 1. Left Sidebar (width: 170px)
    const sidebar = document.createElement("div");
    sidebar.style.cssText = `
        width: 190px;
        background: #111112;
        border-right: 1px solid rgba(255, 255, 255, 0.05);
        display: flex;
        flex-direction: column;
        padding: 16px 8px;
        gap: 6px;
        flex-shrink: 0;
        overflow-y: auto;
    `;

    const categoryGroups = [
        {
            title: "浏览 / Browse",
            items: [
                { id: "all", label: "全部 / All", category: "", special: true }
            ]
        },
        {
            title: "分类 / Category",
            items: [
                { id: "action", label: "动作 / Action", category: "action" },
                { id: "animal", label: "动物 / Animal", category: "animal" },
                { id: "assets", label: "素材 / Assets", category: "assets" },
                { id: "background", label: "背景 / Background", category: "background" },
                { id: "base model", label: "基础模型 / Base Model", category: "base model" },
                { id: "buildings", label: "建筑 / Buildings", category: "buildings" },
                { id: "celebrity", label: "名人 / Celebrity", category: "celebrity" },
                { id: "character", label: "角色 / Character", category: "character" },
                { id: "clothing", label: "服装 / Clothing", category: "clothing" },
                { id: "concept", label: "概念 / Concept", category: "concept" },
                { id: "objects", label: "物品 / Objects", category: "objects" },
                { id: "poses", label: "姿势 / Poses", category: "poses" },
                { id: "style", label: "风格 / Style", category: "style" },
                { id: "tool", label: "工具 / Tool", category: "tool" },
                { id: "vehicle", label: "载具 / Vehicle", category: "vehicle" }
            ]
        },
        {
            title: "本地 / Local",
            items: [
                { id: "downloaded", label: "已下载 / Downloaded", special: true },
                { id: "loaded", label: "已加载 / Loaded", special: true },
                { id: "favorites", label: "收藏 / Favorites", special: true }
            ]
        }
    ];
    const categories = categoryGroups.flatMap(group => group.items);

    function buildSearchUrl(loadNext = false) {
        const activeCat = categories.find(c => c.id === currentCategory);
        const activeCategory = activeCat ? activeCat.category || "" : "";
        let searchUrl = `/anima-tools/lora/search?query=${encodeURIComponent(query)}&category=${encodeURIComponent(activeCategory)}&sort=${encodeURIComponent(currentSort)}&limit=40`;
        if (loadNext && cursor) {
            searchUrl += `&cursor=${encodeURIComponent(cursor)}`;
        }
        return searchUrl;
    }

    function tryRenderCachedSearchPage() {
        if (currentCategory === "downloaded" || currentCategory === "loaded" || currentCategory === "favorites") return false;
        const searchUrl = buildSearchUrl(false);
        const cached = civitaiSearchCache.get(searchUrl);
        if (!cached || Date.now() - cached.timestamp >= CIVITAI_SEARCH_CACHE_TTL) return false;
        pageHistory = [];
        const pageState = {
            searchUrl,
            items: cached.data.items || [],
            nextCursor: (cached.data.metadata && cached.data.metadata.nextCursor) ? cached.data.metadata.nextCursor : ""
        };
        applySearchPage(pageState, `Found ${pageState.items.length} Anima models (Cached).`);
        return true;
    }

    const sidebarButtons = {};
    categoryGroups.forEach(group => {
        const section = document.createElement("div");
        section.className = "anima-sidebar-section";
        section.innerText = group.title;
        sidebar.appendChild(section);

        group.items.forEach(cat => {
        const btn = document.createElement("button");
        btn.className = "anima-sidebar-btn";
            if (cat.special) btn.classList.add("anima-sidebar-special");
        if (cat.id === currentCategory) btn.classList.add("active");
        btn.innerText = cat.label;
        btn.onclick = () => {
            if (currentCategory === cat.id) return;
            Object.values(sidebarButtons).forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentCategory = cat.id;
            cursor = "";
            if (searchDebounceTimer) {
                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = null;
            }
            query = searchInput.value.trim();
            executeSearch();
        };
        sidebar.appendChild(btn);
        sidebarButtons[cat.id] = btn;
        });
    });

    // 2. Center List Content Area
    const contentArea = document.createElement("div");
    contentArea.style.cssText = `
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        height: 100%;
    `;

    const gridContainer = document.createElement("div");
    gridContainer.id = "anima-lora-grid-container";
    gridContainer.style.cssText = `
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        scrollbar-gutter: stable;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 20px;
        align-content: start;
    `;

    // Center Footer
    const footer = document.createElement("div");
    footer.className = "anima-lora-pagination";

    const infoText = document.createElement("span");
    infoText.className = "anima-lora-pagination-stats";
    
    const pagButtons = document.createElement("div");
    pagButtons.className = "anima-lora-pagination-controls";

    const prevBtn = document.createElement("button");
    prevBtn.innerText = t("Prev");
    prevBtn.className = "anima-lora-pagination-btn";
    prevBtn.disabled = true;
    prevBtn.onclick = () => {
        restorePreviousPage();
    };

    const nextBtn = document.createElement("button");
    nextBtn.innerText = t("Next");
    nextBtn.className = "anima-lora-pagination-btn";
    nextBtn.disabled = true;
    nextBtn.onclick = () => {
        if (cursor) {
            executeSearch(true);
        }
    };

    pagButtons.appendChild(prevBtn);
    pagButtons.appendChild(nextBtn);
    footer.appendChild(infoText);
    footer.appendChild(pagButtons);

    contentArea.appendChild(gridContainer);
    contentArea.appendChild(footer);

    // 3. Right Detail Panel Sidebar (width: 340px)
    const detailPanel = document.createElement("div");
    detailPanel.id = "anima-lora-detail-panel";
    detailPanel.style.cssText = `
        width: 340px;
        box-sizing: border-box;
        background: #1a1a1c;
        border-left: 1px solid rgba(255, 255, 255, 0.06);
        display: flex;
        flex-direction: column;
        padding: 20px;
        gap: 14px;
        min-height: 0;
        overflow-y: auto;
        scrollbar-gutter: stable;
        flex-shrink: 0;
    `;

    // Render empty state initially
    renderDetailEmptyState();

    modalBody.appendChild(sidebar);
    modalBody.appendChild(contentArea);
    modalBody.appendChild(detailPanel);

    modalContainer.appendChild(header);
    modalContainer.appendChild(modalBody);
    modalOverlay.appendChild(modalContainer);
    document.body.appendChild(modalOverlay);

    const previewObserver = "IntersectionObserver" in window
        ? new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const target = entry.target;
                previewObserver.unobserve(target);
                target.__animaStartPreview?.();
            });
        }, { root: gridContainer, rootMargin: "700px 0px" })
        : null;

    function schedulePreviewLoad(element, startLoad, index, immediateCount = INITIAL_CARD_PREVIEW_LOADS) {
        element.__animaStartPreview = startLoad;
        if (index < immediateCount || !previewObserver) {
            startLoad();
        } else {
            requestAnimationFrame(() => {
                if (element.isConnected) {
                    previewObserver.observe(element);
                }
            });
        }
    }

    function resetPreviewObserver() {
        previewObserver?.disconnect();
    }

    function clearGridForRender() {
        previewRenderGeneration += 1;
        resetPreviewObserver();
        gridContainer.querySelectorAll("img, video").forEach(el => {
            try {
                el.removeAttribute("src");
                if (typeof el.load === "function") el.load();
            } catch (_) {}
        });
        gridContainer.innerHTML = "";
        return previewRenderGeneration;
    }

    function updatePaginationButtons() {
        prevBtn.disabled = isSearching || pageHistory.length === 0 || currentCategory === "downloaded" || currentCategory === "loaded" || currentCategory === "favorites";
        nextBtn.disabled = isSearching || !cursor || currentCategory === "downloaded" || currentCategory === "loaded" || currentCategory === "favorites";
    }

    function applySearchPage(pageState, message = "") {
        searchResults = Array.isArray(pageState.items) ? pageState.items : [];
        cursor = pageState.nextCursor || "";
        currentPageState = {
            searchUrl: pageState.searchUrl || "",
            items: searchResults,
            nextCursor: cursor,
            message
        };
        renderGrid();
        updatePaginationButtons();
        infoText.innerText = message || `Found ${searchResults.length} Anima models.`;
    }

    function restorePreviousPage() {
        if (isSearching || pageHistory.length === 0) return;
        const previous = pageHistory.pop();
        resetSelectedPreviewState();
        selectedModel = null;
        selectedVersion = null;
        renderDetailEmptyState();
        applySearchPage(previous, previous.message || `Found ${previous.items?.length || 0} Anima models (Cached).`);
    }

    // Render skeleton placeholders initially before async data loads
    const hasSyncManifest = loadCachedManifestSync();
    const renderedCachedSearch = tryRenderCachedSearchPage();
    if (renderedCachedSearch) {
        // Search cache has already painted the first page.
    } else if (hasSyncManifest && currentCategory === "downloaded") {
        renderDownloadedOnly();
    } else if (hasSyncManifest && currentCategory === "loaded") {
        renderLoadedOnly();
    } else {
        gridContainer.innerHTML = getSkeletonHtml(40);
        loadCachedManifest().then((hasCached) => {
            if (hasCached && currentCategory === "downloaded") {
                renderDownloadedOnly();
            } else if (hasCached && currentCategory === "loaded") {
                renderLoadedOnly();
            }
        });
    }

    // Start background asynchronous data fetch
    setTimeout(async () => {
        const manifestRefreshPromise = refreshManifest();
        try {
            const promises = [];
            if (!globalLoraConfig) {
                promises.push(fetch("/anima-tools/lora/config").then(r => r.ok ? r.json() : null).then(data => {
                    if (data) globalLoraConfig = data;
                }));
            }
            if (!globalLoraManifest && !globalLocalLoras) {
                promises.push(fetch("/anima-tools/lora/local").then(r => r.ok ? r.json() : null).then(data => {
                    if (Array.isArray(data)) globalLocalLoras = data;
                }));
            }
            if (!globalFavorites) {
                promises.push(fetch("/anima-tools/favorites").then(r => r.ok ? r.json() : null).then(data => {
                    if (data) globalFavorites = data;
                }));
            }
            promises.push(fetch("/anima-tools/lora/download-status").then(r => r.ok ? r.json() : null).then(data => {
                if (data) activeDownloads = data;
            }));

            if (promises.length > 0) {
                await Promise.all(promises);
            }

            if (globalLoraConfig) config = globalLoraConfig;
            if (globalLoraManifest) applyManifest(globalLoraManifest);
            else if (globalLocalLoras) localLoras = globalLocalLoras;
            if (globalFavorites && globalFavorites.lora) {
                favoritesConfig.lora = globalFavorites.lora;
            }
        } catch (e) {
            console.error("[Anima Tools] Failed to initialize data", e);
        }

        // Once initial data is ready, run first search query
        executeSearch();
        manifestRefreshPromise.then((changed) => {
            if (!changed) return;
            if (currentCategory === "downloaded") {
                renderDownloadedOnly();
            } else if (currentCategory === "loaded") {
                renderLoadedOnly();
            } else if (!isSearching && searchResults.length > 0) {
                renderGrid();
            }
        });

        // Start polling download status
        pollInterval = setInterval(updateDownloadsProgress, 1000);
    }, 50);

    // Close Handler
    function closeModal() {
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        if (pollInterval) clearInterval(pollInterval);
        resetPreviewObserver();
        document.head.removeChild(styleSheet);
        modalOverlay.remove();
    }

    // --- Search Execution ---
    async function executeSearch(loadNext = false, forceRefresh = false) {
        isSearching = true;
        const requestSeq = ++searchRequestSeq;
        updatePaginationButtons();
        
        // Clear selected state
        resetSelectedPreviewState();
        selectedModel = null;
        selectedVersion = null;
        renderDetailEmptyState();

        if (currentCategory === "downloaded") {
            isSearching = false;
            pageHistory = [];
            currentPageState = null;
            updatePaginationButtons();
            renderDownloadedOnly();
            return;
        }

        if (currentCategory === "loaded") {
            isSearching = false;
            pageHistory = [];
            currentPageState = null;
            updatePaginationButtons();
            renderLoadedOnly();
            return;
        }

        if (currentCategory === "favorites") {
            isSearching = false;
            pageHistory = [];
            currentPageState = null;
            updatePaginationButtons();
            renderFavoritesOnly();
            return;
        }

        const searchUrl = buildSearchUrl(loadNext);

        if (!loadNext) {
            pageHistory = [];
            currentPageState = null;
        }

        if (forceRefresh) {
            civitaiSearchCache.delete(searchUrl);
        }
        const cached = civitaiSearchCache.get(searchUrl);
        if (!forceRefresh && cached && (Date.now() - cached.timestamp < CIVITAI_SEARCH_CACHE_TTL)) {
            if (requestSeq !== searchRequestSeq) return;
            const previousState = loadNext && currentPageState ? { ...currentPageState, items: [...currentPageState.items] } : null;
            const pageState = {
                searchUrl,
                items: cached.data.items || [],
                nextCursor: (cached.data.metadata && cached.data.metadata.nextCursor) ? cached.data.metadata.nextCursor : ""
            };
            if (previousState) pageHistory.push(previousState);
            applySearchPage(pageState, `Found ${pageState.items.length} Anima models (Cached).`);
            isSearching = false;
            updatePaginationButtons();
            return;
        }

        clearGridForRender();
        gridContainer.innerHTML = getSkeletonHtml(40);
        infoText.innerText = "Querying...";

        try {
            const resp = await fetch(searchUrl);
            if (requestSeq !== searchRequestSeq) return;
            if (resp.ok) {
                const data = await resp.json();
                if (requestSeq !== searchRequestSeq) return;
                civitaiSearchCache.set(searchUrl, { data: data, timestamp: Date.now() });
                const previousState = loadNext && currentPageState ? { ...currentPageState, items: [...currentPageState.items] } : null;
                const pageState = {
                    searchUrl,
                    items: data.items || [],
                    nextCursor: (data.metadata && data.metadata.nextCursor) ? data.metadata.nextCursor : ""
                };
                if (previousState) pageHistory.push(previousState);
                applySearchPage(pageState, `Found ${pageState.items.length} Anima models on this page.`);
            } else {
                gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 40px;">Failed to load data from server.</div>`;
            }
        } catch (e) {
            if (requestSeq !== searchRequestSeq) return;
            console.error(e);
            gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 40px;">Network error occurred.</div>`;
        } finally {
            if (requestSeq === searchRequestSeq) {
                isSearching = false;
                updatePaginationButtons();
            }
        }
    }

    // --- Grid Rendering ---
    function renderGrid() {
        const renderGeneration = clearGridForRender();
        
        if (searchResults.length === 0) {
            gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #9ca3af; padding: 40px;">${t("No Anima LoRAs found")}</div>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        for (const [index, model] of searchResults.entries()) {
            const card = document.createElement("div");
            card.className = "anima-lora-card";
            if (selectedModel && String(selectedModel.id) === String(model.id)) {
                card.classList.add("selected");
            }
            const cardClip = document.createElement("div");
            cardClip.className = "anima-lora-card-clip";
            card.appendChild(cardClip);

            const versions = model.modelVersions || [];
            const firstVersion = versions[0] || {};
            const files = firstVersion.files || [];
            const safetensorFile = files.find(f => f.name.endsWith(".safetensors")) || files[0] || {};
            const filename = safetensorFile.name || `${model.name}.safetensors`;

            // Card Image
            const imgContainer = document.createElement("div");
            imgContainer.style.cssText = "position: absolute; inset: 0; width: 100%; height: 100%; background: transparent; overflow: hidden;";
            
            let previewUrl = "";
            let isVideo = false;
            const localPath = localLoras.find(l => l === filename || l.endsWith(filename));
            const isLocal = !!localPath;
            if (isLocal) {
                previewUrl = getLocalPreviewUrl(localPath, LORA_LOCAL_CARD_PREVIEW_WIDTH);
                const localManifest = getManifestItem(localPath);
                if (localManifest && !localManifest.has_preview && localManifest.meta_summary?.preview_url) {
                    previewUrl = getRemotePreviewUrl(localManifest.meta_summary.preview_url, LORA_CARD_PREVIEW_WIDTH);
                }
            } else {
                const images = firstVersion.images || [];
                if (images.length > 0) {
                    previewUrl = images[0].url || "";
                    if (images[0].type === "video" || (previewUrl && (previewUrl.toLowerCase().includes(".mp4") || previewUrl.toLowerCase().includes(".webm") || previewUrl.toLowerCase().includes(".ogv")))) {
                        isVideo = true;
                    }
                    if (!isVideo && previewUrl) {
                        previewUrl = getPreviewImageUrl(images[0], LORA_CARD_PREVIEW_WIDTH);
                    }
                }
            }
            
            const mediaElement = isVideo ? document.createElement("video") : document.createElement("img");
            mediaElement.style.cssText = "width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);";
            
            if (isVideo) {
                mediaElement.muted = true;
                mediaElement.loop = true;
                mediaElement.playsInline = true;
                mediaElement.autoplay = true;
                mediaElement.controls = false;
            } else {
                mediaElement.loading = index < INITIAL_CARD_PREVIEW_LOADS ? "eager" : "lazy";
                mediaElement.fetchPriority = index < INITIAL_CARD_PREVIEW_LOADS ? "high" : "low";
            }
            
            let loader = null;
            if (previewUrl) {
                if (isVideo) {
                    mediaElement.onloadeddata = () => {
                        mediaElement.style.opacity = "1";
                        loader?.remove();
                    };
                    mediaElement.onerror = () => {
                        mediaElement.style.display = "none";
                        loader?.remove();
                        const fallback = document.createElement("img");
                        fallback.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23222'/><text x='50%' y='50%' font-size='10' fill='%23666' dominant-baseline='middle' text-anchor='middle'>No Preview</text></svg>";
                        fallback.style.cssText = "width: 100%; height: 100%; object-fit: cover;";
                        imgContainer.appendChild(fallback);
                    };
                    schedulePreviewLoad(mediaElement, () => {
                        if (renderGeneration !== previewRenderGeneration) return;
                        if (mediaElement.dataset.loadStarted === "1") return;
                        mediaElement.dataset.loadStarted = "1";
                        loader = createPreviewLoader(imgContainer);
                        mediaElement.src = previewUrl;
                    }, index);
                } else if (isImageLoaded(previewUrl)) {
                    // 缓存命中：浏览器 HTTP 缓存会瞬间返回，跳过 spinner 直接显示
                    mediaElement.src = previewUrl;
                    mediaElement.style.opacity = "1";
                } else {
                    mediaElement.onload = () => {
                        mediaElement.style.opacity = "1";
                        loader?.remove();
                        markImageLoaded(previewUrl);
                    };
                    mediaElement.onerror = () => {
                        if (retryRemotePreviewLoad(mediaElement, previewUrl)) return;
                        mediaElement.style.display = "none";
                        loader?.remove();
                        const fallback = document.createElement("img");
                        fallback.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23222'/><text x='50%' y='50%' font-size='10' fill='%23666' dominant-baseline='middle' text-anchor='middle'>No Preview</text></svg>";
                        fallback.style.cssText = "width: 100%; height: 100%; object-fit: cover;";
                        imgContainer.appendChild(fallback);
                    };
                    schedulePreviewLoad(mediaElement, () => {
                        if (renderGeneration !== previewRenderGeneration) return;
                        if (mediaElement.dataset.loadStarted === "1") return;
                        mediaElement.dataset.loadStarted = "1";
                        loader = createPreviewLoader(imgContainer);
                        mediaElement.src = previewUrl;
                    }, index);
                }
            } else {
                mediaElement.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23222'/><text x='50%' y='50%' font-size='10' fill='%23666' dominant-baseline='middle' text-anchor='middle'>No Preview</text></svg>";
                mediaElement.style.opacity = "1";
            }
            
            card.onmouseenter = () => {
                mediaElement.style.transform = "scale(1.06)";
            };
            card.onmouseleave = () => {
                mediaElement.style.transform = "scale(1)";
            };
            imgContainer.appendChild(mediaElement);

            // Download progress bar
            const dlBar = document.createElement("div");
            dlBar.className = "anima-download-bar";
            dlBar.id = `dl-bar-${firstVersion.id}`;
            imgContainer.appendChild(dlBar);
            
            const activeJob = activeDownloads[firstVersion.id];
            if (activeJob && (activeJob.status === "pending" || activeJob.status === "downloading")) {
                const percent = activeJob.total ? Math.round((activeJob.progress / activeJob.total) * 100) : 0;
                dlBar.style.width = `${percent}%`;
            }

            // Floating Star Button (Favorites)
            const favBtn = document.createElement("div");
            favBtn.className = "anima-lora-favorite-btn";
            favBtn.style.zIndex = "8";
            const isFav = favoritesConfig.lora.items.some(item => String(item.id) === String(model.id));
            if (isFav) {
                favBtn.classList.add("active");
                favBtn.innerHTML = "★";
            } else {
                favBtn.innerHTML = "☆";
            }
            favBtn.onclick = (e) => {
                e.stopPropagation();
                toggleFavorite(model, favBtn);
            };
            imgContainer.appendChild(favBtn);

            // Local status overlay dot
            if (isLocal) {
                const statusDot = document.createElement("div");
                statusDot.style.cssText = "position: absolute; top: 8px; left: 8px; width: 10px; height: 10px; border-radius: 50%; background: #10b981; border: 2px solid #202022; z-index: 8;";
                statusDot.title = "Downloaded";
                imgContainer.appendChild(statusDot);
            }

            // Card Body Info (Floating text metadata with gradient overlay)
            const body = document.createElement("div");
            body.style.cssText = `
                position: absolute;
                bottom: 0;
                left: 0;
                width: 100%;
                background: linear-gradient(to top, rgba(10, 10, 15, 0.95) 0%, rgba(10, 10, 15, 0.6) 60%, rgba(10, 10, 15, 0) 100%);
                padding: 40px 12px 12px 12px;
                display: flex;
                flex-direction: column;
                gap: 2px;
                overflow: hidden;
                box-sizing: border-box;
                z-index: 5;
                pointer-events: none;
            `;
            
            const modelName = document.createElement("div");
            modelName.innerText = model.name || "Unnamed Model";
            modelName.style.cssText = "font-size: 12px; font-weight: 700; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-shadow: 0 1px 4px rgba(0,0,0,0.85);";
            
            const author = document.createElement("div");
            author.innerText = `by ${model.creator?.username || "Unknown"}`;
            author.style.cssText = "font-size: 10px; color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-shadow: 0 1px 3px rgba(0,0,0,0.85);";

            const stats = getModelStats(model, firstVersion);
            const statRow = document.createElement("div");
            statRow.className = "anima-lora-card-stat-row";

            const downloadChip = document.createElement("div");
            downloadChip.className = "anima-lora-card-stat-chip";
            downloadChip.title = "Downloads";
            downloadChip.innerHTML = `<span>↓</span><span>${formatStatCount(stats.downloadCount)}</span>`;

            const likeChip = document.createElement("div");
            likeChip.className = "anima-lora-card-stat-chip";
            likeChip.title = "Likes";
            likeChip.innerHTML = `<span>♥</span><span>${formatStatCount(stats.likeCount)}</span>`;

            statRow.appendChild(downloadChip);
            statRow.appendChild(likeChip);
            
            body.appendChild(modelName);
            body.appendChild(author);
            body.appendChild(statRow);

            imgContainer.appendChild(body);
            cardClip.appendChild(imgContainer);
            
            // Onclick: Preview Details in right sidebar
            card.onclick = () => {
                // Remove selected borders from other cards
                const allCards = gridContainer.querySelectorAll(".anima-lora-card");
                allCards.forEach(c => c.classList.remove("selected"));
                card.classList.add("selected");
                
                resetSelectedPreviewState();
                selectedModel = model;
                selectedVersion = firstVersion;
                renderModelDetail();
                hydrateSelectedModelDetail(model.id, firstVersion.id);
            };

            fragment.appendChild(card);
        }
        gridContainer.appendChild(fragment);
    }

    // --- Render Model Detail Panel (Right Sidebar) ---
    function renderModelDetail() {
        if (!selectedModel || !selectedVersion) {
            renderDetailEmptyState();
            return;
        }

        detailPanel.innerHTML = "";

        // 1. Preview gallery
        const imgContainer = document.createElement("div");
        imgContainer.className = "anima-lora-detail-preview-main";
        
        const files = selectedVersion.files || [];
        const safetensorFile = files.find(f => f.name.endsWith(".safetensors")) || files[0] || {};
        const filename = safetensorFile.name || `${selectedModel.name}.safetensors`;
        const localPath = localLoras.find(l => l === filename || l.endsWith(filename));
        const isLocal = !!localPath;

        const modelId = selectedModel.id;
        const isCivitaiModel = modelId && !isNaN(Number(modelId)) && !String(modelId).endsWith(".safetensors");

        const noPreviewSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='150' viewBox='0 0 100 150'><rect width='100' height='150' fill='%23222'/><text x='50%' y='50%' font-size='10' fill='%23666' dominant-baseline='middle' text-anchor='middle'>No Preview</text></svg>";

        const isVideoPreview = (image, url) => {
            const lowerUrl = String(url || "").toLowerCase();
            return image?.type === "video" || lowerUrl.includes(".mp4") || lowerUrl.includes(".webm") || lowerUrl.includes(".ogv");
        };

        const createFallbackPreview = () => {
            const fallback = document.createElement("img");
            fallback.src = noPreviewSvg;
            fallback.style.cssText = "width: 100%; height: 100%; object-fit: contain; background: #000; position: relative; z-index: 2;";
            return fallback;
        };

        const addBlurredPreviewBackground = (item) => {
            if (!item?.url || item.url === noPreviewSvg) return;
            const bg = item.isVideo ? document.createElement("video") : document.createElement("img");
            bg.className = "anima-lora-preview-bg";
            if (item.isVideo) {
                bg.muted = true;
                bg.loop = true;
                bg.playsInline = true;
                bg.autoplay = true;
                bg.controls = false;
            }
            bg.src = item.url;
            const overlay = document.createElement("div");
            overlay.className = "anima-lora-preview-bg-overlay";
            imgContainer.appendChild(bg);
            imgContainer.appendChild(overlay);
        };

        const getPreviewItems = () => {
            if (isLocal) {
                let localPreviewUrl = getLocalPreviewUrl(localPath, LORA_DETAIL_PREVIEW_WIDTH);
                const localManifest = getManifestItem(localPath);
                if (localManifest && !localManifest.has_preview && localManifest.meta_summary?.preview_url) {
                    localPreviewUrl = getRemotePreviewUrl(localManifest.meta_summary.preview_url, LORA_DETAIL_PREVIEW_WIDTH);
                }
                return localPreviewUrl ? [{
                    url: localPreviewUrl,
                    sourceUrl: localManifest?.meta_summary?.preview_url || localPreviewUrl,
                    thumbUrl: localPreviewUrl,
                    isVideo: false
                }] : [];
            }

            const images = selectedVersion.images || [];
            const orderedImages = [
                ...images.filter(img => !isVideoPreview(img, img?.url || img?.thumbnailUrl || "")),
                ...images.filter(img => isVideoPreview(img, img?.url || img?.thumbnailUrl || ""))
            ];

            return orderedImages
                .map(image => {
                    const rawUrl = image?.url || image?.thumbnailUrl || "";
                    if (!rawUrl) return null;
                    const isVideo = isVideoPreview(image, rawUrl);
                    return {
                        url: isVideo ? rawUrl : getPreviewImageUrl(image, LORA_DETAIL_PREVIEW_WIDTH),
                        sourceUrl: rawUrl,
                        thumbUrl: isVideo ? rawUrl : getPreviewImageUrl(image, 160),
                        isVideo
                    };
                })
                .filter(Boolean);
        };

        const previewItems = getPreviewItems();
        let currentPreviewIndex = previewItems.length > 0
            ? Math.min(Math.max(selectedPreviewIndex, 0), previewItems.length - 1)
            : 0;
        if (selectedPreviewUrl) {
            const preservedPreviewIndex = previewItems.findIndex(item => item.url === selectedPreviewUrl);
            if (preservedPreviewIndex !== -1) {
                currentPreviewIndex = preservedPreviewIndex;
            }
        }
        let detailPreviewGeneration = 0;

        function renderMainPreview(index) {
            const renderGeneration = ++detailPreviewGeneration;
            const isCurrentPreviewRender = () => renderGeneration === detailPreviewGeneration;
            if (previewItems.length > 0) {
                currentPreviewIndex = (index + previewItems.length) % previewItems.length;
            } else {
                currentPreviewIndex = 0;
            }
            imgContainer.innerHTML = "";

            const item = previewItems[currentPreviewIndex] || { url: noPreviewSvg, isVideo: false };
            selectedPreviewIndex = currentPreviewIndex;
            selectedPreviewUrl = item.url || "";
            addBlurredPreviewBackground(item);
            const mediaElement = item.isVideo ? document.createElement("video") : document.createElement("img");
            mediaElement.style.cssText = "width: 100%; height: 100%; object-fit: contain; background: transparent; cursor: zoom-in; opacity: 0; transition: opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1); position: relative; z-index: 2;";

            if (item.isVideo) {
                mediaElement.muted = true;
                mediaElement.loop = true;
                mediaElement.playsInline = true;
                mediaElement.autoplay = true;
                mediaElement.controls = false;
            }

            if (item.url && item.url !== noPreviewSvg) {
                mediaElement.onclick = () => window.open(item.sourceUrl || item.url, "_blank");
            }

            let loader = null;
            const showLoader = () => {
                loader = document.createElement("div");
                const spinner = document.createElement("div");
                spinner.className = "anima-spinner";
                loader.appendChild(spinner);
                imgContainer.appendChild(loader);
                clearStaleLoader(loader);
            };

            if (!item.url || item.url === noPreviewSvg) {
                mediaElement.src = noPreviewSvg;
                mediaElement.style.opacity = "1";
            } else if (item.isVideo) {
                showLoader();
                mediaElement.onloadeddata = () => {
                    if (!isCurrentPreviewRender()) return;
                    mediaElement.style.opacity = "1";
                    loader?.remove();
                };
                mediaElement.onerror = () => {
                    if (!isCurrentPreviewRender()) return;
                    mediaElement.remove();
                    loader?.remove();
                    imgContainer.appendChild(createFallbackPreview());
                };
                mediaElement.src = item.url;
            } else {
                if (isImageLoaded(item.url)) {
                    mediaElement.style.opacity = "1";
                } else {
                    showLoader();
                }
                mediaElement.onload = () => {
                    if (!isCurrentPreviewRender()) return;
                    mediaElement.style.opacity = "1";
                    loader?.remove();
                    markImageLoaded(item.url);
                };
                mediaElement.onerror = () => {
                    if (!isCurrentPreviewRender()) return;
                    if (retryRemotePreviewLoad(mediaElement, item.url)) return;
                    mediaElement.remove();
                    loader?.remove();
                    if (!isCivitaiModel) {
                        const video = document.createElement("video");
                        video.style.cssText = "width: 100%; height: 100%; object-fit: contain; background: transparent; cursor: zoom-in; opacity: 0; transition: opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1); position: relative; z-index: 2;";
                        video.muted = true;
                        video.loop = true;
                        video.playsInline = true;
                        video.autoplay = true;
                        video.controls = false;
                        video.onclick = () => window.open(item.sourceUrl || item.url, "_blank");
                        video.onloadeddata = () => {
                            if (!isCurrentPreviewRender()) return;
                            video.style.opacity = "1";
                        };
                        video.onerror = () => {
                            if (!isCurrentPreviewRender()) return;
                            video.remove();
                            imgContainer.appendChild(createFallbackPreview());
                        };
                        video.src = item.url;
                        imgContainer.appendChild(video);
                    } else {
                        imgContainer.appendChild(createFallbackPreview());
                    }
                };
                mediaElement.src = item.url;
            }
            imgContainer.appendChild(mediaElement);

            if (previewItems.length > 1) {
                const makeNavButton = (direction) => {
                    const btn = document.createElement("button");
                    btn.type = "button";
                    btn.className = `anima-lora-preview-nav ${direction < 0 ? "prev" : "next"}`;
                    btn.innerText = direction < 0 ? "<" : ">";
                    btn.title = direction < 0 ? "Previous preview" : "Next preview";
                    btn.onclick = (event) => {
                        event.stopPropagation();
                        renderMainPreview(currentPreviewIndex + direction);
                    };
                    return btn;
                };
                imgContainer.appendChild(makeNavButton(-1));
                imgContainer.appendChild(makeNavButton(1));
            }
        }

        renderMainPreview(currentPreviewIndex);

        // 2. Info Row
        const titleRow = document.createElement("div");
        titleRow.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
        
        const titleText = document.createElement(isCivitaiModel ? "a" : "div");
        titleText.innerText = selectedModel.name;
        
        if (isCivitaiModel) {
            titleText.href = `https://civitai.com/models/${modelId}`;
            titleText.target = "_blank";
            titleText.title = "View on Civitai / 在 C 站查看";
            titleText.style.cssText = "font-size: 16px; font-weight: 700; color: #fff; line-height: 1.3; text-decoration: none; display: inline-flex; align-items: center; transition: color 0.2s;";
            
            // Add SVG external link icon
            const iconSpan = document.createElement("span");
            iconSpan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 5px; display: inline-block; transition: stroke 0.2s;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
            titleText.appendChild(iconSpan);
            
            titleText.onmouseenter = () => {
                titleText.style.color = "#38bdf8";
                const svg = iconSpan.querySelector("svg");
                if (svg) svg.setAttribute("stroke", "#38bdf8");
            };
            titleText.onmouseleave = () => {
                titleText.style.color = "#fff";
                const svg = iconSpan.querySelector("svg");
                if (svg) svg.setAttribute("stroke", "#9ca3af");
            };
        } else {
            titleText.style.cssText = "font-size: 16px; font-weight: 700; color: #fff; line-height: 1.3; cursor: default;";
        }
        
        const authorText = document.createElement("div");
        authorText.innerText = `by ${selectedModel.creator?.username || "Unknown"}`;
        authorText.style.cssText = "font-size: 11px; color: #9ca3af;";
        
        titleRow.appendChild(titleText);
        titleRow.appendChild(authorText);

        // 3. Version Select Dropdown
        const verContainer = document.createElement("div");
        verContainer.style.cssText = "display: flex; flex-direction: column; gap: 6px;";
        
        const verLabel = document.createElement("div");
        verLabel.innerText = "Versions / 模型版本:";
        verLabel.style.cssText = "font-size: 11px; color: #9ca3af; font-weight: 600;";
        
        const verSelect = document.createElement("select");
        verSelect.style.cssText = `
            background: #252528;
            color: #fff;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 8px;
            padding: 8px;
            font-size: 12px;
            outline: none;
            cursor: pointer;
        `;
        const versions = selectedModel.modelVersions || [];
        versions.forEach(v => {
            const opt = document.createElement("option");
            opt.value = v.id;
            opt.innerText = v.name || "Unnamed Version";
            if (String(v.id) === String(selectedVersion.id)) {
                opt.selected = true;
            }
            verSelect.appendChild(opt);
        });
        verSelect.onchange = () => {
            const vId = verSelect.value;
            const match = versions.find(v => String(v.id) === String(vId));
            if (match) {
                resetSelectedPreviewState();
                selectedVersion = match;
                renderModelDetail();
            }
        };
        verContainer.appendChild(verLabel);
        verContainer.appendChild(verSelect);

        // 4. Action Button (Download / Add)
        const actionContainer = document.createElement("div");
        actionContainer.style.cssText = "display: flex; flex-direction: column; gap: 8px; margin-top: 6px; flex-shrink: 0;";

        const downloadUrl = selectedVersion.downloadUrl || "";
        const activeJob = activeDownloads[selectedVersion.id];

        const actionBtn = document.createElement("button");
        actionBtn.className = "anima-btn-primary";
        actionBtn.style.padding = "12px";
        actionBtn.style.fontSize = "13px";
        actionBtn.style.width = "100%";

        if (isLocal) {
            const alreadyInNode = node._loraData.some(l => l.name === filename || l.name.endsWith(filename));
            if (alreadyInNode) {
                actionBtn.innerText = t("Already Added");
                actionBtn.style.background = "rgba(16, 185, 129, 0.15)";
                actionBtn.style.color = "#10b981";
                actionBtn.style.border = "1px solid rgba(16, 185, 129, 0.3)";
                actionBtn.disabled = true;
            } else {
                actionBtn.innerText = "➕ " + t("Add");
                actionBtn.style.background = "#10b981";
                actionBtn.style.color = "#fff";
                actionBtn.onclick = () => {
                    addLoraToNode(filename);
                    renderModelDetail();
                    // Refilter if on local grids
                    if (currentCategory === "downloaded") {
                        renderDownloadedOnly();
                    } else if (currentCategory === "loaded") {
                        renderLoadedOnly();
                    } else if (currentCategory === "favorites") {
                        renderFavoritesOnly();
                    } else {
                        renderGrid();
                    }
                };
            }
        } else if (activeJob && (activeJob.status === "pending" || activeJob.status === "downloading")) {
            const percent = activeJob.total ? Math.round((activeJob.progress / activeJob.total) * 100) : 0;
            actionBtn.innerText = t("Downloading... {progress}%", { progress: percent });
            actionBtn.style.background = "rgba(11, 140, 233, 0.2)";
            actionBtn.style.color = "#7dd3fc";
            actionBtn.style.border = "1px solid rgba(11, 140, 233, 0.3)";
            actionBtn.disabled = true;
        } else {
            actionBtn.innerText = t("Download & Add");
            actionBtn.style.background = "#0b8ce9";
            actionBtn.style.color = "#fff";
            actionBtn.onclick = () => {
                startDownload(selectedVersion.id, downloadUrl, filename, actionBtn, null);
            };
        }
        actionContainer.appendChild(actionBtn);

        // 5. Trigger Words (if any)
        const triggers = selectedVersion.trainedWords || [];
        const triggerContainer = document.createElement("div");
        triggerContainer.style.cssText = "display: flex; flex-direction: column; gap: 6px;";
        
        const triggerLabel = document.createElement("div");
        triggerLabel.innerText = "Trigger Words / 触发词:";
        triggerLabel.style.cssText = "font-size: 11px; color: #9ca3af; font-weight: 600;";
        triggerContainer.appendChild(triggerLabel);

        if (triggers.length > 0) {
            const listDiv = document.createElement("div");
            listDiv.style.cssText = "max-height: clamp(44px, 10vh, 80px); overflow-y: auto; border: 1px solid rgba(255,255,255,0.03); padding: 4px; border-radius: 6px;";
            triggers.forEach(word => {
                const tag = document.createElement("span");
                tag.className = "anima-lora-tag";
                tag.innerText = word;
                tag.title = "Click to copy";
                tag.onclick = () => {
                    copyTextToClipboard(word)
                        .then(() => showCopyFeedback(`已复制: ${word}`))
                        .catch(() => showCopyFeedback("复制失败"));
                };
                listDiv.appendChild(tag);
            });
            triggerContainer.appendChild(listDiv);
        } else {
            const noneDiv = document.createElement("div");
            noneDiv.innerText = "None / 无需触发词";
            noneDiv.style.cssText = "font-size: 12px; color: #666; font-style: italic;";
            triggerContainer.appendChild(noneDiv);
        }

        // 6. Model Description (Rich Text Description)
        const descContainer = document.createElement("div");
        descContainer.style.cssText = "display: flex; flex-direction: column; gap: 6px; flex: 1 0 170px; min-height: 160px;";
        
        const descLabel = document.createElement("div");
        descLabel.innerText = "Description / 模型介绍:";
        descLabel.style.cssText = "font-size: 11px; color: #9ca3af; font-weight: 600; flex-shrink: 0;";
        
        const descBody = document.createElement("div");
        descBody.className = "anima-lora-desc";
        
        let descHtml = getModelDescriptionHtml(selectedModel, selectedVersion);
        if (descHtml) {
            // Clean up description if needed, render innerHTML
            descBody.innerHTML = descHtml;
        } else {
            descBody.innerHTML = `<span style="color: #666; font-style: italic;">No description provided.</span>`;
        }
        
        descContainer.appendChild(descLabel);
        descContainer.appendChild(descBody);

        detailPanel.appendChild(imgContainer);
        detailPanel.appendChild(titleRow);
        detailPanel.appendChild(verContainer);
        detailPanel.appendChild(actionContainer);
        detailPanel.appendChild(triggerContainer);
        detailPanel.appendChild(descContainer);
    }

    function renderDetailEmptyState() {
        resetSelectedPreviewState();
        detailPanel.innerHTML = `
            <div style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #555; text-align: center; gap: 10px; padding: 20px;">
                <div style="font-size: 40px;">🔍</div>
                <div style="font-size: 13px; font-weight: 600; color: #888;">Select a LoRA card</div>
                <div style="font-size: 11px; color: #555; line-height: 1.4;">Click any LoRA on the left grid to view version files, trigger words, and read full description.</div>
            </div>
        `;
    }

    // --- Render Downloaded Only (Local List) ---
    function renderDownloadedOnly() {
        const renderGeneration = clearGridForRender();

        const configuredDir = getConfiguredAnimaLoraDir();
        const customDirValid = isConfiguredAnimaLoraDirValid();
        if (!configuredDir || !customDirValid) {
            const empty = document.createElement("div");
            empty.style.cssText = "grid-column: 1/-1; text-align: center; color: #9ca3af; padding: 48px 24px; line-height: 1.7; display: flex; flex-direction: column; gap: 8px; align-items: center;";
            const title = document.createElement("div");
            title.style.cssText = "font-size: 14px; font-weight: 700; color: #e5e7eb;";
            title.innerText = !configuredDir ? "请先设置 Anima LoRA 存放位置" : "Anima LoRA 存放位置不存在";
            const body = document.createElement("div");
            body.style.cssText = "font-size: 12px; max-width: 460px;";
            body.innerText = !configuredDir
                ? "已下载标签页只显示用户设置目录中的 LoRA。请点击右上角设置，填写 Anima LoRA 存放位置。"
                : "当前设置的目录无法访问。请点击右上角设置，重新填写有效的 Anima LoRA 存放位置。";
            empty.appendChild(title);
            empty.appendChild(body);
            if (configuredDir) {
                const pathHint = document.createElement("div");
                pathHint.style.cssText = "font-size: 11px; color: #6b7280; max-width: 520px; overflow-wrap: anywhere;";
                pathHint.innerText = configuredDir;
                empty.appendChild(pathHint);
            }
            gridContainer.appendChild(empty);
            infoText.innerText = !configuredDir ? "请设置 Anima LoRA 存放位置。" : "Anima LoRA 存放位置无效。";
            return;
        }

        const downloadedItems = getDownloadedManifestItems();
        const filteredItems = downloadedItems.filter(item => {
            const q = query.toLowerCase();
            if (!q) return true;
            const meta = item.meta_summary || {};
            return [
                item.filename,
                item.display_name,
                meta.name,
                meta.creator,
                meta.version
            ].filter(Boolean).some(value => String(value).toLowerCase().includes(q));
        });

        if (downloadedItems.length === 0) {
            gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #9ca3af; padding: 40px;">该目录下还没有已下载的 LoRA</div>`;
            infoText.innerText = "当前 Anima LoRA 目录为空。";
            return;
        }

        if (filteredItems.length === 0) {
            gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #9ca3af; padding: 40px;">没有匹配当前搜索的已下载 LoRA</div>`;
            infoText.innerText = "没有匹配当前搜索的本地模型。";
            return;
        }

        const fragment = document.createDocumentFragment();
        for (const [index, manifestItem] of filteredItems.entries()) {
            const filename = manifestItem.filename;
            const card = document.createElement("div");
            card.className = "anima-lora-card";
            if (selectedModel && selectedModel.id === filename) {
                card.classList.add("selected");
            }
            const cardClip = document.createElement("div");
            cardClip.className = "anima-lora-card-clip";
            card.appendChild(cardClip);

            const imgContainer = document.createElement("div");
            imgContainer.style.cssText = "position: absolute; inset: 0; width: 100%; height: 100%; background: transparent; overflow: hidden; display: flex; align-items: center; justify-content: center;";
            
            const img = document.createElement("img");
            img.style.cssText = "width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);";
            img.loading = index < INITIAL_CARD_PREVIEW_LOADS ? "eager" : "lazy";
            img.fetchPriority = index < INITIAL_CARD_PREVIEW_LOADS ? "high" : "low";
            
            let loader = null;
            let previewUrl = getLocalPreviewUrl(filename, LORA_LOCAL_CARD_PREVIEW_WIDTH);
            if (manifestItem && !manifestItem.has_preview && manifestItem.meta_summary?.preview_url) {
                previewUrl = getRemotePreviewUrl(manifestItem.meta_summary.preview_url, LORA_CARD_PREVIEW_WIDTH);
            }
            
            const previewAlreadyLoaded = isImageLoaded(previewUrl);
            if (previewAlreadyLoaded) {
                img.src = previewUrl;
                img.style.opacity = "1";
            }
            
            img.onload = () => {
                img.style.opacity = "1";
                loader?.remove();
                markImageLoaded(previewUrl);
            };
            img.onerror = () => {
                if (retryRemotePreviewLoad(img, previewUrl)) return;
                img.remove();
                
                const video = document.createElement("video");
                video.style.cssText = "width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);";
                video.muted = true;
                video.loop = true;
                video.playsInline = true;
                video.autoplay = true;
                video.controls = false;
                video.src = previewUrl;
                
                video.onloadeddata = () => {
                    video.style.opacity = "1";
                    loader?.remove();
                };
                video.onerror = () => {
                    video.remove();
                    loader?.remove();
                    const fallback = document.createElement("div");
                    fallback.innerText = "📦";
                    fallback.style.cssText = "font-size: 48px; color: #555;";
                    imgContainer.appendChild(fallback);
                };
                
                card.onmouseenter = () => {
                    video.style.transform = "scale(1.06)";
                };
                card.onmouseleave = () => {
                    video.style.transform = "scale(1)";
                };
                imgContainer.appendChild(video);
            };
            
            card.onmouseenter = () => {
                img.style.transform = "scale(1.06)";
            };
            card.onmouseleave = () => {
                img.style.transform = "scale(1)";
            };
            imgContainer.appendChild(img);
            if (!previewAlreadyLoaded) {
                schedulePreviewLoad(img, () => {
                    if (renderGeneration !== previewRenderGeneration) return;
                    if (img.dataset.loadStarted === "1") return;
                    img.dataset.loadStarted = "1";
                    loader = createPreviewLoader(imgContainer);
                    img.src = previewUrl;
                }, index);
            }

            // Card delete button
            const deleteBtn = document.createElement("button");
            deleteBtn.innerHTML = "🗑️";
            deleteBtn.title = t("Delete Model / 删除模型");
            deleteBtn.style.cssText = `
                position: absolute;
                top: 8px;
                right: 8px;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: rgba(0, 0, 0, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: #ef4444;
                font-size: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10;
                transition: all 0.2s;
                opacity: 0;
            `;
            
            deleteBtn.onmouseenter = () => {
                deleteBtn.style.background = "#ef4444";
                deleteBtn.style.color = "#ffffff";
                deleteBtn.style.transform = "scale(1.1)";
            };
            deleteBtn.onmouseleave = () => {
                deleteBtn.style.background = "rgba(0, 0, 0, 0.6)";
                deleteBtn.style.color = "#ef4444";
                deleteBtn.style.transform = "scale(1)";
            };
            
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                const confirmed = confirm(
                    t("Are you sure you want to delete this model and its metadata? This action CANNOT be undone.\n确认要从磁盘中永久删除此模型及所有伴随文件吗？此操作不可撤销。")
                );
                
                if (!confirmed) return;
                
                deleteBtn.disabled = true;
                deleteBtn.innerHTML = "⏳";
                
                try {
                    const resp = await fetch("/anima-tools/lora/delete-local", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ filename: filename })
                    });
                    
                    if (resp.ok) {
                        localLoras = localLoras.filter(l => l !== filename);
                        globalLocalLoras = localLoras;
                        loraManifestItems = loraManifestItems.filter(item => item.filename !== filename);
                        loraManifestMap.delete(filename);
                        if (globalLoraManifest?.items) {
                            globalLoraManifest.items = globalLoraManifest.items.filter(item => item.filename !== filename);
                            cacheSet(LORA_MANIFEST_CACHE_KEY, globalLoraManifest);
                        }
                        
                        let isCurrentSelectedDeleted = false;
                        if (selectedModel) {
                            if (selectedModel.id === filename || selectedModel.local_filename === filename) {
                                isCurrentSelectedDeleted = true;
                            }
                            const sFiles = selectedVersion?.files || [];
                            if (sFiles.some(f => f.name === filename || f.name.endsWith(filename))) {
                                isCurrentSelectedDeleted = true;
                            }
                        }
                        if (isCurrentSelectedDeleted) {
                            resetSelectedPreviewState();
                            selectedModel = null;
                            selectedVersion = null;
                            renderDetailEmptyState();
                        }
                        
                        renderDownloadedOnly();
                    } else {
                        const err = await resp.json();
                        alert(`Failed to delete model: ${err.error || "Unknown error"}`);
                        deleteBtn.disabled = false;
                        deleteBtn.innerHTML = "🗑️";
                    }
                } catch (error) {
                    console.error("Delete local lora failed", error);
                    alert("Network error. Failed to delete model.");
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = "🗑️";
                }
            };
            
            imgContainer.appendChild(deleteBtn);

            card.onmouseenter = () => {
                img.style.transform = "scale(1.06)";
                deleteBtn.style.opacity = "1";
            };
            card.onmouseleave = () => {
                img.style.transform = "scale(1)";
                deleteBtn.style.opacity = "0";
            };

            // Floating Local Dot
            const statusDot = document.createElement("div");
            statusDot.style.cssText = "position: absolute; top: 8px; left: 8px; width: 10px; height: 10px; border-radius: 50%; background: #10b981; border: 2px solid #202022; z-index: 8;";
            imgContainer.appendChild(statusDot);

            // Card Body Info (Floating text metadata with gradient overlay)
            const body = document.createElement("div");
            body.style.cssText = `
                position: absolute;
                bottom: 0;
                left: 0;
                width: 100%;
                background: linear-gradient(to top, rgba(10, 10, 15, 0.95) 0%, rgba(10, 10, 15, 0.6) 60%, rgba(10, 10, 15, 0) 100%);
                padding: 40px 12px 12px 12px;
                display: flex;
                flex-direction: column;
                gap: 2px;
                overflow: hidden;
                box-sizing: border-box;
                z-index: 5;
                pointer-events: none;
            `;
            
            const modelName = document.createElement("div");
            modelName.style.cssText = "font-size: 12px; font-weight: 700; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-shadow: 0 1px 4px rgba(0,0,0,0.85);";
            
            let displayName = filename;
            if (displayName.endsWith(".safetensors")) {
                displayName = displayName.slice(0, -12);
            }
            const lastSlash = Math.max(displayName.lastIndexOf("/"), displayName.lastIndexOf("\\"));
            if (lastSlash !== -1) {
                displayName = displayName.substring(lastSlash + 1);
            }
            modelName.innerText = displayName;
            modelName.title = filename;
            
            const localPathLabel = document.createElement("div");
            localPathLabel.innerText = "Local SafeTensor";
            localPathLabel.style.cssText = "font-size: 10px; color: #10b981; text-shadow: 0 1px 3px rgba(0,0,0,0.85);";

            const metaSummary = manifestItem?.meta_summary || {};
            if (metaSummary.name) {
                modelName.innerText = metaSummary.name;
                modelName.title = metaSummary.name;
            }
            if (metaSummary.creator) {
                localPathLabel.innerText = `by ${metaSummary.creator}`;
                localPathLabel.style.color = "#cbd5e1";
            }

            body.appendChild(modelName);
            body.appendChild(localPathLabel);
            imgContainer.appendChild(body);
            cardClip.appendChild(imgContainer);
            
            // Click Local Card
            card.onclick = async () => {
                const allCards = gridContainer.querySelectorAll(".anima-lora-card");
                allCards.forEach(c => c.classList.remove("selected"));
                card.classList.add("selected");

                // Pre-fill with a mock model version in case fetch fails or meta is absent
                resetSelectedPreviewState();
                selectedModel = {
                    id: filename,
                    name: manifestItem?.meta_summary?.name || displayName,
                    creator: manifestItem?.meta_summary?.creator ? { username: manifestItem.meta_summary.creator } : undefined,
                    description: "This is a locally available LoRA model file."
                };
                selectedVersion = {
                    id: filename,
                    name: manifestItem?.meta_summary?.version || "Local version",
                    trainedWords: manifestItem?.meta_summary?.trained_words || [],
                    files: [{ name: filename }],
                    downloadUrl: ""
                };
                renderModelDetail();

                try {
                    const resp = await fetch(`/anima-tools/lora/local-metadata?filename=${encodeURIComponent(filename)}`);
                    if (resp.ok) {
                        const resData = await resp.json();
                        if (resData.success && resData.metadata) {
                            if (!selectedModel || (selectedModel.id !== filename && selectedModel.local_filename !== filename)) {
                                return;
                            }
                            selectedModel = resData.metadata.model;
                            selectedVersion = resData.metadata.version;
                            selectedModel.local_filename = filename;
                            selectedVersion.local_filename = filename;
                            renderModelDetail();
                            hydrateSelectedModelDetail(selectedModel.id, selectedVersion.id);
                        }
                    }
                } catch (e) {
                    console.error("[Anima Tools] Failed to fetch local model metadata", e);
                }
            };

            fragment.appendChild(card);
        }

        gridContainer.appendChild(fragment);
        infoText.innerText = `Found ${filteredItems.length} Anima LoRAs.`;
    }

    // --- Render Loaded Only (LoRAs currently added to this node) ---
    function renderLoadedOnly() {
        const renderGeneration = clearGridForRender();
        const loadedItems = normalizeLoraList(node._loraData || []);
        const filteredItems = loadedItems.filter(item => {
            const q = query.toLowerCase();
            if (!q) return true;
            const manifestItem = getManifestItem(item.name);
            const meta = manifestItem?.meta_summary || {};
            return [
                item.name,
                manifestItem?.display_name,
                meta.name,
                meta.creator,
                meta.version
            ].filter(Boolean).some(value => String(value).toLowerCase().includes(q));
        });

        if (loadedItems.length === 0) {
            gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #9ca3af; padding: 40px;">当前节点还没有已加载的 LoRA</div>`;
            infoText.innerText = "当前节点未加载 LoRA。";
            return;
        }

        if (filteredItems.length === 0) {
            gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #9ca3af; padding: 40px;">没有匹配当前搜索的已加载 LoRA</div>`;
            infoText.innerText = "没有匹配当前搜索的已加载 LoRA。";
            return;
        }

        const fragment = document.createDocumentFragment();
        for (const [index, loadedItem] of filteredItems.entries()) {
            const filename = loadedItem.name;
            const manifestItem = getManifestItem(filename);
            const card = document.createElement("div");
            card.className = "anima-lora-card";
            if (selectedModel && (selectedModel.id === filename || selectedModel.local_filename === filename)) {
                card.classList.add("selected");
            }
            const cardClip = document.createElement("div");
            cardClip.className = "anima-lora-card-clip";
            card.appendChild(cardClip);

            const imgContainer = document.createElement("div");
            imgContainer.style.cssText = "position: absolute; inset: 0; width: 100%; height: 100%; background: transparent; overflow: hidden; display: flex; align-items: center; justify-content: center;";

            const img = document.createElement("img");
            img.style.cssText = "width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);";
            img.loading = index < INITIAL_CARD_PREVIEW_LOADS ? "eager" : "lazy";
            img.fetchPriority = index < INITIAL_CARD_PREVIEW_LOADS ? "high" : "low";

            let loader = null;
            let previewUrl = getLocalPreviewUrl(filename, LORA_LOCAL_CARD_PREVIEW_WIDTH);
            if (manifestItem && !manifestItem.has_preview && manifestItem.meta_summary?.preview_url) {
                previewUrl = getRemotePreviewUrl(manifestItem.meta_summary.preview_url, LORA_CARD_PREVIEW_WIDTH);
            }

            const previewAlreadyLoaded = isImageLoaded(previewUrl);
            if (previewAlreadyLoaded) {
                img.src = previewUrl;
                img.style.opacity = "1";
            }

            img.onload = () => {
                img.style.opacity = "1";
                loader?.remove();
                markImageLoaded(previewUrl);
            };
            img.onerror = () => {
                if (retryRemotePreviewLoad(img, previewUrl)) return;
                img.remove();
                loader?.remove();
                const fallback = document.createElement("div");
                fallback.innerText = "LoRA";
                fallback.style.cssText = "font-size: 28px; font-weight: 800; color: #555;";
                imgContainer.appendChild(fallback);
            };

            card.onmouseenter = () => {
                img.style.transform = "scale(1.06)";
            };
            card.onmouseleave = () => {
                img.style.transform = "scale(1)";
            };
            imgContainer.appendChild(img);
            if (!previewAlreadyLoaded) {
                schedulePreviewLoad(img, () => {
                    if (renderGeneration !== previewRenderGeneration) return;
                    if (img.dataset.loadStarted === "1") return;
                    img.dataset.loadStarted = "1";
                    loader = createPreviewLoader(imgContainer);
                    img.src = previewUrl;
                }, index);
            }

            const removeBtn = document.createElement("button");
            removeBtn.innerText = "×";
            removeBtn.title = "从当前节点移除";
            removeBtn.style.cssText = `
                position: absolute;
                top: 8px;
                right: 8px;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: rgba(0, 0, 0, 0.62);
                border: 1px solid rgba(239, 68, 68, 0.32);
                color: #fca5a5;
                font-size: 18px;
                line-height: 1;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10;
                transition: all 0.2s;
                opacity: 0;
            `;
            removeBtn.onmouseenter = () => {
                removeBtn.style.background = "#ef4444";
                removeBtn.style.color = "#ffffff";
                removeBtn.style.transform = "scale(1.08)";
            };
            removeBtn.onmouseleave = () => {
                removeBtn.style.background = "rgba(0, 0, 0, 0.62)";
                removeBtn.style.color = "#fca5a5";
                removeBtn.style.transform = "scale(1)";
            };
            removeBtn.onclick = (event) => {
                event.stopPropagation();
                node._loraData = normalizeLoraList(node._loraData || []).filter(item => item.name !== filename);
                updateJsonValue(node);
                syncLoraWidgets(node, node._loraData);
                if (selectedModel && (selectedModel.id === filename || selectedModel.local_filename === filename)) {
                    resetSelectedPreviewState();
                    selectedModel = null;
                    selectedVersion = null;
                    renderDetailEmptyState();
                }
                renderLoadedOnly();
            };
            imgContainer.appendChild(removeBtn);

            card.onmouseenter = () => {
                img.style.transform = "scale(1.06)";
                removeBtn.style.opacity = "1";
            };
            card.onmouseleave = () => {
                img.style.transform = "scale(1)";
                removeBtn.style.opacity = "0";
            };

            const statusDot = document.createElement("div");
            statusDot.style.cssText = "position: absolute; top: 8px; left: 8px; width: 10px; height: 10px; border-radius: 50%; background: #0c8ce9; border: 2px solid #202022; z-index: 8;";
            imgContainer.appendChild(statusDot);

            const body = document.createElement("div");
            body.style.cssText = `
                position: absolute;
                bottom: 0;
                left: 0;
                width: 100%;
                background: linear-gradient(to top, rgba(10, 10, 15, 0.95) 0%, rgba(10, 10, 15, 0.6) 60%, rgba(10, 10, 15, 0) 100%);
                padding: 40px 12px 12px 12px;
                display: flex;
                flex-direction: column;
                gap: 2px;
                overflow: hidden;
                box-sizing: border-box;
                z-index: 5;
                pointer-events: none;
            `;

            const modelName = document.createElement("div");
            modelName.style.cssText = "font-size: 12px; font-weight: 700; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-shadow: 0 1px 4px rgba(0,0,0,0.85);";
            const metaSummary = manifestItem?.meta_summary || {};
            modelName.innerText = metaSummary.name || getLoraBaseName(filename);
            modelName.title = filename;

            const strengthLabel = document.createElement("div");
            strengthLabel.innerText = `Strength ${Number(loadedItem.strength_model || 1).toFixed(2)}`;
            strengthLabel.style.cssText = "font-size: 10px; color: #7dd3fc; text-shadow: 0 1px 3px rgba(0,0,0,0.85);";
            if (metaSummary.creator) {
                strengthLabel.innerText = `by ${metaSummary.creator} · Strength ${Number(loadedItem.strength_model || 1).toFixed(2)}`;
                strengthLabel.style.color = "#cbd5e1";
            }

            body.appendChild(modelName);
            body.appendChild(strengthLabel);
            imgContainer.appendChild(body);
            cardClip.appendChild(imgContainer);

            card.onclick = async () => {
                const allCards = gridContainer.querySelectorAll(".anima-lora-card");
                allCards.forEach(c => c.classList.remove("selected"));
                card.classList.add("selected");

                resetSelectedPreviewState();
                selectedModel = {
                    id: filename,
                    name: metaSummary.name || getLoraBaseName(filename),
                    creator: metaSummary.creator ? { username: metaSummary.creator } : undefined,
                    description: "This LoRA is currently loaded in this node.",
                    local_filename: filename
                };
                selectedVersion = {
                    id: filename,
                    name: metaSummary.version || "Loaded version",
                    trainedWords: metaSummary.trained_words || [],
                    files: [{ name: filename }],
                    downloadUrl: "",
                    local_filename: filename
                };
                renderModelDetail();

                try {
                    const resp = await fetch(`/anima-tools/lora/local-metadata?filename=${encodeURIComponent(filename)}`);
                    if (resp.ok) {
                        const resData = await resp.json();
                        if (resData.success && resData.metadata) {
                            if (!selectedModel || (selectedModel.id !== filename && selectedModel.local_filename !== filename)) {
                                return;
                            }
                            selectedModel = resData.metadata.model;
                            selectedVersion = resData.metadata.version;
                            selectedModel.local_filename = filename;
                            selectedVersion.local_filename = filename;
                            renderModelDetail();
                            hydrateSelectedModelDetail(selectedModel.id, selectedVersion.id);
                        }
                    }
                } catch (e) {
                    console.error("[Anima Tools] Failed to fetch loaded model metadata", e);
                }
            };

            fragment.appendChild(card);
        }

        gridContainer.appendChild(fragment);
        infoText.innerText = `Showing ${filteredItems.length} loaded LoRAs.`;
    }

    // --- Render Favorites Only ---
    function renderFavoritesOnly() {
        gridContainer.innerHTML = "";
        
        let filteredFavs = favoritesConfig.lora.items.filter(model => {
            const q = query.toLowerCase();
            return !q || model.name.toLowerCase().includes(q) || (model.creator && model.creator.username.toLowerCase().includes(q));
        });

        if (filteredFavs.length === 0) {
            gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #9ca3af; padding: 40px;">No favorite LoRAs found</div>`;
            infoText.innerText = "No favorite models matched.";
            return;
        }

        searchResults = filteredFavs;
        renderGrid();
        infoText.innerText = `Showing ${filteredFavs.length} favorite LoRAs.`;
    }

    // --- Action Methods ---
    async function startDownload(versionId, downloadUrl, filename, btnElement, barElement) {
        if (!downloadUrl) {
            alert("No download URL available for this model.");
            return;
        }

        btnElement.innerText = t("Downloading... {progress}%", { progress: 0 });
        btnElement.style.background = "rgba(11, 140, 233, 0.2)";
        btnElement.style.color = "#7dd3fc";
        btnElement.style.border = "1px solid rgba(11, 140, 233, 0.3)";
        btnElement.disabled = true;

        try {
            const resp = await fetch("/anima-tools/lora/download", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    version_id: versionId,
                    download_url: downloadUrl,
                    filename: filename,
                    metadata: {
                        model: selectedModel,
                        version: selectedVersion
                    }
                })
            });

            if (resp.ok) {
                const data = await resp.json();
                const taskId = String(data.task_id || versionId);
                startedDownloadTaskIds.add(taskId);
                notifiedDownloadFailures.delete(taskId);
                activeDownloads[taskId] = {
                    status: "downloading",
                    progress: 0,
                    total: 0
                };
            } else {
                alert("Failed to start download task.");
                renderModelDetail();
            }
        } catch (e) {
            console.error(e);
            alert("Network error starting download.");
            renderModelDetail();
        }
    }

    async function updateDownloadsProgress() {
        try {
            const resp = await fetch("/anima-tools/lora/download-status");
            if (!resp.ok) return;

            const jobs = await resp.json();
            activeDownloads = jobs;

            let needGridRebuild = false;
            let needsManifestRefresh = false;

            for (const [task_id, job] of Object.entries(jobs)) {
                const bar = document.getElementById(`dl-bar-${task_id}`);
                const percent = job.total ? Math.round((job.progress / job.total) * 100) : 0;
                
                if (bar) {
                    bar.style.width = `${percent}%`;
                }

                if (job.status === "completed") {
                    const filename = job.save_path ? job.save_path.split(/[/\\]/).pop() : "";
                    if (filename && !localLoras.includes(filename)) {
                        localLoras.push(filename);
                        globalLocalLoras = localLoras;
                        needGridRebuild = true;
                    }
                    needsManifestRefresh = true;
                    delete activeDownloads[task_id];
                    startedDownloadTaskIds.delete(String(task_id));
                } else if (job.status === "failed") {
                    console.error(`Download failed for task ${task_id}: ${job.error}`);
                    const taskKey = String(task_id);
                    const shouldNotify = startedDownloadTaskIds.has(taskKey);
                    delete activeDownloads[taskKey];

                    if (notifiedDownloadFailures.has(taskKey)) {
                        continue;
                    }

                    notifiedDownloadFailures.add(taskKey);
                    const isApiKeyError = job.error && (job.error.includes("401") || job.error.includes("403") || job.error.includes("API Key"));
                    if (shouldNotify && isApiKeyError) {
                        if (!civitaiApiKeyDownloadWarningShown) {
                            civitaiApiKeyDownloadWarningShown = true;
                            alert(`【下载失败】此模型需要 Civitai API Key 才能下载。\n请点击界面右上角的 ⚙️ (齿轮) 按钮配置你的 API Key 后再试。`);
                        }
                    } else if (shouldNotify) {
                        alert(`Download failed for model version ${task_id}. Error: ${job.error}`);
                    }
                    startedDownloadTaskIds.delete(taskKey);
                    needGridRebuild = true;
                }
            }

            if (needsManifestRefresh) {
                await refreshManifest();
            }

            // 只在下载完成/失败等状态变更时才重建 grid，正在下载中只更新进度条
            if (needGridRebuild) {
                if (currentCategory === "downloaded") {
                    renderDownloadedOnly();
                } else if (currentCategory === "loaded") {
                    renderLoadedOnly();
                } else if (currentCategory === "favorites") {
                    renderFavoritesOnly();
                } else {
                    renderGrid();
                }
                
                // Refresh detail pane if selection is active
                if (selectedModel) {
                    renderModelDetail();
                }
            } else if (selectedVersion && activeDownloads[selectedVersion.id] && ["pending", "downloading"].includes(activeDownloads[selectedVersion.id].status)) {
                // 仅更新详情面板的按钮状态文字
                const actionBtn = detailPanel.querySelector(".anima-btn-primary");
                if (actionBtn) {
                    const job = activeDownloads[selectedVersion.id];
                    const percent = job.total ? Math.round((job.progress / job.total) * 100) : 0;
                    actionBtn.innerText = t("Downloading... {progress}%", { progress: percent });
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    function addLoraToNode(filename) {
        if (!node._loraData.some(l => l.name === filename)) {
            node._loraData.push({
                name: filename,
                strength_model: 1.0,
                enabled: true
            });
            updateJsonValue(node);
            syncLoraWidgets(node, node._loraData);
        }
    }

    // --- Save Favorites to Server ---
    async function saveFavorites() {
        try {
            const favResp = await fetch("/anima-tools/favorites");
            let fullFavs = {};
            if (favResp.ok) fullFavs = await favResp.json();
            
            fullFavs.lora = favoritesConfig.lora;
            
            const saveResp = await fetch("/anima-tools/favorites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(fullFavs)
            });
            if (!saveResp.ok) {
                throw new Error(await saveResp.text());
            }
        } catch (e) {
            console.error("Failed to save favorites to server", e);
        }
    }

    // --- Toggle Favorite Star ---
    async function toggleFavorite(model, favBtnElement) {
        const items = favoritesConfig.lora.items;
        const index = items.findIndex(item => String(item.id) === String(model.id));
        
        if (index !== -1) {
            items.splice(index, 1);
            favBtnElement.classList.remove("active");
            favBtnElement.innerHTML = "☆";
        } else {
            items.push({
                id: model.id,
                name: model.name,
                creator: model.creator,
                modelVersions: model.modelVersions,
                description: model.description
            });
            favBtnElement.classList.add("active");
            favBtnElement.innerHTML = "★";
        }
        
        await saveFavorites();
        
        if (currentCategory === "favorites") {
            renderFavoritesOnly();
        }
    }

    // --- Settings Modal ---
    function openSettingsModal() {
        const dialog = document.createElement("div");
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(10px);
            z-index: 100001;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const content = document.createElement("div");
        content.style.cssText = `
            background: #1c1c1e;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px;
            padding: 24px;
            width: 90%;
            max-width: 480px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
            gap: 16px;
            animation: animaFadeIn 0.2s ease-out;
            color: #fff;
        `;
        
        const title = document.createElement("div");
        title.innerText = t("Save Path Config");
        title.style.cssText = "font-size: 16px; font-weight: 700; color: #ffffff;";

        const pathLabel = document.createElement("div");
        pathLabel.innerText = t("Save Path");
        pathLabel.style.cssText = "font-size: 12px; color: #9ca3af; margin-bottom: -8px;";
        
        const pathInput = document.createElement("input");
        pathInput.type = "text";
        pathInput.value = config.custom_lora_dir || "";
        pathInput.placeholder = t("Enter absolute directory path...");
        pathInput.style.cssText = `
            background: #2c2c2e;
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 8px;
            padding: 10px 12px;
            color: #ffffff;
            font-size: 14px;
            outline: none;
        `;

        const keyLabel = document.createElement("div");
        keyLabel.style.cssText = "font-size: 12px; color: #9ca3af; margin-bottom: -8px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; width: fit-content;";
        keyLabel.title = "Open Civitai API Key settings";
        keyLabel.tabIndex = 0;
        const keyLabelText = document.createElement("span");
        keyLabelText.innerText = t("Civitai API Key Config");
        const keyLabelIcon = document.createElement("span");
        keyLabelIcon.innerText = "↗";
        keyLabelIcon.style.cssText = "font-size: 12px; color: #7dd3fc; line-height: 1;";
        const openCivitaiApiKeys = () => window.open(CIVITAI_API_KEYS_URL, "_blank", "noopener,noreferrer");
        keyLabel.onclick = openCivitaiApiKeys;
        keyLabel.onkeydown = (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openCivitaiApiKeys();
            }
        };
        keyLabel.appendChild(keyLabelText);
        keyLabel.appendChild(keyLabelIcon);

        const keyInput = document.createElement("input");
        keyInput.type = "password";
        keyInput.value = config.civitai_api_key || "";
        keyInput.placeholder = t("Enter Civitai API Key...");
        keyInput.style.cssText = `
            background: #2c2c2e;
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 8px;
            padding: 10px 12px;
            color: #ffffff;
            font-size: 14px;
            outline: none;
        `;
        
        const btnRow = document.createElement("div");
        btnRow.style.cssText = "display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px;";
        
        const cancel = document.createElement("button");
        cancel.innerText = t("Cancel");
        cancel.className = "anima-btn-secondary";
        cancel.onclick = () => dialog.remove();
        
        const confirm = document.createElement("button");
        confirm.innerText = t("Save");
        confirm.className = "anima-btn-primary";
        confirm.onclick = async () => {
            const dirVal = pathInput.value.trim();
            const keyVal = keyInput.value.trim();
            
            try {
                const resp = await fetch("/anima-tools/lora/config", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        custom_lora_dir: dirVal,
                        civitai_api_key: keyVal
                    })
                });
                
                if (resp.ok) {
                    const data = await resp.json();
                    config.custom_lora_dir = dirVal;
                    config.civitai_api_key = keyVal;
                    config.custom_lora_dir_valid = data.custom_lora_dir_valid === true;
                    config.custom_lora_dir_abs = data.custom_lora_dir_abs || "";
                    globalLoraConfig = config;
                    if (keyVal) {
                        civitaiApiKeyDownloadWarningShown = false;
                    }
                    
                    await refreshManifest();
                    if (currentCategory === "downloaded") {
                        renderDownloadedOnly();
                    } else if (currentCategory === "loaded") {
                        renderLoadedOnly();
                    } else if (currentCategory === "favorites") {
                        renderFavoritesOnly();
                    } else {
                        renderGrid();
                    }
                    dialog.remove();
                } else {
                    alert("Failed to save config.");
                }
            } catch (e) {
                console.error(e);
                alert("Error saving settings.");
            }
        };
        
        btnRow.appendChild(cancel);
        btnRow.appendChild(confirm);
        content.appendChild(title);
        content.appendChild(pathLabel);
        content.appendChild(pathInput);
        content.appendChild(keyLabel);
        content.appendChild(keyInput);
        content.appendChild(btnRow);
        dialog.appendChild(content);
        
        document.body.appendChild(dialog);
    }
}
