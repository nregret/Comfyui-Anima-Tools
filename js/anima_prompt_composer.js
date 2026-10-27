import { app } from "../../scripts/app.js";
import { t } from "./i18n.js";
import { getEntryPreviewUrl } from "./anima_prompt_composer_preview.js";
import { enablePartialExecutionSeedControl } from "./anima_prompt_composer_seed_control.js";

const SECTIONS = ["artist", "character", "clothing", "background", "pose"];
const SECTION_META = {
    artist: { color: "#38bdf8", labelKey: "Artists" },
    character: { color: "#f472b6", labelKey: "Characters" },
    clothing: { color: "#a78bfa", labelKey: "Clothing" },
    background: { color: "#22c55e", labelKey: "Background" },
    pose: { color: "#f59e0b", labelKey: "Pose" },
};
const SELECTION_PROPERTY = "anima_prompt_composer_selection";
const COLLAPSED_PROPERTY = "anima_prompt_composer_collapsed";
const THUMB_W = 60;
const THUMB_H = 80;
const HEADER_HEIGHT = 26;
const TEXT_HEIGHT = 66;
const THUMBS_HEIGHT = THUMB_H + 30;
const MIN_WIDTH = 400;
const PANEL_GAP = 6;
// Widget order of workflows saved before the inputs were grouped by section; they start with the enable_artist toggle.
const LEGACY_WIDGET_ORDER = [
    "enable_artist",
    "enable_character",
    "enable_clothing",
    "enable_background",
    "enable_pose",
    "character_detail",
    "seed",
    "control_after_generate",
    "artist_count",
    "preview_collapsed",
    "resolved_prompt",
    "character_seed",
    "character_tag_count",
    "character_keep_features",
    "clothing_seed",
    "clothing_source",
];

app.registerExtension({
    name: "AnimaPromptComposer.extension",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "AnimaPromptComposer") return;
        const defaults = inputDefaults(nodeData);

        const origOnCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origOnCreated?.apply(this, arguments);
            enablePartialExecutionSeedControl(getWidget(this, "seed"));
            addResultWidget(this);
            this.setSize([Math.max(MIN_WIDTH, this.size[0]), this.size[1]]);
        };

        const origOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function (info) {
            const result = origOnConfigure?.apply(this, arguments);
            migrateLegacyWidgetValues(this, info?.widgets_values, defaults);
            renderResult(this);
            return result;
        };

        const origOnExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            origOnExecuted?.apply(this, arguments);
            const selection = message?.anima_prompt_composer?.[0];
            if (!selection) return;
            this.properties[SELECTION_PROPERTY] = selection;
            renderResult(this);
        };
    }
});

function getWidget(node, name) {
    return node?.widgets?.find(widget => widget.name === name);
}

// Accepts the selection object or, from older workflows, its JSON text or the bare prompt text.
function parseSelection(value) {
    if (value && typeof value === "object") return value;
    const text = String(value || "").trim();
    if (!text) return null;
    if (text.startsWith("{")) {
        try {
            return JSON.parse(text);
        } catch (_) {}
    }
    return { _resolved_prompt: text };
}

function inputDefaults(nodeData) {
    const inputs = { ...nodeData.input?.required, ...nodeData.input?.optional };
    return Object.fromEntries(Object.entries(inputs).map(([name, spec]) => [name, spec[1]?.default]));
}

// Old values can be null (a widget that did not exist when the workflow was saved) or come from a shifted slot.
function isUsableValue(widget, value) {
    if (value === null || value === undefined) return false;
    if (Array.isArray(widget.options?.values)) return widget.options.values.includes(value);
    if (typeof widget.value === "boolean") return typeof value === "boolean";
    if (typeof widget.value === "number") {
        return typeof value === "number" && value >= (widget.options?.min ?? -Infinity) && value <= (widget.options?.max ?? Infinity);
    }
    return true;
}

// The frontend restored the old values by position into the new layout; start from the defaults and take each old value by name.
function migrateLegacyWidgetValues(node, values, defaults) {
    if (typeof values?.[0] !== "boolean") return;
    for (const [name, value] of Object.entries(defaults)) {
        const widget = getWidget(node, name);
        if (widget) widget.value = value;
    }
    LEGACY_WIDGET_ORDER.forEach((name, index) => {
        if (index >= values.length) return;
        const value = values[index];
        if (name === "preview_collapsed") {
            node.properties[COLLAPSED_PROPERTY] = value === true;
        } else if (name === "resolved_prompt") {
            const selection = parseSelection(value);
            if (selection && !node.properties[SELECTION_PROPERTY]) node.properties[SELECTION_PROPERTY] = selection;
        } else {
            const widget = getWidget(node, name);
            if (widget && isUsableValue(widget, value)) widget.value = value;
        }
    });
}

function getSelection(node) {
    return parseSelection(node.properties?.[SELECTION_PROPERTY]);
}

function isCollapsed(node) {
    return node.properties?.[COLLAPSED_PROPERTY] === true;
}

function flattenSelected(selected) {
    return SECTIONS.flatMap(section => (Array.isArray(selected?.[section]) ? selected[section] : []).map(entry => ({ ...entry, section })));
}

function resultHeight(node) {
    const selection = getSelection(node);
    if (!selection?._resolved_prompt) return HEADER_HEIGHT;
    let height = HEADER_HEIGHT + PANEL_GAP + TEXT_HEIGHT;
    if (!isCollapsed(node) && flattenSelected(selection).length) height += PANEL_GAP + THUMBS_HEIGHT;
    return height;
}

function stopCanvasPointer(event) {
    event.stopPropagation();
}

