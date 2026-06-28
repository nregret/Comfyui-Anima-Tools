import { t } from "./i18n.js";

export const PROMO_LINKS = {
    github: "https://github.com/nregret/Comfyui-Anima-Tools",
    afdian: "https://www.ifdian.net/a/nnegret?utm_source=copylink&utm_medium=link",
};

export function createPromoLinks({ accentColor = "#38bdf8" } = {}) {
    const wrap = document.createElement("div");
    wrap.className = "anima-promo-links";
    wrap.style.cssText = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        flex: 0 0 auto;
    `;

    wrap.appendChild(createPromoButton({
        url: PROMO_LINKS.github,
        title: t("Open GitHub"),
        accentColor,
        content: githubIcon(),
    }));
    wrap.appendChild(createPromoButton({
        url: PROMO_LINKS.afdian,
        title: PROMO_LINKS.afdian ? t("Support on Afdian") : t("Afdian link not configured"),
        accentColor: "#f472b6",
        width: 54,
        content: `<span style="font-size:12px;font-weight:850;">${t("Support on Afdian")}</span>`,
    }));

    return wrap;
}

function createPromoButton({ url, title, accentColor, content, width = 34 }) {
    const enabled = Boolean(url);
    const el = document.createElement(enabled ? "a" : "span");
    el.className = "anima-promo-link";
    el.title = title;
    el.setAttribute("aria-label", title);
    el.innerHTML = content;
    if (enabled) {
        el.href = url;
        el.target = "_blank";
        el.rel = "noopener noreferrer";
    }
    el.style.cssText = `
        width: ${width}px;
        height: 34px;
        border-radius: 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: ${accentColor};
        background: rgba(255,255,255,0.045);
        border: 1px solid ${hexToRgba(accentColor, 0.36)};
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        cursor: ${enabled ? "pointer" : "not-allowed"};
        opacity: ${enabled ? "1" : "0.48"};
        text-decoration: none;
        transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
        user-select: none;
        flex: 0 0 auto;
    `;
    el.onmousedown = event => event.stopPropagation();
    el.onclick = event => {
        event.stopPropagation();
        if (!enabled) event.preventDefault();
    };
    el.onmouseover = () => {
        if (!enabled) return;
        el.style.background = hexToRgba(accentColor, 0.16);
        el.style.borderColor = hexToRgba(accentColor, 0.58);
        el.style.color = "#ffffff";
        el.style.transform = "translateY(-1px)";
        el.style.boxShadow = `0 8px 22px ${hexToRgba(accentColor, 0.18)}, inset 0 1px 0 rgba(255,255,255,0.06)`;
    };
    el.onmouseout = () => {
        el.style.background = "rgba(255,255,255,0.045)";
        el.style.borderColor = hexToRgba(accentColor, 0.36);
        el.style.color = accentColor;
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.05)";
    };
    return el;
}

function githubIcon() {
    return `
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.53 2.87 8.37 6.84 9.72.5.1.68-.22.68-.49v-1.88c-2.78.62-3.37-1.22-3.37-1.22-.45-1.19-1.11-1.51-1.11-1.51-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.98c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9v2.8c0 .27.18.59.69.49A10.13 10.13 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z"/>
        </svg>
    `;
}

function hexToRgba(hex, alpha) {
    const value = String(hex || "").replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(value)) return `rgba(255,255,255,${alpha})`;
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}
