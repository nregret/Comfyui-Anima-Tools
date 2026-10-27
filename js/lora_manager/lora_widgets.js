import { createPreviewMedia } from "./media.js";

function entryKey(entry) {
    return `${entry.storage_root_id || ""}::${entry.name}`;
}

function removeWidget(node, widget) {
    if (node.removeWidget) node.removeWidget(widget);
    else {
        widget.onRemove?.();
        node.widgets.splice(node.widgets.indexOf(widget), 1);
    }
}

// Keep the backend input, without the multiline DOM widget's layout lifecycle.
export function ensureLoraDataWidget(node) {
    let widget = node.widgets.find((item) => item.name === "lora_list_json");
    if (widget?._almData) return widget;
    const index = widget ? node.widgets.indexOf(widget) : 0;
    const value = widget?.value || "[]";
    if (widget) removeWidget(node, widget);
    widget = node.addCustomWidget({
        name: "lora_list_json",
        type: "hidden",
        value,
        options: { hidden: true },
        serialize: true,
        computeSize: () => [0, -4],
        _almData: true,
    });
    node.widgets.splice(node.widgets.indexOf(widget), 1);
    node.widgets.splice(index, 0, widget);
    return widget;
}

// Layout metrics shared by the CSS in styles.js and the DOMWidget height.
export const LORA_CARD_HEIGHT = 56;
export const LORA_CARD_GAP = 6;
export const LORA_FOOTER_HEIGHT = 28;
export const LORA_EMPTY_HEIGHT = 64;
const DEFAULT_STRENGTH = 1;

export function loraPanelHeight(count) {
    if (!count) return LORA_EMPTY_HEIGHT;
    return count * LORA_CARD_HEIGHT + count * LORA_CARD_GAP + LORA_FOOTER_HEIGHT;
}

let panelSequence = 0;
const COPY_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="3" width="10" height="11" rx="2"/><path d="M13 14v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2"/></svg>';
const REMOVE_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8m0-8-8 8"/></svg>';
const LAYERS_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/></svg>';
const PLUS_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg>';

function element(tag, className, html = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html) node.innerHTML = html;
    return node;
}

function button(className, html = "") {
    const node = element("button", className, html);
    node.type = "button";
    return node;
}

function formatStrength(value) {
    return Number(value).toFixed(2);
}

function previewSource(url) {
    if (!url) return { src: "", fallbacks: [] };
    const media = createPreviewMedia(url, 96);
    if (media.type === "video") {
        return { src: media.posterUrl || "", fallbacks: media.posterFallbackUrls || [] };
    }
    return { src: media.url || "", fallbacks: media.fallbackUrls || [] };
}

function updateThumb(row, entry) {
    const url = String(entry.preview_url || "");
    if (row.previewUrl === url) return;
    row.previewUrl = url;
    const { src, fallbacks } = previewSource(url);
    row.thumb.classList.toggle("has-image", false);
    row.thumbFallbacks = [...fallbacks];
    if (src) {
        row.image.src = src;
    } else {
        row.image.removeAttribute?.("src");
    }
}

