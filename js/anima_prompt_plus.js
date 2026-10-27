import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { t } from "./i18n.js";
import { openPromptSelector } from "./anima_gallery_selector.js";
import { artistSelector } from "./anima_artist_selector.js";
import { characterSelector } from "./anima_character_selector.js";
import { TAG_SELECTORS } from "./anima_tag_selectors.js";
import {
    addPromptSelectorWidget,
    applySelectorWidgetValues,
    installSelectorExecutionSync,
    isAnimaPromptPlusNode,
    refreshPromptSelectorWidget,
} from "./anima_selector_random.js";

const CLIP_ENCODE_NODE_NAME = "AnimaPromptPlusClipEncode";
const [clothingSelector, backgroundSelector, poseSelector] = TAG_SELECTORS;
// Same order as the tag widgets on the node.
const PROMPT_SELECTORS = [artistSelector, characterSelector, clothingSelector, poseSelector, backgroundSelector];

app.registerExtension({
    name: "AnimaPromptPlus.extension",

    async setup() {
        api.addEventListener("anima.prompt_plus_resolved", ({ detail }) => {
            const updates = detail?.nodes;
            if (!updates || typeof updates !== "object") return;
            for (const [nodeId, values] of Object.entries(updates)) {
                const node = app.graph?.getNodeById?.(Number(nodeId))
                    || app.graph?.getNodeById?.(nodeId);
                if (!node || node.type !== CLIP_ENCODE_NODE_NAME) continue;
                applySelectorWidgetValues(node, values);
                removeInternalTextControls(node);
            }
        });
    },

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (!isAnimaPromptPlusNode(nodeData.name)) return;
        installSelectorExecutionSync(nodeType);

        const origOnCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origOnCreated?.apply(this, arguments);
            addPromptSelectorWidget(this, PROMPT_SELECTORS, () => openPromptSelector(
                this,
                t("Anima Prompt Selector"),
                PROMPT_SELECTORS,
                () => refreshPromptSelectorWidget(this),
            ));
            if (nodeData.name === CLIP_ENCODE_NODE_NAME) setTimeout(() => removeInternalTextControls(this), 0);
        };

        const origOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const result = origOnConfigure?.apply(this, arguments);
            if (nodeData.name === CLIP_ENCODE_NODE_NAME) setTimeout(() => removeInternalTextControls(this), 0);
            return result;
        };
    }
});

function removeInternalTextControls(node) {
    if (!node) return;

    const widgetIndex = node.widgets?.findIndex(item => item?.name === "text") ?? -1;
    if (widgetIndex >= 0) {
        const [widget] = node.widgets.splice(widgetIndex, 1);
        [widget?.element, widget?.inputEl, widget?.el, widget?.container].forEach(element => {
            element?.remove?.();
        });
    }

    const inputIndex = node.inputs?.findIndex(input => input?.name === "text") ?? -1;
    if (inputIndex >= 0) {
        node.removeInput?.(inputIndex);
    }

    const currentWidth = node.size?.[0];
    const computedSize = node.computeSize?.();
    if (Number.isFinite(currentWidth) && Number.isFinite(computedSize?.[1])) {
        node.setSize?.([currentWidth, computedSize[1]]);
    }
    node.setDirtyCanvas?.(true, true);
    node.graph?.setDirtyCanvas?.(true, true);
}
