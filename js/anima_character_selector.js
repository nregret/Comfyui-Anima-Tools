import { t } from "./i18n.js";
import { formatCount, normalizePromptToken, splitPromptTokens } from "./anima_selector_ui.js";
import "./character_data.js";

const SIDEBAR_STORAGE_KEY = "anima-char-selector-active-sidebar-category";
const ATTRIBUTE_FILTERS = ["gender", "hair", "eye", "series"];

let characterOfficialDataPromise = null;
const officialCharacterPending = new Map();

async function ensureCharacterOfficialData() {
    if (window.characterOfficialData) {
        return window.characterOfficialData;
    }
    if (!characterOfficialDataPromise) {
        const dataUrl = new URL("./character_official_data.json", import.meta.url);
        characterOfficialDataPromise = fetch(dataUrl)
            .then(response => response.ok ? response.json() : null)
            .then(data => {
                if (data && typeof data === "object") {
                    window.characterOfficialData = data;
                    return data;
                }
                return null;
            })
            .catch(err => {
                console.warn("[Anima Tools] Failed to load local official character tags", err);
                return null;
            });
    }
    return characterOfficialDataPromise;
}

export const characterSelector = {
    kind: "character",
    label: "Characters",
    icon: "user",
    widgetName: "character_tags",
    loading: "Anima character database is loading, please wait a few seconds...",
    ready: () => Boolean(window.characterData),
    createConfig: characterSelectorConfig,
};

function pushUniquePromptTokens(target, seen, value) {
    splitPromptTokens(value).forEach(token => {
        const key = normalizePromptToken(token);
        if (key && !seen.has(key)) {
            seen.add(key);
            target.push(token);
        }
    });
}

function getCharacterTrigger(item) {
    if (!item) return "";
    if (item.isCustom) return item.customContent || item.name || "";
    const source = item._officialData || item;
    if (source.trigger) return source.trigger;
    if (item.copyright) return `${item.name}, ${item.copyright}`;
    return item.name || "";
}

function getExplicitCharacterTags(item) {
    const tags = [];
    const seen = new Set();
    if (!item || item.isCustom) return tags;
    const source = item._officialData || item;

    pushUniquePromptTokens(tags, seen, source.tags);
    pushUniquePromptTokens(tags, seen, source.core_tags);
    pushUniquePromptTokens(tags, seen, source.coreTags);

    return tags;
}

function getCharacterTags(item) {
    const tags = getExplicitCharacterTags(item);
    const seen = new Set(tags.map(normalizePromptToken));
    if (!item || item.isCustom) return tags;

    if (tags.length === 0) {
        pushUniquePromptTokens(tags, seen, item.gender);
        if (item.hair) pushUniquePromptTokens(tags, seen, `${item.hair} hair`);
        if (item.eye) pushUniquePromptTokens(tags, seen, `${item.eye} eyes`);
    }

    return tags;
}

function getCharacterPromptParts(item, includeTags = false) {
    const parts = [];
    const seen = new Set();
    pushUniquePromptTokens(parts, seen, getCharacterTrigger(item));
    if (includeTags) {
        getCharacterTags(item).forEach(tag => pushUniquePromptTokens(parts, seen, tag));
    }
    return parts;
}

function formatTitle(text) {
    return String(text || "")
        .split(" ")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function getCharacterCacheKey(item) {
    return `${normalizePromptToken(item?.name)}||${normalizePromptToken(item?.copyright)}`;
}

async function fetchOfficialCharacterData(item) {
    if (!item || item.isCustom || getExplicitCharacterTags(item).length > 0) {
        return item?._officialData || item || null;
    }
    if (!window.characterOfficialData) {
        await ensureCharacterOfficialData();
    }
    const key = getCharacterCacheKey(item);
    const localOfficial = window.characterOfficialData?.[key];
    if (localOfficial) {
        item._officialData = localOfficial;
        return localOfficial;
    }
    if (officialCharacterPending.has(key)) {
        return officialCharacterPending.get(key);
    }

    const query = new URLSearchParams({
        name: item.name || "",
        copyright: item.copyright || ""
    });
    const request = fetch(`/anima-tools/character/official?${query.toString()}`)
        .then(response => response.ok ? response.json() : null)
        .then(payload => {
            if (payload?.success && payload.item) {
                item._officialData = {
                    ...payload.item,
                    tags: Array.isArray(payload.item.tags) ? payload.item.tags : splitPromptTokens(payload.item.tags)
                };
                return item._officialData;
            }
            return null;
        })
        .catch(err => {
            console.warn("[Anima Tools] Failed to load official character tags", item.name, err);
            return null;
        })
        .finally(() => {
            officialCharacterPending.delete(key);
        });
    officialCharacterPending.set(key, request);
    return request;
}

function getPopularCopyrights(data) {
    const counts = new Map();
    data.forEach(item => {
        if (item.copyright) counts.set(item.copyright, (counts.get(item.copyright) || 0) + 1);
    });
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 30);
}

