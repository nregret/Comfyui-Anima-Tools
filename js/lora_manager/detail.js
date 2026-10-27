import { fetchModelDetail } from "./api.js";
import { t } from "./i18n.js";
import { createPreviewMedia, findModelPreviewSource } from "./media.js";
import { selectorIcon } from "./selector_ui.js";

const GALLERY_LIMIT = 12;
const PREFETCH_DELAY = 140;
let prefetchTimer = 0;
const TYPE_LABELS = { LORA: "LoRA", LoCon: "LoCon", DoRA: "DoRA", Checkpoint: "Checkpoint", Workflows: "Workflow" };
const compactDetail = window.matchMedia("(max-width: 980px)");

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
}

export function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit += 1;
    }
    return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function civitaiModelUrl(modelId, versionId = "") {
    return `https://civitai.red/models/${encodeURIComponent(modelId || "")}${versionId ? `?modelVersionId=${encodeURIComponent(versionId)}` : ""}`;
}

// Early Access (or permanent paid access) versions must be unlocked with Buzz
// on Civitai; until then the download endpoint answers 403 whatever the key.
export function isEarlyAccess(version) {
    const pending = (value) => Boolean(value) && Date.parse(value) > Date.now();
    const paid = version?.paidAccess;
    return version?.availability === "EarlyAccess" || pending(version?.earlyAccessEndsAt) || Boolean(paid && (paid.permanent || !paid.endsAt || pending(paid.endsAt)));
}

export function renderEarlyAccessNotice(model, version) {
    if (!isEarlyAccess(version)) return "";
    return `
        <div class="alm-early-access" role="note">
            <span class="alm-early-access-icon" aria-hidden="true">${selectorIcon("lock")}</span>
            <div><b>${escapeHtml(t("Early Access"))}</b><span>${escapeHtml(t("Unlock this version with Buzz on Civitai first, or the download is refused. Already unlocked versions download normally."))}</span></div>
            <a class="alm-secondary" href="${escapeAttr(civitaiModelUrl(model?.id, version?.id))}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("Unlock on Civitai"))}</a>
        </div>
    `;
}

