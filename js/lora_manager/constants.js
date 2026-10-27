export const API = "/anima-tools/lora-manager/api";
export const SEARCH_CACHE_KEY = "alm-civitai-search-cache";
export const SEARCH_CACHE_VERSION = "v9-early-access";
export const SEARCH_CACHE_TTL = 24 * 60 * 60 * 1000;
export const SEARCH_CACHE_LIMIT = 16;
export const INITIAL_PREVIEW_LOADS = 12;
export const SEARCH_PAGE_SIZE = 40;
export const HIGH_PRIORITY_PREVIEW_LOADS = 4;

export const TABS = ["Discover", "Library", "Favorites", "Downloads", "Settings"];

export const ASSET_KINDS = [
    { id: "checkpoint", label: "Checkpoint/UNet", rootKinds: ["checkpoints", "unet"] },
    { id: "lora", label: "LoRA" },
    { id: "workflow", label: "Workflow" },
];

export const CIVITAI_CATEGORY_FILTERS = [
    { label: "Action", value: "action" },
    { label: "Animal", value: "animal" },
    { label: "Assets", value: "assets" },
    { label: "Background", value: "background" },
    { label: "Base Model", value: "base model" },
    { label: "Buildings", value: "buildings" },
    { label: "Celebrity", value: "celebrity" },
    { label: "Character", value: "character" },
    { label: "Clothing", value: "clothing" },
    { label: "Concept", value: "concept" },
    { label: "Objects", value: "objects" },
    { label: "Poses", value: "poses" },
    { label: "Style", value: "style" },
    { label: "Tool", value: "tool" },
    { label: "Vehicle", value: "vehicle" },
];

export const ROOT_KINDS = [
    { id: "checkpoints", label: "Checkpoints" },
    { id: "unet", label: "UNet" },
    { id: "loras", label: "LoRA" },
    { id: "workflows", label: "Workflows" },
];

export const ROOT_LOCAL_FOLDER = "__alm_root_files__";
