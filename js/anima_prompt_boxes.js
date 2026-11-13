import { t } from "./i18n.js";
import { openBoxSelector } from "./anima_gallery_selector.js";
import { SELECTOR_RANDOM_PROPERTY, normalizeBoolean } from "./anima_selector_random.js";
import { copyText, escapeHtml, selectorIcon } from "./anima_selector_ui.js";

// The prompt nodes keep a list of text boxes as JSON in their hidden prompt_boxes widget.
// Each box: { id, label, text, random: [selector kinds drawn on run], picks: selector picks, disabled, see openBoxSelector }.
// Every box is drawn by its own unserialized widget box_<id> with a STRING input bound to it, so a link
// lands on the box and replaces its text the same way a link replaces a native text widget.
const WIDGET_NAME = "prompt_boxes";
const BOX_PREFIX = "box_";
const ADD_WIDGET_NAME = "anima_box_add";
const MIN_WIDTH = 400;
// Card = 1px border + header + auto-sized textarea; keep in sync with the CSS below.
const CARD_CHROME = 30;
const MIN_TEXT_HEIGHT = 40;
const MAX_TEXT_HEIGHT = 168;
const ADD_HEIGHT = 38;
const SELECT_ICON = new URL("./anima_select_avatar.webp", import.meta.url).href;
// Widgets of the prompt nodes before the text boxes became dynamic, in widget order.
const LEGACY_BOXES = [
    { input: "quality_prompt", label: "Quality Prompt" },
    { input: "artist_tags", label: "Artists", random: "artist" },
    { input: "character_tags", label: "Characters", random: "character" },
    { input: "clothing_tags", label: "Clothing", random: "clothing" },
    { input: "pose_tags", label: "Pose", random: "pose" },
    { input: "background_tags", label: "Background", random: "background" },
    { input: "extra_prompt", label: "Extra Prompt" },
];
const LEGACY_SEPARATOR_INDEX = 7;

