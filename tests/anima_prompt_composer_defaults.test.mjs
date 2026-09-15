import assert from "node:assert/strict";

import {
    COMPOSER_WIDGET_DEFAULTS,
    isUsableWidgetValue,
    repairComposerWidgetValues,
    widgetDefault,
} from "../js/anima_prompt_composer_defaults.js";

function makeNode(widgets) {
    return { widgets };
}

function widget(name, value, options) {
    const created = { name, value };
    if (options) created.options = options;
    return created;
}

{
    // The case the queue rejects: the five 3.3.0 widgets come back as null from a
    // workflow that was saved before they existed.
    const characterSeed = widget("character_seed", null);
    const tagCount = widget("character_tag_count", undefined);
    const keepFeatures = widget("character_keep_features", null);
    const clothingSeed = widget("clothing_seed", "");
    const clothingSource = widget("clothing_source", null, { values: ["author", "danbooru", "character_tags", "random"] });
    const resolvedPrompt = widget("resolved_prompt", null);

    const repaired = repairComposerWidgetValues(
        makeNode([characterSeed, tagCount, keepFeatures, clothingSeed, clothingSource, resolvedPrompt]),
    );

    assert.deepEqual(repaired, [
        "character_seed",
        "character_tag_count",
        "character_keep_features",
        "clothing_seed",
        "clothing_source",
        "resolved_prompt",
    ]);
    assert.equal(characterSeed.value, -1);
    assert.equal(tagCount.value, 3);
    assert.equal(keepFeatures.value, true);
    assert.equal(clothingSeed.value, -1);
    assert.equal(clothingSource.value, "author");
    assert.equal(resolvedPrompt.value, "");
}

{
    // Values the queue accepts must survive untouched, including the falsy ones.
    const widgets = [
        widget("seed", 0),
        widget("character_seed", -1),
        widget("artist_count", 1),
        widget("enable_artist", false),
        widget("preview_collapsed", false),
        widget("resolved_prompt", "1girl, solo, "),
        widget("character_detail", "trigger", { values: ["trigger", "trigger_tags", "trigger_random_tags"] }),
    ];

    assert.deepEqual(repairComposerWidgetValues(makeNode(widgets)), []);
    assert.deepEqual(
        widgets.map((item) => item.value),
        [0, -1, 1, false, false, "1girl, solo, ", "trigger"],
    );
}

{
    // A value of the wrong kind is repaired as well: the frontend writes `null`
    // for missing widgets, but a hand-edited or older workflow can hold anything.
    assert.equal(widgetDefault(widget("character_seed", null)), -1);
    assert.equal(widgetDefault(widget("character_seed", null, { default: 7 })), 7);
    assert.equal(widgetDefault(widget("anima_prompt_composer_dom_preview", null)), undefined);

    assert.equal(isUsableWidgetValue(widget("character_seed"), -1, "4242"), true);
    assert.equal(isUsableWidgetValue(widget("character_seed"), -1, "abc"), false);
    assert.equal(isUsableWidgetValue(widget("character_seed"), -1, true), false);
    assert.equal(isUsableWidgetValue(widget("character_seed"), -1, "   "), false);
    assert.equal(isUsableWidgetValue(widget("clothing_source", "author", { values: [] }), "author", "danbooru"), false);
    assert.equal(isUsableWidgetValue(widget("enable_artist"), true, 1), true);
}

{
    // The toggle button the extension adds has no default and is left alone.
    const toggle = { name: "Collapse Preview", value: null };
    assert.deepEqual(repairComposerWidgetValues(makeNode([toggle])), []);
    assert.equal(toggle.value, null);
}

{
    // The callback of a repaired widget runs, so the node redraws with the value
    // the engine will use.
    const calls = [];
    const characterSeed = widget("character_seed", null);
    characterSeed.callback = (value) => calls.push(value);

    repairComposerWidgetValues(makeNode([characterSeed]));

    assert.deepEqual(calls, [COMPOSER_WIDGET_DEFAULTS.character_seed]);
}

{
    assert.deepEqual(repairComposerWidgetValues(undefined), []);
}

console.log("anima_prompt_composer_defaults tests passed");
