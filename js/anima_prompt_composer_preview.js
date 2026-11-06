export function getEntryPreviewUrl(entry) {
    if (!entry?.title) {
        return entry?.preview || "";
    }
    if (entry.section !== "character") return entry.preview || "";
    const params = new URLSearchParams({ name: entry.title });
    if (entry.subtitle) params.set("copyright", entry.subtitle);
    return `/anima-tools/character/preview?${params.toString()}`;
}
