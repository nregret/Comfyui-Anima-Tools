import { t } from "./i18n.js";
import { PROMO_LINKS } from "./anima_promo_links.js";
import { copyText, escapeHtml, openDialog, selectorIcon, shuffleInPlace, splitPromptTokens } from "./anima_selector_ui.js";

// "My Tags" is the user's own library: two category levels and entries with prompt tags and a cover.
// The backend keeps it in the ComfyUI user directory (anima_tools_my_tags/my_tags.json + covers/),
// so updating or reinstalling the plugin never touches it. Categories are edited inline in the
// filter tree and entries in the details panel, so the tab needs no dialogs besides its help.
const API = "/anima-tools/my-tags";
const PATH_SEPARATOR = "\u001f";
const UNCATEGORIZED = PATH_SEPARATOR;
const COVER_SIZE = 640;

// { path, categories: [{ name, children: [name] }], items: [{ id, name, tags, path: [category, subcategory?], cover }], error? }
let library = null;

fetch(API)
    .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
    .then(data => {
        library = {
            path: data.path,
            categories: data.categories.map(category => ({ name: String(category.name), children: Array.isArray(category.children) ? category.children.map(String) : [] })),
            items: data.items.map(item => ({ ...item, path: Array.isArray(item.path) ? item.path : [], cover: item.cover || "" })),
        };
    })
    .catch(error => {
        console.error("[Anima Tools] Failed to load My Tags", error);
        library = { path: "", categories: [], items: [], error: String(error.message || error) };
    });

// Mutations apply immediately so the selector can re-render; a failed save restores the snapshot.
// Nothing is saved after a failed load, so a library that could not be read is never overwritten.
async function commit(mutate) {
    if (library.error) return false;
    const snapshot = JSON.stringify({ categories: library.categories, items: library.items });
    mutate();
    try {
        const response = await fetch(API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ categories: library.categories, items: library.items }),
        });
        if (response.ok) return true;
        console.error("[Anima Tools] Failed to save My Tags", await response.text());
    } catch (error) {
        console.error("[Anima Tools] Failed to save My Tags", error);
    }
    const restored = JSON.parse(snapshot);
    library.categories = restored.categories;
    library.items.splice(0, library.items.length, ...restored.items);
    return false;
}

async function save(tools, mutate) {
    if (await commit(mutate)) return true;
    tools.toast(library.error ? t("My Tags could not be read ({error}), so nothing will be saved until it loads.", { error: library.error }) : t("Failed to save My Tags"), "error");
    return false;
}

function duplicateName(tools) {
    tools.toast(t("A category with this name already exists."), "error");
    return false;
}

