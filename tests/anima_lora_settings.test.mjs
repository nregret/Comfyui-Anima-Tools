import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../js/anima_lora_selector.js", import.meta.url), "utf8");
const modalSource = source.slice(source.indexOf("    function openSettingsModal()"), source.lastIndexOf("\n}"));

async function saveSettings(keyEdit, error = null) {
    const elements = [];
    const requests = [];
    const alerts = [];
    const createElement = tag => {
        const element = {
            tag, style: {}, children: [], events: {}, value: "",
            appendChild(child) { this.children.push(child); },
            addEventListener(type, fn) { this.events[type] = fn; },
            select() {},
            remove() { this.removed = true; },
        };
        elements.push(element);
        return element;
    };
    const config = { custom_lora_dir: "/models/loras", has_civitai_api_key: true };
    const context = vm.createContext({
        document: { createElement, body: createElement("body") }, config,
        t: text => text, CIVITAI_API_KEYS_URL: "https://civitai.com/user/account?tab=apiKeys",
        currentCategory: "all", globalLoraConfig: null, civitaiApiKeyDownloadWarningShown: false,
        refreshManifest: async () => {}, renderGrid() {}, console,
        alert: message => alerts.push(message),
        fetch: async (url, options) => {
            requests.push({ url, body: JSON.parse(options.body) });
            return { ok: !error, json: async () => error ? { error } : {
                custom_lora_dir: "/models/loras", custom_lora_dir_valid: true,
                custom_lora_dir_abs: "/models/loras", has_civitai_api_key: keyEdit !== "",
            } };
        },
    });
    vm.runInContext(modalSource + "\nopenSettingsModal();", context);
    const keyInput = elements.find(element => element.type === "password");
    assert.equal(keyInput.value, "••••••••");
    if (keyEdit !== undefined) {
        keyInput.value = keyEdit;
        keyInput.events.input();
    }
    await elements.find(element => element.tag === "button" && element.innerText === "Save").onclick();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "/anima-tools/lora/config");
    assert.equal(Object.hasOwn(config, "civitai_api_key"), false);
    return { body: requests[0].body, config, alerts };
}

assert.equal(Object.hasOwn((await saveSettings()).body, "civitai_api_key"), false);
assert.equal((await saveSettings("NEW_TEST_KEY")).body.civitai_api_key, "NEW_TEST_KEY");
const cleared = await saveSettings("");
assert.equal(cleared.body.civitai_api_key, "");
assert.equal(cleared.config.has_civitai_api_key, false);
assert.deepEqual((await saveSettings(undefined, "Choose a registered LoRA directory")).alerts, ["Choose a registered LoRA directory"]);
console.log("anima_lora_settings tests passed");