const STYLE = `
@keyframes animaBoxIn { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: none; } }
.anima-box, .anima-box-add {
    --ab-text: var(--input-text, var(--fg-color, #e5e7eb));
    --ab-field: var(--comfy-input-bg, #222);
    --ab-accent: var(--primary-background, var(--p-primary-color, #31b9f4));
    --ab-muted: color-mix(in srgb, var(--ab-text) 52%, transparent);
    --ab-line: color-mix(in srgb, var(--ab-text) 11%, transparent);
    --ab-hover: color-mix(in srgb, var(--ab-text) 9%, transparent);
    box-sizing: border-box; color: var(--ab-text); font-family: inherit; pointer-events: auto;
}
.anima-box svg, .anima-box-add svg { width: 14px; height: 14px; flex: none; }
.anima-box { position: relative; display: flex; flex-direction: column; width: 100%; border: 1px solid var(--ab-line); border-radius: 8px; background: var(--ab-field); transition: border-color .15s ease, box-shadow .15s ease, opacity .15s ease; }
.anima-box:hover { border-color: color-mix(in srgb, var(--ab-text) 20%, transparent); }
.anima-box:focus-within { border-color: color-mix(in srgb, var(--ab-accent) 60%, transparent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--ab-accent) 16%, transparent); }
.anima-box.is-new { animation: animaBoxIn .18s ease-out; }
.anima-box.is-dragging { opacity: .45; }
.anima-box.is-drop-before::before, .anima-box.is-drop-after::after { content: ""; position: absolute; left: 6px; right: 6px; height: 2px; border-radius: 2px; background: var(--ab-accent); }
.anima-box.is-drop-before::before { top: -4px; }
.anima-box.is-drop-after::after { bottom: -4px; }
.anima-box-head { display: flex; align-items: center; gap: 4px; height: 28px; padding: 0 4px 0 6px; box-sizing: border-box; }
.anima-box-grip { display: grid; place-items: center; width: 16px; height: 22px; margin-left: -2px; color: var(--ab-muted); cursor: grab; opacity: 0; transition: opacity .15s; touch-action: none; }
.anima-box:hover .anima-box-grip { opacity: 1; }
.anima-box-grip:active { cursor: grabbing; }
.anima-box-title { min-width: 0; max-width: 55%; overflow: hidden; padding: 3px 5px; border-radius: 5px; font-size: 11px; font-weight: 600; line-height: 14px; white-space: nowrap; text-overflow: ellipsis; cursor: text; transition: background .15s; }
.anima-box-title.is-placeholder { color: var(--ab-muted); font-weight: 500; }
.anima-box-title:hover { background: var(--ab-hover); }
.anima-box-title-input { width: 55%; height: 20px; box-sizing: border-box; padding: 0 5px; border: 1px solid color-mix(in srgb, var(--ab-accent) 60%, transparent); border-radius: 5px; background: transparent; color: var(--ab-text); font-family: inherit; font-size: 11px; font-weight: 600; outline: none; }
.anima-box-spacer { flex: 1; }
.anima-box button { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 22px; padding: 0 7px; border: 0; border-radius: 6px; background: transparent; color: var(--ab-muted); font-family: inherit; font-size: 11px; font-weight: 600; line-height: 1; cursor: pointer; transition: background .15s, color .15s, border-color .15s, opacity .15s; }
.anima-box button:hover { background: var(--ab-hover); color: var(--ab-text); }
.anima-box .anima-box-head button { border: 1px solid transparent; color: color-mix(in srgb, var(--ab-text) 72%, transparent); }
.anima-box .anima-box-head button:hover, .anima-box .anima-box-head button.is-open { border-color: color-mix(in srgb, var(--ab-accent) 70%, transparent); background: color-mix(in srgb, var(--ab-accent) 12%, transparent); color: var(--ab-text); }
.anima-box .anima-box-head .anima-box-remove:hover { border-color: rgba(248,113,113,.6); background: rgba(248,113,113,.12); color: #f87171; }
.anima-box .anima-box-icon { min-width: 24px; padding: 0 4px; }
.anima-box .anima-box-icon.is-on svg { color: var(--ab-accent); }
.anima-box .anima-box-head .anima-box-disable.is-on { border-color: rgba(245,158,11,.65); background: rgba(245,158,11,.12); color: #f0a92e; }
.anima-box .anima-box-head .anima-box-disable.is-on svg { color: #f0a92e; }
.anima-box-muted { display: inline-flex; align-items: center; height: 16px; margin-right: 2px; padding: 0 6px; border: 1px solid rgba(245,158,11,.55); border-radius: 999px; background: rgba(245,158,11,.12); color: #f0a92e; font-size: 9px; font-weight: 700; letter-spacing: .04em; line-height: 1; white-space: nowrap; }
.anima-box.is-muted { border-style: dashed; border-color: color-mix(in srgb, var(--ab-text) 24%, transparent); }
.anima-box.is-muted:hover { border-color: color-mix(in srgb, var(--ab-text) 36%, transparent); }
.anima-box.is-muted .anima-box-title { opacity: .65; }
.anima-box.is-muted textarea, .anima-box.is-muted .anima-box-select { opacity: .45; }
.anima-box .anima-box-select { padding: 0 6px 0 0; overflow: hidden; letter-spacing: .03em; }
.anima-box-select-icon { width: 18px; height: 100%; flex: none; border-right: 1px solid; border-right-color: inherit; background: url("${SELECT_ICON}") center / cover; }
.anima-box button b { min-width: 14px; height: 14px; box-sizing: border-box; padding: 0 4px; border-radius: 7px; background: var(--ab-accent); color: #fff; font-size: 9px; font-weight: 700; line-height: 14px; text-align: center; }
.anima-box textarea { display: block; width: 100%; box-sizing: border-box; margin: 0; padding: 0 10px 8px; border: 0; background: transparent; color: var(--ab-text); font-family: inherit; font-size: 12px; line-height: 1.5; resize: none; outline: none; overflow-y: auto; scrollbar-width: thin; }
.anima-box textarea::placeholder { color: var(--ab-muted); }
.anima-box-menu { position: absolute; top: 27px; z-index: 30; width: max-content; min-width: 120px; padding: 4px; border: 1px solid var(--ab-line); border-radius: 8px; background: var(--comfy-menu-bg, #1f2125); box-shadow: 0 10px 28px rgba(0,0,0,.38); animation: animaBoxIn .14s ease-out; }
.anima-box-menu-title { padding: 5px 8px 4px; color: var(--ab-muted); font-size: 10px; font-weight: 600; }
.anima-box .anima-box-menu button { display: flex; width: 100%; height: 26px; justify-content: flex-start; padding: 0 8px; color: var(--ab-text); font-weight: 500; }
.anima-box-menu button svg { color: var(--ab-accent); opacity: 0; }
.anima-box-menu button.is-checked svg { opacity: 1; }
.anima-box-add { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; height: ${ADD_HEIGHT}px; min-height: ${ADD_HEIGHT}px; border: 1px dashed color-mix(in srgb, var(--ab-text) 22%, transparent); border-radius: 8px; background: color-mix(in srgb, var(--ab-text) 2%, transparent); color: var(--ab-muted); font-size: 12px; font-weight: 600; line-height: 1; cursor: pointer; transition: border-color .15s, color .15s, background .15s; }
.anima-box-add:hover { border-color: color-mix(in srgb, var(--ab-accent) 70%, transparent); color: var(--ab-text); background: color-mix(in srgb, var(--ab-accent) 8%, transparent); }
`;

