// ComfyUI theme sampling, copied from CivitaiManager's civitai_manager.js.
import { app } from "../../../scripts/app.js";

let themeObserver = null;
let themeSyncQueued = false;
let themeColorProbe = null;

function isUsefulThemeColor(value) {
    const color = String(value || "").trim();
    return color
        && color !== "transparent"
        && color !== "none"
        && !/^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/i.test(color)
        && !/^rgba?\([^)]*,\s*0\s*\)$/i.test(color);
}

function isVisibleThemeElement(element) {
    if (!(element instanceof HTMLElement)) return false;
    const style = getComputedStyle(element);
    return style.display !== "none"
        && style.visibility !== "hidden"
        && Number.parseFloat(style.opacity || "1") > 0
        && element.getClientRects().length > 0;
}

function readCssColor(style, names) {
    for (const name of names) {
        const value = style.getPropertyValue(name).trim();
        if (isUsefulThemeColor(value)) return value;
    }
    return "";
}

function resolveThemeRgb(value) {
    if (!isUsefulThemeColor(value)) return null;
    if (!themeColorProbe) {
        themeColorProbe = document.createElement("span");
        themeColorProbe.setAttribute("aria-hidden", "true");
        themeColorProbe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;width:0;height:0;overflow:hidden;";
        document.documentElement.appendChild(themeColorProbe);
    }

    themeColorProbe.style.color = "";
    themeColorProbe.style.color = value;
    if (!themeColorProbe.style.color) return null;

    const resolved = getComputedStyle(themeColorProbe).color;
    const channels = resolved.match(/[\d.]+/g)?.map(Number);
    if (!channels || channels.length < 3) return null;
    if (resolved.startsWith("color(srgb")) {
        return channels.slice(0, 3).map((channel) => channel * 255);
    }
    return channels.slice(0, 3);
}

function themeColorLuminance(value) {
    const rgb = resolveThemeRgb(value);
    if (!rgb) return null;
    const [red, green, blue] = rgb.map((channel) => {
        const srgb = Math.max(0, Math.min(255, channel)) / 255;
        return srgb <= 0.04045
            ? srgb / 12.92
            : ((srgb + 0.055) / 1.055) ** 2.4;
    });
    return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function themeColorHsl(value) {
    const rgb = resolveThemeRgb(value);
    if (!rgb) return null;
    const [red, green, blue] = rgb.map((channel) => Math.max(0, Math.min(255, channel)) / 255);
    const max = Math.max(red, green, blue);
    const chroma = max - Math.min(red, green, blue);
    if (!chroma) return { hue: 0, saturation: 0, chroma };
    const lightness = max - chroma / 2;
    const sector = max === red ? ((green - blue) / chroma + 6) % 6 : max === green ? (blue - red) / chroma + 2 : (red - green) / chroma + 4;
    return { hue: sector * 60, saturation: chroma / (1 - Math.abs(2 * lightness - 1)), chroma };
}

// Palettes have no accent token, so the most saturated palette color carries
// the theme hue; neutral palettes fall back to ComfyUI's primary blue. The
// lightness is fixed per theme so text and filled buttons stay readable.
function themeAccent(style, isLightTheme) {
    let source = null;
    for (const name of ["--border-color", "--interface-panel-selected-surface", "--comfy-menu-secondary-bg", "--content-hover-bg", "--content-bg"]) {
        const hsl = themeColorHsl(style.getPropertyValue(name).trim());
        if (hsl && hsl.chroma >= 0.12 && (!source || hsl.chroma > source.chroma)) source = hsl;
    }
    source ||= themeColorHsl(readCssColor(style, ["--primary-background", "--p-primary-color"]));
    if (!source) return {};
    const hue = Math.round(source.hue);
    const saturation = Math.round(Math.min(Math.max(source.saturation, 0.35), 0.6) * 100);
    return {
        text: `hsl(${hue} ${saturation}% ${isLightTheme ? 38 : 70}%)`,
        fill: `hsl(${hue} ${saturation}% ${isLightTheme ? 42 : 44}%)`,
    };
}

function firstVisibleElement(selectors) {
    for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
            if (isVisibleThemeElement(element)) return element;
        }
    }
    return null;
}

function readElementColor(elementOrSelectors, property, fallback = "") {
    const element = Array.isArray(elementOrSelectors) ? firstVisibleElement(elementOrSelectors) : elementOrSelectors;
    if (!element || !(element instanceof HTMLElement)) return fallback;
    const value = getComputedStyle(element)[property];
    return isUsefulThemeColor(value) ? value : fallback;
}

function readBorderColor(element) {
    if (!element || !(element instanceof HTMLElement)) return "";
    const style = getComputedStyle(element);
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
        const width = Number.parseFloat(style[`border${side}Width`] || "0");
        const borderStyle = style[`border${side}Style`];
        const color = style[`border${side}Color`];
        if (width > 0 && borderStyle !== "none" && borderStyle !== "hidden" && isUsefulThemeColor(color)) {
            return color;
        }
    }
    return "";
}

