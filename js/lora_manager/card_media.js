import { t } from "./i18n.js";
import { looksLikeVideoUrl } from "./media.js";

const MEDIA_HOSTS = ["https://image-b2.civitai.com", "https://image.civitai.com"];
const SCROLL_ROOTS = ".alm-results, .alm-lora-applied-list, .alm-download-list, .alm-lora-download-list";
// Everything that fades in once its pixels are decoded.
const REVEALED_MEDIA = ".alm-card-media, .alm-detail-stage-media, .alm-detail-preview-bg, .alm-detail-thumb img, .alm-lightbox-stage > img, .alm-lightbox-stage > video";
const REPLACED_ON_FAILURE = ".alm-card-media, .alm-detail-stage-media, .alm-lightbox-stage > *";
const LOADED_LIMIT = 3000;
// Shared by both popups, so a card that was already shown never fades in twice.
const loadedUrls = new Set();
const observers = new WeakMap();

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function rememberLoaded(url) {
    if (!url) return;
    loadedUrls.delete(url);
    loadedUrls.add(url);
    if (loadedUrls.size > LOADED_LIMIT) loadedUrls.delete(loadedUrls.values().next().value);
}

function sourceAttrs(urls, attribute) {
    const [src, ...fallbacks] = urls;
    return `${attribute}="${escapeHtml(src)}" data-key="${escapeHtml(src)}"${fallbacks.length ? ` data-fallback-srcs="${escapeHtml(JSON.stringify(fallbacks))}"` : ""}`;
}

export function renderNoPreview(text) {
    return `<div class="alm-no-image">${escapeHtml(text || t("No Preview"))}</div>`;
}

/**
 * Card thumbnail: a shimmer skeleton under an image that only receives its
 * src when it nears the viewport (or immediately for the first row), then
 * fades in after decoding. Video previews show their poster and play on hover.
 */
export function renderCardMedia(media, { eager = false, priority = "auto" } = {}) {
    const descriptor = typeof media === "string" ? { url: media, type: looksLikeVideoUrl(media) ? "video" : "image" } : media || {};
    if (!descriptor.url) return renderNoPreview(descriptor.emptyText);
    const video = descriptor.type === "video";
    const still = (video ? [descriptor.posterUrl, ...(descriptor.posterFallbackUrls || [])] : [descriptor.url, ...(descriptor.fallbackUrls || [])]).filter(Boolean);
    const clip = video ? [descriptor.url, ...(descriptor.fallbackUrls || [])].filter(Boolean) : [];
    const loaded = loadedUrls.has(still[0] || clip[0]);
    const attribute = loaded || eager ? "src" : "data-src";
    const state = loaded ? " is-loaded" : "";
    const skeleton = loaded ? "" : '<span class="alm-media-skeleton" aria-hidden="true"></span>';
    if (!still.length) {
        return `${skeleton}<video class="alm-card-media alm-card-video${state}" ${sourceAttrs(clip, attribute)} muted loop playsinline preload="metadata" aria-hidden="true"></video>`;
    }
    return `
        ${skeleton}<img class="alm-card-media${state}" ${sourceAttrs(still, attribute)} alt="" decoding="async" draggable="false"${priority === "auto" ? "" : ` fetchpriority="${priority}"`} />
        ${clip.length ? `<video class="alm-card-video" ${sourceAttrs(clip, "data-clip")} muted loop playsinline preload="none" aria-hidden="true"></video>` : ""}
    `;
}

export function observeCardMedia(scope) {
    scope?.querySelectorAll(".alm-card-media[data-src]").forEach((media) => {
        const root = media.closest(SCROLL_ROOTS);
        const key = root || document;
        let observer = observers.get(key);
        if (!observer) {
            observer = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    observer.unobserve(entry.target);
                    const { src } = entry.target.dataset;
                    if (!src) continue;
                    entry.target.removeAttribute("data-src");
                    entry.target.src = src;
                }
            }, { root, rootMargin: "100% 0px" });
            observers.set(key, observer);
        }
        observer.observe(media);
    });
}

// The thumbnail keeps the skeleton shimmer the placeholder cards showed, so
// only the card text settles in and the grid never flashes empty.
export function animateCardsIn(cards) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    [...cards].slice(0, 24).forEach((card, index) => {
        const delay = Math.min(index, 12) * 22;
        card.style.setProperty("--alm-enter-delay", `${delay}ms`);
        card.classList.add("is-entering");
        setTimeout(() => {
            card.classList.remove("is-entering");
            card.style.removeProperty("--alm-enter-delay");
        }, delay + 420);
    });
}