function createLoraRow(node, handlers) {
    const row = { handlers, element: element("div", "alm-node-lora") };
    const currentIndex = () => node._almLoraRows.indexOf(row);
    const edit = (patch) => {
        const index = currentIndex();
        if (index >= 0) row.handlers.onEdit(index, patch);
    };
    const copy = () => {
        const entry = node._almLoras[currentIndex()];
        if (entry) row.handlers.onCopy(entry);
    };

    row.thumb = element("div", "alm-node-lora-thumb", LAYERS_ICON);
    row.image = element("img");
    row.image.alt = "";
    row.image.draggable = false;
    row.image.decoding = "async";
    row.image.loading = "lazy";
    row.image.onload = () => row.thumb.classList.toggle("has-image", true);
    row.image.onerror = () => {
        const next = row.thumbFallbacks?.shift();
        if (next) row.image.src = next;
        else row.thumb.classList.toggle("has-image", false);
    };
    row.thumb.append(row.image);

    const body = element("div", "alm-node-lora-body");
    row.header = element("div", "alm-node-lora-header");
    row.enabled = button("alm-node-lora-toggle");
    row.enabled.setAttribute("role", "switch");
    row.enabled.onclick = () => edit({ enabled: row.entry.enabled === false });
    row.name = button("alm-node-lora-name");
    row.name.onclick = copy;
    row.copy = button("alm-node-lora-icon alm-node-lora-copy", COPY_ICON);
    row.copy.onclick = copy;
    row.remove = button("alm-node-lora-icon alm-node-lora-remove", REMOVE_ICON);
    row.remove.onclick = () => {
        const index = currentIndex();
        if (index >= 0) row.handlers.onRemove(index);
    };
    row.header.append(row.enabled, row.name, row.copy, row.remove);

    const strengthRow = element("div", "alm-node-lora-strength");
    row.range = element("input");
    row.range.type = "range";
    row.range.step = "0.05";
    row.strength = element("input");
    row.strength.type = "number";
    row.strength.step = "0.05";
    const commitStrength = (input) => {
        const value = input.valueAsNumber;
        if (Number.isFinite(value)) edit({ strength_model: value });
        else input.value = formatStrength(row.entry.strength_model);
    };
    row.range.oninput = () => commitStrength(row.range);
    row.range.ondblclick = () => edit({ strength_model: DEFAULT_STRENGTH });
    row.strength.onchange = () => commitStrength(row.strength);
    row.strength.onkeydown = (event) => {
        event.stopPropagation();
        if (event.key === "Enter") commitStrength(row.strength);
    };
    strengthRow.append(row.range, row.strength);
    body.append(row.header, strengthRow);
    row.element.append(row.thumb, body);
    return row;
}

export function paintStrengthRange(range, value) {
    const min = Number(range.min);
    const max = Number(range.max);
    const span = max - min || 1;
    const ratio = (number) => Math.min(1, Math.max(0, (number - min) / span)).toFixed(4);
    const zero = ratio(0);
    const current = ratio(value);
    // The fill grows from zero towards the value so negative weights read
    // as the opposite direction instead of a "shorter" positive weight.
    range.style.setProperty?.("--alm-fill-from", value < 0 ? current : zero);
    range.style.setProperty?.("--alm-fill-to", value < 0 ? zero : current);
    range.style.setProperty?.("--alm-zero", zero);
}

function createPanel(node, handlers) {
    const panel = element("div", "alm-node-loras");
    for (const event of ["pointerdown", "mousedown", "click", "dblclick"]) {
        panel.addEventListener(event, (event) => event.stopPropagation());
    }
    const list = element("div", "alm-node-lora-list");
    const empty = button("alm-node-lora-empty");
    const emptyIcon = element("span", "alm-node-lora-empty-icon", PLUS_ICON);
    const emptyText = element("span", "alm-node-lora-empty-text");
    const emptyTitle = element("strong");
    const emptyHint = element("span");
    emptyText.append(emptyTitle, emptyHint);
    empty.append(emptyIcon, emptyText);
    const footer = element("div", "alm-node-lora-footer");
    const summary = element("span", "alm-node-lora-summary");
    const open = button("alm-node-lora-open");
    const openIcon = element("span", "alm-node-lora-open-icon", PLUS_ICON);
    const openLabel = element("span");
    open.append(openIcon, openLabel);
    footer.append(summary, open);
    panel.append(list, empty, footer);
    const parts = { panel, list, empty, emptyTitle, emptyHint, footer, summary, open, openLabel };
    empty.onclick = () => parts.handlers.onOpen();
    open.onclick = () => parts.handlers.onOpen();
    parts.handlers = handlers;
    return parts;
}