export function formatStatCount(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number) || number <= 0) return "0";
    if (number >= 1000000) return `${(number / 1000000).toFixed(number >= 10000000 ? 0 : 1).replace(/\.0$/, "")}M`;
    if (number >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 0 : 1).replace(/\.0$/, "")}K`;
    return String(Math.round(number));
}

function readStatValue(source, keys) {
    if (!source || typeof source !== "object") return 0;
    for (const key of keys) {
        const value = Number(source[key]);
        if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
}

export function modelStats(model, version = {}) {
    const sources = [model?.stats || model?.metrics, version?.stats || version?.metrics, model, version];
    const read = (keys) => sources.reduce((found, source) => found || readStatValue(source, keys), 0);
    return {
        downloadCount: read(["downloadCount", "downloads", "download_count"]),
        likeCount: read(["thumbsUpCount", "likeCount", "likes", "favoriteCount", "favorites", "collectedCount"]),
    };
}

export function modelFacts(model, version = {}, file = {}) {
    const meta = file?.metadata || {};
    const published = String(version?.publishedAt || version?.createdAt || "").slice(0, 10);
    return [
        TYPE_LABELS[model?.type] || model?.type,
        version?.baseModel,
        file?.sizeKB ? formatBytes(file.sizeKB * 1024) : "",
        [meta.format, meta.fp, meta.size].filter(Boolean).join(" · "),
        published ? t("Published {date}", { date: published }) : "",
    ].filter(Boolean);
}

export function renderDetailFacts(facts) {
    const list = [...new Set(facts.filter(Boolean))];
    return list.length ? `<div class="alm-detail-facts">${list.map((fact) => `<span>${escapeHtml(fact)}</span>`).join("")}</div>` : "";
}

export function renderDetailTags(tags, interactive) {
    const list = [...new Set((Array.isArray(tags) ? tags : []).map((tag) => String(tag || "").trim()).filter(Boolean))].slice(0, 16);
    if (!list.length) return "";
    return `
        <section class="alm-detail-tags" aria-label="${escapeAttr(t("Tags"))}">
            <div class="alm-section-title">${selectorIcon("tag")}${escapeHtml(t("Tags"))}</div>
            <div class="alm-detail-tag-list">
                ${list.map((tag) => interactive
                    ? `<button type="button" data-detail-tag="${escapeAttr(tag)}" title="${escapeAttr(t("Show models tagged {tag}", { tag }))}">${escapeHtml(tag)}</button>`
                    : `<span>${escapeHtml(tag)}</span>`).join("")}
            </div>
        </section>
    `;
}

export function renderMatchRow(matched, asset, action, busy) {
    return `
        <div class="alm-detail-match-row ${matched ? "is-matched" : ""}">
            <div>
                <b>${escapeHtml(t(matched ? "Civitai matched" : "Civitai not matched"))}</b>
                <span>${escapeHtml(matched ? asset.version_name || asset.version_id || "" : t("Use the model file hash to find its Civitai page and metadata."))}</span>
            </div>
            <button class="alm-secondary" type="button" data-action="${escapeAttr(action)}" ${busy ? "disabled" : ""}>${escapeHtml(t(matched ? "Refresh Civitai info" : "Match Civitai info"))}</button>
        </div>
    `;
}

function urlList(primary, fallbacks) {
    return [primary, ...(Array.isArray(fallbacks) ? fallbacks : [])].filter(Boolean);
}

function galleryEntry(source) {
    const view = createPreviewMedia(source, 450);
    if (!view.url) return null;
    const thumb = createPreviewMedia(source, 96);
    const full = createPreviewMedia(source, 1200);
    const video = view.type === "video";
    return {
        type: view.type,
        src: urlList(view.url, view.fallbackUrls),
        poster: video ? urlList(view.posterUrl, view.posterFallbackUrls) : [],
        thumb: video ? urlList(thumb.posterUrl, thumb.posterFallbackUrls) : urlList(thumb.url, thumb.fallbackUrls),
        full: urlList(full.url, full.fallbackUrls),
        raw: /^https?:\/\//i.test(view.rawUrl || "") ? view.rawUrl : "",
    };
}

export function galleryItemsForModel(model, version) {
    const entries = (Array.isArray(version?.images) ? version.images : []).map(galleryEntry).filter(Boolean);
    const unique = new Map();
    for (const item of [...entries.filter((entry) => entry.type !== "video"), ...entries.filter((entry) => entry.type === "video")]) {
        if (!unique.has(item.src[0])) unique.set(item.src[0], item);
    }
    const items = [...unique.values()].slice(0, GALLERY_LIMIT);
    if (items.length) return items;
    const fallback = galleryEntry(findModelPreviewSource(model, version));
    return fallback ? [fallback] : [];
}

export function galleryItemsForUrl(url) {
    const entry = url ? galleryEntry(url) : null;
    return entry ? [entry] : [];
}

function mediaSource(urls) {
    const [src, ...fallbacks] = urls;
    return `src="${escapeAttr(src)}"${fallbacks.length ? ` data-fallback-srcs="${escapeAttr(JSON.stringify(fallbacks))}"` : ""}`;
}

function renderStage(item, alt) {
    const backdrop = item.type === "video" ? item.poster : item.src;
    const media = item.type === "video"
        ? `<video class="alm-detail-stage-media" ${mediaSource(item.src)} ${item.poster.length ? `poster="${escapeAttr(item.poster[0])}"` : ""} muted loop playsinline autoplay preload="metadata" aria-hidden="true"></video>`
        : `<img class="alm-detail-stage-media" ${mediaSource(item.src)} alt="" decoding="async" fetchpriority="high" />`;
    return `
        ${backdrop.length ? `<img class="alm-detail-preview-bg" ${mediaSource(backdrop)} alt="" aria-hidden="true" decoding="async" />` : ""}
        <button class="alm-detail-stage" type="button" data-gallery-open aria-label="${escapeAttr(t("View larger preview of {name}", { name: alt }))}" title="${escapeAttr(t("View larger"))}">${media}</button>
    `;
}

export function renderDetailGallery(items, alt, emptyText = "") {
    if (!items.length) {
        return `<div class="alm-detail-gallery"><div class="alm-detail-preview"><div class="alm-no-image">${escapeHtml(emptyText || t("No Preview"))}</div></div></div>`;
    }
    const many = items.length > 1;
    return `
        <div class="alm-detail-gallery" data-gallery-key="${escapeAttr(items.map((item) => item.src[0]).join("|"))}" data-gallery-current="0" data-gallery-alt="${escapeAttr(alt)}" data-gallery-items="${escapeAttr(JSON.stringify(items))}">
            <div class="alm-detail-preview">
                ${renderStage(items[0], alt)}
                ${many ? `
                    <button class="alm-detail-preview-nav prev" type="button" data-gallery-step="-1" aria-label="${escapeAttr(t("Previous preview"))}">‹</button>
                    <button class="alm-detail-preview-nav next" type="button" data-gallery-step="1" aria-label="${escapeAttr(t("Next preview"))}">›</button>
                    <span class="alm-detail-preview-count" aria-live="polite">1 / ${items.length}</span>
                ` : ""}
            </div>
            ${many ? `
                <div class="alm-detail-thumbs" role="group" aria-label="${escapeAttr(t("Preview images"))}">
                    ${items.map((item, index) => `
                        <button class="alm-detail-thumb ${index ? "" : "active"}" type="button" data-gallery-thumb="${index}" aria-pressed="${index ? "false" : "true"}" aria-label="${escapeAttr(t("Preview {current} of {total}", { current: index + 1, total: items.length }))}">
                            ${item.thumb.length ? `<img ${mediaSource(item.thumb)} alt="" loading="lazy" decoding="async" />` : ""}
                            ${item.type === "video" ? '<i class="alm-detail-thumb-play" aria-hidden="true"></i>' : ""}
                        </button>
                    `).join("")}
                </div>
            ` : ""}
        </div>
    `;
}

function galleryItems(gallery) {
    try {
        return JSON.parse(gallery?.dataset.galleryItems || "[]");
    } catch (_) {
        return [];
    }
}

function showGalleryItem(gallery, index) {
    const items = galleryItems(gallery);
    if (!items.length) return;
    const current = ((index % items.length) + items.length) % items.length;
    gallery.dataset.galleryCurrent = String(current);
    const preview = gallery.querySelector(".alm-detail-preview");
    preview.querySelectorAll(":scope > :is(.alm-detail-preview-bg, .alm-detail-stage, .alm-no-image)").forEach((element) => element.remove());
    preview.insertAdjacentHTML("afterbegin", renderStage(items[current], gallery.dataset.galleryAlt || ""));
    const count = preview.querySelector(".alm-detail-preview-count");
    if (count) count.textContent = `${current + 1} / ${items.length}`;
    gallery.querySelectorAll("[data-gallery-thumb]").forEach((thumb) => {
        const active = Number(thumb.dataset.galleryThumb) === current;
        thumb.classList.toggle("active", active);
        thumb.setAttribute("aria-pressed", String(active));
        if (!active) return;
        const strip = thumb.parentElement;
        strip.scrollTo({ left: thumb.offsetLeft - (strip.clientWidth - thumb.offsetWidth) / 2, behavior: "smooth" });
    });
}

function openLightbox(gallery) {
    const items = galleryItems(gallery);
    const shell = gallery.closest(".alm-selector-shell");
    if (!items.length || !shell) return;
    const alt = gallery.dataset.galleryAlt || "";
    let index = Number(gallery.dataset.galleryCurrent || 0);
    const box = document.createElement("div");
    box.className = "alm-lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", alt || t("Preview"));
    box.innerHTML = `
        <div class="alm-lightbox-stage"></div>
        <div class="alm-lightbox-bar">
            <span class="alm-lightbox-title">${escapeHtml(alt)}</span>
            <span class="alm-lightbox-count"></span>
            <a class="alm-lightbox-original" target="_blank" rel="noopener noreferrer">${escapeHtml(t("Open original image"))} ↗</a>
            <button class="alm-lightbox-close" type="button" aria-label="${escapeAttr(t("Close"))}">${selectorIcon("close")}</button>
        </div>
        ${items.length > 1 ? `
            <button class="alm-lightbox-nav prev" type="button" data-lightbox-step="-1" aria-label="${escapeAttr(t("Previous preview"))}">‹</button>
            <button class="alm-lightbox-nav next" type="button" data-lightbox-step="1" aria-label="${escapeAttr(t("Next preview"))}">›</button>
        ` : ""}
    `;
    const stage = box.querySelector(".alm-lightbox-stage");
    const original = box.querySelector(".alm-lightbox-original");
    const show = (next) => {
        index = ((next % items.length) + items.length) % items.length;
        const item = items[index];
        stage.innerHTML = item.type === "video"
            ? `<video ${mediaSource(item.full)} ${item.poster.length ? `poster="${escapeAttr(item.poster[0])}"` : ""} controls autoplay loop playsinline></video>`
            : `<img ${mediaSource(item.full)} alt="${escapeAttr(alt)}" decoding="async" />`;
        box.querySelector(".alm-lightbox-count").textContent = items.length > 1 ? `${index + 1} / ${items.length}` : "";
        original.hidden = !item.raw;
        if (item.raw) original.href = item.raw;
    };
    const close = () => {
        box.remove();
        showGalleryItem(gallery, index);
        gallery.querySelector("[data-gallery-open]")?.focus({ preventScroll: true });
    };
    box.addEventListener("click", (event) => {
        const step = event.target.closest("[data-lightbox-step]");
        if (step) show(index + Number(step.dataset.lightboxStep));
        else if (event.target.closest(".alm-lightbox-close") || event.target === box || event.target === stage) close();
    });
    box.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
        } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            show(index + (event.key === "ArrowRight" ? 1 : -1));
        } else if (event.key === "Tab") {
            const controls = [...box.querySelectorAll("button, a[href]:not([hidden])")];
            const edge = event.shiftKey ? controls[0] : controls.at(-1);
            if (document.activeElement === edge || !box.contains(document.activeElement)) {
                event.preventDefault();
                event.stopPropagation();
                (event.shiftKey ? controls.at(-1) : controls[0])?.focus();
            }
        }
    });
    shell.append(box);
    show(index);
    box.querySelector(".alm-lightbox-close").focus({ preventScroll: true });
}

function moveCardFocus(event) {
    const card = event.target;
    if (!card.matches?.(".alm-results > .alm-card[tabindex]")) return;
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        card.click();
        return;
    }
    const cards = [...card.parentElement.querySelectorAll(":scope > .alm-card[tabindex]")];
    const columns = Math.max(1, cards.filter((item) => item.offsetTop === cards[0].offsetTop).length);
    const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key];
    if (!offset) return;
    event.preventDefault();
    const next = cards[cards.indexOf(card) + offset];
    if (!next) return;
    next.focus({ preventScroll: true });
    next.scrollIntoView({ block: "nearest" });
    next.click();
}

export function renderDetailDismiss() {
    return `<button class="alm-detail-dismiss" type="button" data-detail-close aria-label="${escapeAttr(t("Close details"))}" title="${escapeAttr(t("Close details"))}">${selectorIcon("close")}</button>`;
}

export function setDetailDrawer(root, open) {
    root?.querySelectorAll(".alm-split.has-detail").forEach((split) => split.classList.toggle("is-detail-open", open));
}

export function isDetailDrawerOpen(root) {
    return compactDetail.matches && Boolean(root?.querySelector(".alm-split.has-detail.is-detail-open"));
}

export function setDetailLoading(root, loading) {
    root?.querySelector(".alm-split.has-detail > .alm-detail")?.classList.toggle("is-loading", loading);
}

/**
 * Replace a detail panel. The gallery element (and its current image) is kept
 * when it shows the same media, and the scroll position is kept when the panel
 * still describes the same subject, so background refreshes never jump.
 */
export function swapDetail(existing, next) {
    const sameSubject = Boolean(existing.dataset.detailSubject) && existing.dataset.detailSubject === next.dataset.detailSubject;
    const oldGallery = existing.querySelector(".alm-detail-gallery[data-gallery-key]");
    const newGallery = next.querySelector(".alm-detail-gallery[data-gallery-key]");
    if (oldGallery && newGallery && oldGallery.dataset.galleryKey === newGallery.dataset.galleryKey) newGallery.replaceWith(oldGallery);
    const scrollTop = sameSubject ? existing.querySelector(".alm-detail-scroll")?.scrollTop || 0 : 0;
    next.classList.toggle("is-loading", sameSubject && existing.classList.contains("is-loading"));
    existing.replaceWith(next);
    const scroll = next.querySelector(".alm-detail-scroll");
    if (scroll && scrollTop) scroll.scrollTop = scrollTop;
}

export function bindDetailInteractions(overlay, { onCloseDetail }) {
    overlay.addEventListener("click", (event) => {
        if (event.target.closest("[data-detail-close]")) {
            onCloseDetail();
            const split = event.target.closest(".alm-split");
            setDetailDrawer(overlay, false);
            split?.querySelector(".alm-card.selected")?.focus({ preventScroll: true });
            return;
        }
        const gallery = event.target.closest(".alm-detail-gallery");
        if (!gallery) return;
        const thumb = event.target.closest("[data-gallery-thumb]");
        const step = event.target.closest("[data-gallery-step]");
        const current = Number(gallery.dataset.galleryCurrent || 0);
        if (thumb) showGalleryItem(gallery, Number(thumb.dataset.galleryThumb));
        else if (step) showGalleryItem(gallery, current + Number(step.dataset.galleryStep));
        else if (event.target.closest("[data-gallery-open]")) openLightbox(gallery);
    });
    overlay.addEventListener("keydown", (event) => {
        moveCardFocus(event);
        const gallery = event.target.closest?.(".alm-detail-gallery");
        if (!gallery || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        showGalleryItem(gallery, Number(gallery.dataset.galleryCurrent || 0) + (event.key === "ArrowRight" ? 1 : -1));
        gallery.querySelector("[data-gallery-open]")?.focus({ preventScroll: true });
    });
    // Resting on a remote card (or a download row) warms its full record before the click.
    overlay.addEventListener("pointerover", (event) => {
        const card = event.target.closest?.(".alm-card[data-model-id], .alm-card[data-remote-id], [data-prefetch-model]");
        if (!card || card.contains(event.relatedTarget) || card.classList.contains("selected")) return;
        clearTimeout(prefetchTimer);
        const id = card.dataset.modelId || card.dataset.remoteId || card.dataset.prefetchModel;
        prefetchTimer = setTimeout(() => fetchModelDetail(id).catch(() => {}), PREFETCH_DELAY);
    });
    overlay.addEventListener("pointerout", (event) => {
        const card = event.target.closest?.(".alm-card, [data-prefetch-model]");
        if (card && !card.contains(event.relatedTarget)) clearTimeout(prefetchTimer);
    });
}

export function renderDetailSkeleton() {
    return `
        <div class="alm-detail-scroll alm-detail-skeleton" aria-busy="true">
            <div class="alm-detail-preview"></div>
            <div class="alm-detail-skeleton-lines is-title"><span></span><span></span></div>
            <div class="alm-detail-skeleton-chips"><span></span><span></span><span></span></div>
            <div class="alm-detail-skeleton-block"></div>
            <div class="alm-detail-skeleton-lines"><span></span><span></span><span></span></div>
        </div>
    `;
}

export function renderDescriptionSkeleton() {
    return '<div class="alm-detail-skeleton-lines" aria-busy="true"><span></span><span></span><span></span><span></span></div>';
}