function findThemeMenuContainer() {
    if (app?.ui?.menuContainer instanceof HTMLElement) {
        return app.ui.menuContainer;
    }
    return firstVisibleElement([
        "#comfy-menu",
        ".comfy-menu",
        ".comfyui-menu",
        ".comfyui-body-topbar",
        ".comfyui-workspace-bar",
        ".comfyui-topbar",
        ".comfyui-toolbar",
        ".comfyui-menu-right",
        "[data-testid='topbar']",
        "[role='toolbar']",
        ".p-toolbar",
        ".topbar",
        ".p-menubar",
    ]);
}

function setRootVariable(name, value) {
    const root = document.documentElement;
    const current = root.style.getPropertyValue(name).trim();
    if (isUsefulThemeColor(value)) {
        if (current !== value) root.style.setProperty(name, value);
    } else if (current) {
        root.style.removeProperty(name);
    }
}

function syncThemeVariables() {
    const rootStyle = getComputedStyle(document.documentElement);
    const bodyStyle = document.body ? getComputedStyle(document.body) : rootStyle;
    const menu = findThemeMenuContainer();
    const controlElement = firstVisibleElement([
        ".comfy-menu input",
        ".comfy-menu select",
        ".comfy-menu button",
        ".comfyui-menu input",
        ".comfyui-menu select",
        ".comfyui-menu button",
        ".comfyui-input",
        ".comfyui-button",
        ".p-form-field",
        ".p-inputtext",
        ".p-select",
        ".p-button",
    ]);

    const panelBg = readElementColor(menu, "backgroundColor")
        || readCssColor(rootStyle, ["--comfy-menu-bg", "--p-content-background", "--bg-color"])
        || readElementColor(document.body, "backgroundColor")
        || bodyStyle.backgroundColor;
    const cardBg = readCssColor(rootStyle, [
        "--comfy-input-bg",
        "--p-form-field-background",
        "--component-node-widget-background",
        "--secondary-background",
    ]) || readElementColor(menu, "backgroundColor") || panelBg;
    const controlBg = cardBg;
    const borderColor = readBorderColor(controlElement)
        || readBorderColor(menu)
        || readCssColor(rootStyle, ["--border-color", "--p-content-border-color", "--p-button-secondary-border-color"]);
    const textColor = readElementColor(menu, "color")
        || readCssColor(rootStyle, ["--fg-color", "--input-text", "--p-text-color"])
        || bodyStyle.color;
    const mutedColor = readCssColor(rootStyle, ["--descrip-text", "--p-text-muted-color", "--muted-foreground"]);
    const panelLuminance = themeColorLuminance(panelBg);
    const isLightTheme = panelLuminance !== null && panelLuminance >= 0.5;
    const readableTextColor = panelLuminance === null
        ? textColor
        : (isLightTheme ? "#18181b" : "#e4e4e7");
    const readableMutedColor = panelLuminance === null
        ? mutedColor
        : (isLightTheme ? "#52525b" : "#b8bec7");
    const accent = themeAccent(rootStyle, isLightTheme);

    setRootVariable("--alm-sampled-accent", accent.text);
    setRootVariable("--alm-sampled-primary", accent.fill);
    setRootVariable("--alm-sampled-panel-bg", panelBg);
    setRootVariable("--alm-sampled-card-bg", cardBg);
    setRootVariable("--alm-sampled-control-bg", controlBg);
    setRootVariable("--alm-sampled-border-color", borderColor);
    setRootVariable("--alm-sampled-text-color", readableTextColor);
    setRootVariable("--alm-sampled-muted-color", readableMutedColor);

    setRootVariable("--alm-sampled-bg", panelBg);
    setRootVariable("--alm-sampled-panel", panelBg);
    setRootVariable("--alm-sampled-card", cardBg);
    setRootVariable("--alm-sampled-control", controlBg);
    setRootVariable("--alm-sampled-border", borderColor);
    setRootVariable("--alm-sampled-text", readableTextColor);
    setRootVariable("--alm-sampled-muted", readableMutedColor);
}

function queueThemeSync() {
    if (themeSyncQueued) return;
    themeSyncQueued = true;
    requestAnimationFrame(() => {
        themeSyncQueued = false;
        syncThemeVariables();
    });
}

export function observeThemeChanges() {
    if (themeObserver) {
        queueThemeSync();
        return;
    }
    themeObserver = new MutationObserver(() => queueThemeSync());
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "style", "data-theme", "data-color-mode"],
    });
    if (document.body) {
        themeObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ["class", "style", "data-theme", "data-color-mode"],
        });
    }
    if (document.head) {
        themeObserver.observe(document.head, {
            attributes: true,
            childList: true,
            subtree: true,
            attributeFilter: ["class", "style", "href"],
        });
    }
    window.addEventListener("focus", queueThemeSync);
    queueThemeSync();
}
