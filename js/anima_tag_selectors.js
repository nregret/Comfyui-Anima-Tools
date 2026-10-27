import { t } from "./i18n.js";
import { normalizePromptToken, shuffleInPlace, splitPromptTokens } from "./anima_selector_ui.js";
import "./background_data.js";
import "./clothing_data.js";
import "./pose_data.js";

// Clothing, background and pose share one data shape: id, name, name_zh, tags, tags_zh, categories, traits, preview.
const TAG_SELECTOR_DEFS = [
    {
        kind: "clothing",
        label: "Clothing",
        widgetName: "clothing_tags",
        dataKey: "clothingData",
        icon: "shirt",
        restoreSelection: true,
        categories: ["Dress & Gown", "Casual & Daily", "Uniform & Suit", "Swimsuit & Lingerie", "Fantasy & Cosplay", "Revealing"],
        loading: "Anima clothing database is loading, please wait a few seconds...",
        text: {
            all: "All Clothing",
            search: "Search clothing or tags...",
            empty: "No matching clothing items found",
            noSelection: "Please select at least one clothing item first.",
            selected: "Selected: {count} clothing items",
            total: "Total {total} clothing items | Showing {start}-{end}",
        },
    },
    {
        kind: "background",
        label: "Background",
        widgetName: "background_tags",
        dataKey: "backgroundData",
        icon: "image",
        restoreSelection: false,
        categories: ["Nature & Outdoors", "Urban & Daily", "Fantasy & Sci-Fi", "Minimalist & Abstract"],
        loading: "Anima background database is loading, please wait a few seconds...",
        text: {
            all: "All Backgrounds",
            search: "Search background or tags...",
            empty: "No matching background scenes found",
            noSelection: "Please select at least one background scene first.",
            selected: "Selected: {count} background scenes",
            total: "Total {total} background scenes | Showing {start}-{end}",
        },
    },
    {
        kind: "pose",
        label: "Pose",
        widgetName: "pose_tags",
        dataKey: "poseData",
        icon: "pose",
        restoreSelection: false,
        categories: ["Gestures & Arms", "Standing & Dynamic", "Sitting Poses", "Lying & Prone", "Adjusting & Dressing", "Props & Holding", "Duo & Interaction", "Daily & Miscellaneous"],
        loading: "Anima pose database is loading, please wait a few seconds...",
        text: {
            all: "All Poses",
            search: "Search pose or tags...",
            empty: "No matching poses found",
            noSelection: "Please select at least one pose first.",
            selected: "Selected: {count} poses",
            total: "Total {total} poses | Showing {start}-{end}",
        },
    },
];

export const TAG_SELECTORS = TAG_SELECTOR_DEFS.map(selector => ({
    ...selector,
    ready: () => Boolean(window[selector.dataKey]),
    createConfig: widget => tagSelectorConfig(selector, widget),
}));

function englishCategory(category) {
    const text = String(category || "").trim();
    return text.match(/\(([^)]+)\)$/)?.[1] || text;
}

function itemKey(item) {
    return String(item.id || item.name || "");
}

function itemTitle(item, bilingual) {
    return bilingual && item.name_zh ? item.name_zh : item.name || "";
}

// Pair each English tag with its Chinese translation by position.
function buildTagTranslations(data) {
    const translations = new Map();
    data.forEach(item => {
        const zhList = splitPromptTokens(item.tags_zh);
        splitPromptTokens(item.tags).forEach((tag, index) => {
            const key = normalizePromptToken(tag);
            if (zhList[index] && !translations.has(key)) translations.set(key, zhList[index]);
        });
    });
    return translations;
}

function restoreSelection(text, data, customs) {
    const current = new Set(splitPromptTokens(text).map(normalizePromptToken));
    const covered = value => {
        const tokens = splitPromptTokens(value).map(normalizePromptToken);
        return tokens.length > 0 && tokens.every(token => current.has(token));
    };
    return [
        ...data.filter(item => covered(item.tags)),
        ...customs.filter(item => covered(item.customContent)),
    ];
}

const SORTERS = {
    "id-desc": (a, b) => String(b.id).localeCompare(String(a.id)),
    "id-asc": (a, b) => String(a.id).localeCompare(String(b.id)),
    "name-asc": (a, b) => String(a.name || "").localeCompare(String(b.name || "")),
    "name-desc": (a, b) => String(b.name || "").localeCompare(String(a.name || "")),
};