function injectStyle() {
    if (document.getElementById("anima-prompt-boxes-style")) return;
    document.addEventListener("wheel", claimBoxWheel, { capture: true, passive: true });
    const style = document.createElement("style");
    style.id = "anima-prompt-boxes-style";
    style.textContent = STYLE;
    document.head.appendChild(style);
}

function createBox(box) {
    return { id: Math.random().toString(36).slice(2, 8), label: "", text: "", random: [], picks: {}, disabled: false, ...box };
}

// A disabled box keeps its text on the card, but the node leaves it out of the composed prompt.
function boxDisabled(box) {
    const value = box.disabled;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    return ["true", "1", "yes", "on"].includes(String(value ?? "").trim().toLowerCase());
}

// Vue nodes hand wheel events to the canvas from a capture listener above the node, so a scrollable box claims them first.
function claimBoxWheel(event) {
    const textarea = event.target instanceof Element ? event.target.closest(".anima-box textarea") : null;
    if (textarea && !event.ctrlKey && textarea.scrollHeight > textarea.clientHeight) event.stopPropagation();
}

function parseBoxes(value) {
    const text = String(value ?? "").trim();
    return text.startsWith("[") ? JSON.parse(text).map(createBox) : null;
}

// The node used to write the artist box as @name; boxes now keep their text as typed.
export function legacyArtistText(text) {
    const tags = String(text || "")
        .split(/[\r\n,]/)
        .map(tag => tag.replace("_raw_:", "").trim())
        .map(tag => tag.startsWith("@") ? tag.slice(1).trim() : (/^by /i.test(tag) ? tag.slice(3).trim() : tag))
        .filter(Boolean);
    return tags.length ? `${tags.map(tag => `@${tag}`).join(", ")}, ` : "";
}

export function legacyPromptBoxes(values, randomState) {
    return LEGACY_BOXES.map((box, index) => createBox({
        label: box.label,
        text: box.random === "artist" ? legacyArtistText(values[index]) : String(values[index] ?? ""),
        random: box.random && normalizeBoolean(randomState?.[box.random]) ? [box.random] : [],
    }));
}

function stopNodeDrag(event) {
    event.preventDefault();
    event.stopPropagation();
}

function pickCount(box) {
    return Object.values(box.picks).reduce((count, pick) => count + (pick.keys?.length || 0), 0);
}