// Placeholders reuse the real card's thumb skeleton and body layout, so a
// result replaces its placeholder in place: the text fades in, nothing moves.
export function renderCardSkeletons(count, { loadMore = false } = {}) {
    const label = escapeHtml(t(loadMore ? "Loading more..." : "Loading..."));
    return Array.from({ length: count }, (_, index) => `
        <article class="alm-card alm-skeleton-card${loadMore ? " alm-load-more-skeleton" : ""}" ${index ? 'aria-hidden="true"' : `role="status" aria-label="${label}"`}>
            <div class="alm-thumb"><span class="alm-media-skeleton" aria-hidden="true"></span></div>
            <div class="alm-skeleton-badge"></div>
            <div class="alm-skeleton-content">
                <div class="alm-skeleton-line ${["", "is-medium", "is-short"][index % 3]}"></div>
                <div class="alm-skeleton-line is-creator"></div>
                <div class="alm-skeleton-stats"><span></span><span></span></div>
            </div>
        </article>
    `).join("");
}

// Placeholder cards finish the current grid row and add one more, so the
// skeletons never leave a ragged half row.
export function loadMoreSkeletonCount(results) {
    const columns = results ? getComputedStyle(results).gridTemplateColumns.split(" ").length : 4;
    const remainder = (results?.querySelectorAll(":scope > .alm-card:not(.alm-skeleton-card)").length || 0) % columns;
    return (remainder ? columns - remainder : 0) + columns;
}

export function preconnectMediaHosts() {
    for (const href of MEDIA_HOSTS) {
        if (document.head.querySelector(`link[rel="preconnect"][href="${href}"]`)) continue;
        document.head.append(Object.assign(document.createElement("link"), { rel: "preconnect", href }));
    }
}

function revealMedia(event) {
    const media = event.target;
    if (!(media instanceof HTMLElement) || !media.matches(REVEALED_MEDIA) || media.classList.contains("is-loaded")) return;
    const show = () => {
        media.classList.add("is-loaded");
        if (media.classList.contains("alm-card-media")) rememberLoaded(media.dataset.key);
    };
    if (media instanceof HTMLImageElement) media.decode().then(show, show);
    else show();
}

function useFallback(event) {
    const media = event.target;
    if (!(media instanceof HTMLImageElement || media instanceof HTMLVideoElement)) return;
    let queue = [];
    try {
        queue = JSON.parse(media.dataset.fallbackSrcs || "[]");
    } catch (_) {}
    const next = queue.shift();
    if (next) {
        media.dataset.fallbackSrcs = JSON.stringify(queue);
        media.src = next;
    } else if (media.matches(REPLACED_ON_FAILURE)) {
        media.insertAdjacentHTML("afterend", renderNoPreview());
        media.remove();
    } else {
        media.remove();
    }
}

function toggleClip(event, entering) {
    const card = event.target.closest?.(".alm-card");
    if (!card || card.contains(event.relatedTarget)) return;
    const clip = card.querySelector("video.alm-card-video");
    if (!clip) return;
    if (!entering) {
        clip.pause();
        return;
    }
    if (clip.dataset.clip) {
        clip.src = clip.dataset.clip;
        clip.removeAttribute("data-clip");
    }
    clip.play().catch(() => {});
}

// Every shimmer runs on the document clock, so a placeholder swapped for a
// real card keeps sweeping in step instead of restarting.
function alignShimmer(event) {
    if (event.animationName !== "almSkeletonShimmer") return;
    for (const animation of event.target.getAnimations({ subtree: true })) {
        if (animation.animationName === "almSkeletonShimmer" && animation.startTime !== 0) animation.startTime = 0;
    }
}

export function bindCardMedia(overlay) {
    overlay.addEventListener("animationstart", alignShimmer);
    overlay.addEventListener("load", revealMedia, true);
    overlay.addEventListener("loadeddata", revealMedia, true);
    overlay.addEventListener("playing", (event) => event.target.classList?.add("is-loaded"), true);
    overlay.addEventListener("error", useFallback, true);
    overlay.addEventListener("pointerover", (event) => toggleClip(event, true));
    overlay.addEventListener("pointerout", (event) => toggleClip(event, false));
}