function countBy(data, field) {
    const counts = new Map();
    data.forEach(item => {
        if (item[field]) counts.set(item[field], (counts.get(item[field]) || 0) + 1);
    });
    return counts;
}

function loadSavedFilters() {
    const filters = { type: "all", gender: null, hair: null, eye: null, series: null };
    try {
        const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
        if (saved?.startsWith("{")) Object.assign(filters, JSON.parse(saved));
        else if (saved === "favorites") filters.type = "default";
        else if (saved?.startsWith("gender:")) filters.gender = saved.split(":")[1];
        else if (saved?.startsWith("hair:")) filters.hair = saved.split(":")[1];
        else if (saved?.startsWith("eye:")) filters.eye = saved.split(":")[1];
        else if (saved && saved !== "all") filters.series = saved;
    } catch (e) {
        console.error("Failed to load active filters", e);
    }
    if (filters.type === "favorites") filters.type = "default";
    return filters;
}

const byPosts = (a, b) => (Number(b.post_count) || 0) - (Number(a.post_count) || 0);

function characterSelectorConfig() {
    ensureCharacterOfficialData();
    const data = window.characterData;
    const attemptedOfficial = new Set();
    const hairCounts = countBy(data, "hair");
    const eyeCounts = countBy(data, "eye");
    const genderCounts = countBy(data, "gender");
    const option = (counts, value, label) => ({ value, label, count: counts.get(value) || 0 });
    const filterDefs = [
        {
            id: "gender",
            label: t("Gender"),
            options: [option(genderCounts, "1girl", t("Female (1girl)")), option(genderCounts, "1boy", t("Male (1boy)"))],
            test: (item, value) => item.gender === value,
        },
        {
            id: "hair",
            label: t("Hair Color"),
            options: [
                option(hairCounts, "black", t("Black Hair")),
                option(hairCounts, "blonde", t("Blonde Hair")),
                option(hairCounts, "white", t("White/Silver")),
                option(hairCounts, "brown", t("Brown Hair")),
                option(hairCounts, "blue", t("Blue/Aqua")),
                option(hairCounts, "pink", t("Pink Hair")),
                option(hairCounts, "red", t("Red Hair")),
                option(hairCounts, "purple", t("Purple Hair")),
                option(hairCounts, "green", t("Green Hair")),
            ],
            test: (item, value) => item.hair === value,
        },
        {
            id: "eye",
            label: t("Eye Color"),
            options: [
                option(eyeCounts, "blue", t("Blue Eyes")),
                option(eyeCounts, "red", t("Red Eyes")),
                option(eyeCounts, "brown", t("Brown Eyes")),
                option(eyeCounts, "green", t("Green Eyes")),
                option(eyeCounts, "yellow", t("Yellow/Gold")),
                option(eyeCounts, "purple", t("Purple Eyes")),
                option(eyeCounts, "pink", t("Pink Eyes")),
            ],
            test: (item, value) => item.eye === value,
        },
        {
            id: "series",
            label: t("Hot Series"),
            options: getPopularCopyrights(data).map(([value, count]) => ({ value, label: formatTitle(value), count })),
            test: (item, value) => item.copyright === value,
        },
    ].map(def => ({ ...def, options: def.options.filter(entry => entry.count > 0) }));
    const optionLabel = (id, value) => filterDefs.find(def => def.id === id).options.find(entry => entry.value === value)?.label || value;
    const isPending = item => getExplicitCharacterTags(item).length === 0 && !attemptedOfficial.has(getCharacterCacheKey(item));

    return {
        data,
        pageSize: 60,
        cardAspect: "3 / 4",
        storage: {
            sort: "anima-char-selector-active-sort",
            page: "anima-char-selector-active-page",
            scroll: "anima-char-selector-active-scroll",
        },
        labels: {
            all: t("All Characters"),
            search: t("Search character name..."),
            empty: t("No matching characters found"),
            noSelection: t("Please select at least one character first."),
            selected: count => t("Selected: {count} characters", { count }),
            total: values => t("Total {total} characters | Showing {start}-{end}", values),
        },
        sortOptions: [
            { value: "works-desc", label: t("Illustrations Count ⬇") },
            { value: "works-asc", label: t("Illustrations Count ⬆") },
            { value: "fav-first", label: t("Favorites First ★") },
            { value: "name-asc", label: t("Name A-Z") },
            { value: "name-desc", label: t("Name Z-A") },
            { value: "copyright-asc", label: t("Series A-Z") },
        ],
        defaultSort: "works-desc",
        sort: (items, value, ctx) => items.sort({
            "works-desc": byPosts,
            "works-asc": (a, b) => byPosts(b, a),
            "fav-first": (a, b) => Number(ctx.isFavorite(b)) - Number(ctx.isFavorite(a)) || byPosts(a, b),
            "name-asc": (a, b) => String(a.name).localeCompare(String(b.name)),
            "name-desc": (a, b) => String(b.name).localeCompare(String(a.name)),
            "copyright-asc": (a, b) => String(a.copyright || "").localeCompare(String(b.copyright || "")) || byPosts(a, b),
        }[value]),
        filters: () => filterDefs,
        loadState: () => {
            const saved = loadSavedFilters();
            return { collection: saved.type, filters: saved };
        },
        saveState: ({ collection, filters }) => {
            const saved = { type: collection };
            ATTRIBUTE_FILTERS.forEach(id => saved[id] = filters[id] || null);
            localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(saved));
        },
        selectionKey: item => item.name,
        favoriteKey: item => item.name,
        favoriteRecord: item => ({ name: item.name, isCustom: false }),
        customItem: (title, content, groupId) => ({
            id: `custom_${Date.now()}`,
            name: title,
            nickname: title,
            groupIds: [groupId],
            isCustom: true,
            customContent: content,
        }),
        initialSelection: () => [],
        matches: (item, query) => String(item.name || "").toLowerCase().includes(query) || String(item.copyright || "").toLowerCase().includes(query),
        imageUrls: item => [`https://blobs.animadex.net/Outputs/thumbs/${encodeURIComponent(item.copyright ? `${item.name}, ${item.copyright}` : item.name)}.webp`],
        card: item => ({
            title: formatTitle(item.name),
            meta: formatTitle(item.copyright),
            stats: [{ icon: "image", text: formatCount(item.post_count), title: t("Works") }],
        }),
        detail: item => {
            const pending = isPending(item);
            const failed = attemptedOfficial.has(getCharacterCacheKey(item)) && !item._officialData;
            const tags = getCharacterTags(item);
            return {
                title: formatTitle(item.name),
                subtitle: formatTitle(item.copyright),
                pending,
                sections: [
                    { title: t("Trigger"), icon: "tag", accent: true, tags: getCharacterPromptParts(item).map(value => ({ value })) },
                    {
                        title: failed ? `${t("Tags")} · ${t("Official tags unavailable")}` : t("Tags"),
                        icon: "file",
                        loading: pending,
                        tags: tags.map(value => ({ value })),
                    },
                ],
                facts: [
                    { label: t("Series"), value: formatTitle(item.copyright) || "-" },
                    { label: t("Works"), value: Number(item.post_count || 0).toLocaleString() },
                    { label: t("Gender"), value: optionLabel("gender", item.gender) || "-" },
                    { label: t("Hair Color"), value: optionLabel("hair", item.hair) || "-" },
                    { label: t("Eye Color"), value: optionLabel("eye", item.eye) || "-" },
                ],
            };
        },
        loadDetail: async item => {
            await fetchOfficialCharacterData(item);
            attemptedOfficial.add(getCharacterCacheKey(item));
        },
        applyActions: [
            { label: t("Apply Trigger"), mode: "trigger" },
            { label: t("Apply Trigger + Tags"), mode: "tags", primary: true },
        ],
        prepareApply: items => Promise.all(items.map(fetchOfficialCharacterData)),
        buildOutput: (items, mode) => {
            const parts = [];
            const seen = new Set();
            items.forEach(item => getCharacterPromptParts(item, mode === "tags").forEach(tag => pushUniquePromptTokens(parts, seen, tag)));
            return parts.length ? `${parts.join(", ")}, ` : "";
        },
    };
}
