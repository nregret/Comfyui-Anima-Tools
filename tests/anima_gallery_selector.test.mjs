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
const requests = [];
let saveOk = true;
globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, body: options.body ? JSON.parse(options.body) : null });
    return { ok: saveOk, text: async () => "error", json: async () => ({}) };
};
const silentError = console.error;
console.error = () => {};

const { createFavoriteStore } = await import("../js/anima_gallery_selector.js");
const { parseInitialSelection } = await import("../js/anima_artist_selector.js");

const favoriteKey = item => item.name;
const store = createFavoriteStore("artist", {
    groups: [{ id: "group_a", name: "A" }],
    items: [
        { name: "legacy", nickname: "", groupIds: [] },
        { name: "grouped", nickname: "", groupIds: ["group_a"] },
        { id: "custom_1", name: "Custom", nickname: "Custom", isCustom: true, customContent: "x", groupIds: ["group_a"] },
    ],
}, favoriteKey);

assert.deepEqual(store.groups().map(group => group.id), ["default", "group_a"]);
assert.equal(store.isFavorite({ name: "legacy" }), true);
assert.deepEqual(store.record({ name: "legacy" }).groupIds, ["default"]);
assert.equal(store.count("group_a"), 2);
assert.equal(store.total(), 3);

assert.equal(await store.toggleFavorite({ name: "new" }, item => ({ name: item.name, isCustom: false })), true);
assert.deepEqual(store.record({ name: "new" }).groupIds, ["default"]);
const saved = requests.at(-1).body;
assert.deepEqual(Object.keys(saved), ["artist"]);
assert.equal(saved.artist.items.length, 4);

saveOk = false;
assert.equal(await store.toggleFavorite({ name: "new" }, item => ({ name: item.name })), false);
assert.equal(store.isFavorite({ name: "new" }), true, "failed save rolls back");
saveOk = true;

assert.equal(await store.removeGroup("group_a"), true);
assert.deepEqual(store.groups().map(group => group.id), ["default"]);
assert.deepEqual(store.record({ name: "grouped" }).groupIds, ["default"]);
assert.deepEqual(store.customsIn("default").map(item => item.name), ["Custom"]);

assert.equal(await store.setGroup({ name: "grouped" }, "default", false), true);
assert.equal(store.isFavorite({ name: "grouped" }), false);

assert.equal(await store.setNote({ name: "legacy" }, "memo"), true);
assert.equal(store.record({ name: "legacy" }).nickname, "memo");

const data = [{ name: "dairi", id: "1" }, { name: "hammer \\(sunset beach\\)", id: "2" }];
const customs = [{ name: "Mix", isCustom: true, customContent: "masterpiece, best quality" }];
const parsed = parseInitialSelection("@dairi, by hammer \\(sunset beach\\), _raw_:masterpiece, _raw_:best quality, _raw_:orphan, @unknown", data, customs);
assert.deepEqual(parsed.map(item => item.name), ["dairi", "hammer \\(sunset beach\\)", "unknown", "Mix", "_raw_:orphan"]);
assert.equal(parsed[0], data[0]);

console.error = silentError;
console.log("anima_gallery_selector tests passed");
