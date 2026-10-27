const COMMON_MEDIA_WIDTHS = [96, 320, 450, 512, 800, 1200, 1600, 2200];
const CIVITAI_MEDIA_HOSTS = new Set([
    "image.civitai.com",
    "imagecache.civitai.com",
    "image-b2.civitai.com",
]);
const CIVITAI_LEGACY_MEDIA_ROOT = "https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA";
const CIVITAI_B2_MEDIA_ROOT = "https://image-b2.civitai.com/file/civitai-media-cache";
const MEDIA_ID_PATTERN = /(?:^|\/)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i;

export function looksLikeVideoUrl(url) {
    const clean = String(url || "").split("?")[0].toLowerCase();
    return /\.(mp4|webm|mov|m4v|avi)$/.test(clean) || clean.includes("/video/");
}

function snapMediaWidth(width) {
    const requested = Math.max(1, Number(width) || 450);
    return COMMON_MEDIA_WIDTHS.find((value) => requested <= value) || requested;
}

function uniqueUrls(urls) {
    return [...new Set(urls.map((url) => String(url || "").trim()).filter(Boolean))];
}

function sourceUrl(source) {
    return typeof source === "string"
        ? source
        : source?.url || source?.videoUrl || source?.thumbnailUrl || "";
}

function sourceIsVideo(source) {
    const mediaType = String(source?.type || source?.mimeType || source?.contentType || "").toLowerCase();
    return mediaType.includes("video") || looksLikeVideoUrl(sourceUrl(source));
}

export function findModelPreviewSource(model, preferredVersion = null, options = {}) {
    const versions = Array.isArray(model?.modelVersions) ? model.modelVersions : [];
    const preferredId = String(preferredVersion?.id || "");
    const orderedVersions = preferredVersion
        ? [preferredVersion, ...versions.filter((version) => (
            version !== preferredVersion && (!preferredId || String(version?.id || "") !== preferredId)
        ))]
        : versions;
    const candidates = [];
    orderedVersions.forEach((version) => {
        if (Array.isArray(version?.images)) candidates.push(...version.images);
    });
    if (Array.isArray(model?.images)) candidates.push(...model.images);
    const available = candidates.filter((source) => Boolean(sourceUrl(source)));
    if (options.preferImage === true) {
        return available.find((source) => !sourceIsVideo(source)) || available[0] || null;
    }
    return available[0] || null;
}

export function isModelPreviewFiltered(model, contentFilterActive = false) {
    if (!contentFilterActive) return false;
    const level = Number(model?.nsfwLevel ?? model?.nsfw_level);
    return model?.nsfw === true || (Number.isFinite(level) && level > 1);
}

function civitaiMediaParts(rawUrl) {
    let parsed;
    try {
        parsed = new URL(String(rawUrl || ""));
    } catch (_) {
        return null;
    }
    if (!CIVITAI_MEDIA_HOSTS.has(parsed.hostname.toLowerCase())) return null;
    const mediaId = parsed.pathname.match(MEDIA_ID_PATTERN)?.[1]?.toLowerCase();
    if (!mediaId) return null;
    const filename = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || "");
    return { mediaId, filename };
}

/**
 * Build the same optimized Civitai media variants used by the official cards.
 * The direct B2 URL avoids the legacy redirect; the legacy transformer remains
 * first fallback so newly uploaded media can be generated on demand.
 */
export function createPreviewMedia(image, width = 450) {
    const rawUrl = sourceUrl(image);
    if (!rawUrl) return { url: "", rawUrl: "", type: "image", fallbackUrls: [] };

    const mediaType = String(image?.type || image?.mimeType || image?.contentType || "").toLowerCase();
    const isVideo = mediaType.includes("video") || looksLikeVideoUrl(rawUrl);
    const type = isVideo ? "video" : "image";
    const parts = civitaiMediaParts(rawUrl);
    if (!parts) return { url: rawUrl, rawUrl, type, fallbackUrls: [] };

    const snappedWidth = snapMediaWidth(width);
    const { mediaId, filename } = parts;
    if (isVideo) {
        const sourceStem = (filename.replace(/\.[^.]+$/, "") || mediaId).replaceAll("%", "");
        const directVideo = `${CIVITAI_B2_MEDIA_ROOT}/${mediaId}/${snappedWidth}x%3Cauto%3E_.mp4`;
        const legacyVideo = `${CIVITAI_LEGACY_MEDIA_ROOT}/${mediaId}/transcode=true,width=${snappedWidth}/${sourceStem}.mp4`;
        const directPoster = `${CIVITAI_B2_MEDIA_ROOT}/${mediaId}/${snappedWidth}x%3Cauto%3E_.webp`;
        const legacyPoster = `${CIVITAI_LEGACY_MEDIA_ROOT}/${mediaId}/anim=false,transcode=true,width=${snappedWidth},optimized=true/${sourceStem}.jpeg`;
        return {
            url: directVideo,
            rawUrl,
            type,
            fallbackUrls: uniqueUrls([legacyVideo, rawUrl]).filter((url) => url !== directVideo),
            posterUrl: directPoster,
            posterFallbackUrls: uniqueUrls([legacyPoster]).filter((url) => url !== directPoster),
        };
    }

    const directImage = `${CIVITAI_B2_MEDIA_ROOT}/${mediaId}/${snappedWidth}x%3Cauto%3E_so`;
    const legacyImage = `${CIVITAI_LEGACY_MEDIA_ROOT}/${mediaId}/width=${snappedWidth},optimized=true/${mediaId}.jpeg`;
    return {
        url: directImage,
        rawUrl,
        type,
        fallbackUrls: uniqueUrls([legacyImage, rawUrl]).filter((url) => url !== directImage),
    };
}
