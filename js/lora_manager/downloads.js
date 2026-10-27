import { fetchModelDetail, peekModelDetail } from "./api.js";
import { renderCardMedia } from "./card_media.js";
import { renderCollectionEmptyState } from "./components.js";
import {
    civitaiModelUrl,
    formatBytes,
    formatStatCount,
    galleryItemsForModel,
    galleryItemsForUrl,
    modelStats,
    renderDescriptionSkeleton,
    renderDetailGallery,
    renderDetailTags,
} from "./detail.js";
import { t } from "./i18n.js";
import { renderSelectorStats, selectorIcon } from "./selector_ui.js";

export const ACTIVE_DOWNLOAD_STATUSES = new Set(["pending", "downloading", "cancelling"]);
const STATUS_LABELS = {
    pending: "Pending",
    downloading: "Downloading",
    cancelling: "Cancelling",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
};
// Title and next step for each failure cause the backend reports.
const FAILURE_REASONS = {
    early_access: ["Early Access", "Unlock this version with Buzz on Civitai, then retry."],
    auth: ["API Key rejected", "Check the Civitai API Key in Settings, then retry."],
    forbidden: ["Access denied", "Civitai does not let this account download the file."],
    not_found: ["File no longer available", "The creator may have removed or replaced this file."],
    rate_limited: ["Too many requests", "Civitai is limiting downloads. Wait a moment, then retry."],
    server: ["Civitai is unavailable", "Civitai returned a server error. Retry later."],
    network: ["Network error", "Check your connection or proxy, then retry."],
    disk: ["Could not save the file", "Check the folder permissions and free disk space."],
};
const KIND_LABELS = { loras: "LoRA", checkpoints: "Checkpoint", unet: "UNet", workflows: "Workflow" };
// Byte rate per job, smoothed across polls so the speed and ETA do not jitter.
const rates = new Map();
const renderedActions = new WeakMap();
const renderedMeta = new WeakMap();
// Only one row shows its details; the choice survives polling re-renders.
let openJobId = "";

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

export function trackDownloadRates(jobs) {
    const now = performance.now();
    for (const job of jobs) {
        if (job.status !== "downloading") {
            rates.delete(job.id);
            continue;
        }
        const progress = Number(job.progress || 0);
        const sample = rates.get(job.id);
        if (!sample) {
            rates.set(job.id, { progress, time: now, rate: 0 });
            continue;
        }
        const seconds = (now - sample.time) / 1000;
        if (seconds < 0.25 || progress < sample.progress) continue;
        const rate = (progress - sample.progress) / seconds;
        sample.rate = sample.rate ? sample.rate * 0.6 + rate * 0.4 : rate;
        sample.progress = progress;
        sample.time = now;
    }
}

function downloadPercent(job) {
    if (job.status === "completed") return 100;
    const total = Number(job.total || 0);
    return total > 0 ? Math.min(100, Math.round((Number(job.progress || 0) / total) * 100)) : 0;
}

function formatRemaining(seconds) {
    if (seconds < 60) return t("{count}s left", { count: Math.max(1, Math.round(seconds)) });
    if (seconds < 3600) return t("{count} min left", { count: Math.round(seconds / 60) });
    return t("{count} h left", { count: (seconds / 3600).toFixed(1) });
}

function formatTime(timestamp) {
    return timestamp ? new Date(Number(timestamp) * 1000).toLocaleString() : "";
}

function failureTitle(job) {
    return t(FAILURE_REASONS[job.error_reason]?.[0] || "Download failed");
}

function formatAgo(timestamp) {
    const seconds = Math.max(0, Date.now() / 1000 - Number(timestamp || 0));
    if (seconds < 60) return t("Just now");
    if (seconds < 3600) return t("{count} min ago", { count: Math.round(seconds / 60) });
    if (seconds < 86400) return t("{count} h ago", { count: Math.round(seconds / 3600) });
    return new Date(Number(timestamp) * 1000).toLocaleDateString();
}