const coverUrl = name => `${API}/cover/${name}`;
const newId = () => `mt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const pathKey = item => item.path.join(PATH_SEPARATOR);
const inPath = (item, value) => value === UNCATEGORIZED ? !item.path.length : pathKey(item) === value || pathKey(item).startsWith(`${value}${PATH_SEPARATOR}`);
const findCategory = name => library.categories.find(category => category.name === name);
const itemsIn = (...path) => library.items.filter(item => path.every((part, depth) => item.path[depth] === part));

async function encodeCover(file) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, COVER_SIZE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.86));
}

async function uploadCover(blob) {
    const response = await fetch(`${API}/cover`, { method: "POST", body: blob });
    if (!response.ok) throw new Error(await response.text());
    return (await response.json()).cover;
}

function categoryOptions() {
    const count = value => library.items.filter(item => inPath(item, value)).length;
    const options = library.categories.flatMap(category => [
        { value: category.name, label: category.name, count: count(category.name), depth: 0, parent: null, editable: true, nestable: true },
        ...category.children.map(child => {
            const value = `${category.name}${PATH_SEPARATOR}${child}`;
            return { value, label: child, count: count(value), depth: 1, parent: category.name, editable: true };
        }),
    ]);
    const loose = count(UNCATEGORIZED);
    if (loose) options.push({ value: UNCATEGORIZED, label: t("Uncategorized"), count: loose, depth: 0, parent: null });
    return options;
}

// Inline category edits from the filter tree; values are "category" or "category\u001fsubcategory".
const CATEGORY_EDIT = {
    addRoot: (name, tools) => findCategory(name) ? duplicateName(tools) : save(tools, () => library.categories.push({ name, children: [] })),
    addChild: (parent, name, tools) => {
        const category = findCategory(parent);
        return category.children.includes(name) ? duplicateName(tools) : save(tools, () => category.children.push(name));
    },
    rename: async (value, name, tools) => {
        const [root, child] = value.split(PATH_SEPARATOR);
        const category = findCategory(root);
        if (child === undefined) {
            if (findCategory(name)) return duplicateName(tools);
            const saved = await save(tools, () => {
                itemsIn(root).forEach(item => item.path = [name, ...item.path.slice(1)]);
                category.name = name;
            });
            return saved && name;
        }
        if (category.children.includes(name)) return duplicateName(tools);
        const saved = await save(tools, () => {
            itemsIn(root, child).forEach(item => item.path = [root, name]);
            category.children[category.children.indexOf(child)] = name;
        });
        return saved && `${root}${PATH_SEPARATOR}${name}`;
    },
    remove: (value, tools) => {
        const [root, child] = value.split(PATH_SEPARATOR);
        const category = findCategory(root);
        return save(tools, () => {
            if (child === undefined) {
                itemsIn(root).forEach(item => item.path = []);
                library.categories.splice(library.categories.indexOf(category), 1);
                return;
            }
            itemsIn(root, child).forEach(item => item.path = [root]);
            category.children.splice(category.children.indexOf(child), 1);
        });
    },
    addItem: (value, tools) => tools.edit(null, value.split(PATH_SEPARATOR)),
};

const optionHtml = (value, label, selected) => `<option value="${escapeHtml(value)}" ${selected ? "selected" : ""}>${escapeHtml(label)}</option>`;

// Fills the details panel with the entry form; refresh keeps typed values while categories change in the tree.
function entryEditor(container, { item, preset }, tools) {
    let pendingCover = null;
    let coverChanged = false;
    let previewUrl = "";
    container.innerHTML = `
        <form class="anima-sel-entry-editor">
            <h2>${escapeHtml(item ? t("Edit Entry") : t("New Entry"))}</h2>
            <label class="anima-sel-field"><span>${escapeHtml(t("Name"))}</span><input class="anima-sel-input" name="title" value="${escapeHtml(item?.name || "")}" placeholder="${escapeHtml(t("Item Title (e.g. My Style A)..."))}" autocomplete="off"></label>
            <label class="anima-sel-field"><span>${escapeHtml(t("Prompt Tags"))}</span><textarea class="anima-sel-input is-multiline" name="tags" rows="5" placeholder="${escapeHtml(t("Tags separated by commas (, or ，), e.g. masterpiece, best quality"))}">${escapeHtml(item?.tags || "")}</textarea></label>
            <div class="anima-sel-field-row">
                <label class="anima-sel-field"><span>${escapeHtml(t("Category"))}</span><select class="anima-sel-input" name="category"></select></label>
                <label class="anima-sel-field"><span>${escapeHtml(t("Subcategory"))}</span><select class="anima-sel-input" name="subcategory"></select></label>
            </div>
            <div class="anima-sel-field">
                <span>${escapeHtml(t("Cover"))}</span>
                <div class="anima-sel-cover">
                    <button class="anima-sel-cover-drop" type="button" data-cover-pick></button>
                    <div class="anima-sel-cover-side">
                        <small>${escapeHtml(t("Click, drop or paste an image. It is shrunk to WebP and saved with your tags."))}</small>
                        <button class="anima-sel-button" type="button" data-cover-remove>${selectorIcon("trash")}${escapeHtml(t("Remove Cover"))}</button>
                    </div>
                </div>
                <input type="file" accept="image/*" hidden data-cover-file>
            </div>
            <div class="anima-sel-entry-actions">
                <button class="anima-sel-button" type="button" data-editor-cancel>${escapeHtml(t("Cancel"))}</button>
                <button class="anima-sel-button is-primary" type="submit">${selectorIcon("check")}${escapeHtml(t("Save"))}</button>
            </div>
        </form>
    `;
    const form = container.querySelector("form");
    const nameInput = form.querySelector('[name="title"]');
    const tagsInput = form.querySelector('[name="tags"]');
    const categorySelect = form.querySelector('[name="category"]');
    const subcategorySelect = form.querySelector('[name="subcategory"]');
    const drop = form.querySelector("[data-cover-pick]");
    const fileInput = form.querySelector("[data-cover-file]");
    const removeButton = form.querySelector("[data-cover-remove]");

    const fillSubcategories = selected => {
        const children = findCategory(categorySelect.value)?.children || [];
        subcategorySelect.innerHTML = optionHtml("", t("None"), !children.includes(selected)) + children.map(child => optionHtml(child, child, child === selected)).join("");
        subcategorySelect.disabled = !children.length;
    };
    const fillCategories = (category, subcategory) => {
        const known = Boolean(findCategory(category));
        categorySelect.innerHTML = optionHtml("", t("Uncategorized"), !known)
            + library.categories.map(entry => optionHtml(entry.name, entry.name, entry.name === category)).join("");
        fillSubcategories(subcategory);
    };
    fillCategories(...(item ? item.path : preset));
    categorySelect.onchange = () => fillSubcategories("");

    const showCover = url => {
        drop.innerHTML = url ? `<img src="${escapeHtml(url)}" alt="">` : `${selectorIcon("image")}<span>${escapeHtml(t("Add Cover"))}</span>`;
        removeButton.hidden = !url;
    };
    showCover(item?.cover ? coverUrl(item.cover) : "");
    const useFile = async file => {
        if (!file?.type.startsWith("image/")) return;
        try {
            pendingCover = await encodeCover(file);
        } catch (error) {
            console.error("[Anima Tools] Failed to read cover image", error);
            tools.toast(t("This image could not be read."), "error");
            return;
        }
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(pendingCover);
        coverChanged = true;
        showCover(previewUrl);
    };
    drop.onclick = () => fileInput.click();
    fileInput.onchange = () => useFile(fileInput.files[0]);
    // ComfyUI loads files dropped or pasted anywhere on the page, so these events stop here.
    drop.ondragover = event => {
        event.preventDefault();
        event.stopPropagation();
        drop.classList.add("is-over");
    };
    drop.ondragleave = () => drop.classList.remove("is-over");
    drop.ondrop = event => {
        event.preventDefault();
        event.stopPropagation();
        drop.classList.remove("is-over");
        useFile(event.dataTransfer.files[0]);
    };
    form.onpaste = event => {
        event.stopPropagation();
        const file = [...event.clipboardData.files].find(entry => entry.type.startsWith("image/"));
        if (!file) return;
        event.preventDefault();
        useFile(file);
    };
    removeButton.onclick = () => {
        pendingCover = null;
        coverChanged = true;
        showCover("");
    };
    form.querySelector("[data-editor-cancel]").onclick = () => tools.closeEditor(item);
    form.onsubmit = async event => {
        event.preventDefault();
        const name = nameInput.value.trim();
        // Chinese commas separate tags too; saved tags are always joined with ", ".
        const tags = splitPromptTokens(tagsInput.value.replace(/，/g, ",")).join(", ");
        if (!name || !tags) {
            tools.toast(t("Name and prompt tags are required."), "error");
            return;
        }
        const buttons = [...form.querySelectorAll("button")];
        buttons.forEach(button => button.disabled = true);
        let cover = item?.cover || "";
        try {
            if (coverChanged) cover = pendingCover ? await uploadCover(pendingCover) : "";
        } catch (error) {
            console.error("[Anima Tools] Failed to upload cover", error);
            tools.toast(t("Failed to save My Tags"), "error");
            buttons.forEach(button => button.disabled = false);
            return;
        }
        const fields = { name, tags, path: [categorySelect.value, subcategorySelect.value].filter(Boolean), cover };
        const entry = item || { id: newId() };
        if (!await save(tools, () => item ? Object.assign(item, fields) : library.items.push(Object.assign(entry, fields)))) {
            buttons.forEach(button => button.disabled = false);
            return;
        }
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        tools.refresh();
        tools.closeEditor(library.items.includes(entry) ? entry : null);
        tools.toast(t("Saved"));
    };
    nameInput.focus();
    return { refresh: () => fillCategories(categorySelect.value, subcategorySelect.value) };
}

async function deleteEntry(entry, tools) {
    if (await save(tools, () => library.items.splice(library.items.indexOf(entry), 1))) tools.refresh();
}

function openHelp(tools) {
    openDialog(tools.host, {
        title: t("About My Tags"),
        confirmText: t("Got it"),
        body: `
            ${library.error ? `<p>${escapeHtml(t("My Tags could not be read ({error}), so nothing will be saved until it loads.", { error: library.error }))}</p>` : `
                <p>${escapeHtml(t("Your tags and covers are saved in:"))}</p>
                <div class="anima-sel-path"><code>${escapeHtml(library.path)}</code><button class="anima-sel-button" type="button" data-copy-path>${selectorIcon("copy")}${escapeHtml(t("Copy Path"))}</button></div>
                <p>${escapeHtml(t("Updating or reinstalling the plugin keeps everything in this folder."))}</p>
            `}
            <p>${escapeHtml(t("In Adjust Filters on the left, + adds a category; hover a category to add a subcategory or an entry, rename or delete it."))}</p>
            <p>${escapeHtml(t("Share your tag library in QQ group {qq} and help build the open-source community!", { qq: PROMO_LINKS.qqGroup }))}</p>
        `,
        onOpen: form => {
            const copy = form.querySelector("[data-copy-path]");
            if (copy) copy.onclick = () => copyText(library.path, () => tools.toast(t("Copied: {text}", { text: library.path })));
        },
        onConfirm: () => {},
    });
}

const SORTERS = {
    "id-desc": (a, b) => String(b.id).localeCompare(String(a.id)),
    "id-asc": (a, b) => String(a.id).localeCompare(String(b.id)),
    "name-asc": (a, b) => String(a.name).localeCompare(String(b.name)),
    "name-desc": (a, b) => String(b.name).localeCompare(String(a.name)),
};

function myTagsConfig() {
    const filterStorageKey = "anima-my_tags-selector-filters";
    return {
        data: library.items,
        pageSize: 48,
        cardAspect: "3 / 4",
        storage: {
            sort: "anima-my_tags-selector-active-sort",
            page: "anima-my_tags-selector-active-page",
            scroll: "anima-my_tags-selector-active-scroll",
        },
        labels: {
            all: t("All My Tags"),
            search: t("Search my tags..."),
            get empty() { return library.items.length ? t("No matching entries found") : t("No entries yet"); },
            get emptyHint() { return library.items.length ? "" : t("Create categories and entries in Adjust Filters on the left."); },
            noSelection: t("Please select at least one entry first."),
            selected: count => t("Selected: {count} entries", { count }),
            total: values => t("Total {total} entries | Showing {start}-{end}", values),
        },
        sortOptions: [
            { value: "id-desc", label: t("Latest") },
            { value: "id-asc", label: t("Oldest") },
            { value: "name-asc", label: t("Name A-Z") },
            { value: "name-desc", label: t("Name Z-A") },
            { value: "random", label: t("Random") },
        ],
        defaultSort: "id-desc",
        sort: (items, value) => value === "random" ? shuffleInPlace(items) : items.sort(SORTERS[value]),
        filters: () => [{ id: "path", label: t("My Categories"), tree: true, options: categoryOptions(), test: inPath, edit: { ...CATEGORY_EDIT, removeHint: t("Its entries are kept and move up one level.") } }],
        loadState: () => {
            try {
                const saved = JSON.parse(localStorage.getItem(filterStorageKey) || "{}");
                return { collection: saved.collection || "all", filters: { path: saved.path || null } };
            } catch (e) {
                console.warn("[Anima Tools] Failed to restore My Tags filters", e);
                return { collection: "all", filters: {} };
            }
        },
        saveState: ({ collection, filters }) => localStorage.setItem(filterStorageKey, JSON.stringify({ path: filters.path, collection })),
        selectionKey: item => item.isCustom ? `custom:${item.name}` : item.id,
        favoriteKey: item => item.id,
        favoriteRecord: item => ({ id: item.id, name: item.name, isCustom: false }),
        customItem: (title, content, groupId) => ({
            name: `custom_${Date.now()}`,
            nickname: title,
            customContent: content,
            groupIds: [groupId],
            isCustom: true,
        }),
        initialSelection: () => [],
        matches: (item, query) => [item.name, item.tags, ...item.path].join(" ").toLowerCase().includes(query),
        imageUrls: item => item.cover ? [coverUrl(item.cover)] : [],
        toolbarActions: [{ label: t("Storage & Help"), icon: "info", iconOnly: true, run: openHelp }],
        navActions: [{
            label: t("New Entry"),
            icon: "plus",
            primary: true,
            run: tools => tools.edit(null, (tools.filters().path || "").split(PATH_SEPARATOR).filter(Boolean)),
        }],
        editor: entryEditor,
        card: item => ({ title: item.name, tooltip: item.name, meta: item.path.join(" / ") || item.tags }),
        detail: item => ({
            title: item.name,
            subtitle: item.path.join(" / ") || t("Uncategorized"),
            sections: [{ title: t("Prompt Tags"), icon: "tag", accent: true, tags: splitPromptTokens(item.tags).map(value => ({ value })) }],
            actions: [
                { label: t("Edit"), icon: "edit", run: (entry, tools) => tools.edit(entry) },
                { label: t("Delete"), icon: "trash", danger: true, confirmLabel: t("Click again to delete"), run: deleteEntry },
            ],
        }),
        buildOutput: items => {
            const tags = items.flatMap(item => splitPromptTokens(item.isCustom ? item.customContent : item.tags));
            return tags.length ? `${tags.join(", ")}, ` : "";
        },
    };
}

export const myTagsSelector = {
    kind: "my_tags",
    label: "My Tags",
    icon: "folder",
    random: false,
    loading: "My Tags is loading, please wait a few seconds...",
    ready: () => Boolean(library),
    createConfig: myTagsConfig,
};
