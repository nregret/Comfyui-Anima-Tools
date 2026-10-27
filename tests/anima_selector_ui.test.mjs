import assert from "node:assert/strict";

function createFakeElement(tag) {
    return {
        tag,
        children: [],
        className: "",
        dataset: {},
        innerText: "",
        appendChild(child) {
            this.children.push(child);
            return child;
        },
    };
}

const head = createFakeElement("head");
globalThis.document = {
    head,
    createElement: createFakeElement,
    getElementById: id => head.children.find(child => child.id === id) || null,
};

const ui = await import("../js/anima_selector_ui.js");

assert.deepEqual(
    ui.splitPromptTokens("_raw_:one, two, , three "),
    ["one", "two", "three"],
);
assert.deepEqual(ui.splitPromptTokens(["a, b", "_raw_:c"]), ["a", "b", "c"]);
assert.equal(ui.normalizePromptToken("_raw_:Hello World "), "hello world");
assert.equal(ui.escapeHtml(`<tag a="b">'&`), "&lt;tag a=&quot;b&quot;&gt;&#39;&amp;");
assert.equal(ui.escapeHtml(undefined), "");
assert.equal(ui.formatCount(999), "999");
assert.equal(ui.formatCount(103500), "103.5k");
assert.equal(ui.formatCount(2000), "2k");

const shuffled = ui.shuffleInPlace([1, 2, 3, 4, 5]);
assert.deepEqual([...shuffled].sort(), [1, 2, 3, 4, 5]);

const element = ui.createEl("button", "sample", "Label");
assert.equal(element.className, "sample");
assert.equal(element.innerText, "Label");

for (const name of ["grid", "star", "applied", "palette", "user", "shirt", "image", "pose", "close", "check", "github"]) {
    assert.match(ui.selectorIcon(name), /^<svg class="anima-sel-icon"/);
}
assert.doesNotMatch(ui.selectorIcon("star"), /undefined/);

ui.injectSelectorStyles();
ui.injectSelectorStyles();
assert.equal(head.children.length, 1);
assert.equal(head.children[0].id, "anima-selector-style");
assert.match(head.children[0].textContent, /\.anima-sel-overlay \{/);
assert.match(head.children[0].textContent, /--anima-accent: var\(--primary-background/);

console.log("anima_selector_ui tests passed");