function renderMeta(job) {
    const progress = Number(job.progress || 0);
    const total = Number(job.total || 0);
    if (job.status === "pending") return escapeHtml(t("Waiting in queue..."));
    if (job.status === "cancelling") return escapeHtml(t("Cancelling..."));
    if (job.status === "failed") return `<span class="is-error">${escapeHtml(failureTitle(job))}</span><i aria-hidden="true">·</i>${escapeHtml(formatAgo(job.failed_at))}`;
    if (job.status === "cancelled") return escapeHtml(t("Cancelled {time}", { time: formatAgo(job.cancelled_at) }));
    if (job.status === "completed") return escapeHtml(`${formatBytes(total || progress)} · ${formatAgo(job.completed_at)}`);
    const rate = rates.get(job.id)?.rate || 0;
    const parts = [
        `<b>${total ? `${downloadPercent(job)}%` : escapeHtml(t("Waiting for size..."))}</b>`,
        escapeHtml(total ? `${formatBytes(progress)} / ${formatBytes(total)}` : formatBytes(progress)),
    ];
    if (rate > 0) {
        parts.push(escapeHtml(`${formatBytes(rate)}/s`));
        if (total > progress) parts.push(escapeHtml(formatRemaining((total - progress) / rate)));
    }
    return parts.join("<i aria-hidden=\"true\">·</i>");
}

function renderBar(job) {
    const indeterminate = ACTIVE_DOWNLOAD_STATUSES.has(job.status) && !Number(job.total || 0);
    const pct = downloadPercent(job);
    return `<div class="alm-dl-bar ${indeterminate ? "is-indeterminate" : ""}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>`;
}

function patchBar(bar, job) {
    const pct = downloadPercent(job);
    bar.classList.toggle("is-indeterminate", ACTIVE_DOWNLOAD_STATUSES.has(job.status) && !Number(job.total || 0));
    bar.setAttribute("aria-valuenow", String(pct));
    bar.firstElementChild.style.width = `${pct}%`;
}

/** Compact progress used inside a model detail while its download runs. */
export function renderDownloadProgress(job) {
    return `
        <div class="alm-dl-inline" data-dl-progress="${escapeHtml(job.id)}">
            <div class="alm-dl-inline-head"><b>${escapeHtml(t(STATUS_LABELS[job.status] || "Pending"))}</b><span class="alm-dl-meta" data-dl-meta>${renderMeta(job)}</span></div>
            ${renderBar(job)}
        </div>
    `;
}

/** Update an existing inline progress in place; returns false when it has to be rendered. */
export function patchDownloadProgress(root, job) {
    const host = job ? root?.querySelector(`[data-dl-progress="${CSS.escape(String(job.id))}"]`) : null;
    if (!host) return false;
    host.querySelector("b").textContent = t(STATUS_LABELS[job.status] || "Pending");
    host.querySelector("[data-dl-meta]").innerHTML = renderMeta(job);
    patchBar(host.querySelector(".alm-dl-bar"), job);
    return true;
}