function createBoxesWidget(node, selectors) {
    injectStyle();
    const index = node.widgets.findIndex(widget => widget.name === WIDGET_NAME);
    const [source] = node.widgets.splice(index, 1);
    let boxes = parseBoxes(source.value) || [];
    let newBox = null;
    let closeMenu = null;
    const views = new Map();
    const textHeights = new Map();
    const randomSelectors = selectors.filter(selector => selector.random !== false);

    const holder = node.addDOMWidget(WIDGET_NAME, "anima_prompt_boxes", document.createElement("div"), {
        hideOnZoom: false,
        getValue: () => JSON.stringify(boxes),
        setValue: value => {
            if (value === JSON.stringify(boxes)) return;
            const parsed = parseBoxes(value);
            if (!parsed) return;
            boxes = parsed;
            render();
        },
    });
    holder.hidden = true;
    holder.computeSize = () => [0, -4];

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "anima-box-add";
    addButton.innerHTML = `${selectorIcon("plus")}<span>${escapeHtml(t("Add Text Box"))}</span>`;
    addButton.addEventListener("pointerdown", stopNodeDrag);
    addButton.addEventListener("mousedown", stopNodeDrag);
    addButton.addEventListener("click", event => {
        stopNodeDrag(event);
        const box = createBox({});
        newBox = box;
        setBoxes([...boxes, box]);
        // The node re-mounts its widget rows after the change; focus once the new box is in place.
        requestAnimationFrame(() => views.get(box.id)?.element.querySelector("textarea").focus());
    });
    const addWidget = node.addDOMWidget(ADD_WIDGET_NAME, "anima_box_add", addButton, { hideOnZoom: false, serialize: false, getValue: () => "", setValue: () => {} });
    addWidget.serialize = false;
    // The classic canvas insets a DOM widget by its margin above and below its row.
    addWidget.computeSize = width => [Math.max(width, MIN_WIDTH), ADD_HEIGHT + 2 * addWidget.margin];

    const nameOf = box => `${BOX_PREFIX}${box.id}`;
    const titleOf = (box, position) => box.label ? t(box.label) : t("Text box {index}", { index: position + 1 });

    function changed() {
        node.setDirtyCanvas?.(true, true);
        node.graph?.change?.();
    }

    function fitNodeHeight() {
        const height = node.computeSize()[1];
        if (Math.abs(height - node.size[1]) > 1) node.setSize?.([Math.max(node.size[0], MIN_WIDTH), height]);
        node.setDirtyCanvas?.(true, true);
    }

    // Grow each textarea with its text up to MAX_TEXT_HEIGHT; hidden textareas keep their last height.
    function fitText(textarea, box) {
        if (!textarea.offsetParent) return false;
        textarea.style.height = "0px";
        const height = Math.min(MAX_TEXT_HEIGHT, Math.max(MIN_TEXT_HEIGHT, textarea.scrollHeight));
        textarea.style.height = `${height}px`;
        if (textHeights.get(box.id) === height) return false;
        textHeights.set(box.id, height);
        return true;
    }

    function fitAll() {
        let resized = false;
        boxes.forEach(box => {
            const textarea = views.get(box.id)?.element.querySelector("textarea");
            if (textarea && fitText(textarea, box)) resized = true;
        });
        if (resized) fitNodeHeight();
    }

    function removeInputs(shouldRemove) {
        for (let slot = (node.inputs?.length || 0) - 1; slot >= 0; slot--) {
            if (shouldRemove(node.inputs[slot].name)) node.removeInput(slot);
        }
    }

    function createView(box) {
        const element = document.createElement("div");
        const view = { box, element };
        view.widget = node.addDOMWidget(nameOf(box), "anima_box", element, { hideOnZoom: false, serialize: false, getValue: () => view.box.text, setValue: () => {} });
        view.widget.serialize = false;
        view.widget.computeSize = width => [Math.max(width, MIN_WIDTH), CARD_CHROME + (textHeights.get(view.box.id) || MIN_TEXT_HEIGHT)];
        new ResizeObserver(() => requestAnimationFrame(fitAll)).observe(element);
        views.set(box.id, view);
        return view;
    }

    function removeView(id) {
        const name = `${BOX_PREFIX}${id}`;
        removeInputs(inputName => inputName === name);
        node.removeWidget(views.get(id).widget);
        views.delete(id);
    }

    // Holder first where prompt_boxes was declared, then the boxes, the add button and the node's other widgets.
    function arrange() {
        const boxWidgets = boxes.map(box => views.get(box.id).widget);
        const own = new Set([holder, addWidget, ...boxWidgets]);
        const order = [holder, ...boxWidgets, addWidget, ...node.widgets.filter(widget => !own.has(widget))];
        if (order.length !== node.widgets.length || order.some((widget, slot) => node.widgets[slot] !== widget)) {
            node.widgets.splice(0, node.widgets.length, ...order);
        }
    }

    // Each box input is bound to its widget, so ComfyUI draws the socket on the box and hides the box while linked.
    // The holder's own input would feed raw text into the JSON and is dropped.
    function syncInputs() {
        const names = new Set(boxes.map(nameOf));
        removeInputs(name => name === WIDGET_NAME || (name.startsWith(BOX_PREFIX) && !names.has(name)));
        boxes.forEach((box, position) => {
            const name = nameOf(box);
            const input = node.inputs?.find(slot => slot.name === name) || node.addInput(name, "STRING", { widget: { name } });
            input.widget = { name };
            input.label = titleOf(box, position);
            views.get(box.id).widget.label = input.label;
        });
    }

    function setBoxes(next) {
        boxes = next;
        render();
        fitNodeHeight();
        changed();
    }

    function openSelector(box) {
        openBoxSelector(t("Anima Prompt Selector"), selectors, box, updated => {
            const at = boxes.indexOf(box);
            if (at < 0) return;
            boxes[at] = updated;
            render();
            changed();
        });
    }

    function rename(box, titleEl, position) {
        const input = document.createElement("input");
        input.className = "anima-box-title-input";
        input.value = box.label ? t(box.label) : "";
        input.placeholder = titleOf({}, position);
        titleEl.replaceWith(input);
        input.focus();
        input.select();
        let done = false;
        const finish = save => {
            if (done) return;
            done = true;
            if (save && input.value.trim() !== (box.label ? t(box.label) : "")) {
                box.label = input.value.trim();
                changed();
            }
            render();
        };
        input.addEventListener("pointerdown", event => event.stopPropagation());
        input.addEventListener("keydown", event => {
            event.stopPropagation();
            if (event.key === "Enter") finish(true);
            if (event.key === "Escape") finish(false);
        });
        input.addEventListener("blur", () => finish(true));
    }

    function randomButtonHtml(box) {
        return `${selectorIcon("shuffle")}${box.random.length ? `<b>${box.random.length}</b>` : ""}`;
    }

    function toggleRandomMenu(box, anchor, card) {
        if (anchor.classList.contains("is-open")) {
            closeMenu?.();
            return;
        }
        closeMenu?.();
        const menu = document.createElement("div");
        menu.className = "anima-box-menu";
        menu.innerHTML = `<div class="anima-box-menu-title">${escapeHtml(t("Randomize on run"))}</div>${randomSelectors.map(selector => `
            <button type="button" data-kind="${escapeHtml(selector.kind)}" class="${box.random.includes(selector.kind) ? "is-checked" : ""}">${selectorIcon("check")}<span>${escapeHtml(t(selector.label))}</span></button>
        `).join("")}`;
        menu.addEventListener("pointerdown", stopNodeDrag);
        menu.addEventListener("click", event => {
            const option = event.target.closest("[data-kind]");
            if (!option) return;
            const kind = option.dataset.kind;
            box.random = randomSelectors.map(selector => selector.kind).filter(entry => entry === kind ? !box.random.includes(entry) : box.random.includes(entry));
            option.classList.toggle("is-checked", box.random.includes(kind));
            anchor.classList.toggle("is-on", box.random.length > 0);
            anchor.innerHTML = randomButtonHtml(box);
            changed();
        });
        const outside = event => {
            if (!menu.contains(event.target) && !anchor.contains(event.target)) close();
        };
        const onKey = event => {
            if (event.key === "Escape") close();
        };
        function close() {
            menu.remove();
            anchor.classList.remove("is-open");
            document.removeEventListener("pointerdown", outside, true);
            document.removeEventListener("keydown", onKey, true);
            closeMenu = null;
        }
        document.addEventListener("pointerdown", outside, true);
        document.addEventListener("keydown", onKey, true);
        anchor.classList.add("is-open");
        menu.style.right = `${card.clientWidth - anchor.offsetLeft - anchor.offsetWidth}px`;
        card.appendChild(menu);
        closeMenu = close;
    }

    function startDrag(event, box, card) {
        stopNodeDrag(event);
        const grip = event.currentTarget;
        grip.setPointerCapture(event.pointerId);
        const cards = boxes.map(entry => views.get(entry.id).element);
        const from = boxes.indexOf(box);
        let to = from;
        const clearMarks = () => cards.forEach(entry => entry.classList.remove("is-drop-before", "is-drop-after"));
        const move = moveEvent => {
            let insert = cards.findIndex(entry => {
                const rect = entry.getBoundingClientRect();
                return moveEvent.clientY < rect.top + rect.height / 2;
            });
            if (insert < 0) insert = cards.length;
            to = insert > from ? insert - 1 : insert;
            clearMarks();
            if (to === from) return;
            if (insert < cards.length) cards[insert].classList.add("is-drop-before");
            else cards[cards.length - 1].classList.add("is-drop-after");
        };
        const end = () => {
            grip.removeEventListener("pointermove", move);
            grip.removeEventListener("pointerup", end);
            grip.removeEventListener("pointercancel", end);
            card.classList.remove("is-dragging");
            clearMarks();
            if (to === from) return;
            const next = boxes.filter(entry => entry !== box);
            next.splice(to, 0, box);
            setBoxes(next);
        };
        card.classList.add("is-dragging");
        grip.addEventListener("pointermove", move);
        grip.addEventListener("pointerup", end);
        grip.addEventListener("pointercancel", end);
    }

    function drawCard(card, box, position) {
        const single = boxes.length === 1;
        const picks = pickCount(box);
        const muted = boxDisabled(box);
        card.className = `anima-box ${box === newBox ? "is-new" : ""} ${muted ? "is-muted" : ""}`;
        card.innerHTML = `
            <div class="anima-box-head">
                ${single ? "" : `<span class="anima-box-grip" title="${escapeHtml(t("Drag to reorder"))}">${selectorIcon("grip")}</span>`}
                <span class="anima-box-title ${box.label ? "" : "is-placeholder"}" title="${escapeHtml(t("Click to rename"))}">${escapeHtml(titleOf(box, position))}</span>
                <span class="anima-box-spacer"></span>
                ${muted ? `<span class="anima-box-muted">${escapeHtml(t("Disabled"))}</span>` : ""}
                <button type="button" class="anima-box-icon anima-box-disable ${muted ? "is-on" : ""}" data-action="disable" title="${escapeHtml(muted ? t("Enable text box") : t("Disable text box"))}">${selectorIcon("ban")}</button>
                <button type="button" class="anima-box-icon ${box.random.length ? "is-on" : ""}" data-action="random" title="${escapeHtml(t("Randomize on run"))}">${randomButtonHtml(box)}</button>
                <button type="button" class="anima-box-icon" data-action="clear" title="${escapeHtml(t("Clear"))}">${selectorIcon("eraser")}</button>
                <button type="button" class="anima-box-icon" data-action="copy" title="${escapeHtml(t("Copy"))}">${selectorIcon("copy")}</button>
                <button type="button" class="anima-box-select" data-action="select" title="${escapeHtml(t("Anima Prompt Selector"))}"><span class="anima-box-select-icon"></span><span>${escapeHtml(t("Select"))}</span>${picks ? `<b>${picks}</b>` : ""}</button>
                ${single ? "" : `<button type="button" class="anima-box-icon anima-box-remove" data-action="remove" title="${escapeHtml(t("Remove text box"))}">${selectorIcon("close")}</button>`}
            </div>
            <textarea spellcheck="false"></textarea>`;
        const textarea = card.querySelector("textarea");
        textarea.value = box.text;
        textarea.placeholder = t("Type a prompt, or pick tags from the selector...");
        textarea.style.height = `${textHeights.get(box.id) || MIN_TEXT_HEIGHT}px`;
        textarea.addEventListener("input", () => {
            box.text = textarea.value;
            if (fitText(textarea, box)) fitNodeHeight();
            changed();
        });

        card.querySelector(".anima-box-grip")?.addEventListener("pointerdown", event => startDrag(event, box, card));
        const titleEl = card.querySelector(".anima-box-title");
        titleEl.addEventListener("pointerdown", stopNodeDrag);
        titleEl.addEventListener("click", () => rename(box, titleEl, position));
        card.querySelectorAll("button").forEach(button => {
            button.addEventListener("pointerdown", stopNodeDrag);
            button.addEventListener("mousedown", stopNodeDrag);
        });
        card.querySelector(".anima-box-head").addEventListener("click", event => {
            const button = event.target.closest("[data-action]");
            const action = button?.dataset.action;
            if (action === "disable") {
                box.disabled = !boxDisabled(box);
                render();
                changed();
            }
            if (action === "random") toggleRandomMenu(box, button, card);
            if (action === "clear") {
                box.text = "";
                box.picks = {};
                render();
                changed();
            }
            if (action === "copy") {
                copyText(box.text, () => {
                    button.innerHTML = selectorIcon("check");
                    setTimeout(() => { button.innerHTML = selectorIcon("copy"); }, 1200);
                });
            }
            if (action === "select") openSelector(box);
            if (action === "remove") setBoxes(boxes.filter(entry => entry !== box));
        });
    }

    function render() {
        closeMenu?.();
        const ids = new Set(boxes.map(box => box.id));
        [...views.keys()].filter(id => !ids.has(id)).forEach(removeView);
        boxes.forEach((box, position) => {
            const view = views.get(box.id) || createView(box);
            view.box = box;
            drawCard(view.element, box, position);
        });
        arrange();
        syncInputs();
        newBox = null;
        requestAnimationFrame(fitAll);
    }

    render();
    node.setSize?.([Math.max(node.size[0], MIN_WIDTH), node.computeSize()[1]]);
    return {
        render,
        // Saved links name their target by slot index, so the box inputs made for the default box must go before
        // the saved inputs are restored, or every saved box input would land one slot later.
        reset() {
            boxes = [];
            [...views.keys()].forEach(removeView);
        },
        migrate(values, savedInputs = []) {
            const legacy = legacyPromptBoxes(values, node.properties?.[SELECTOR_RANDOM_PROPERTY]);
            // ComfyUI re-attaches saved links by slot index, which no longer matches the old section inputs, so follow
            // each old input's link id to the slot now holding it and hand that slot to the matching box.
            LEGACY_BOXES.forEach((entry, position) => {
                const link = savedInputs.find(slot => slot.name === entry.input)?.link;
                const input = link == null ? null : node.inputs?.find(slot => slot.link === link);
                if (input) input.name = nameOf(legacy[position]);
            });
            const legacyInputs = new Set(LEGACY_BOXES.map(entry => entry.input));
            removeInputs(name => legacyInputs.has(name));
            setBoxes(legacy);
            delete node.properties[SELECTOR_RANDOM_PROPERTY];
            const separator = node.widgets.find(entry => entry.name === "separator");
            if (separator) separator.value = values[LEGACY_SEPARATOR_INDEX] ?? ", ";
        },
    };
}

export function installPromptBoxes(nodeType, selectors) {
    const origOnCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
        origOnCreated?.apply(this, arguments);
        this.__animaPromptBoxes = createBoxesWidget(this, selectors);
    };

    const origConfigure = nodeType.prototype.configure;
    nodeType.prototype.configure = function () {
        this.__animaPromptBoxes?.reset();
        return origConfigure.apply(this, arguments);
    };

    // Workflows saved before the boxes became dynamic hold one widget value per fixed box plus the separator.
    const origOnConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function (info) {
        const result = origOnConfigure?.apply(this, arguments);
        const values = info?.widgets_values;
        if (Array.isArray(values) && values.length > LEGACY_SEPARATOR_INDEX) this.__animaPromptBoxes.migrate(values, info.inputs);
        else this.__animaPromptBoxes.render();
        return result;
    };
}
