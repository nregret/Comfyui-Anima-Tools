import { app } from "../../scripts/app.js";
import { t } from "./i18n.js";
import { markImageLoaded, isImageLoaded } from "./anima_image_utils.js";
import { createPromoLinks } from "./anima_promo_links.js";
import "./background_data.js";

const THEME = {
    accent: "#db2777",
    accentSoft: "rgba(219, 39, 119, 0.15)",
    accentBorder: "rgba(219, 39, 119, 0.35)",
    accentText: "#f472b6",
};

const CATEGORY_LIST = [
    "自然与户外 (Nature & Outdoors)",
    "都市与日常 (Urban & Daily)",
    "幻想与异界 (Fantasy & Sci-Fi)",
    "极简与纯色 (Minimalist & Abstract)",
];

const TRAITS_TRANSLATION = {
    "abstract": "抽象",
    "artistic": "艺术感",
    "city": "城市",
    "classroom": "教室",
    "cool colors": "冷色调",
    "cozy": "舒适",
    "cyber": "赛博",
    "dark": "昏暗",
    "day": "白天",
    "fantasy": "幻想",
    "fire": "火焰",
    "flower": "花朵",
    "fog": "雾",
    "foggy": "雾气",
    "forest": "森林",
    "glow": "发光",
    "greenery": "绿植",
    "home": "居家",
    "horror": "恐怖",
    "indoor": "室内",
    "japanese": "日式",
    "light rays": "光束",
    "magic": "魔法",
    "minimalism": "极简主义",
    "minimalist": "极简",
    "monster": "怪物",
    "moonlight": "月光",
    "nature": "自然",
    "neon": "霓虹",
    "night": "夜晚",
    "outdoor": "室外",
    "rainy": "雨天",
    "ruins": "废墟",
    "scifi": "科幻",
    "sea": "海",
    "shadow": "阴影",
    "sky": "天空",
    "snowy": "雪景",
    "space": "太空",
    "sparkles": "闪光",
    "stars": "星空",
    "stormy": "暴风雨",
    "street": "街道",
    "sunlight": "阳光",
    "sunrise": "日出",
    "sunset": "日落",
    "surreal": "超现实",
    "water": "水",
    "white": "白色",
    "winter": "冬季",
};

app.registerExtension({
    name: "AnimaBackgroundTagSelector.extension",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === "AnimaBackgroundTagSelector" || nodeData.name === "AnimaBackgroundTagSelectorPlus") {
            const origOnCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                origOnCreated?.apply(this, arguments);

                const backgroundTagsWidget = this.widgets.find(w => w.name === "background_tags");
                const btnWidget = this.addWidget("button", t("Open Background Selector"), null, async () => {
                    if (!window.backgroundData) {
                        alert(t("Anima background database is loading, please wait a few seconds..."));
                        return;
                    }
                    await openBackgroundSelectorModal(this, backgroundTagsWidget);
                });

                if (btnWidget && btnWidget.el) {
                    btnWidget.el.style.cssText += `
                        border: 1px solid rgba(219, 39, 119, 0.4) !important;
                        background: linear-gradient(135deg, rgba(219, 39, 119, 0.1), rgba(157, 23, 77, 0.15)) !important;
                        color: #f472b6 !important;
                        font-weight: 600 !important;
                        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
                    `;
                    btnWidget.el.onmouseover = () => {
                        btnWidget.el.style.boxShadow = "0 0 12px rgba(219, 39, 119, 0.35)";
                        btnWidget.el.style.background = "linear-gradient(135deg, rgba(219, 39, 119, 0.25), rgba(157, 23, 77, 0.3))";
                    };
                    btnWidget.el.onmouseout = () => {
                        btnWidget.el.style.boxShadow = "none";
                        btnWidget.el.style.background = "linear-gradient(135deg, rgba(219, 39, 119, 0.1), rgba(157, 23, 77, 0.15))";
                    };
                }
            };
        }
    }
});

function splitPromptTokens(value) {
    return String(value || "")
        .split(",")
        .map(part => part.replace(/^_raw_:/, "").trim())
        .filter(Boolean);
}

function normalizePromptToken(value) {
    return String(value || "").replace(/^_raw_:/, "").trim().toLowerCase();
}

function getItemKey(item) {
    return item?.isCustom ? `custom:${item.name}` : String(item?.id || item?.name || "");
}

function formatDisplayName(item, displayLang) {
    if (!item) return "";
    if (item.isCustom) return item.nickname || item.name || "";
    if (displayLang === "bilingual" && item.name_zh) return item.name_zh;
    return item.name || "";
}

function getCategoryLabel(category, displayLang) {
    if (displayLang === "en") {
        return category.match(/\(([^)]+)\)/)?.[1] || category;
    }
    return category;
}

function getTraitZh(trait, data) {
    const key = String(trait || "").toLowerCase().trim();
    if (TRAITS_TRANSLATION[key]) return TRAITS_TRANSLATION[key];
    for (const item of data || []) {
        const enList = splitPromptTokens(item.tags).map(normalizePromptToken);
        const zhList = splitPromptTokens(item.tags_zh);
        const idx = enList.indexOf(key);
        if (idx !== -1 && zhList[idx]) return zhList[idx];
    }
    return trait;
}

function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, ch => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }[ch]));
}

function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.innerText = text;
    return el;
}

function fallbackCopy(text, callback) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    callback?.();
}

function copyText(text, callback) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => callback?.()).catch(() => fallbackCopy(text, callback));
    } else {
        fallbackCopy(text, callback);
    }
}

