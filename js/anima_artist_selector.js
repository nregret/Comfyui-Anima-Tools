import { app } from "../../scripts/app.js";
import { t } from "./i18n.js";
import { openGallerySelector } from "./anima_gallery_selector.js";
import { addSelectorActionRow, installSelectorExecutionSync, isAnimaPromptPlusNode } from "./anima_selector_random.js";
import { formatCount, shuffleInPlace } from "./anima_selector_ui.js";

const SIDEBAR_STORAGE_KEY = "anima-artist-active-sidebar-category";

app.registerExtension({
    name: "AnimaArtistTagSelector.extension",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === "AnimaArtistTagSelector" || nodeData.name === "AnimaArtistTagSelectorPlus" || isAnimaPromptPlusNode(nodeData.name)) {
            installSelectorExecutionSync(nodeType);
            const origOnCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                origOnCreated?.apply(this, arguments);

                const artistTagsWidget = this.widgets.find(w => w.name === "artist_tags");
                if (!artistTagsWidget) return;

                addSelectorActionRow(this, {
                    section: "artist",
                    label: t("Open Artist Selector"),
                    accent: "#0b8ce9",
                    accentText: "#7dd3fc",
                    onOpen: async () => {
                        if (!window.galleryData) {
                            alert(t("Anima artist database is loading, please wait a few seconds..."));
                            return;
                        }
                        await openArtistSelector(this, artistTagsWidget);
                    },
                });
            };
        }
    }
});

function cleanArtistToken(value) {
    const text = String(value || "").trim();
    if (text.startsWith("@")) return text.slice(1).trim();
    if (text.toLowerCase().startsWith("by ")) return text.slice(3).trim();
    return text;
}

function unescapeArtistName(name) {
    return String(name || "").replace(/\\([()[\]{}])/g, "$1").trim();
}

function formatArtistName(name) {
    return unescapeArtistName(name).split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function artistImageUrls(item) {
    const name = unescapeArtistName(item.name);
    const urls = name ? [`https://blobs.animadex.net/ArtistOutputs/thumbs/${encodeURIComponent(name)}.webp`] : [];
    if (item.id) {
        const partition = item.p || 1;
        urls.push(
            `https://fastly.jsdelivr.net/gh/ThetaCursed/Anima-Assets@main/images/${partition}/${item.id}.webp`,
            `https://raw.githubusercontent.com/ThetaCursed/Anima-Assets/main/images/${partition}/${item.id}.webp`,
            `https://cdn.statically.io/gh/ThetaCursed/Anima-Assets/main/images/${partition}/${item.id}.webp`,
        );
    }
    return urls;
}

const byNumber = (field, direction) => (a, b) => direction * ((Number(a[field]) || 0) - (Number(b[field]) || 0));
const byName = direction => (a, b) => direction * String(a.name).localeCompare(String(b.name));
const SORTERS = {
    "works-desc": byNumber("post_count", -1),
    "works-asc": byNumber("post_count", 1),
    "unique-desc": byNumber("uniqueness_score", -1),
    "unique-asc": byNumber("uniqueness_score", 1),
    "name-asc": byName(1),
    "name-desc": byName(-1),
};

// Widget text uses "@name" for artists and "_raw_:tag" for custom item content.
export function parseInitialSelection(text, data, customs) {
    const names = [];
    const rawTokens = new Set();
    String(text || "").split(",").map(token => token.trim()).filter(Boolean).forEach(token => {
        if (token.startsWith("_raw_:")) rawTokens.add(token.slice(6).trim().toLowerCase());
        else names.push(cleanArtistToken(token));
    });
    const knownTokens = new Set([...rawTokens, ...names.map(name => name.toLowerCase())]);
    const items = names.filter(Boolean).map(name => data.find(item => item.name === name) || { name });
    const matchedRaw = new Set();
    customs.forEach(custom => {
        const keys = String(custom.customContent || "").split(",").map(token => cleanArtistToken(token).toLowerCase()).filter(Boolean);
        const bareNumeric = keys.length === 1 && /^\d+$/.test(keys[0]);
        if (!keys.length || bareNumeric || !keys.every(key => knownTokens.has(key))) return;
        items.push(custom);
        keys.forEach(key => matchedRaw.add(key));
    });
    rawTokens.forEach(token => {
        if (!matchedRaw.has(token)) items.push({ name: `_raw_:${token}` });
    });
    return items;
}

async function openArtistSelector(node, widget) {
    const data = window.galleryData || [];
    await openGallerySelector({
        kind: "artist",
        title: t("Anima Artist Style Selector"),
        icon: "palette",
        node,
        widget,
        data,
        pageSize: 60,
        cardAspect: "3 / 4",
        storage: {
            sort: "anima-selector-active-sort",
            page: "anima-selector-active-page",
            scroll: "anima-selector-active-scroll",
        },
        labels: {
            all: t("All Artists"),
            search: t("Search artist name..."),
            empty: t("No matching artist styles found"),
            noSelection: t("Please select at least one artist first."),
            selected: count => t("Selected: {count} artist styles", { count }),
            total: values => t("Total {total} artists | Showing {start}-{end}", values),
        },
        sortOptions: [
            { value: "works-desc", label: t("Works Count ⬇") },
            { value: "works-asc", label: t("Works Count ⬆") },
            { value: "unique-desc", label: t("Uniqueness Score ⬇") },
            { value: "unique-asc", label: t("Uniqueness Score ⬆") },
            { value: "name-asc", label: t("Name A-Z") },
            { value: "name-desc", label: t("Name Z-A") },
            { value: "random", label: t("Random") },
        ],
        defaultSort: "works-desc",
        sort: (items, value) => value === "random" ? shuffleInPlace(items) : items.sort(SORTERS[value]),
        filters: () => [],
        loadState: () => {
            const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY) || "all";
            return { collection: saved === "favorites" ? "default" : saved, filters: {} };
        },
        saveState: ({ collection }) => localStorage.setItem(SIDEBAR_STORAGE_KEY, collection),
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
        initialSelection: customs => parseInitialSelection(widget.value, data, customs),
        matches: (item, query) => String(item.name || "").toLowerCase().includes(query),
        imageUrls: artistImageUrls,
        card: item => ({
            title: formatArtistName(item.name),
            tooltip: item.name,
            stats: item.post_count === undefined ? [] : [
                { icon: "image", text: formatCount(item.post_count), title: t("Works") },
                { text: `${t("Uniqueness")} ${Number(item.uniqueness_score || 0).toFixed(1)}`, tone: "warm", title: t("Uniqueness") },
            ],
        }),
        detail: item => ({
            title: formatArtistName(item.name),
            subtitle: item.name,
            sections: [{ title: t("Prompt"), icon: "tag", accent: true, tags: [{ value: item.name.startsWith("_raw_:") ? item.name.slice(6) : `@${item.name}` }] }],
            facts: item.post_count === undefined ? [] : [
                { label: t("Works"), value: Number(item.post_count).toLocaleString() },
                { label: t("Uniqueness"), value: Number(item.uniqueness_score || 0).toFixed(2) },
            ],
        }),
        buildOutput: items => {
            const tokens = items.flatMap(item => {
                if (item.isCustom) return String(item.customContent || "").split(",").map(tag => tag.trim()).filter(Boolean).map(tag => `_raw_:${tag}`);
                return item.name.startsWith("_raw_:") ? [item.name] : [`@${item.name}`];
            });
            return tokens.length ? `${tokens.join(", ")}, ` : "";
        },
    });
}
