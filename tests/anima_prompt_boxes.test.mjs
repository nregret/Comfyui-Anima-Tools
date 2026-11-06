import assert from "node:assert/strict";
import { register } from "node:module";

// Selector modules import ComfyUI's app from ../../scripts/app.js; stub it for Node.
register(`data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, next) {
    if (specifier.endsWith("/scripts/app.js")) {
        return { url: "data:text/javascript,export const app = { registerExtension() {} };", shortCircuit: true };
    }
    return next(specifier, context);
}
`)}`);

globalThis.window = globalThis;

const { replacePromptTokens } = await import("../js/anima_gallery_selector.js");
const { legacyArtistText, legacyPromptBoxes } = await import("../js/anima_prompt_boxes.js");

// A tab's old tags are swapped in place; typed text and other tabs' tags stay.
assert.deepEqual(
    replacePromptTokens(["masterpiece", "@dairi", "@wlop", "smile"], ["@dairi", "@wlop"], ["@ask"]),
    ["masterpiece", "@ask", "smile"],
);
// Without old tags the new ones are appended, skipping tags already in the box.
assert.deepEqual(replacePromptTokens(["masterpiece", "Smile"], [], ["smile", "bikini", "bikini"]), ["masterpiece", "Smile", "bikini"]);
// Deselecting everything removes only that tab's tags.
assert.deepEqual(replacePromptTokens(["a", "bikini", "b"], ["bikini"], []), ["a", "b"]);

// Old artist boxes were written as @name by the node.
assert.equal(legacyArtistText("dairi, by ebifurya\n@wlop, _raw_:ask"), "@dairi, @ebifurya, @wlop, @ask, ");
assert.equal(legacyArtistText(""), "");

const migrated = legacyPromptBoxes(
    ["masterpiece", "dairi", "miku", "school uniform", "standing", "classroom", "smile", ", "],
    { artist: true, pose: "true", clothing: false },
);
assert.deepEqual(migrated.map(box => box.label), ["Quality Prompt", "Artists", "Characters", "Clothing", "Pose", "Background", "Extra Prompt"]);
assert.deepEqual(migrated.map(box => box.text), ["masterpiece", "@dairi, ", "miku", "school uniform", "standing", "classroom", "smile"]);
assert.deepEqual(migrated.map(box => box.random), [[], ["artist"], [], [], ["pose"], [], []]);

console.log("anima_prompt_boxes tests passed");