function renderReason(job, modelUrl) {
    const [title, hint] = FAILURE_REASONS[job.error_reason] || ["Download failed", ""];
    return `
        <div class="alm-dl-reason">
            <b>${escapeHtml(t(title))}</b>
            ${hint ? `<span>${escapeHtml(t(hint))}</span>` : ""}
            ${job.error ? `<code>${escapeHtml(job.error)}</code>` : ""}
            ${job.error_reason === "early_access" && modelUrl ? `<a class="alm-secondary" href="${escapeHtml(modelUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("Unlock on Civitai"))}</a>` : ""}
        </div>
    `;
}

function jobVersion(job, model) {
    const versions = Array.isArray(model?.modelVersions) ? model.modelVersions : [];
    return versions.find((version) => String(version.id) === String(job.version_id)) || versions[0] || {};
}

// Paragraph and line breaks survive as newlines so sentences do not run together.
function plainText(html) {
    const marked = String(html || "").replace(/<br\s*\/?>|<\/(?:p|div|li|h[1-6])>/gi, "$&\n");
    const text = new DOMParser().parseFromString(marked, "text/html").body.textContent || "";
    return text.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}

// Same footprint as the final gallery, so the row does not jump or show a
// stand-in image that gets swapped once the Civitai record arrives.
function renderGallerySkeleton() {
    return `<div class="alm-detail-gallery" aria-busy="true"><div class="alm-detail-preview"></div><div class="alm-detail-thumbs">${'<span class="alm-detail-thumb" aria-hidden="true"></span>'.repeat(5)}</div></div>`;
}

function renderGallery(job, model) {
    const items = model ? galleryItemsForModel(model, jobVersion(job, model)) : galleryItemsForUrl(job.preview_url);
    return renderDetailGallery(items, job.model_name || job.filename || "", t("No Preview"));
}

// The job only knows what was downloaded; the Civitai record adds stats,
// trigger words, tags and the description once the row is opened.
function renderModelInfo(job, model) {
    const version = jobVersion(job, model);
    const stats = modelStats(model, version);
    const words = (Array.isArray(version.trainedWords) ? version.trainedWords : []).map((word) => String(word || "").trim()).filter(Boolean);
    const description = plainText(model.description || version.description).slice(0, 600);
    const published = String(version.publishedAt || version.createdAt || "").slice(0, 10);
    return `
        <div class="alm-dl-model-stats">
            ${renderSelectorStats(formatStatCount(stats.downloadCount), formatStatCount(stats.likeCount))}
            ${published ? `<span>${escapeHtml(t("Published {date}", { date: published }))}</span>` : ""}
        </div>
        ${words.length ? `
            <section class="alm-selector-triggers" aria-label="${escapeHtml(t("Trigger Words"))}">
                <div class="alm-section-head">
                    <div class="alm-section-title">${selectorIcon("tag")}${escapeHtml(t("Trigger Words"))}</div>
                    ${words.length > 1 ? `<button class="alm-copy-all-btn" type="button" data-dl-copy="${escapeHtml(words.join(", "))}">${escapeHtml(t("Copy All ({count})", { count: words.length }))}</button>` : ""}
                </div>
                <div class="alm-trained">${words.slice(0, 16).map((word) => `<button type="button" data-dl-copy="${escapeHtml(word)}">${escapeHtml(word)}</button>`).join("")}</div>
            </section>
        ` : ""}
        ${renderDetailTags(model.tags, false)}
        ${description ? `<p class="alm-dl-description">${escapeHtml(description)}</p>` : ""}
    `;
}

function renderModelSection(job) {
    if (!job.model_id) return "";
    const model = peekModelDetail(job.model_id);
    return model
        ? `<div class="alm-dl-model">${renderModelInfo(job, model)}</div>`
        : `<div class="alm-dl-model" data-dl-pending data-model-id="${escapeHtml(job.model_id)}" data-version-id="${escapeHtml(job.version_id)}" data-preview-url="${escapeHtml(job.preview_url)}">${renderDescriptionSkeleton()}</div>`;
}

function renderDetails(job) {
    const modelUrl = job.model_id ? civitaiModelUrl(job.model_id, job.version_id) : "";
    const name = escapeHtml(job.model_name || job.filename || "");
    const size = Number(job.total || job.file_size || 0);
    const finished = {
        completed: ["Finished", job.completed_at],
        failed: ["Failed at", job.failed_at],
        cancelled: ["Cancelled at", job.cancelled_at],
    }[job.status];
    const facts = [
        ["Model", modelUrl ? `<a href="${escapeHtml(modelUrl)}" target="_blank" rel="noopener noreferrer">${name}</a>` : name],
        ["Version", escapeHtml(job.version_name)],
        ["Base Model", escapeHtml(job.base_model)],
        ["Type", escapeHtml(KIND_LABELS[job.root_kind] || job.model_type)],
        ["Size", escapeHtml(size ? formatBytes(size) : "")],
        ["File", job.filename ? `<span class="is-path">${escapeHtml(job.filename)}</span>` : ""],
        ["Saved to", job.target_path ? `<span class="is-path">${escapeHtml(job.target_path)}</span>` : ""],
        ["Started", escapeHtml(formatTime(job.created_at))],
        finished ? [finished[0], escapeHtml(formatTime(finished[1]))] : null,
    ].filter((fact) => fact?.[1]);
    const folder = job.status === "completed" && job.relative_path
        ? `<button class="alm-secondary" type="button" data-action="open-download-folder" data-root-kind="${escapeHtml(job.root_kind)}" data-relative-path="${escapeHtml(job.relative_path)}">${selectorIcon("local")}<span>${escapeHtml(t("Open Folder"))}</span></button>`
        : "";
    const cached = job.model_id ? peekModelDetail(job.model_id) : null;
    return `
        <div class="alm-dl-gallery" data-dl-gallery>${cached || !job.model_id ? renderGallery(job, cached) : renderGallerySkeleton()}</div>
        <div class="alm-dl-info">
            ${job.status === "failed" ? renderReason(job, modelUrl) : ""}
            <dl class="alm-dl-facts">${facts.map(([label, value]) => `<div><dt>${escapeHtml(t(label))}</dt><dd>${value}</dd></div>`).join("")}</dl>
            ${renderModelSection(job)}
            ${folder || modelUrl ? `
                <div class="alm-dl-links">
                    ${folder}
                    ${modelUrl ? `<a class="alm-secondary" href="${escapeHtml(modelUrl)}" target="_blank" rel="noopener noreferrer">${selectorIcon("discover")}<span>${escapeHtml(t("View on Civitai"))}</span></a>` : ""}
                </div>
            ` : ""}
        </div>
    `;
}

/** Fills opened rows whose Civitai record was not cached when they rendered. */
export function hydrateDownloadDetails(root) {
    root?.querySelectorAll(".alm-dl-row.is-open [data-dl-pending]").forEach((host) => {
        host.removeAttribute("data-dl-pending");
        const row = host.closest(".alm-dl-row");
        const job = { model_id: host.dataset.modelId, version_id: host.dataset.versionId, preview_url: host.dataset.previewUrl, model_name: row.querySelector(".alm-dl-head > b")?.textContent || "" };
        const gallery = row.querySelector("[data-dl-gallery]");
        fetchModelDetail(job.model_id).then((model) => {
            if (!host.isConnected) return;
            // A long description can make the panel taller than its skeleton;
            // grow into it instead of jumping.
            const panel = row.querySelector(".alm-dl-details > div");
            const before = panel.offsetHeight;
            host.innerHTML = renderModelInfo(job, model);
            gallery.innerHTML = renderGallery(job, model);
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
            const after = panel.offsetHeight;
            if (after !== before) panel.animate([{ height: `${before}px` }, { height: `${after}px` }], { duration: 240, easing: "cubic-bezier(.2,.7,.2,1)" });
            host.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
        }, () => {
            host.remove();
            gallery.innerHTML = renderGallery(job, null);
        });
    });
}

function renderRow(job, actions) {
    const title = job.model_name || job.filename || t("Download");
    const status = job.status || "pending";
    const open = String(job.id) === openJobId;
    const detailsId = `alm-dl-details-${escapeHtml(job.id)}`;
    return `
        <article class="alm-dl-row is-${escapeHtml(status)}${open ? " is-open" : ""}" data-job-id="${escapeHtml(job.id)}" data-status="${escapeHtml(status)}">
            <div class="alm-dl-row-head"${job.model_id ? ` data-prefetch-model="${escapeHtml(job.model_id)}"` : ""}>
                <div class="alm-dl-thumb">${renderCardMedia(job.preview_url || "", { eager: true })}</div>
                <div class="alm-dl-main">
                    <div class="alm-dl-head">
                        <b title="${escapeHtml(title)}">${escapeHtml(title)}</b>
                        ${job.base_model ? `<span class="alm-dl-chip">${escapeHtml(job.base_model)}</span>` : ""}
                    </div>
                    ${ACTIVE_DOWNLOAD_STATUSES.has(status) ? renderBar(job) : ""}
                    <div class="alm-dl-meta" data-dl-meta>${renderMeta(job)}</div>
                </div>
                <span class="alm-dl-status">${escapeHtml(t(STATUS_LABELS[status] || "Pending"))}</span>
                <div class="alm-dl-actions">${actions}</div>
                <button class="alm-dl-expand" type="button" data-dl-toggle aria-expanded="${open}" aria-controls="${detailsId}" aria-label="${escapeHtml(t("Details"))}">${selectorIcon("chevron")}</button>
            </div>
            <div class="alm-dl-details" id="${detailsId}"><div><div class="alm-dl-details-body">${renderDetails(job)}</div></div></div>
        </article>
    `;
}

function setRowOpen(row, open) {
    row.classList.toggle("is-open", open);
    row.querySelector("[data-dl-toggle]").setAttribute("aria-expanded", String(open));
}

/** Row expansion and trigger-word copying; returns true when the click was handled. */
export function handleDownloadDetailsClick(event) {
    const copy = event.target.closest("[data-dl-copy]");
    if (copy) {
        navigator.clipboard.writeText(copy.dataset.dlCopy).then(() => {
            copy.classList.add("is-copied");
            setTimeout(() => copy.classList.remove("is-copied"), 1400);
        }, () => {});
        return true;
    }
    const head = event.target.closest(".alm-dl-row-head");
    const control = event.target.closest("a, button");
    if (!head || (control && !control.hasAttribute("data-dl-toggle"))) return false;
    const row = head.parentElement;
    const open = !row.classList.contains("is-open");
    row.closest("[data-dl-list]")?.querySelectorAll(".alm-dl-row.is-open").forEach((other) => setRowOpen(other, false));
    setRowOpen(row, open);
    openJobId = open ? row.dataset.jobId : "";
    if (open) hydrateDownloadDetails(row.parentElement);
    return true;
}

function sortJobs(jobs) {
    const finishedAt = (job) => Number(job.completed_at || job.failed_at || job.cancelled_at || job.created_at || 0);
    const active = jobs.filter((job) => ACTIVE_DOWNLOAD_STATUSES.has(job.status)).sort((a, b) => Number(a.created_at || 0) - Number(b.created_at || 0));
    const finished = jobs.filter((job) => !ACTIVE_DOWNLOAD_STATUSES.has(job.status)).sort((a, b) => finishedAt(b) - finishedAt(a));
    return { active, finished };
}

function renderGroups(jobs, actionsFor) {
    if (!jobs.length) {
        return renderCollectionEmptyState({
            kind: "downloads",
            kicker: t("Downloads"),
            title: t("No download tasks yet"),
            description: t("Downloads you queue from Discover will appear here with their progress and status."),
            hints: [t("Live progress"), t("Retry failed tasks")],
        });
    }
    const groups = sortJobs(jobs);
    return [["active", t("In progress")], ["finished", t("History")]].map(([id, label]) => `
        <section class="alm-dl-group" data-dl-group="${id}" ${groups[id].length ? "" : "hidden"}>
            <h3>${escapeHtml(label)}<b data-dl-count>${groups[id].length}</b></h3>
            <div class="alm-dl-rows">${groups[id].map((job) => renderRow(job, actionsFor(job))).join("")}</div>
        </section>
    `).join("");
}

function renderSummary(jobs) {
    const { active, finished } = sortJobs(jobs);
    return escapeHtml(t("{active} active · {finished} finished", { active: active.length, finished: finished.length }));
}

function renderToolbarActions(jobs) {
    const finished = jobs.some((job) => !ACTIVE_DOWNLOAD_STATUSES.has(job.status));
    return finished ? `<button class="alm-secondary" type="button" data-action="clear-downloads">${escapeHtml(t("Clear finished"))}</button>` : "";
}

export function renderDownloadPage({ title, jobs, actionsFor }) {
    return `
        <section class="alm-page alm-dl-page">
            <div class="alm-toolbar alm-selector-utility-toolbar alm-dl-toolbar">
                <div class="alm-dl-heading"><h2>${escapeHtml(title)}</h2><span data-dl-summary>${renderSummary(jobs)}</span></div>
                <div class="alm-dl-toolbar-actions" data-dl-toolbar>${renderToolbarActions(jobs)}</div>
            </div>
            <div class="alm-download-list" data-dl-list>${renderGroups(jobs, actionsFor)}</div>
        </section>
    `;
}

function rowElement(job, actions) {
    const template = document.createElement("template");
    template.innerHTML = renderRow(job, actions).trim();
    const row = template.content.firstElementChild;
    renderedActions.set(row, actions);
    renderedMeta.set(row, renderMeta(job));
    return row;
}

/**
 * Keyed update of a rendered download page: running rows only move their bar
 * and numbers, rows that change status are swapped, new ones slide in.
 */
export function patchDownloadPage(root, { jobs, actionsFor }) {
    const list = root?.querySelector("[data-dl-list]");
    if (!list) return false;
    root.querySelector("[data-dl-summary]").innerHTML = renderSummary(jobs);
    root.querySelector("[data-dl-toolbar]").innerHTML = renderToolbarActions(jobs);
    if (!jobs.length || !list.querySelector("[data-dl-group]")) {
        list.innerHTML = renderGroups(jobs, actionsFor);
        return true;
    }
    const keep = new Set(jobs.map((job) => String(job.id)));
    list.querySelectorAll("[data-job-id]").forEach((row) => {
        if (!keep.has(row.dataset.jobId)) row.remove();
    });
    const groups = sortJobs(jobs);
    for (const id of ["active", "finished"]) {
        const section = list.querySelector(`[data-dl-group="${id}"]`);
        const rows = section.querySelector(".alm-dl-rows");
        section.hidden = !groups[id].length;
        section.querySelector("[data-dl-count]").textContent = String(groups[id].length);
        let previous = null;
        for (const job of groups[id]) {
            const actions = actionsFor(job);
            let row = list.querySelector(`[data-job-id="${CSS.escape(String(job.id))}"]`);
            if (!row || row.dataset.status !== (job.status || "pending")) {
                const fresh = rowElement(job, actions);
                fresh.classList.add(row ? "is-changed" : "is-new");
                row?.remove();
                row = fresh;
            } else {
                const bar = row.querySelector(".alm-dl-bar");
                if (bar) patchBar(bar, job);
                const meta = renderMeta(job);
                if (renderedMeta.get(row) !== meta) {
                    row.querySelector("[data-dl-meta]").innerHTML = meta;
                    renderedMeta.set(row, meta);
                }
                if (renderedActions.get(row) !== actions) {
                    row.querySelector(".alm-dl-actions").innerHTML = actions;
                    renderedActions.set(row, actions);
                }
            }
            const expected = previous ? previous.nextElementSibling : rows.firstElementChild;
            if (row !== expected) rows.insertBefore(row, expected);
            previous = row;
        }
    }
    hydrateDownloadDetails(list);
    return true;
}
