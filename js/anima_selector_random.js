import { t } from "./i18n.js";

export const SELECTOR_RANDOM_PROPERTY = "anima_selector_random";
const PROMPT_SELECTOR_WIDGET = "anima_prompt_selector";

function getRandomState(node) {
    node.properties = node.properties || {};
    const state = node.properties[SELECTOR_RANDOM_PROPERTY];
    if (state && typeof state === "object" && !Array.isArray(state)) {
        return state;
    }
    node.properties[SELECTOR_RANDOM_PROPERTY] = {};
    return node.properties[SELECTOR_RANDOM_PROPERTY];
}

function normalizeBoolean(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const text = String(value ?? "").trim().toLowerCase();
    return text === "true" || text === "1" || text === "yes" || text === "on";
}

function isRandomEnabled(node, section) {
    return normalizeBoolean(getRandomState(node)[section]);
}

function setRandomEnabled(node, section, enabled) {
    const state = getRandomState(node);
    state[section] = Boolean(enabled);
    refreshNode(node);
}

function refreshNode(node) {
    node.setDirtyCanvas?.(true, true);
    node.graph?.setDirtyCanvas?.(true, true);
    window?.app?.graph?.setDirtyCanvas?.(true, true);
}

function refreshPromptSelectorWidget(node) {
    getWidget(node, PROMPT_SELECTOR_WIDGET)?.__animaSelectorRefresh?.();
}

function getWidget(node, name) {
    return node?.widgets?.find(widget => widget?.name === name);
}

function setWidgetValue(node, name, value) {
    const widget = getWidget(node, name);
    if (!widget) return;
    const text = String(value ?? "");
    widget.value = text;
    if (widget.inputEl) {
        widget.inputEl.value = text;
        widget.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    }
    widget.callback?.(text);
}

export function applySelectorWidgetValues(node, values) {
    if (!node || !values || typeof values !== "object") return;
    for (const [name, value] of Object.entries(values)) {
        setWidgetValue(node, name, value);
    }
    refreshNode(node);
}

function extractSelectorTagsPayload(message) {
    const candidates = [
        message?.anima_selector_tags,
        message?.output?.anima_selector_tags,
        message?.ui?.anima_selector_tags,
    ];
    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate[0] && typeof candidate[0] === "object") {
            return candidate[0];
        }
        if (candidate && typeof candidate === "object") {
            return candidate;
        }
    }
    return null;
}

function syncSelectorTagsFromExecution(node, message) {
    const payload = extractSelectorTagsPayload(message);
    if (!payload) return;
    applySelectorWidgetValues(node, payload);
}

export function installSelectorExecutionSync(nodeType) {
    const origOnConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function () {
        const result = origOnConfigure?.apply(this, arguments);
        setTimeout(() => {
            refreshPromptSelectorWidget(this);
            refreshNode(this);
        }, 0);
        return result;
    };

    const origOnExecuted = nodeType.prototype.onExecuted;
    nodeType.prototype.onExecuted = function (message) {
        const result = origOnExecuted?.apply(this, arguments);
        syncSelectorTagsFromExecution(this, message);
        return result;
    };
}

function stopNodeDrag(event) {
    event.preventDefault();
    event.stopPropagation();
}

function baseButtonStyle() {
    return `
        height: 28px;
        border-radius: 7px;
        border: 1px solid rgba(255,255,255,0.12);
        color: #e5e7eb;
        font-size: 12px;
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
        pointer-events: auto;
        transition: background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
    `;
}

function styleRandomToggle(button, enabled) {
    button.setAttribute("aria-pressed", String(enabled));
    button.style.cssText = `
        ${baseButtonStyle()}
        flex: 1 1 0;
        min-width: 0;
        height: 24px;
        padding: 0 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 11px;
        background: ${enabled ? "rgba(56,178,109,0.22)" : "rgba(255,255,255,0.045)"};
        border-color: ${enabled ? "rgba(56,178,109,0.55)" : "rgba(255,255,255,0.10)"};
        color: ${enabled ? "#d1fae5" : "#9ca3af"};
    `;
}

// One button opens the selector popup; the row below toggles which sections are randomized on run.
export function addPromptSelectorWidget(node, label, selectors, onOpen) {
    const container = document.createElement("div");
    container.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 100%;
        box-sizing: border-box;
        padding: 1px 0;
        pointer-events: none;
    `;

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.textContent = label;
    openButton.style.cssText = `
        ${baseButtonStyle()}
        width: 100%;
        background: rgba(255,255,255,0.055);
        border-color: rgba(255,255,255,0.12);
    `;
    openButton.onmouseenter = () => {
        openButton.style.borderColor = "rgba(255,255,255,0.22)";
        openButton.style.background = "rgba(255,255,255,0.09)";
    };
    openButton.onmouseleave = () => {
        openButton.style.borderColor = "rgba(255,255,255,0.12)";
        openButton.style.background = "rgba(255,255,255,0.055)";
    };
    openButton.addEventListener("pointerdown", stopNodeDrag);
    openButton.addEventListener("mousedown", stopNodeDrag);
    openButton.addEventListener("click", event => {
        stopNodeDrag(event);
        onOpen();
    });

    const randomRow = document.createElement("div");
    randomRow.style.cssText = "display: flex; align-items: center; gap: 4px;";
    const randomLabel = document.createElement("span");
    randomLabel.textContent = t("Randomize");
    randomLabel.style.cssText = "flex: 0 0 auto; padding: 0 2px; color: #9ca3af; font-size: 11px; font-weight: 700;";
    randomRow.appendChild(randomLabel);

    const toggles = selectors.map(selector => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = t(selector.label);
        button.title = t("Auto randomize this selector when the workflow runs.");
        button.addEventListener("pointerdown", stopNodeDrag);
        button.addEventListener("mousedown", stopNodeDrag);
        button.addEventListener("click", event => {
            stopNodeDrag(event);
            setRandomEnabled(node, selector.kind, !isRandomEnabled(node, selector.kind));
            styleRandomToggle(button, isRandomEnabled(node, selector.kind));
        });
        randomRow.appendChild(button);
        return { kind: selector.kind, button };
    });
    const refresh = () => toggles.forEach(({ kind, button }) => styleRandomToggle(button, isRandomEnabled(node, kind)));
    refresh();

    container.append(openButton, randomRow);
    const widget = node.addDOMWidget(PROMPT_SELECTOR_WIDGET, "div", container, {
        serialize: false,
        hideOnZoom: false,
        getValue: () => "",
        setValue: () => {},
    });
    widget.__animaSelectorRefresh = refresh;
    widget.serialize = false;
    widget.computeSize = width => [width, 60];
    widget.computedHeight = 60;
}