async function openBackgroundSelectorModal(node, tagsWidget) {
    const backgroundData = Array.isArray(window.backgroundData) ? window.backgroundData : [];
    const dataById = new Map(backgroundData.map(item => [String(item.id), item]));
    // Keep selection one-way: existing node text should not auto-check cards in the modal.
    const selectedBackground = new Set();

    let favoritesConfig = {
        background: {
            groups: [{ id: "default", name: t("My Favorites"), isSystem: true }],
            items: [],
        }
    };

    try {
        const response = await fetch("/anima-tools/favorites");
        if (response.ok) {
            favoritesConfig = await response.json();
        }
    } catch (e) {
        console.error("[Anima Tools] Failed to load background favorites", e);
    }

    if (!favoritesConfig.background) {
        favoritesConfig.background = {
            groups: [{ id: "default", name: t("My Favorites"), isSystem: true }],
            items: [],
        };
    }

    let groups = Array.isArray(favoritesConfig.background.groups) && favoritesConfig.background.groups.length
        ? favoritesConfig.background.groups
        : [{ id: "default", name: t("My Favorites"), isSystem: true }];
    if (!groups.some(group => group.id === "default")) {
        groups = [{ id: "default", name: t("My Favorites"), isSystem: true }, ...groups];
    }

    let favoriteItems = Array.isArray(favoritesConfig.background.items) ? favoritesConfig.background.items : [];
    const favoriteMap = new Map();
    const favoriteSet = new Set();

    favoriteItems.forEach(item => {
        if (item.isCustom) {
            return;
        }
        const key = String(item.id || item.name || "");
        if (key) {
            favoriteMap.set(key, item);
            if (Array.isArray(item.groupIds) && item.groupIds.length > 0) favoriteSet.add(key);
        }
    });

    const SORT_STORAGE_KEY = "anima-background-selector-active-sort";
    const PAGE_STORAGE_KEY = "anima-background-selector-active-page";
    const SCROLL_STORAGE_KEY = "anima-background-selector-active-scroll";
    const SIDEBAR_SCROLL_STORAGE_KEY = "anima-background-selector-sidebar-scroll";
    const DISPLAY_LANG_STORAGE_KEY = "anima-background-selector-display-lang";
    const FILTER_STORAGE_KEY = "anima-background-selector-filters";
    const COLLECTIONS_COLLAPSE_STORAGE_KEY = "anima-background-selector-collections-collapsed";

    let activeSort = localStorage.getItem(SORT_STORAGE_KEY) || "id-asc";
    let displayLang = localStorage.getItem(DISPLAY_LANG_STORAGE_KEY) || "bilingual";
    let currentPage = parseInt(localStorage.getItem(PAGE_STORAGE_KEY), 10) || 1;
    let showSelectedOnly = false;
    let filteredData = [];
    let totalPages = 1;
    let lastScrollTop = parseInt(localStorage.getItem(SCROLL_STORAGE_KEY), 10) || 0;
    let lastSidebarScrollTop = parseInt(localStorage.getItem(SIDEBAR_SCROLL_STORAGE_KEY), 10) || 0;
    let collectionsCollapsed = localStorage.getItem(COLLECTIONS_COLLAPSE_STORAGE_KEY) === "true";

    const activeFilters = {
        categories: new Set(),
        traits: new Set(),
        collection: "all",
    };

    try {
        const saved = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || "{}");
        if (Array.isArray(saved.categories)) saved.categories.forEach(v => activeFilters.categories.add(v));
        if (Array.isArray(saved.traits)) saved.traits.forEach(v => activeFilters.traits.add(v));
        if (saved.collection) activeFilters.collection = saved.collection;
    } catch (e) {
        console.warn("[Anima Tools] Failed to restore background filters", e);
    }

    const allTraits = Array.from(backgroundData.reduce((map, item) => {
        (Array.isArray(item.traits) ? item.traits : []).forEach(trait => {
            map.set(trait, (map.get(trait) || 0) + 1);
        });
        return map;
    }, new Map()).entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    async function saveFavorites() {
        const nextItems = favoriteItems.filter(item => item.isCustom);
        favoriteMap.forEach((value, key) => {
            if (favoriteSet.has(key)) nextItems.push(value);
        });

        favoriteItems = nextItems;
        favoritesConfig.background.groups = groups;
        favoritesConfig.background.items = favoriteItems;

        try {
            const response = await fetch("/anima-tools/favorites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(favoritesConfig),
            });
            if (!response.ok) throw new Error(await response.text());
            return true;
        } catch (e) {
            console.error("[Anima Tools] Failed to save background favorites", e);
            alert(t("Failed to save favorites"));
            return false;
        }
    }

    function persistFilters() {
        localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
            categories: Array.from(activeFilters.categories),
            traits: Array.from(activeFilters.traits),
            collection: activeFilters.collection,
        }));
    }

    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
        @keyframes animaBackgroundFadeIn {
            from { opacity: 0; transform: scale(0.97) translateY(8px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes animaBackgroundSpin {
            to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes animaBackgroundShimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }
        .anima-background-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .anima-background-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .anima-background-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 999px; }
        .anima-background-btn {
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px;
            background: rgba(255,255,255,0.05);
            color: #e5e7eb;
            padding: 9px 14px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.18s ease;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            user-select: none;
            white-space: nowrap;
        }
        .anima-background-btn:hover:not(:disabled) {
            background: rgba(255,255,255,0.11);
            border-color: rgba(255,255,255,0.16);
            color: #fff;
        }
        .anima-background-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .anima-background-btn.primary {
            background: linear-gradient(135deg, #db2777, #9d174d);
            border-color: rgba(219,39,119,0.35);
            color: #fff;
            box-shadow: 0 8px 20px rgba(219,39,119,0.24);
        }
        .anima-background-btn.primary:hover:not(:disabled) {
            box-shadow: 0 10px 25px rgba(219,39,119,0.36);
        }
        .anima-background-btn.danger {
            background: rgba(239,68,68,0.08);
            border-color: rgba(239,68,68,0.22);
            color: #fca5a5;
        }
        .anima-background-btn.active {
            background: rgba(219,39,119,0.18);
            border-color: rgba(219,39,119,0.42);
            color: #f9a8d4;
        }
        .anima-background-pagination {
            padding: 14px 24px;
            background: linear-gradient(180deg, rgba(18,18,24,0.2), rgba(18,18,24,0.62));
            border-top: 1px solid rgba(255,255,255,0.06);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            flex-wrap: wrap;
            box-shadow: 0 -12px 32px rgba(0,0,0,0.18);
        }
        .anima-background-pagination-stats {
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
            max-width: min(460px, 100%);
            overflow: hidden;
            text-overflow: ellipsis;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .anima-background-pagination-stats::before {
            content: "";
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #db2777;
            box-shadow: 0 0 14px rgba(219,39,119,0.72);
            flex: 0 0 auto;
        }
        .anima-background-pagination-controls {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            flex-wrap: wrap;
            margin-left: auto;
        }
        .anima-background-page-number {
            min-height: 36px;
            padding: 0;
            border-radius: 0;
            background: transparent;
            border: none;
            color: #d1d5db;
            display: inline-flex;
            align-items: center;
            gap: 7px;
            box-shadow: none;
        }
        .anima-background-page-btn {
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
        .anima-background-page-btn:hover:not(:disabled) {
            background: rgba(219,39,119,0.16);
            color: #fff;
            border-color: rgba(219,39,119,0.38);
            transform: translateY(-1px);
        }
        .anima-background-page-btn:disabled {
            opacity: 0.35;
            cursor: not-allowed;
        }
        .anima-background-page-input {
            width: 48px;
            padding: 6px 4px;
            background: transparent;
            border: none;
            border-bottom: 1px solid rgba(255,255,255,0.16);
            border-radius: 0;
            color: #fff;
            font-size: 13px;
            font-weight: 800;
            text-align: center;
            outline: none;
            transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
        }
        .anima-background-page-input:focus {
            background: transparent;
            border-bottom-color: rgba(219,39,119,0.72);
            box-shadow: none;
        }
        .anima-background-select, .anima-background-input {
            background: rgba(10,10,15,0.76);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            color: #f8fafc;
            outline: none;
            font-size: 13px;
            transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .anima-background-select { padding: 10px 13px; cursor: pointer; }
        .anima-background-input { padding: 11px 14px; }
        .anima-background-select:focus, .anima-background-input:focus {
            border-color: rgba(219,39,119,0.55);
            box-shadow: 0 0 0 3px rgba(219,39,119,0.12);
        }
        .anima-background-sidebar-item {
            padding: 10px 12px;
            border-radius: 10px;
            color: #a1a1aa;
            cursor: pointer;
            border: 1px solid transparent;
            transition: all 0.16s ease;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            font-size: 12.5px;
            font-weight: 650;
            user-select: none;
        }
        .anima-background-sidebar-item:hover {
            background: rgba(255,255,255,0.05);
            color: #fff;
        }
        .anima-background-sidebar-item.active {
            background: rgba(219,39,119,0.14);
            border-color: rgba(219,39,119,0.34);
            color: #f9a8d4;
        }
        .anima-background-clear-filters-btn {
            width: calc(100% - 16px);
            margin: 0 8px 12px;
            padding: 9px 12px;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.035);
            color: #a1a1aa;
            font-size: 12.5px;
            font-weight: 750;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            transition: all 0.18s ease;
        }
        .anima-background-clear-filters-btn:hover:not(:disabled) {
            background: rgba(219,39,119,0.13);
            border-color: rgba(219,39,119,0.32);
            color: #f9a8d4;
        }
        .anima-background-clear-filters-btn:disabled {
            opacity: 0.42;
            cursor: not-allowed;
        }
        .anima-background-section-header {
            color: #71717a;
            font-size: 11px;
            font-weight: 850;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            margin: 14px 8px 8px;
            display: flex;
            align-items: center;
            gap: 8px;
            user-select: none;
        }
        .anima-background-section-header.foldable {
            cursor: pointer;
        }
        .anima-background-section-header.foldable:hover {
            color: #f9a8d4;
        }
        .anima-background-section-title {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .anima-background-section-spacer {
            flex: 1;
        }
        .anima-background-section-icon-btn {
            width: 20px;
            height: 20px;
            border-radius: 6px;
            border: 1px solid rgba(219,39,119,0.18);
            background: rgba(219,39,119,0.08);
            color: #f472b6;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.16s ease;
            padding: 0;
            flex: 0 0 auto;
        }
        .anima-background-section-icon-btn:hover {
            background: rgba(219,39,119,0.18);
            border-color: rgba(219,39,119,0.34);
            color: #fff;
        }
        .anima-background-section-arrow {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.18s ease;
            flex: 0 0 auto;
        }
        .anima-background-section-arrow.collapsed {
            transform: rotate(-90deg);
        }
        .anima-background-check-row {
            display: flex;
            gap: 9px;
            align-items: flex-start;
            color: #cbd5e1;
            font-size: 12.5px;
            font-weight: 600;
            cursor: pointer;
            padding: 8px 9px;
            border-radius: 9px;
            line-height: 1.28;
            transition: background 0.15s ease;
        }
        .anima-background-check-row:hover { background: rgba(255,255,255,0.045); }
        .anima-background-check-row input { margin-top: 2px; accent-color: #db2777; }
        .anima-background-card {
            position: relative;
            width: 100%;
            height: 100%;
            min-height: 0;
            min-width: 0;
            overflow: hidden;
            box-sizing: border-box;
            border-radius: 16px;
            isolation: isolate;
            background: rgba(255,255,255,0.06);
            border: 2px solid rgba(255,255,255,0.06);
            box-shadow: 0 5px 18px rgba(0,0,0,0.25);
            cursor: pointer;
            transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .anima-background-card:hover {
            border-color: rgba(219,39,119,0.82);
            box-shadow: 0 12px 30px rgba(0,0,0,0.38), 0 0 18px rgba(219,39,119,0.14);
        }
        .anima-background-card.selected {
            border-color: #db2777;
            box-shadow: 0 12px 30px rgba(0,0,0,0.36), 0 0 24px rgba(219,39,119,0.24);
        }
        .anima-background-card-clip {
            position: absolute;
            inset: 2px;
            z-index: 0;
            overflow: hidden;
            border-radius: 13px;
            clip-path: inset(0 round 13px);
            background: #0a0a10;
        }
        .anima-background-card img {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
            opacity: 0;
            transition: opacity 0.28s ease;
        }
        .anima-background-placeholder {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #2a1430, #101018);
            color: rgba(255,255,255,0.68);
            font-size: 46px;
            font-weight: 900;
            z-index: 1;
        }
        .anima-background-shimmer {
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg, rgba(20,20,30,0.9) 25%, rgba(219,39,119,0.12) 50%, rgba(20,20,30,0.9) 75%);
            background-size: 200% 100%;
            animation: animaBackgroundShimmer 1.5s infinite linear;
            z-index: 2;
            pointer-events: none;
        }
        .anima-background-spinner {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 26px;
            height: 26px;
            border: 2.5px solid rgba(219,39,119,0.16);
            border-top-color: #db2777;
            border-radius: 50%;
            animation: animaBackgroundSpin 0.85s infinite linear;
        }
        .anima-background-card-mask {
            position: absolute;
            inset: 0;
            background: linear-gradient(to top, rgba(10,10,16,0.99) 0%, rgba(10,10,16,0.72) 42%, rgba(10,10,16,0.16) 100%);
            z-index: 3;
            pointer-events: none;
        }
        .anima-background-card-info {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 4;
            padding: 13px 12px;
            display: flex;
            flex-direction: column;
            gap: 5px;
            min-width: 0;
            transition: opacity 0.2s ease;
            pointer-events: none;
        }
        .anima-background-card:hover .anima-background-card-info { opacity: 0; }
        .anima-background-card-title {
            color: #fff;
            font-size: 13.5px;
            font-weight: 850;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-shadow: 0 2px 8px rgba(0,0,0,0.72);
        }
        .anima-background-card-sub {
            color: #cbd5e1;
            font-size: 10.5px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            opacity: 0.9;
        }
        .anima-background-card-badges {
            display: flex;
            gap: 5px;
            min-width: 0;
            overflow: hidden;
        }
        .anima-background-badge {
            color: #f9a8d4;
            background: rgba(219,39,119,0.16);
            border: 1px solid rgba(219,39,119,0.24);
            border-radius: 999px;
            padding: 2px 7px;
            font-size: 10px;
            font-weight: 750;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .anima-background-tags-overlay {
            position: absolute;
            inset: 0;
            z-index: 5;
            padding: 42px 12px 14px;
            box-sizing: border-box;
            opacity: 0;
            pointer-events: none;
            background: rgba(7, 7, 14, 0.76);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            transition: opacity 0.2s ease;
            display: flex;
            flex-direction: column;
            gap: 10px;
            overflow: hidden;
        }
        .anima-background-card:hover .anima-background-tags-overlay {
            opacity: 1;
            pointer-events: auto;
        }
        .anima-background-tags-title {
            border: 1px solid rgba(219,39,119,0.32);
            background: rgba(219,39,119,0.16);
            color: #fce7f3;
            border-radius: 999px;
            padding: 6px 9px;
            font-size: 11px;
            font-weight: 850;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            width: 100%;
            min-width: 0;
        }
        .anima-background-tags-list {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            align-content: flex-start;
            overflow-y: auto;
            min-height: 0;
            padding-right: 2px;
            scrollbar-width: none;
            -ms-overflow-style: none;
        }
        .anima-background-tags-list::-webkit-scrollbar { display: none; }
        .anima-background-tag-pill {
            border: 1px solid rgba(255,255,255,0.1);
            background: rgba(255,255,255,0.07);
            color: #e5e7eb;
            border-radius: 999px;
            padding: 4px 7px;
            font-size: 10.5px;
            font-weight: 650;
            line-height: 1.15;
            cursor: pointer;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .anima-background-tag-pill:hover {
            border-color: rgba(219,39,119,0.45);
            color: #fff;
            background: rgba(219,39,119,0.22);
        }
        .anima-background-create-card {
            position: relative;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            border-radius: 16px;
            border: 2px dashed rgba(219,39,119,0.42);
            background: rgba(22,22,32,0.42);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            user-select: none;
            transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
        }
        .anima-background-create-card:hover {
            border-color: rgba(219,39,119,0.86);
            background: rgba(219,39,119,0.07);
            box-shadow: 0 12px 30px rgba(0,0,0,0.32), 0 0 18px rgba(219,39,119,0.16);
        }
        .anima-background-create-card-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
            color: #f472b6;
            padding: 18px;
            text-align: center;
            transition: transform 0.2s ease, color 0.2s ease;
        }
        .anima-background-create-card:hover .anima-background-create-card-content {
            color: #fff;
            transform: scale(1.06);
        }
        .anima-background-icon-btn {
            position: absolute;
            right: 9px;
            z-index: 7;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: rgba(10,10,15,0.48);
            border: 1px solid rgba(255,255,255,0.12);
            backdrop-filter: blur(5px);
            color: #e5e7eb;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: transform 0.15s ease, background 0.15s ease, color 0.15s ease;
        }
        .anima-background-icon-btn:hover {
            transform: scale(1.1);
            background: rgba(10,10,15,0.72);
            color: #f9a8d4;
        }
        .anima-background-selected-mark {
            position: absolute;
            top: 9px;
            left: 9px;
            z-index: 7;
            width: 24px;
            height: 24px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(10,10,15,0.52);
            border: 1px solid rgba(255,255,255,0.28);
            color: #fff;
            transition: all 0.15s ease;
        }
        .anima-background-card.selected .anima-background-selected-mark {
            background: #db2777;
            border-color: #db2777;
        }
        .anima-background-popover {
            position: fixed;
            z-index: 1000000;
            min-width: 170px;
            max-height: 280px;
            overflow-y: auto;
            background: #1c1c1e;
            border: 1px solid rgba(255,255,255,0.14);
            border-radius: 12px;
            padding: 10px;
            box-shadow: 0 14px 34px rgba(0,0,0,0.52);
        }
    `;
    document.head.appendChild(styleSheet);

    const overlay = createEl("div");
    overlay.id = "anima-background-selector-overlay";
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(10, 10, 15, 0.74);
        backdrop-filter: blur(15px);
        -webkit-backdrop-filter: blur(15px);
        color: #f3f4f6;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    `;

    const container = createEl("div");
    container.style.cssText = `
        width: 94vw;
        max-width: 1360px;
        height: 91vh;
        background: #171718;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 24px;
        overflow: hidden;
        box-shadow: 0 25px 60px rgba(0,0,0,0.58);
        display: flex;
        flex-direction: column;
        animation: animaBackgroundFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    `;

    overlay.onclick = (event) => {
        if (event.target === overlay) closeModal();
    };

    const header = createEl("div");
    header.style.cssText = `
        padding: 20px 26px 16px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        background: linear-gradient(180deg, rgba(219,39,119,0.08), rgba(23,23,24,0));
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
    `;

    const titleWrap = createEl("div");
    titleWrap.style.cssText = "min-width: 240px;";
    const title = createEl("div", null, t("Anima Background Tag Selector"));
    title.style.cssText = "font-size: 20px; font-weight: 850; color: #fff; line-height: 1.2;";
    const subtitle = createEl("div", null, t("Browse and select background prompt tags with visual preview cards."));
    subtitle.style.cssText = "font-size: 12.5px; color: #a1a1aa; margin-top: 5px;";
    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);

    const searchInput = createEl("input", "anima-background-input");
    searchInput.type = "search";
    searchInput.placeholder = t("Search background or tags...");
    searchInput.value = "";
    searchInput.style.cssText += "flex: 1; min-width: 260px;";

    const closeBtn = createEl("button", "anima-background-btn", t("Cancel"));
    closeBtn.onclick = () => closeModal();

    const headerActions = createEl("div");
    headerActions.style.cssText = "display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex: 0 0 auto;";
    headerActions.appendChild(createPromoLinks({ accentColor: THEME.accentText }));
    headerActions.appendChild(closeBtn);

    header.appendChild(titleWrap);
    header.appendChild(searchInput);
    header.appendChild(headerActions);
    container.appendChild(header);

    const toolbar = createEl("div");
    toolbar.style.cssText = `
        padding: 14px 26px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        background: rgba(18,18,24,0.42);
    `;

    const filterControls = createEl("div");
    filterControls.style.cssText = "display: flex; align-items: center; gap: 10px; min-width: 0; flex-wrap: wrap;";

    const sortSelect = createEl("select", "anima-background-select");
    sortSelect.innerHTML = `
        <option value="id-desc">${t("Latest")}</option>
        <option value="id-asc">${t("Oldest")}</option>
        <option value="name-asc">${t("Name A-Z")}</option>
        <option value="name-desc">${t("Name Z-A")}</option>
        <option value="favorite-desc">${t("Favorites First ★")}</option>
        <option value="random">${t("Random")}</option>
    `;
    sortSelect.value = activeSort;
    sortSelect.onchange = () => {
        activeSort = sortSelect.value;
        localStorage.setItem(SORT_STORAGE_KEY, activeSort);
        currentPage = 1;
        triggerFilter();
    };

    const langSelect = createEl("select", "anima-background-select");
    langSelect.innerHTML = `
        <option value="bilingual">${t("Bilingual")}</option>
        <option value="en">${t("English Only")}</option>
    `;
    langSelect.value = displayLang;
    langSelect.onchange = () => {
        displayLang = langSelect.value;
        localStorage.setItem(DISPLAY_LANG_STORAGE_KEY, displayLang);
        renderSidebar();
        renderCurrentPage();
    };

    filterControls.appendChild(sortSelect);
    filterControls.appendChild(langSelect);

    const actionControls = createEl("div");
    actionControls.style.cssText = "display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end;";

    const copySelectedBtn = createEl("button", "anima-background-btn");
    copySelectedBtn.innerHTML = `${copyIcon()} ${t("Copy Selected")}`;
    copySelectedBtn.onclick = () => {
        const text = buildSelectedText();
        if (!text) {
            alert(t("Please select at least one background scene first."));
            return;
        }
        copyText(text, () => showToast(t("Copied Successfully")));
    };

    const showSelectedOnlyBtn = createEl("button", "anima-background-btn", t("Show Selected"));
    showSelectedOnlyBtn.onclick = () => {
        showSelectedOnly = !showSelectedOnly;
        showSelectedOnlyBtn.classList.toggle("active", showSelectedOnly);
        currentPage = 1;
        triggerFilter();
    };

    const clearSelectedBtn = createEl("button", "anima-background-btn danger");
    clearSelectedBtn.innerHTML = `${trashIcon()} ${t("Clear Selected")}`;
    clearSelectedBtn.onclick = () => {
        if (selectedBackground.size === 0) return;
        selectedBackground.clear();
        updateCountLabel();
        renderCurrentPage();
    };

    actionControls.appendChild(copySelectedBtn);
    actionControls.appendChild(showSelectedOnlyBtn);
    actionControls.appendChild(clearSelectedBtn);
    toolbar.appendChild(filterControls);
    toolbar.appendChild(actionControls);
    container.appendChild(toolbar);

    const main = createEl("div");
    main.style.cssText = "display: flex; flex: 1; min-height: 0; background: rgba(10,10,15,0.18);";

    const sidebar = createEl("aside", "anima-background-scrollbar");
    sidebar.style.cssText = `
        width: 280px;
        flex: 0 0 280px;
        overflow-y: auto;
        padding: 18px 12px 18px 16px;
        border-right: 1px solid rgba(255,255,255,0.06);
        background: rgba(18,18,24,0.45);
        box-sizing: border-box;
    `;
    sidebar.onscroll = () => localStorage.setItem(SIDEBAR_SCROLL_STORAGE_KEY, sidebar.scrollTop);

    const gridArea = createEl("div");
    gridArea.style.cssText = "flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0;";

    const listContainer = createEl("div", "anima-background-scrollbar");
    listContainer.style.cssText = `
        flex: 1;
        overflow-y: auto;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        grid-auto-rows: 340px;
        justify-content: stretch;
        gap: 20px;
        align-content: start;
        padding: 24px 28px;
        min-height: 0;
    `;
    listContainer.onscroll = () => localStorage.setItem(SCROLL_STORAGE_KEY, listContainer.scrollTop);

    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const img = entry.target;
            if (img.dataset.lazySrc) {
                img.src = img.dataset.lazySrc;
                delete img.dataset.lazySrc;
            }
            imageObserver.unobserve(img);
        });
    }, { root: listContainer, rootMargin: "320px" });

    const pagination = createEl("div", "anima-background-pagination");

    const pageStats = createEl("div", "anima-background-pagination-stats");

    const pageControls = createEl("div", "anima-background-pagination-controls");

    const firstBtn = createEl("button", "anima-background-page-btn", t("First"));
    const prevBtn = createEl("button", "anima-background-page-btn", t("Prev"));
    const nextBtn = createEl("button", "anima-background-page-btn", t("Next"));
    const lastBtn = createEl("button", "anima-background-page-btn", t("Last"));
    const pageNumContainer = createEl("div", "anima-background-page-number");
    const pageInput = createEl("input", "anima-background-page-input");
    pageInput.type = "text";
    const totalPagesLabel = createEl("span");

    firstBtn.onclick = () => goToPage(1);
    prevBtn.onclick = () => goToPage(currentPage - 1);
    nextBtn.onclick = () => goToPage(currentPage + 1);
    lastBtn.onclick = () => goToPage(totalPages);
    pageInput.onkeydown = (event) => {
        if (event.key !== "Enter") return;
        const page = parseInt(pageInput.value, 10);
        if (!isNaN(page)) goToPage(page);
    };

    pageControls.appendChild(firstBtn);
    pageControls.appendChild(prevBtn);
    pageNumContainer.appendChild(pageInput);
    pageNumContainer.appendChild(totalPagesLabel);
    pageControls.appendChild(pageNumContainer);
    pageControls.appendChild(nextBtn);
    pageControls.appendChild(lastBtn);
    pagination.appendChild(pageStats);
    pagination.appendChild(pageControls);

    gridArea.appendChild(listContainer);
    gridArea.appendChild(pagination);
    main.appendChild(sidebar);
    main.appendChild(gridArea);
    container.appendChild(main);

    const footer = createEl("div");
    footer.style.cssText = `
        padding: 18px 26px;
        border-top: 1px solid rgba(255,255,255,0.06);
        background: rgba(18,18,24,0.68);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
    `;

    const countLabel = createEl("button", "anima-background-btn active");
    countLabel.onclick = () => showSelectedOnlyBtn.click();

    const footerBtns = createEl("div");
    footerBtns.style.cssText = "display: flex; align-items: center; gap: 10px;";
    const cancelFooterBtn = createEl("button", "anima-background-btn", t("Cancel"));
    cancelFooterBtn.onclick = () => closeModal();
    const applyBtn = createEl("button", "anima-background-btn primary", t("Confirm & Apply"));
    applyBtn.onclick = () => applySelectionAndClose();

    footerBtns.appendChild(cancelFooterBtn);
    footerBtns.appendChild(applyBtn);
    footer.appendChild(countLabel);
    footer.appendChild(footerBtns);
    container.appendChild(footer);

    overlay.appendChild(container);
    document.body.appendChild(overlay);

    searchInput.addEventListener("input", debounce(() => {
        currentPage = 1;
        triggerFilter();
    }, 140));

    function renderSidebar() {
        sidebar.innerHTML = "";
        const clearFiltersBtn = createEl("button", "anima-background-clear-filters-btn");
        clearFiltersBtn.type = "button";
        clearFiltersBtn.innerHTML = `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <span>${t("Clear Filters")}</span>
        `;
        clearFiltersBtn.disabled = !hasActiveSidebarFilters();
        clearFiltersBtn.onclick = clearSidebarFilters;
        sidebar.appendChild(clearFiltersBtn);

        sidebar.appendChild(collectionsSectionHeader());

        const collectionsContent = createEl("div");
        collectionsContent.style.cssText = collectionsCollapsed ? "display: none;" : "display: flex; flex-direction: column;";
        if (!collectionsCollapsed) {
            const allItem = sidebarItem(t("All Backgrounds"), activeFilters.collection === "all", backgroundData.length);
            allItem.onclick = () => switchCollection("all");
            collectionsContent.appendChild(allItem);

            const defaultCount = favoriteItems.filter(item => item.groupIds?.includes("default")).length;
            const defaultItem = sidebarItem(t("My Favorites"), activeFilters.collection === "default", defaultCount);
            defaultItem.onclick = () => switchCollection("default");
            collectionsContent.appendChild(defaultItem);

            groups.filter(group => group.id !== "default").forEach(group => {
                const groupCount = favoriteItems.filter(item => item.groupIds?.includes(group.id)).length;
                const row = sidebarItem(group.name, activeFilters.collection === group.id, groupCount);
                row.onclick = () => switchCollection(group.id);
                const tools = createEl("span");
                tools.style.cssText = "display: inline-flex; gap: 5px;";
                const rename = createEl("button");
                rename.title = t("Rename Group");
                rename.innerHTML = editIcon();
                rename.style.cssText = miniToolStyle();
                rename.onclick = (event) => {
                    event.stopPropagation();
                    openTextInputModal(t("Rename Group"), t("Enter new group name..."), group.name, async value => {
                        group.name = value;
                        await saveFavorites();
                        renderSidebar();
                        return true;
                    });
                };
                const del = createEl("button");
                del.title = t("Delete Group");
                del.innerHTML = trashIcon(12);
                del.style.cssText = miniToolStyle("#fca5a5");
                del.onclick = async (event) => {
                    event.stopPropagation();
                    if (!confirm(t("Are you sure you want to delete this group? Items inside won't be deleted."))) return;
                    groups = groups.filter(g => g.id !== group.id);
                    favoriteItems.forEach(item => {
                        item.groupIds = (item.groupIds || []).filter(id => id !== group.id);
                    });
                    favoriteMap.forEach(item => {
                        item.groupIds = (item.groupIds || []).filter(id => id !== group.id);
                        if (!item.groupIds.length) favoriteSet.delete(String(item.id || item.name || ""));
                    });
                    if (activeFilters.collection === group.id) activeFilters.collection = "all";
                    persistFilters();
                    await saveFavorites();
                    renderSidebar();
                    triggerFilter();
                };
                tools.appendChild(rename);
                tools.appendChild(del);
                row.appendChild(tools);
                collectionsContent.appendChild(row);
            });
        }
        sidebar.appendChild(collectionsContent);

        sidebar.appendChild(sectionTitle(t("Categories")));
        CATEGORY_LIST.forEach(category => {
            const row = createEl("label", "anima-background-check-row");
            row.innerHTML = `
                <input type="checkbox" ${activeFilters.categories.has(category) ? "checked" : ""}>
                <span>${escapeHtml(getCategoryLabel(category, displayLang))}</span>
            `;
            row.querySelector("input").onchange = (event) => {
                if (event.target.checked) activeFilters.categories.add(category);
                else activeFilters.categories.delete(category);
                currentPage = 1;
                persistFilters();
                updateClearFiltersButtonState();
                triggerFilter();
            };
            sidebar.appendChild(row);
        });

        sidebar.appendChild(sectionTitle(t("Traits")));
        allTraits.forEach(trait => {
            const zh = getTraitZh(trait.name, backgroundData);
            const label = displayLang === "bilingual" && zh ? `${trait.name} (${zh})` : trait.name;
            const row = createEl("label", "anima-background-check-row");
            row.innerHTML = `
                <input type="checkbox" ${activeFilters.traits.has(trait.name) ? "checked" : ""}>
                <span style="min-width:0;">${escapeHtml(label)} <span style="color:#71717a;">${trait.count}</span></span>
            `;
            row.querySelector("input").onchange = (event) => {
                if (event.target.checked) activeFilters.traits.add(trait.name);
                else activeFilters.traits.delete(trait.name);
                currentPage = 1;
                persistFilters();
                updateClearFiltersButtonState();
                triggerFilter();
            };
            sidebar.appendChild(row);
        });

        if (lastSidebarScrollTop > 0) {
            sidebar.scrollTop = lastSidebarScrollTop;
            setTimeout(() => sidebar.scrollTop = lastSidebarScrollTop, 60);
        }
    }

    function collectionsSectionHeader() {
        const header = createEl("div", "anima-background-section-header foldable");
        const title = createEl("span", "anima-background-section-title", t("Collections"));
        const spacer = createEl("span", "anima-background-section-spacer");
        const addBtn = createEl("button", "anima-background-section-icon-btn");
        addBtn.type = "button";
        addBtn.title = t("Create Group");
        addBtn.innerHTML = "+";
        const arrow = createEl("span", `anima-background-section-arrow${collectionsCollapsed ? " collapsed" : ""}`);
        arrow.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

        addBtn.onclick = (event) => {
            event.stopPropagation();
            openCreateGroupModal();
        };
        header.onclick = () => {
            collectionsCollapsed = !collectionsCollapsed;
            localStorage.setItem(COLLECTIONS_COLLAPSE_STORAGE_KEY, String(collectionsCollapsed));
            renderSidebar();
        };

        header.appendChild(title);
        header.appendChild(spacer);
        header.appendChild(addBtn);
        header.appendChild(arrow);
        return header;
    }

    function openCreateGroupModal() {
        openTextInputModal(t("Create New Group"), t("Enter group name..."), "", async value => {
            groups.push({ id: `group_${Date.now()}`, name: value, isSystem: false });
            await saveFavorites();
            collectionsCollapsed = false;
            localStorage.setItem(COLLECTIONS_COLLAPSE_STORAGE_KEY, "false");
            renderSidebar();
            return true;
        });
    }

    function sectionTitle(label) {
        return createEl("div", "anima-background-section-header", label);
    }

    function sidebarItem(label, active, count) {
        const row = createEl("div", `anima-background-sidebar-item${active ? " active" : ""}`);
        const nameSpan = createEl("span", null, label);
        nameSpan.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;";
        const countSpan = createEl("span", null, String(count || 0));
        countSpan.style.cssText = "color:#71717a;font-size:11px;flex:0 0 auto;";
        row.appendChild(nameSpan);
        row.appendChild(countSpan);
        return row;
    }

    function switchCollection(collection) {
        activeFilters.collection = collection;
        currentPage = 1;
        listContainer.scrollTop = 0;
        persistFilters();
        renderSidebar();
        triggerFilter();
    }

    function hasActiveSidebarFilters() {
        return activeFilters.collection !== "all" ||
            activeFilters.categories.size > 0 ||
            activeFilters.traits.size > 0;
    }

    function updateClearFiltersButtonState() {
        const clearFiltersBtn = sidebar.querySelector(".anima-background-clear-filters-btn");
        if (clearFiltersBtn) {
            clearFiltersBtn.disabled = !hasActiveSidebarFilters();
        }
    }

    function clearSidebarFilters() {
        if (!hasActiveSidebarFilters()) return;
        activeFilters.collection = "all";
        activeFilters.categories.clear();
        activeFilters.traits.clear();
        currentPage = 1;
        listContainer.scrollTop = 0;
        persistFilters();
        renderSidebar();
        triggerFilter();
    }

    function triggerFilter() {
        const query = searchInput.value.toLowerCase().trim();
        const aliases = {
            "海滩": ["beach", "sea", "water", "sand"],
            "大海": ["sea", "ocean", "water", "beach"],
            "森林": ["forest", "nature", "greenery", "outdoor"],
            "城市": ["city", "street", "urban"],
            "街道": ["street", "city", "urban"],
            "教室": ["classroom", "school"],
            "房间": ["room", "home", "indoor"],
            "室内": ["indoor", "home", "room"],
            "室外": ["outdoor", "nature", "sky"],
            "夜晚": ["night", "moonlight", "stars"],
            "白天": ["day", "sunlight", "sky"],
            "天空": ["sky", "clouds", "sunlight"],
            "赛博": ["cyber", "neon", "scifi"],
            "科幻": ["scifi", "cyber", "space"],
            "幻想": ["fantasy", "magic", "surreal"],
        };
        let queryList = query ? [query] : [];
        for (const [key, values] of Object.entries(aliases)) {
            if (query.includes(key)) queryList = queryList.concat(values);
        }

        let items = [];
        let customItems = [];
        if (showSelectedOnly) {
            customItems = favoriteItems.filter(item => item.isCustom && selectedBackground.has(getItemKey(item)));
            items = backgroundData.filter(item => selectedBackground.has(getItemKey(item)));
        } else {
            const groupIds = new Set();
            if (activeFilters.collection !== "all") {
                favoriteItems.forEach(item => {
                    if (item.groupIds?.includes(activeFilters.collection) && !item.isCustom) {
                        groupIds.add(String(item.id || item.name || ""));
                    }
                });
            }

            items = backgroundData.filter(item => {
                if (activeFilters.collection !== "all" && !groupIds.has(String(item.id))) return false;

                if (queryList.length > 0) {
                    const haystack = [
                        item.id,
                        item.name,
                        item.name_zh,
                        item.tags,
                        item.tags_zh,
                        ...(Array.isArray(item.categories) ? item.categories : []),
                        ...(Array.isArray(item.traits) ? item.traits : []),
                    ].join(" ").toLowerCase();
                    if (!queryList.some(q => haystack.includes(q))) return false;
                }

                if (activeFilters.categories.size > 0) {
                    const categories = Array.isArray(item.categories) ? item.categories : [];
                    if (!categories.some(category => activeFilters.categories.has(category))) return false;
                }

                if (activeFilters.traits.size > 0) {
                    const traits = Array.isArray(item.traits) ? item.traits : [];
                    if (!Array.from(activeFilters.traits).every(trait => traits.includes(trait))) return false;
                }

                return true;
            });

            if (activeFilters.collection !== "all") {
                customItems = favoriteItems.filter(item => item.isCustom && item.groupIds?.includes(activeFilters.collection));
            } else {
                customItems = favoriteItems.filter(item => item.isCustom);
            }

            if (queryList.length > 0) {
                customItems = customItems.filter(item => {
                    const haystack = [item.nickname, item.name, item.customContent].join(" ").toLowerCase();
                    return queryList.some(q => haystack.includes(q));
                });
            }
        }

        if (activeSort === "id-desc") {
            items.sort((a, b) => String(b.id).localeCompare(String(a.id)));
        } else if (activeSort === "id-asc") {
            items.sort((a, b) => String(a.id).localeCompare(String(b.id)));
        } else if (activeSort === "name-asc") {
            items.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
        } else if (activeSort === "name-desc") {
            items.sort((a, b) => String(b.name || "").localeCompare(String(a.name || "")));
        } else if (activeSort === "favorite-desc") {
            items.sort((a, b) => Number(favoriteSet.has(String(b.id))) - Number(favoriteSet.has(String(a.id))) || String(a.name || "").localeCompare(String(b.name || "")));
        } else if (activeSort === "random") {
            items = items.slice();
            for (let i = items.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [items[i], items[j]] = [items[j], items[i]];
            }
        }

        filteredData = [...customItems, ...items];
        totalPages = Math.max(1, Math.ceil(filteredData.length / 48));
        currentPage = Math.max(1, Math.min(currentPage, totalPages));
        localStorage.setItem(PAGE_STORAGE_KEY, currentPage);
        updatePaginationBar();
        renderCurrentPage();
    }

    function updatePaginationBar() {
        const total = filteredData.length;
        const start = total === 0 ? 0 : (currentPage - 1) * 48 + 1;
        const end = Math.min(currentPage * 48, total);
        pageStats.innerText = t("Total {total} background scenes | Showing {start}-{end}", { total, start, end });
        pageInput.value = String(currentPage);
        totalPagesLabel.innerText = `/ ${totalPages}`;
        firstBtn.disabled = currentPage <= 1;
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;
        lastBtn.disabled = currentPage >= totalPages;
    }

    function goToPage(page) {
        if (page < 1 || page > totalPages) {
            pageInput.value = String(currentPage);
            return;
        }
        currentPage = page;
        localStorage.setItem(PAGE_STORAGE_KEY, currentPage);
        listContainer.scrollTop = 0;
        localStorage.setItem(SCROLL_STORAGE_KEY, 0);
        updatePaginationBar();
        renderCurrentPage();
    }

    function renderCurrentPage() {
        imageObserver.disconnect();
        listContainer.innerHTML = "";
        const isCustomGroup = !showSelectedOnly && activeFilters.collection !== "all" && activeFilters.collection !== "default";

        if (filteredData.length === 0 && !isCustomGroup) {
            const empty = createEl("div");
            empty.style.cssText = "grid-column:1/-1; padding:70px 20px; text-align:center; color:#a1a1aa;";
            empty.innerHTML = `
                <div style="font-size:38px;font-weight:900;color:${THEME.accentText};margin-bottom:12px;">0</div>
                <div style="font-size:16px;font-weight:800;color:#fff;">${escapeHtml(t("No matching background scenes found"))}</div>
                <div style="font-size:13px;margin-top:8px;">${escapeHtml(t("Try another search or clear filters."))}</div>
            `;
            listContainer.appendChild(empty);
            updateCountLabel();
            return;
        }

        const fragment = document.createDocumentFragment();
        const pageItems = filteredData.slice((currentPage - 1) * 48, currentPage * 48);
        if (isCustomGroup && currentPage === 1) {
            fragment.appendChild(createCustomPlaceholderCard());
        }
        pageItems.forEach(item => fragment.appendChild(createCard(item)));
        listContainer.appendChild(fragment);

        if (lastScrollTop > 0) {
            listContainer.scrollTop = lastScrollTop;
            setTimeout(() => listContainer.scrollTop = lastScrollTop, 50);
            lastScrollTop = 0;
        }
        updateCountLabel();
    }

    function createCustomPlaceholderCard() {
        const card = createEl("article", "anima-background-create-card");
        const content = createEl("div", "anima-background-create-card-content");
        content.innerHTML = `
            <div style="font-size:46px;line-height:1;font-weight:300;">+</div>
            <div style="font-size:13.5px;font-weight:800;">${escapeHtml(t("Create Custom Item"))}</div>
        `;
        card.appendChild(content);
        card.onclick = event => {
            event.stopPropagation();
            openCustomItemCreateModal(async (titleValue, contentValue) => {
                const item = {
                    name: `custom_${Date.now()}`,
                    nickname: titleValue,
                    customContent: contentValue,
                    groupIds: [activeFilters.collection],
                    isCustom: true,
                };
                favoriteItems.push(item);
                if (!(await saveFavorites())) {
                    favoriteItems = favoriteItems.filter(existing => existing.name !== item.name);
                    return false;
                }
                renderSidebar();
                triggerFilter();
                return true;
            });
        };
        return card;
    }

    function createCard(item) {
        const key = getItemKey(item);
        const isSelected = selectedBackground.has(key);
        const isFavorite = !item.isCustom && favoriteSet.has(String(item.id));
        const favInfo = item.isCustom ? item : favoriteMap.get(String(item.id));
        const nickname = favInfo?.nickname || "";

        const card = createEl("article", `anima-background-card${isSelected ? " selected" : ""}`);
        card.dataset.key = key;

        const clip = createEl("div", "anima-background-card-clip");
        card.appendChild(clip);

        const placeholder = createEl("div", "anima-background-placeholder");
        placeholder.innerText = item.isCustom ? "T" : (formatDisplayName(item, displayLang).trim().charAt(0).toUpperCase() || "?");
        clip.appendChild(placeholder);

        let loader = null;
        if (item.isCustom) {
            placeholder.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
                    <div style="font-size:42px;">T</div>
                    <div style="font-size:11px;font-weight:850;color:#f9a8d4;background:rgba(219,39,119,0.14);border:1px solid rgba(219,39,119,0.28);border-radius:999px;padding:3px 9px;">CUSTOM</div>
                </div>
            `;
        } else if (item.preview) {
            const img = document.createElement("img");
            img.alt = item.name || "";
            img.loading = "lazy";
            img.decoding = "async";
            const imgUrl = item.preview;
            if (isImageLoaded(imgUrl)) {
                img.src = imgUrl;
                img.style.opacity = "1";
            } else {
                img.dataset.lazySrc = imgUrl;
                loader = createEl("div", "anima-background-shimmer");
                const spinner = createEl("div", "anima-background-spinner");
                loader.appendChild(spinner);
                clip.appendChild(loader);
            }
            img.onload = () => {
                img.style.opacity = "1";
                placeholder.style.opacity = "0";
                loader?.remove();
                markImageLoaded(imgUrl);
            };
            img.onerror = () => {
                img.remove();
                loader?.remove();
                placeholder.style.opacity = "1";
            };
            clip.appendChild(img);
            imageObserver.observe(img);
        }

        const selectedMark = createEl("div", "anima-background-selected-mark");
        selectedMark.innerHTML = isSelected ? checkIcon() : "";
        card.appendChild(selectedMark);

        if (item.isCustom) {
            const deleteBtn = iconButton(9, trashIcon(14), t("Delete Custom Item"));
            deleteBtn.onclick = async (event) => {
                event.stopPropagation();
                if (!confirm(t("Are you sure you want to delete this custom item?"))) return;
                favoriteItems = favoriteItems.filter(existing => existing.name !== item.name);
                selectedBackground.delete(key);
                await saveFavorites();
                renderSidebar();
                triggerFilter();
            };
            card.appendChild(deleteBtn);
        } else {
            const favBtn = iconButton(9, heartIcon(isFavorite), t("My Favorites"));
            favBtn.onclick = async (event) => {
                event.stopPropagation();
                toggleFavorite(item);
                await saveFavorites();
                renderSidebar();
                if (activeFilters.collection !== "all" || activeSort === "favorite-desc") triggerFilter();
                else renderCurrentPage();
            };
            card.appendChild(favBtn);
        }

        const memoBtn = iconButton(45, editIcon(), t("Edit Nickname / Note"));
        memoBtn.style.display = (item.isCustom || isFavorite) ? "flex" : "none";
        memoBtn.onclick = (event) => {
            event.stopPropagation();
            openTextInputModal(t("Edit Nickname / Note"), t("Enter a nickname or descriptive note..."), nickname, async value => {
                if (item.isCustom) {
                    item.nickname = value;
                } else {
                    let fav = favoriteMap.get(String(item.id));
                    if (!fav) {
                        fav = { id: item.id, name: item.name, nickname: value, groupIds: ["default"], isCustom: false };
                        favoriteMap.set(String(item.id), fav);
                        favoriteSet.add(String(item.id));
                    } else {
                        fav.nickname = value;
                    }
                }
                await saveFavorites();
                renderSidebar();
                triggerFilter();
                return true;
            });
        };
        card.appendChild(memoBtn);

        const groupBtn = iconButton(81, folderIcon(), t("My Collections"));
        groupBtn.style.display = (!item.isCustom && isFavorite) ? "flex" : "none";
        groupBtn.onclick = (event) => {
            event.stopPropagation();
            const rect = groupBtn.getBoundingClientRect();
            openGroupSelectPopover(rect.left + rect.width / 2, rect.bottom, item);
        };
        card.appendChild(groupBtn);

        const mask = createEl("div", "anima-background-card-mask");
        clip.appendChild(mask);

        const tagsOverlay = createEl("div", "anima-background-tags-overlay");
        const promptTags = splitPromptTokens(item.isCustom ? item.customContent : item.tags);
        const promptTagsZh = splitPromptTokens(item.tags_zh);
        const titleBtn = createEl("button", "anima-background-tags-title");
        titleBtn.innerHTML = `
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(t("Prompt Tags"))} · ${promptTags.length}</span>
            <span style="font-size:10px;color:#f9a8d4;flex:0 0 auto;">${escapeHtml(t("Copy"))}</span>
        `;
        titleBtn.onclick = (event) => {
            event.stopPropagation();
            const text = promptTags.length ? `${promptTags.join(", ")}, ` : "";
            if (text) copyText(text, () => showToast(t("Copied Successfully")));
        };
        tagsOverlay.appendChild(titleBtn);

        const tagsList = createEl("div", "anima-background-tags-list");
        promptTags.forEach((tag, index) => {
            const zh = promptTagsZh[index] || "";
            const displayTag = displayLang === "bilingual" && zh ? `${tag} (${zh})` : tag;
            const pill = createEl("span", "anima-background-tag-pill", displayTag);
            pill.title = displayTag;
            pill.onclick = (event) => {
                event.stopPropagation();
                copyText(tag, () => showToast(t("Copied: {text}", { text: tag })));
            };
            tagsList.appendChild(pill);
        });
        tagsOverlay.appendChild(tagsList);
        clip.appendChild(tagsOverlay);

        const info = createEl("div", "anima-background-card-info");
        const titleEl = createEl("div", "anima-background-card-title");
        const displayName = formatDisplayName(item, displayLang);
        titleEl.innerText = displayName;
        titleEl.title = item.isCustom ? item.customContent || "" : `${item.name_zh || ""}${item.name_zh ? " / " : ""}${item.name || ""}`;
        const subEl = createEl("div", "anima-background-card-sub");
        if (item.isCustom) {
            subEl.innerText = t("Custom");
        } else if (displayLang === "bilingual" && item.name_zh) {
            subEl.innerText = item.name || "";
        } else {
            const firstCategory = Array.isArray(item.categories) && item.categories.length > 0 ? item.categories[0] : "";
            subEl.innerText = firstCategory ? getCategoryLabel(firstCategory, "en") : String(item.id || "");
        }

        if (nickname && !item.isCustom) {
            const note = createEl("div", "anima-background-card-sub", nickname);
            note.style.color = THEME.accentText;
            info.appendChild(titleEl);
            info.appendChild(note);
        } else {
            info.appendChild(titleEl);
        }
        info.appendChild(subEl);

        clip.appendChild(info);

        card.onclick = () => {
            if (selectedBackground.has(key)) selectedBackground.delete(key);
            else selectedBackground.add(key);
            updateCardSelection(card, selectedBackground.has(key));
            updateCountLabel();
        };

        return card;
    }

    function updateCardSelection(card, selected) {
        card.classList.toggle("selected", selected);
        const mark = card.querySelector(".anima-background-selected-mark");
        if (mark) mark.innerHTML = selected ? checkIcon() : "";
    }

    function badge(text) {
        const el = createEl("span", "anima-background-badge", text);
        el.title = text;
        return el;
    }

    function iconButton(top, html, titleText) {
        const btn = createEl("button", "anima-background-icon-btn");
        btn.style.top = `${top}px`;
        btn.innerHTML = html;
        btn.title = titleText;
        return btn;
    }

    function toggleFavorite(item) {
        const key = String(item.id);
        if (favoriteSet.has(key)) {
            favoriteSet.delete(key);
            const fav = favoriteMap.get(key);
            if (fav) fav.groupIds = [];
        } else {
            favoriteSet.add(key);
            let fav = favoriteMap.get(key);
            if (!fav) {
                fav = { id: item.id, name: item.name, nickname: "", groupIds: ["default"], isCustom: false };
                favoriteMap.set(key, fav);
            } else if (!Array.isArray(fav.groupIds) || fav.groupIds.length === 0) {
                fav.groupIds = ["default"];
            }
        }
    }

    function openGroupSelectPopover(x, y, item) {
        const existing = document.getElementById("anima-background-group-popover");
        if (existing) existing.remove();

        const popover = createEl("div", "anima-background-popover");
        popover.id = "anima-background-group-popover";
        popover.style.left = `${x}px`;
        popover.style.top = `${y + 8}px`;
        popover.style.transform = "translateX(-50%)";

        let fav = favoriteMap.get(String(item.id));
        if (!fav) {
            fav = { id: item.id, name: item.name, nickname: "", groupIds: ["default"], isCustom: false };
            favoriteMap.set(String(item.id), fav);
            favoriteSet.add(String(item.id));
        }

        groups.forEach(group => {
            const label = createEl("label");
            label.style.cssText = "display:flex;align-items:center;gap:8px;color:#e2e8f0;font-size:13px;padding:6px;border-radius:8px;cursor:pointer;";
            label.onmouseover = () => label.style.background = "rgba(255,255,255,0.06)";
            label.onmouseout = () => label.style.background = "transparent";
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = (fav.groupIds || []).includes(group.id);
            checkbox.style.accentColor = THEME.accent;
            checkbox.onchange = async () => {
                if (!Array.isArray(fav.groupIds)) fav.groupIds = [];
                if (checkbox.checked && !fav.groupIds.includes(group.id)) fav.groupIds.push(group.id);
                if (!checkbox.checked) fav.groupIds = fav.groupIds.filter(id => id !== group.id);
                if (fav.groupIds.length === 0) favoriteSet.delete(String(item.id));
                else favoriteSet.add(String(item.id));
                await saveFavorites();
                renderSidebar();
                triggerFilter();
            };
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(group.isSystem ? t(group.name) : group.name));
            popover.appendChild(label);
        });

        const closeHandler = event => {
            if (!popover.contains(event.target)) {
                popover.remove();
                document.removeEventListener("mousedown", closeHandler);
            }
        };
        setTimeout(() => document.addEventListener("mousedown", closeHandler), 40);
        document.body.appendChild(popover);
    }

    function openTextInputModal(titleText, placeholderText, defaultValue, callback) {
        const dialog = createModalShell();
        const content = dialog.firstChild;
        const titleNode = createEl("div", null, titleText);
        titleNode.style.cssText = "font-size:16px;font-weight:800;color:#fff;";
        const input = createEl("input", "anima-background-input");
        input.type = "text";
        input.value = defaultValue || "";
        input.placeholder = placeholderText;
        input.style.cssText += "width:100%;box-sizing:border-box;";
        const buttons = modalButtons(dialog, async () => {
            const value = input.value.trim();
            if (!value && titleText !== t("Edit Nickname / Note")) return false;
            return await callback(value);
        });
        content.appendChild(titleNode);
        content.appendChild(input);
        content.appendChild(buttons);
        document.body.appendChild(dialog);
        input.focus();
        input.onkeydown = event => {
            if (event.key === "Enter") buttons.querySelector(".primary").click();
            if (event.key === "Escape") dialog.remove();
        };
    }

    function openCustomItemCreateModal(callback) {
        const dialog = createModalShell(460);
        const content = dialog.firstChild;
        const titleNode = createEl("div", null, t("Create Custom Item"));
        titleNode.style.cssText = "font-size:16px;font-weight:800;color:#fff;";
        const titleInput = createEl("input", "anima-background-input");
        titleInput.type = "text";
        titleInput.placeholder = t("Item Title (e.g. My Style A)...");
        const contentInput = createEl("textarea", "anima-background-input");
        contentInput.placeholder = t("Enter prompt tags (e.g. masterpiece, highly detailed)...");
        contentInput.rows = 4;
        contentInput.style.cssText += "resize:vertical;font-family:monospace;";
        const buttons = modalButtons(dialog, async () => {
            const titleValue = titleInput.value.trim();
            const contentValue = contentInput.value.trim();
            if (!titleValue || !contentValue) {
                alert(t("Title and Content cannot be empty!"));
                return false;
            }
            return await callback(titleValue, contentValue);
        }, t("Create"));
        content.appendChild(titleNode);
        content.appendChild(titleInput);
        content.appendChild(contentInput);
        content.appendChild(buttons);
        document.body.appendChild(dialog);
        titleInput.focus();
    }

    function createModalShell(maxWidth = 400) {
        const dialog = createEl("div");
        dialog.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 100000;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        const content = createEl("div");
        content.style.cssText = `
            width: 90%;
            max-width: ${maxWidth}px;
            background: #1c1c1e;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 16px;
            padding: 22px;
            display: flex;
            flex-direction: column;
            gap: 14px;
            box-shadow: 0 18px 45px rgba(0,0,0,0.52);
            animation: animaBackgroundFadeIn 0.18s ease forwards;
        `;
        dialog.appendChild(content);
        dialog.onclick = event => {
            if (event.target === dialog) dialog.remove();
        };
        return dialog;
    }

    function modalButtons(dialog, onConfirm, confirmText = t("OK")) {
        const row = createEl("div");
        row.style.cssText = "display:flex;justify-content:flex-end;gap:10px;margin-top:6px;";
        const cancel = createEl("button", "anima-background-btn", t("Cancel"));
        cancel.onclick = () => dialog.remove();
        const confirmBtn = createEl("button", "anima-background-btn primary", confirmText);
        confirmBtn.onclick = async () => {
            confirmBtn.disabled = true;
            cancel.disabled = true;
            const shouldClose = await onConfirm();
            if (shouldClose !== false) {
                dialog.remove();
            } else {
                confirmBtn.disabled = false;
                cancel.disabled = false;
            }
        };
        row.appendChild(cancel);
        row.appendChild(confirmBtn);
        return row;
    }

    function buildSelectedText() {
        const tags = [];
        selectedBackground.forEach(key => {
            if (key.startsWith("custom:")) {
                const item = favoriteItems.find(fav => fav.isCustom && getItemKey(fav) === key);
                splitPromptTokens(item?.customContent || "").forEach(tag => tags.push(tag));
                return;
            }
            const item = dataById.get(key);
            splitPromptTokens(item?.tags || "").forEach(tag => tags.push(tag));
        });
        return tags.length ? `${tags.join(", ")}, ` : "";
    }

    function applySelectionAndClose() {
        const resultString = buildSelectedText();
        if (tagsWidget) {
            tagsWidget.value = resultString;
            if (tagsWidget.inputEl) {
                tagsWidget.inputEl.value = resultString;
                tagsWidget.inputEl.dispatchEvent(new Event("input"));
            }
            tagsWidget.callback?.(resultString);
        }
        node.triggerSlot?.(0);
        closeModal();
    }

    function updateCountLabel() {
        countLabel.innerHTML = `${checkIcon()} <span>${t("Selected: {count} background scenes", { count: selectedBackground.size })}</span>`;
    }

    function closeModal() {
        imageObserver.disconnect();
        document.getElementById("anima-background-group-popover")?.remove();
        overlay.remove();
        styleSheet.remove();
    }

    function showToast(message) {
        const toast = createEl("div", null, message);
        toast.style.cssText = `
            position: fixed;
            right: 30px;
            bottom: 30px;
            z-index: 100000;
            background: rgba(16,16,24,0.94);
            border: 1px solid rgba(219,39,119,0.45);
            color: #fff;
            padding: 10px 18px;
            border-radius: 12px;
            box-shadow: 0 12px 28px rgba(0,0,0,0.5);
            font-size: 13px;
            font-weight: 700;
            pointer-events: none;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.transition = "opacity 0.25s ease";
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 260);
        }, 1300);
    }

    function debounce(fn, ms) {
        let timer = null;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), ms);
        };
    }

    function miniToolStyle(color = "#e5e7eb") {
        return `border:0;background:transparent;color:${color};padding:2px;cursor:pointer;line-height:0;`;
    }

    function checkIcon(size = 14) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    }

    function heartIcon(filled) {
        return `<svg width="15" height="15" viewBox="0 0 24 24" fill="${filled ? THEME.accent : "none"}" stroke="${filled ? THEME.accent : "currentColor"}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
    }

    function editIcon(size = 14) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>`;
    }

    function folderIcon(size = 14) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
    }

    function trashIcon(size = 14) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
    }

    function copyIcon(size = 14) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    }

    renderSidebar();
    triggerFilter();
    updateCountLabel();
    searchInput.focus();
}