export function syncLoraWidgets(node, entries, handlers, { restoring = false } = {}) {
    const { t } = handlers;
    const previousSize = [...node.size];
    const previousRows = node._almLoraRows || [];
    if (node._almLoraOpenButton) {
        // Older sessions used a separate canvas button below the panel.
        removeWidget(node, node._almLoraOpenButton);
        node._almLoraOpenButton = null;
    }
    if (restoring && node._almLoraPanel) {
        removeWidget(node, node._almLoraPanel);
        node._almLoraPanel = null;
    }
    if (!node._almLoraPanel) {
        const parts = createPanel(node, handlers);
        const height = () => loraPanelHeight(node._almLoraRows?.length || 0);
        // Rebind Vue's widget view on workflow restore; ordinary edits keep
        // the existing DOM, focus and pointer interaction intact.
        const widget = node.addDOMWidget(`alm_lora_list_${++panelSequence}`, "alm_lora_list", parts.panel, {
            serialize: false,
            hideOnZoom: false,
            getMinHeight: height,
            getMaxHeight: height,
            getHeight: height,
        });
        widget.serialize = false;
        widget.computeSize = (width) => [width, height()];
        node._almLoraPanel = widget;
        node._almLoraParts = parts;
    }
    const parts = node._almLoraParts;
    parts.handlers = handlers;
    const list = parts.list;
    node._almLoraList = list;
    const available = new Map();
    for (const row of previousRows) {
        const key = entryKey(row.entry);
        if (!available.has(key)) available.set(key, []);
        available.get(key).push(row);
    }

    const rows = entries.map((entry, index) => {
        const row = available.get(entryKey(entry))?.shift() || createLoraRow(node, handlers);
        const enabled = entry.enabled !== false;
        const strength = Number(entry.strength_model);
        row.handlers = handlers;
        row.entry = entry;
        const name = String(entry.display_name || entry.name).replaceAll("\\", "/").split("/").pop();
        const hasTriggerWords = Array.isArray(entry.trained_words) && entry.trained_words.some((word) => String(word || "").trim());
        row.element.dataset.index = String(index);
        row.element.classList.toggle("is-disabled", !enabled);
        row.element.classList.toggle("is-negative", strength < 0);
        updateThumb(row, entry);
        row.thumb.title = entry.name;
        row.name.textContent = name;
        row.name.title = `${entry.name}\n${t("Click the LoRA name to copy its trigger words.")}`;
        row.enabled.setAttribute("aria-label", `${t("Enabled")}: ${name}`);
        row.enabled.setAttribute("aria-checked", String(enabled));
        row.enabled.title = enabled ? t("Disable LoRA") : t("Enable LoRA");
        row.copy.classList.toggle("is-empty", !hasTriggerWords);
        row.copy.setAttribute("aria-label", `${t("Trigger Words")}: ${name}`);
        row.copy.title = t("Click the LoRA name to copy its trigger words.");
        row.remove.setAttribute("aria-label", `${t("Remove from node")}: ${name}`);
        row.remove.title = `${t("Remove from node")}: ${entry.name}`;
        for (const input of [row.range, row.strength]) input.setAttribute("aria-label", `${t("Strength")}: ${name}`);
        row.range.title = `${t("Strength")} · ${t("Double-click to reset to 1.00")}`;
        row.range.min = String(Math.min(-4, strength));
        row.range.max = String(Math.max(4, strength));
        row.range.value = String(strength);
        row.range.disabled = !enabled;
        paintStrengthRange(row.range, strength);
        if (document.activeElement !== row.strength) row.strength.value = formatStrength(strength);
        row.strength.disabled = !enabled;
        return row;
    });

    for (const unused of available.values()) {
        for (const row of unused) row.element.remove();
    }
    node._almLoraRows = rows;
    rows.forEach((row, index) => {
        if (list.children[index] !== row.element) list.insertBefore(row.element, list.children[index] || null);
    });

    const enabledCount = entries.filter((entry) => entry.enabled !== false).length;
    parts.panel.classList.toggle("is-empty", rows.length === 0);
    parts.panel.style.height = `${loraPanelHeight(rows.length)}px`;
    parts.list.hidden = rows.length === 0;
    parts.footer.hidden = rows.length === 0;
    parts.empty.hidden = rows.length !== 0;
    parts.emptyTitle.textContent = t("Nothing applied to this node yet");
    parts.emptyHint.textContent = t("Open LoRA Manager");
    parts.summary.textContent = t("{enabled} / {total} enabled", { enabled: enabledCount, total: rows.length });
    parts.openLabel.textContent = t("Open LoRA Manager");
    parts.open.title = t("Open LoRA Manager");

    if (restoring || rows.length !== previousRows.length || !node._almLoraMinHeight) {
        const minimum = node.computeSize();
        const extraHeight = restoring ? 0 : Math.max(0, previousSize[1] - (node._almLoraMinHeight || previousSize[1]));
        const height = restoring ? Math.max(previousSize[1], minimum[1]) : minimum[1] + extraHeight;
        node._almLoraMinHeight = minimum[1];
        node.setSize([Math.max(300, previousSize[0]), height]);
    }
    node.setDirtyCanvas?.(true, true);
}