function tagSelectorConfig(selector, widget) {
    const { kind, text } = selector;
    const data = window[selector.dataKey];
    const filterStorageKey = `anima-${kind}-selector-filters`;
    const translations = buildTagTranslations(data);
    const categoryNames = new Map();
    const traitCounts = new Map();
    data.forEach(item => {
        (item.categories || []).forEach(category => categoryNames.set(englishCategory(category), category));
        (item.traits || []).forEach(trait => traitCounts.set(trait, (traitCounts.get(trait) || 0) + 1));
    });
    const traits = [...traitCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const categoryLabel = (category, bilingual) => bilingual ? categoryNames.get(category) || category : category;
    const tagHint = (tag, bilingual) => bilingual ? translations.get(normalizePromptToken(tag)) || "" : "";

    return {
        data,
        pageSize: 48,
        cardAspect: "2 / 3",
        storage: {
            sort: `anima-${kind}-selector-active-sort`,
            page: `anima-${kind}-selector-active-page`,
            scroll: `anima-${kind}-selector-active-scroll`,
        },
        labels: {
            all: t(text.all),
            search: t(text.search),
            empty: t(text.empty),
            noSelection: t(text.noSelection),
            selected: count => t(text.selected, { count }),
            total: values => t(text.total, values),
        },
        sortOptions: [
            { value: "id-desc", label: t("Latest") },
            { value: "id-asc", label: t("Oldest") },
            { value: "name-asc", label: t("Name A-Z") },
            { value: "name-desc", label: t("Name Z-A") },
            { value: "favorite-desc", label: t("Favorites First ★") },
            { value: "random", label: t("Random") },
        ],
        defaultSort: "id-asc",
        sort: (items, value, ctx) => {
            if (value === "random") return shuffleInPlace(items);
            if (value === "favorite-desc") return items.sort((a, b) => Number(ctx.isFavorite(b)) - Number(ctx.isFavorite(a)) || SORTERS["name-asc"](a, b));
            return items.sort(SORTERS[value]);
        },
        displayModes: {
            storageKey: `anima-${kind}-selector-display-lang`,
            defaultValue: "en",
            options: [
                { value: "bilingual", label: t("Bilingual") },
                { value: "en", label: t("English Only") },
            ],
        },
        filters: ctx => {
            const bilingual = ctx.displayMode === "bilingual";
            return [
                {
                    id: "categories",
                    label: t("Categories"),
                    multiple: true,
                    options: selector.categories.map(category => ({ value: category, label: categoryLabel(category, bilingual) })),
                    test: (item, values) => (item.categories || []).some(category => values.includes(englishCategory(category))),
                },
                {
                    id: "traits",
                    label: t("Traits"),
                    multiple: true,
                    options: traits.map(([trait, count]) => {
                        const hint = tagHint(trait, bilingual);
                        return { value: trait, label: hint ? `${trait} (${hint})` : trait, count };
                    }),
                    test: (item, values) => values.every(trait => (item.traits || []).includes(trait)),
                },
            ];
        },
        loadState: () => {
            try {
                const saved = JSON.parse(localStorage.getItem(filterStorageKey) || "{}");
                return {
                    collection: saved.collection || "all",
                    filters: { categories: (saved.categories || []).map(englishCategory), traits: saved.traits || [] },
                };
            } catch (e) {
                console.warn(`[Anima Tools] Failed to restore ${kind} filters`, e);
                return { collection: "all", filters: {} };
            }
        },
        saveState: ({ collection, filters }) => localStorage.setItem(filterStorageKey, JSON.stringify({
            categories: filters.categories,
            traits: filters.traits,
            collection,
        })),
        selectionKey: item => item.isCustom ? `custom:${item.name}` : itemKey(item),
        favoriteKey: itemKey,
        favoriteRecord: item => ({ id: item.id, name: item.name, isCustom: false }),
        customItem: (title, content, groupId) => ({
            name: `custom_${Date.now()}`,
            nickname: title,
            customContent: content,
            groupIds: [groupId],
            isCustom: true,
        }),
        initialSelection: customs => selector.restoreSelection ? restoreSelection(widget.value, data, customs) : [],
        matches: (item, query) => [
            item.id,
            item.name,
            item.name_zh,
            item.tags,
            item.tags_zh,
            ...(item.categories || []),
            ...(item.traits || []),
        ].join(" ").toLowerCase().includes(query),
        imageUrls: item => item.preview ? [item.preview] : [],
        card: (item, ctx) => {
            const bilingual = ctx.displayMode === "bilingual";
            const firstCategory = item.categories?.[0];
            return {
                title: itemTitle(item, bilingual),
                tooltip: [item.name_zh, item.name].filter(Boolean).join(" / "),
                meta: bilingual && item.name_zh ? item.name : (firstCategory ? englishCategory(firstCategory) : itemKey(item)),
            };
        },
        detail: (item, ctx) => {
            const bilingual = ctx.displayMode === "bilingual";
            const subtitle = bilingual && item.name_zh ? item.name : item.name_zh;
            return {
                title: itemTitle(item, bilingual),
                subtitle,
                sections: [{
                    title: t("Prompt Tags"),
                    icon: "tag",
                    accent: true,
                    tags: splitPromptTokens(item.tags).map(tag => ({ value: tag, hint: tagHint(tag, bilingual) })),
                }],
                facts: [
                    { label: t("Categories"), value: (item.categories || []).map(category => categoryLabel(englishCategory(category), bilingual)).join(" / ") || "-" },
                    { label: t("Traits"), value: (item.traits || []).join(", ") || "-" },
                    { label: "ID", value: itemKey(item) },
                ],
            };
        },
        buildOutput: items => {
            const tags = items.flatMap(item => splitPromptTokens(item.isCustom ? item.customContent : item.tags));
            return tags.length ? `${tags.join(", ")}, ` : "";
        },
    };
}
