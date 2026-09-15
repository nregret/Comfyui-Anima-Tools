// Widget values of `AnimaPromptComposer` that reached the graph without a value.
//
// The frontend serializes a widget it has no value for as `null` (`value ?? null`
// in the node serializer) and restores a saved `widgets_values` array by
// position, so a workflow saved before a widget existed hands the widget that now
// sits at that index whatever the array held there - for this node that is the
// five inputs added in 3.3.0, right after `resolved_prompt`.
//
// Such a value is not harmless: the queue sends it as a literal and ComfyUI's
// `validate_inputs` converts literals with `int()` / `bool()` before the node
// runs, so `character_seed: null` fails the whole prompt with
//
//     Failed to convert an input value to a INT value: character_seed, None
//
// Restoring the node definition's default on load keeps the widget, the node
// signature and the value the engine would use in agreement - and writes a usable
// value back into the workflow on the next save, so the damage does not persist.

export const COMPOSER_WIDGET_DEFAULTS = Object.freeze({
    enable_artist: true,
    enable_character: true,
    enable_clothing: true,
    enable_background: true,
    enable_pose: true,
    character_detail: "trigger",
    seed: -1,
    artist_count: 1,
    preview_collapsed: false,
    resolved_prompt: "",
    character_seed: -1,
    character_tag_count: 3,
    character_keep_features: true,
    clothing_seed: -1,
    clothing_source: "author",
});

export function widgetDefault(widget, defaults = COMPOSER_WIDGET_DEFAULTS) {
    const declared = widget?.options?.default;
    if (declared !== undefined) return declared;
    return defaults?.[widget?.name];
}

export function isUsableWidgetValue(widget, fallback, value) {
    if (value === null || value === undefined) return false;

    const choices = widget?.options?.values;
    if (Array.isArray(choices)) return choices.includes(value);

    if (typeof fallback === "number") {
        if (typeof value === "boolean") return false;
        return Number.isFinite(Number(value)) && String(value).trim() !== "";
    }
    if (typeof fallback === "boolean") {
        return typeof value === "boolean" || value === 0 || value === 1;
    }
    return true;
}

export function repairComposerWidgetValues(node, defaults = COMPOSER_WIDGET_DEFAULTS) {
    const repaired = [];
    for (const widget of node?.widgets || []) {
        const fallback = widgetDefault(widget, defaults);
        if (fallback === undefined) continue;
        if (isUsableWidgetValue(widget, fallback, widget.value)) continue;
        widget.value = fallback;
        widget.callback?.(fallback);
        repaired.push(widget.name);
    }
    return repaired;
}
