export function assetKindForRoot(rootKind, fallback = "lora") {
    const root = String(rootKind || "").toLowerCase();
    if (["checkpoints", "unet"].includes(root)) return "checkpoint";
    if (root === "workflows") return "workflow";
    if (root === "loras") return "lora";
    return ["checkpoint", "workflow", "lora"].includes(fallback) ? fallback : "lora";
}

function cloneModelSnapshot(model) {
    if (!model || typeof model !== "object") return {};
    let snapshot;
    try {
        snapshot = JSON.parse(JSON.stringify(model));
    } catch (_) {
        snapshot = { ...model };
    }
    if (Array.isArray(snapshot.images)) snapshot.images = snapshot.images.slice(0, 12);
    if (Array.isArray(snapshot.modelVersions)) {
        snapshot.modelVersions = snapshot.modelVersions.slice(0, 100).map((version) => ({
            ...version,
            images: Array.isArray(version?.images) ? version.images.slice(0, 12) : [],
            files: Array.isArray(version?.files) ? version.files.slice(0, 30) : [],
            trainedWords: Array.isArray(version?.trainedWords) ? version.trainedWords.slice(0, 100) : [],
        }));
    }
    return snapshot;
}

export function favoriteItemForRemote(model, assetKind = "lora") {
    const snapshot = cloneModelSnapshot(model);
    const version = Array.isArray(snapshot.modelVersions) ? snapshot.modelVersions[0] || {} : {};
    return {
        asset_kind: assetKindForRoot("", assetKind),
        source: "remote",
        model_id: String(snapshot.id || ""),
        version_id: String(version.id || ""),
        name: snapshot.name || "Untitled",
        creator: snapshot.creator?.username || "",
        base_model: version.baseModel || snapshot.baseModel || "",
        type: snapshot.type || assetKind,
        civitai_url: snapshot.id ? `https://civitai.red/models/${encodeURIComponent(snapshot.id)}` : "",
        model: snapshot,
    };
}

export function favoriteItemForLocal(asset, fallbackKind = "lora") {
    return {
        asset_kind: assetKindForRoot(asset?.root_kind, fallbackKind),
        source: "local",
        model_id: String(asset?.model_id || ""),
        version_id: String(asset?.version_id || ""),
        name: asset?.name || asset?.filename || "Local asset",
        creator: asset?.creator || "",
        base_model: asset?.base_model || "",
        type: asset?.root_kind || fallbackKind,
        preview_url: asset?.thumb_url || "",
        civitai_url: asset?.civitai_url || "",
        local: {
            asset_id: asset?.id || "",
            root_kind: asset?.root_kind || "",
            storage_root_id: asset?.storage_root_id || "",
            relative_path: asset?.relative_path || "",
            filename: asset?.filename || "",
        },
    };
}

export function favoriteEntryForRemote(items, model, assetKind = "lora") {
    const modelId = String(model?.id || "");
    if (!modelId) return null;
    const kind = assetKindForRoot("", assetKind);
    return (Array.isArray(items) ? items : []).find((item) => (
        item?.asset_kind === kind && String(item?.model_id || item?.model?.id || "") === modelId
    )) || null;
}

export function favoriteEntryForLocal(items, asset, fallbackKind = "lora") {
    if (!asset || typeof asset !== "object") return null;
    const list = Array.isArray(items) ? items : [];
    const kind = assetKindForRoot(asset?.root_kind, fallbackKind);
    const modelId = String(asset?.model_id || "");
    if (modelId) {
        const matched = list.find((item) => item?.asset_kind === kind && String(item?.model_id || "") === modelId);
        if (matched) return matched;
    }
    const assetId = String(asset?.id || "");
    const relativePath = String(asset?.relative_path || "").replaceAll("\\", "/");
    const rootKind = String(asset?.root_kind || "");
    const storageRootId = String(asset?.storage_root_id || "");
    return list.find((item) => {
        const local = item?.local || {};
        if (assetId && String(local.asset_id || "") === assetId) return true;
        return item?.asset_kind === kind
            && String(local.root_kind || "") === rootKind
            && String(local.storage_root_id || "") === storageRootId
            && String(local.relative_path || "").replaceAll("\\", "/") === relativePath;
    }) || null;
}

export function favoriteModel(item) {
    return item?.model && typeof item.model === "object" && item.model.id ? item.model : null;
}

export function filterFavoriteItems(items, options = {}) {
    const folderId = String(options.folderId || "");
    const kind = String(options.assetKind || "");
    const query = String(options.query || "").trim().toLocaleLowerCase();
    return (Array.isArray(items) ? items : []).filter((item) => {
        if (kind && item?.asset_kind !== kind) return false;
        if (folderId && item?.folder_id !== folderId) return false;
        if (!query) return true;
        const model = favoriteModel(item);
        return [
            item?.name,
            item?.creator,
            item?.base_model,
            item?.type,
            ...(Array.isArray(model?.tags) ? model.tags : []),
        ].some((value) => String(value || "").toLocaleLowerCase().includes(query));
    });
}

export function localAssetForFavorite(item, libraryItems) {
    const items = Array.isArray(libraryItems) ? libraryItems : [];
    const local = item?.local || {};
    if (local.asset_id) {
        const byId = items.find((asset) => String(asset.id || "") === String(local.asset_id));
        if (byId) return byId;
    }
    const modelId = String(item?.model_id || "");
    if (modelId) {
        const byModel = items.find((asset) => (
            assetKindForRoot(asset?.root_kind) === item?.asset_kind
            && String(asset?.model_id || "") === modelId
        ));
        if (byModel) return byModel;
    }
    return items.find((asset) => (
        String(asset?.root_kind || "") === String(local.root_kind || "")
        && String(asset?.storage_root_id || "") === String(local.storage_root_id || "")
        && String(asset?.relative_path || "").replaceAll("\\", "/") === String(local.relative_path || "").replaceAll("\\", "/")
    )) || null;
}