function addResultWidget(node) {
    const el = document.createElement("div");
    el.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: ${PANEL_GAP}px;
        width: 100%;
        box-sizing: border-box;
        overflow: hidden;
        color: #e5e7eb;
        font: 12px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    `;
    const widget = node.addDOMWidget("anima_prompt_composer_result", "div", el, {
        serialize: false,
        hideOnZoom: false,
        getValue: () => "",
        setValue: () => {},
        getMinHeight: () => resultHeight(node),
        getMaxHeight: () => resultHeight(node),
    });
    widget.serialize = false;
    widget.computeSize = width => [width, resultHeight(node)];
    node._animaComposerResultEl = el;
    renderResult(node);
}

function renderResult(node) {
    const el = node._animaComposerResultEl;
    if (!el) return;
    const selection = getSelection(node);
    const text = selection?._resolved_prompt || "";
    const entries = flattenSelected(selection);
    const collapsed = isCollapsed(node);
    el.style.height = `${resultHeight(node)}px`;
    el.replaceChildren();

    const header = document.createElement("div");
    header.style.cssText = `display: flex; align-items: center; justify-content: space-between; gap: 8px; height: ${HEADER_HEIGHT}px; padding: 0 2px;`;
    const title = document.createElement("span");
    title.style.cssText = `min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; color: ${text ? "#fbbf24" : "#9ca3af"};`;
    title.textContent = text
        ? `${t("Random Result")}${entries.length ? ` · ${entries.length}` : ""}`
        : t("Run workflow to preview random result");
    header.appendChild(title);
    if (entries.length) {
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.textContent = collapsed ? t("Expand Preview") : t("Collapse Preview");
        toggle.style.cssText = `
            flex: 0 0 auto;
            height: 22px;
            padding: 0 8px;
            border: 1px solid rgba(255,255,255,0.14);
            border-radius: 6px;
            background: rgba(255,255,255,0.06);
            color: #d1d5db;
            font-size: 11px;
            cursor: pointer;
        `;
        toggle.addEventListener("pointerdown", stopCanvasPointer);
        toggle.addEventListener("click", event => {
            event.stopPropagation();
            node.properties[COLLAPSED_PROPERTY] = !collapsed;
            renderResult(node);
        });
        header.appendChild(toggle);
    }
    el.appendChild(header);
    if (!text) {
        fitNodeHeight(node);
        return;
    }

    const prompt = document.createElement("div");
    prompt.textContent = text;
    prompt.title = text;
    prompt.style.cssText = `
        height: ${TEXT_HEIGHT}px;
        box-sizing: border-box;
        padding: 6px 8px;
        overflow-y: auto;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        background: rgba(16,16,24,0.72);
        font: 11px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
        white-space: pre-wrap;
        word-break: break-word;
        user-select: text;
        cursor: text;
    `;
    prompt.addEventListener("pointerdown", stopCanvasPointer);
    el.appendChild(prompt);

    if (!collapsed && entries.length) {
        const thumbs = document.createElement("div");
        thumbs.style.cssText = `display: flex; gap: 10px; height: ${THUMBS_HEIGHT}px; overflow-x: auto; overflow-y: hidden; scrollbar-width: thin;`;
        thumbs.addEventListener("pointerdown", stopCanvasPointer);
        entries.forEach(entry => thumbs.appendChild(createThumb(entry)));
        el.appendChild(thumbs);
    }
    fitNodeHeight(node);
}

// Grows the node to fit the panel; it only shrinks back when the panel itself gets shorter.
function fitNodeHeight(node) {
    const height = node.computeSize?.()[1];
    if (!Number.isFinite(height)) return;
    const previous = node._animaComposerFitHeight;
    node._animaComposerFitHeight = height;
    if (height > node.size[1] || (previous !== undefined && height < previous)) {
        node.setSize([node.size[0], height]);
    }
    node.setDirtyCanvas?.(true, true);
}

function createThumb(entry) {
    const meta = SECTION_META[entry.section];
    const wrap = document.createElement("div");
    wrap.title = [entry.title, entry.subtitle].filter(Boolean).join(" · ");
    wrap.style.cssText = `flex: 0 0 ${THUMB_W}px; min-width: 0;`;

    const box = document.createElement("div");
    box.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        width: ${THUMB_W}px;
        height: ${THUMB_H}px;
        box-sizing: border-box;
        overflow: hidden;
        border: 1px solid ${meta.color};
        border-radius: 8px;
        background: rgba(255,255,255,0.06);
        color: ${meta.color};
        font-size: 20px;
        font-weight: 900;
    `;
    const initial = (entry.title || "?").slice(0, 1).toUpperCase();
    const previewUrl = getEntryPreviewUrl(entry);
    if (previewUrl) {
        const img = document.createElement("img");
        let directFallbackTried = previewUrl === entry.preview || !entry.preview;
        img.src = previewUrl;
        img.loading = "lazy";
        img.style.cssText = "display: block; width: 100%; height: 100%; object-fit: cover;";
        img.onerror = () => {
            if (!directFallbackTried) {
                directFallbackTried = true;
                img.src = entry.preview;
                return;
            }
            img.remove();
            box.textContent = initial;
        };
        box.appendChild(img);
    } else {
        box.textContent = initial;
    }

    const label = document.createElement("div");
    label.textContent = t(meta.labelKey);
    label.style.cssText = `
        width: ${THUMB_W}px;
        margin-top: 4px;
        overflow: hidden;
        color: #d1d5db;
        font-size: 10px;
        text-overflow: ellipsis;
        white-space: nowrap;
    `;
    wrap.append(box, label);
    return wrap;
}
