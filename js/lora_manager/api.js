import {
    API,
    SEARCH_CACHE_KEY,
    SEARCH_CACHE_LIMIT,
    SEARCH_CACHE_TTL,
    SEARCH_CACHE_VERSION,
} from "./constants.js";

export async function apiGet(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
        signal: options.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || `Request failed: ${response.status}`);
    }
    return data;
}

export async function apiPost(path, body) {
    const response = await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
        throw new Error(data.error || `Request failed: ${response.status}`);
    }
    return data;
}

const MODEL_DETAIL_TTL = 5 * 60 * 1000;
const MODEL_DETAIL_LIMIT = 60;
const modelDetails = new Map();

// Hover prefetch and both popups share these requests, so a click on a card
// that was hovered renders the full detail without waiting.
export function fetchModelDetail(id) {
    const key = String(id || "");
    const cached = modelDetails.get(key);
    if (cached && Date.now() - cached.time < MODEL_DETAIL_TTL) return cached.request;
    const entry = { time: Date.now(), model: null };
    entry.request = apiGet(`/model-detail?id=${encodeURIComponent(key)}`).then((data) => {
        entry.model = data.model || null;
        return entry.model;
    }, (error) => {
        modelDetails.delete(key);
        throw error;
    });
    modelDetails.delete(key);
    modelDetails.set(key, entry);
    if (modelDetails.size > MODEL_DETAIL_LIMIT) modelDetails.delete(modelDetails.keys().next().value);
    return entry.request;
}

export function peekModelDetail(id) {
    const entry = modelDetails.get(String(id || ""));
    return entry && Date.now() - entry.time < MODEL_DETAIL_TTL ? entry.model : null;
}

function searchCacheKey(path) {
    return `${SEARCH_CACHE_VERSION}:${path}`;
}

// Civitai pages can overlap; only items that are not on screen yet are kept.
export function unseenSearchItems(shown, page) {
    const ids = new Set(shown.map((item) => String(item.id)));
    return (Array.isArray(page) ? page : []).filter((item) => !ids.has(String(item.id)) && ids.add(String(item.id)));
}

export function getSearchCache(path) {
    try {
        const raw = localStorage.getItem(SEARCH_CACHE_KEY);
        if (!raw) return null;
        const cache = JSON.parse(raw);
        const entry = cache?.[searchCacheKey(path)];
        if (!entry || Date.now() - Number(entry.timestamp || 0) > SEARCH_CACHE_TTL) return null;
        return entry.data || null;
    } catch (_) {
        return null;
    }
}

export function setSearchCache(path, data) {
    let cache = {};
    try {
        cache = JSON.parse(localStorage.getItem(SEARCH_CACHE_KEY) || "{}") || {};
    } catch (_) {}
    const key = searchCacheKey(path);
    const entries = Object.entries(cache)
        .filter(([entryKey]) => entryKey !== key && entryKey.startsWith(`${SEARCH_CACHE_VERSION}:`))
        .sort((left, right) => Number(right[1]?.timestamp || 0) - Number(left[1]?.timestamp || 0));
    // Taxonomy is merged from every live response, so storing it only costs quota.
    entries.unshift([key, { data: { ...data, taxonomy: undefined }, timestamp: Date.now() }]);
    let kept = entries.slice(0, SEARCH_CACHE_LIMIT);
    while (kept.length) {
        try {
            localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(Object.fromEntries(kept)));
            return;
        } catch (error) {
            if (error?.name !== "QuotaExceededError") return;
            kept = kept.slice(0, -1);
        }
    }
}

export function clearSearchCache() {
    try {
        localStorage.removeItem(SEARCH_CACHE_KEY);
    } catch (_) {}
}
