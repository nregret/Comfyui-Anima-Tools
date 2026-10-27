"""Backend API for the Anima Tools LoRA manager, copied from CivitaiManager."""

from __future__ import annotations

import asyncio
import hashlib
import http.client
import json
import os
import queue
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import folder_paths
from aiohttp import web
from server import PromptServer

try:
    from .backend.client import (
        civitai_red_url as _civitai_red_url,
        fetch as _fetch,
        http_error_message as _http_error_message,
        request_headers as _request_headers,
        validate_civitai_https as _validate_civitai_https,
    )
    from .backend.config import normalize_config as _normalize_config_values, parse_bool as _config_bool
    from .backend.downloads import DownloadJobStore
    from .backend.library import LibraryIndex
    from .backend.routes import register_routes
except ImportError:  # Standalone test loading
    from backend.client import (
        civitai_red_url as _civitai_red_url,
        fetch as _fetch,
        http_error_message as _http_error_message,
        request_headers as _request_headers,
        validate_civitai_https as _validate_civitai_https,
    )
    from backend.config import normalize_config as _normalize_config_values, parse_bool as _config_bool
    from backend.downloads import DownloadJobStore
    from backend.library import LibraryIndex
    from backend.routes import register_routes


API_PREFIX = "/anima-tools/lora-manager/api"
CIVITAI_API_BASE = "https://civitai.red/api/v1"
CIVITAI_DOWNLOAD_BASE = "https://civitai.red/api/download/models"
MODEL_EXTENSIONS = {".ckpt", ".pt", ".pt2", ".bin", ".pth", ".safetensors", ".pkl", ".sft"}
IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")
WORKFLOW_EXTENSIONS = {".json"}
REMOTE_IMAGE_CACHE_WIDTH_DEFAULT = 450
REMOTE_IMAGE_COMMON_WIDTHS = (96, 320, 450, 512, 800, 1200, 1600, 2200)
CIVITAI_IMAGE_HOSTS = {"image.civitai.com", "imagecache.civitai.com", "image-b2.civitai.com"}
CIVITAI_IMAGE_LOCATION = "https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA"
CIVITAI_MEDIA_ID_RE = re.compile(
    r"(?:^|/)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:/|$)",
    re.IGNORECASE,
)
TAXONOMY_CACHE_TTL = 10 * 60
SEARCH_RESULT_CACHE_TTL = 5 * 60
SEARCH_RESULT_CACHE_LIMIT = 64
MODEL_DETAIL_CACHE_TTL = 5 * 60
MODEL_DETAIL_CACHE_LIMIT = 64
# Search cards only need these fields; /model-detail delivers the full record.
SEARCH_MODEL_FIELDS = ("id", "name", "type", "nsfw", "nsfwLevel", "tags", "stats", "availability")
SEARCH_VERSION_FIELDS = ("id", "name", "baseModel", "baseModelType", "publishedAt", "trainedWords", "stats", "availability", "earlyAccessEndsAt", "paidAccess")
SEARCH_FILE_FIELDS = ("id", "name", "sizeKB", "type", "primary", "metadata", "hashes", "downloadUrl")
SEARCH_IMAGE_FIELDS = ("url", "type", "nsfwLevel", "width", "height")
SEARCH_PRIMARY_IMAGE_LIMIT = 12
SEARCH_FALLBACK_CURSOR_PREFIX = "fallback:"
SEARCH_ATTEMPT_CURSOR_PREFIX = "attempt:"
SEARCH_FALLBACK_MAX_PAGES = 8
RETRYABLE_HTTP_STATUS = {429, 500, 502, 503, 504}
DOWNLOAD_MAX_WORKERS = 3
DOWNLOAD_MAX_ACTIVE_JOBS = 20
DOWNLOAD_JOB_HISTORY_LIMIT = 100
DOWNLOAD_JOB_RETENTION_SECONDS = 24 * 60 * 60
ASSET_ROOT_KINDS = {"checkpoints", "unet", "loras", "workflows"}
ROOT_KIND_FAMILIES = {
    "checkpoints": "checkpoint",
    "unet": "checkpoint",
    "loras": "lora",
    "workflows": "workflow",
}
WINDOWS_RESERVED_SEGMENTS = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{index}" for index in range(1, 10)),
    *(f"LPT{index}" for index in range(1, 10)),
}

_CONFIG_CACHE: dict[str, Any] | None = None
_CONFIG_LOCK = threading.Lock()
_DOWNLOAD_QUEUE: queue.Queue[tuple[str, str, str, str, dict[str, Any], str]] = queue.Queue(
    maxsize=DOWNLOAD_MAX_ACTIVE_JOBS
)
_DOWNLOAD_WORKERS_LOCK = threading.Lock()
_DOWNLOAD_WORKERS_STARTED = False
_DOWNLOAD_STORE: DownloadJobStore | None = None
_DOWNLOAD_STORE_LOCK = threading.Lock()
_HASH_METADATA_LOCK = threading.Lock()
_HASH_METADATA_REQUEST_LOCK = asyncio.Lock()
_TAXONOMY_CACHE: dict[str, dict[str, Any]] = {}
_TAXONOMY_LOCK = threading.Lock()
_SEARCH_RESULT_CACHE: dict[tuple[Any, ...], dict[str, Any]] = {}
_SEARCH_RESULT_CACHE_LOCK = threading.Lock()
_MODEL_DETAIL_CACHE: dict[tuple[str, str], dict[str, Any]] = {}
_MODEL_DETAIL_CACHE_LOCK = threading.Lock()
_FAVORITES_LOCK = threading.Lock()
_LIBRARY_INDEX = LibraryIndex(ttl_seconds=30)


def _install_windows_proactor_shutdown_guard() -> None:
    """Suppress noisy Windows asyncio cleanup errors for already-closed pipes.

    Python's Proactor event loop can log an exception from
    _ProactorBasePipeTransport._call_connection_lost when the browser closes an
    HTTP connection while a response is being cleaned up. The connection is
    already gone, so this is not actionable for the plugin or user.
    """
    if os.name != "nt":
        return
    try:
        import asyncio.proactor_events as proactor_events

        transport_cls = getattr(proactor_events, "_ProactorBasePipeTransport", None)
        original = getattr(transport_cls, "_call_connection_lost", None)
        if not transport_cls or not original or getattr(original, "_civitai_manager_guarded", False):
            return

        def guarded_call_connection_lost(self, exc):  # type: ignore[no-untyped-def]
            try:
                return original(self, exc)
            except OSError:
                return None

        guarded_call_connection_lost._civitai_manager_guarded = True  # type: ignore[attr-defined]
        transport_cls._call_connection_lost = guarded_call_connection_lost
    except Exception:
        return


_install_windows_proactor_shutdown_guard()


def _now() -> int:
    return int(time.time())


def _plugin_data_dir() -> str:
    path = os.path.join(folder_paths.get_user_directory(), "anima_tools_lora_manager")
    os.makedirs(path, exist_ok=True)
    return path


def _config_path() -> str:
    return os.path.join(_plugin_data_dir(), "config.json")


def _favorites_path() -> str:
    return os.path.join(_plugin_data_dir(), "favorites.json")


def _default_workflow_dir() -> str:
    return os.path.join(folder_paths.get_user_directory(), "default", "workflows")


def _default_config() -> dict[str, Any]:
    return {
        "civitai_api_key": "",
        "allow_nsfw": False,
        "workflow_dir": _default_workflow_dir(),
        "save_metadata": True,
        "save_preview": True,
    }


def _normalize_config(config: dict[str, Any]) -> dict[str, Any]:
    return _normalize_config_values(config, _default_config())


def load_config() -> dict[str, Any]:
    global _CONFIG_CACHE
    if _CONFIG_CACHE is not None:
        return dict(_CONFIG_CACHE)

    config = _default_config()
    path = _config_path()
    if os.path.isfile(path):
        try:
            with open(path, "r", encoding="utf-8") as handle:
                data = json.load(handle)
            if isinstance(data, dict):
                config.update(data)
            config = _normalize_config(config)
        except Exception as exc:
            print(f"[Anima Tools] Failed to read config: {exc}")
            config = _normalize_config(_default_config())
    else:
        config = _normalize_config({**config, **_legacy_anima_config()})

    _CONFIG_CACHE = config
    return dict(config)


def save_config(data: dict[str, Any]) -> dict[str, Any]:
    with _CONFIG_LOCK:
        return _save_config_unlocked(data)


def _save_config_unlocked(data: dict[str, Any]) -> dict[str, Any]:
    global _CONFIG_CACHE
    current = load_config()
    writable = {
        "civitai_api_key",
        "allow_nsfw",
        "workflow_dir",
        "save_metadata",
        "save_preview",
    }
    for key in writable:
        if key in data:
            current[key] = data[key]
    current = _normalize_config(current)

    path = _config_path()
    tmp_path = f"{path}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as handle:
        json.dump(current, handle, indent=2, ensure_ascii=False)
    os.replace(tmp_path, path)
    _CONFIG_CACHE = current
    with _TAXONOMY_LOCK:
        _TAXONOMY_CACHE.clear()
    with _SEARCH_RESULT_CACHE_LOCK:
        _SEARCH_RESULT_CACHE.clear()
    with _MODEL_DETAIL_CACHE_LOCK:
        _MODEL_DETAIL_CACHE.clear()
    return dict(current)


def _public_config(config: dict[str, Any]) -> dict[str, Any]:
    public = dict(config)
    public["civitai_api_key"] = ""
    public["api_key_set"] = bool(config.get("civitai_api_key"))
    public["roots"] = _root_display()
    return public


def _favorite_asset_kind(root_kind: Any, fallback: Any = "") -> str:
    normalized_root = str(root_kind or "").strip().lower()
    kind = ROOT_KIND_FAMILIES.get(normalized_root, str(fallback or "").strip().lower())
    if kind not in {"checkpoint", "lora", "workflow"}:
        raise ValueError("Invalid favorite asset kind")
    return kind


def _favorite_item_key(item: dict[str, Any]) -> str:
    model = item.get("model") if isinstance(item.get("model"), dict) else {}
    local = item.get("local") if isinstance(item.get("local"), dict) else {}
    asset_kind = _favorite_asset_kind(
        item.get("root_kind") or local.get("root_kind"),
        item.get("asset_kind"),
    )
    model_id = str(item.get("model_id") or model.get("id") or "").strip()
    if model_id:
        if not re.fullmatch(r"[A-Za-z0-9._-]{1,100}", model_id):
            raise ValueError("Invalid favorite model id")
        return f"civitai:{asset_kind}:{model_id}"
    root_kind = str(item.get("root_kind") or local.get("root_kind") or "").strip().lower()
    relative_path = str(item.get("relative_path") or local.get("relative_path") or "").strip().replace("\\", "/")
    storage_root_id = str(item.get("storage_root_id") or local.get("storage_root_id") or "").strip()
    if not root_kind or not relative_path:
        key = str(item.get("key") or "").strip()
        if re.fullmatch(r"[A-Za-z0-9:._-]{1,200}", key):
            return key
        raise ValueError("Favorite requires a Civitai model id or local asset path")
    digest = hashlib.sha256(f"{root_kind}\0{storage_root_id}\0{relative_path}".encode("utf-8")).hexdigest()[:24]
    return f"local:{asset_kind}:{digest}"


def _normalize_favorite_item(item: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(item, dict):
        raise ValueError("Favorite item must be an object")
    model = item.get("model") if isinstance(item.get("model"), dict) else {}
    local = item.get("local") if isinstance(item.get("local"), dict) else {}
    root_kind = str(item.get("root_kind") or local.get("root_kind") or "").strip().lower()
    asset_kind = _favorite_asset_kind(root_kind, item.get("asset_kind"))
    model_id = str(item.get("model_id") or model.get("id") or "").strip()
    name = str(item.get("name") or model.get("name") or local.get("name") or "").strip()[:300]
    if not name:
        raise ValueError("Favorite name is required")
    source = "remote" if model else "local"
    sources = {
        str(value).strip().lower()
        for value in (item.get("sources") if isinstance(item.get("sources"), list) else [item.get("source"), source])
        if str(value or "").strip().lower() in {"local", "remote"}
    }
    if source:
        sources.add(source)
    normalized_local = {}
    if root_kind and str(item.get("relative_path") or local.get("relative_path") or "").strip():
        normalized_local = {
            "asset_id": str(item.get("asset_id") or local.get("asset_id") or "")[:500],
            "root_kind": root_kind,
            "storage_root_id": str(item.get("storage_root_id") or local.get("storage_root_id") or "")[:200],
            "relative_path": str(item.get("relative_path") or local.get("relative_path") or "").replace("\\", "/")[:1000],
            "filename": str(item.get("filename") or local.get("filename") or "")[:300],
        }
    now = _now()
    normalized = {
        "key": "",
        "asset_kind": asset_kind,
        "source": source,
        "sources": sorted(sources),
        "model_id": model_id,
        "version_id": str(item.get("version_id") or "")[:100],
        "name": name,
        "creator": str(item.get("creator") or (model.get("creator") or {}).get("username") or "")[:200],
        "base_model": str(item.get("base_model") or "")[:200],
        "type": str(item.get("type") or model.get("type") or asset_kind)[:100],
        "preview_url": str(item.get("preview_url") or item.get("thumb_url") or "")[:4000],
        "civitai_url": str(item.get("civitai_url") or "")[:2000],
        "folder_id": str(item.get("folder_id") or "")[:100],
        "model": model,
        "local": normalized_local,
        "created_at": int(item.get("created_at") or now),
        "updated_at": int(item.get("updated_at") or now),
    }
    normalized["key"] = _favorite_item_key(normalized)
    return normalized


def _favorite_item_from_asset(asset: dict[str, Any]) -> dict[str, Any]:
    root_kind = str(asset.get("root_kind") or "")
    return _normalize_favorite_item({
        "asset_kind": _favorite_asset_kind(root_kind),
        "source": "local",
        "model_id": asset.get("model_id") or "",
        "version_id": asset.get("version_id") or "",
        "name": asset.get("name") or asset.get("filename") or "Local asset",
        "creator": asset.get("creator") or "",
        "base_model": asset.get("base_model") or "",
        "type": root_kind,
        "preview_url": asset.get("thumb_url") or "",
        "civitai_url": asset.get("civitai_url") or "",
        "local": {
            "asset_id": asset.get("id") or "",
            "root_kind": root_kind,
            "storage_root_id": asset.get("storage_root_id") or "",
            "relative_path": asset.get("relative_path") or "",
            "filename": asset.get("filename") or "",
        },
    })


def _legacy_anima_path(filename: str) -> str:
    return os.path.join(folder_paths.get_user_directory(), filename)


def _legacy_anima_config() -> dict[str, Any]:
    """Civitai API key saved by the previous Anima LoRA selector."""
    try:
        with open(_legacy_anima_path("anima_lora_config.json"), "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, ValueError):
        return {}
    api_key = str(data.get("civitai_api_key") or "").strip() if isinstance(data, dict) else ""
    return {"civitai_api_key": api_key} if api_key else {}


def _legacy_anima_favorites() -> list[dict[str, Any]]:
    """Civitai LoRA favorites saved by the previous Anima LoRA selector."""
    try:
        with open(_legacy_anima_path("anima_tools_favorites.json"), "r", encoding="utf-8") as handle:
            section = json.load(handle).get("lora")
    except (OSError, ValueError, AttributeError):
        return []
    raw_items = section.get("items") if isinstance(section, dict) else None
    items = []
    for raw in raw_items if isinstance(raw_items, list) else []:
        if not isinstance(raw, dict) or not raw.get("id"):
            continue
        creator = raw.get("creator") if isinstance(raw.get("creator"), dict) else {"username": str(raw.get("creator") or "")}
        versions = [version for version in raw.get("modelVersions") or [] if isinstance(version, dict)]
        first_version = versions[0] if versions else {}
        try:
            items.append(_normalize_favorite_item({
                "asset_kind": "lora",
                "model_id": raw["id"],
                "version_id": first_version.get("id") or "",
                "name": raw.get("name") or str(raw["id"]),
                "creator": creator.get("username") or "",
                "base_model": first_version.get("baseModel") or "Anima",
                "civitai_url": f"https://civitai.red/models/{raw['id']}",
                "model": {
                    "id": raw["id"],
                    "name": raw.get("name") or str(raw["id"]),
                    "type": "LORA",
                    "creator": creator,
                    "description": raw.get("description") or "",
                    "modelVersions": versions,
                },
            }))
        except ValueError:
            continue
    return items


def _empty_favorite_store() -> dict[str, Any]:
    return {"version": 1, "folders": [], "items": [], "updated_at": _now()}


def _normalize_favorite_store(data: Any) -> dict[str, Any]:
    store = _empty_favorite_store()
    if not isinstance(data, dict):
        return store
    folders = []
    seen_folder_ids: set[str] = set()
    for raw in data.get("folders") if isinstance(data.get("folders"), list) else []:
        if not isinstance(raw, dict):
            continue
        folder_id = str(raw.get("id") or "").strip()
        name = str(raw.get("name") or "").strip()[:80]
        if not folder_id or folder_id in seen_folder_ids or not name:
            continue
        seen_folder_ids.add(folder_id)
        folders.append({
            "id": folder_id[:100],
            "name": name,
            "created_at": int(raw.get("created_at") or _now()),
            "updated_at": int(raw.get("updated_at") or _now()),
        })
    items = []
    seen_item_keys: set[str] = set()
    for raw in data.get("items") if isinstance(data.get("items"), list) else []:
        try:
            item = _normalize_favorite_item(raw)
        except ValueError:
            continue
        if item["key"] in seen_item_keys:
            continue
        seen_item_keys.add(item["key"])
        if item["folder_id"] not in seen_folder_ids:
            item["folder_id"] = ""
        items.append(item)
    store.update({
        "folders": folders,
        "items": items,
        "updated_at": int(data.get("updated_at") or _now()),
    })
    return store


def _write_favorites_unlocked(store: dict[str, Any]) -> None:
    path = _favorites_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    temp_path = f"{path}.{uuid.uuid4().hex}.tmp"
    try:
        with open(temp_path, "w", encoding="utf-8") as handle:
            json.dump(store, handle, indent=2, ensure_ascii=False)
        os.replace(temp_path, path)
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass


def _load_favorites_unlocked() -> dict[str, Any]:
    path = _favorites_path()
    if os.path.isfile(path):
        try:
            with open(path, "r", encoding="utf-8") as handle:
                return _normalize_favorite_store(json.load(handle))
        except Exception as exc:
            print(f"[Anima Tools] Failed to read favorites: {exc}")
            return _empty_favorite_store()
    store = _empty_favorite_store()
    try:
        snapshot = _scan_roots(False)
        migrated = []
        for asset in snapshot.get("items") if isinstance(snapshot, dict) else []:
            if not isinstance(asset, dict) or not asset.get("favorite"):
                continue
            try:
                migrated.append(_favorite_item_from_asset(asset))
            except ValueError:
                continue
        store["items"] = migrated + _legacy_anima_favorites()
    except Exception as exc:
        print(f"[Anima Tools] Failed to migrate legacy favorites: {exc}")
    _write_favorites_unlocked(store)
    return store


def _favorite_store_response(store: dict[str, Any]) -> dict[str, Any]:
    normalized = _normalize_favorite_store(store)
    normalized["folders"].sort(key=lambda folder: (folder["name"].lower(), folder["id"]))
    normalized["items"].sort(key=lambda item: (-int(item.get("updated_at") or 0), item["name"].lower()))
    return normalized


def _load_favorites() -> dict[str, Any]:
    with _FAVORITES_LOCK:
        return _favorite_store_response(_load_favorites_unlocked())


def _mutate_favorite_item(item: dict[str, Any], favorite: bool, folder_id: str | None = None) -> dict[str, Any]:
    normalized = _normalize_favorite_item(item)
    with _FAVORITES_LOCK:
        store = _load_favorites_unlocked()
        by_key = {entry["key"]: entry for entry in store["items"]}
        existing = by_key.get(normalized["key"])
        if favorite:
            merged = {**(existing or {}), **normalized}
            if existing and existing.get("model") and not normalized.get("model"):
                merged["model"] = existing["model"]
            if existing and existing.get("local") and not normalized.get("local"):
                merged["local"] = existing["local"]
            sources = set(existing.get("sources") or []) if existing else set()
            sources.update(normalized.get("sources") or [])
            merged["sources"] = sorted(sources)
            merged["source"] = "remote" if merged.get("model") else "local"
            merged["created_at"] = int(existing.get("created_at") or _now()) if existing else _now()
            merged["updated_at"] = _now()
            if folder_id is None:
                merged["folder_id"] = str(existing.get("folder_id") or "") if existing else ""
            else:
                valid_folder_ids = {folder["id"] for folder in store["folders"]}
                if folder_id and folder_id not in valid_folder_ids:
                    raise ValueError("Favorite folder not found")
                merged["folder_id"] = folder_id
            by_key[normalized["key"]] = merged
        else:
            by_key.pop(normalized["key"], None)
        store["items"] = list(by_key.values())
        store["updated_at"] = _now()
        _write_favorites_unlocked(store)
        return _favorite_store_response(store)


def _favorite_folder_name(value: Any) -> str:
    name = re.sub(r"[\x00-\x1f]+", " ", str(value or "")).strip()
    if not name:
        raise ValueError("Favorite folder name is required")
    return name[:80]


def _read_json_url(url: str, api_key: str | None = None, timeout: int = 30, quiet: bool = False) -> dict[str, Any] | None:
    try:
        status, reason, body = _fetch(url, _request_headers(api_key), timeout)
    except Exception as exc:
        if not quiet:
            print(f"[Anima Tools] Request failed for {url}: {exc}")
        return {"error": str(exc)}
    raw = body.decode("utf-8", errors="replace")
    if status >= 400:
        snippet = raw[:500]
        if not quiet:
            print(f"[Anima Tools] HTTP {status} for {url}: {snippet or reason}")
        return {
            "error": _http_error_message(snippet, f"HTTP {status}: {reason}"),
            "status": status,
            "body": snippet,
            "retryable": status in RETRYABLE_HTTP_STATUS,
        }
    if not raw.strip():
        return {"error": "Empty response from Civitai"}
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"[Anima Tools] Invalid JSON for {url}: {exc}")
        return {"error": "Invalid JSON response from Civitai"}


def _is_retryable_result(result: dict[str, Any] | None) -> bool:
    if not isinstance(result, dict):
        return False
    status = result.get("status")
    return bool(result.get("retryable")) or status in RETRYABLE_HTTP_STATUS


def _is_invalid_cursor_result(result: dict[str, Any] | None) -> bool:
    if not isinstance(result, dict):
        return False
    if result.get("status") != 400:
        return False
    text = f"{result.get('error') or ''} {result.get('body') or ''}".lower()
    return "invalid cursor" in text


def _read_json_url_with_retries(
    url: str,
    api_key: str | None = None,
    timeout: int = 30,
    retries: int = 2,
    quiet: bool = False,
) -> dict[str, Any] | None:
    last_result: dict[str, Any] | None = None
    for attempt in range(max(0, retries) + 1):
        last_result = _read_json_url(url, api_key, timeout, quiet=quiet or attempt < retries)
        if not _is_retryable_result(last_result):
            return last_result
        if attempt < retries:
            time.sleep(0.45 * (attempt + 1))
    return last_result


def _safe_segment(value: Any, fallback: str = "Other", max_len: int = 80) -> str:
    text = str(value or "").strip()
    text = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "_", text)
    text = re.sub(r"\s+", " ", text).strip(" ._")
    if not text:
        text = fallback
    text = text[:max_len].strip(" ._") or fallback
    if text and os.path.splitext(text)[0].upper() in WINDOWS_RESERVED_SEGMENTS:
        text = f"_{text}"
    return text


def _safe_filename(value: Any, fallback: str, extension: str = ".safetensors") -> str:
    text = _safe_segment(value, fallback=fallback, max_len=160)
    root, ext = os.path.splitext(text)
    if not ext:
        text = f"{text}{extension}"
    return text


def _safe_join(root: str, *parts: str) -> str:
    root_abs = os.path.abspath(root)
    path_abs = os.path.abspath(os.path.join(root_abs, *parts))
    root_real = os.path.normcase(os.path.realpath(root_abs))
    path_real = os.path.normcase(os.path.realpath(path_abs))
    if os.path.commonpath([root_real, path_real]) != root_real:
        raise ValueError("Resolved path escapes allowed root")
    return path_abs


def _normalize_root_kind(root_kind: Any) -> str:
    normalized = str(root_kind or "").strip().lower()
    if normalized not in ASSET_ROOT_KINDS:
        raise ValueError(f"Unknown asset root: {normalized or '(empty)'}")
    return normalized


def _extensions_for_root(root_kind: str) -> set[str]:
    normalized = _normalize_root_kind(root_kind)
    return WORKFLOW_EXTENSIONS if normalized == "workflows" else MODEL_EXTENSIONS


def _validate_asset_filename(root_kind: str, filename: str) -> str:
    normalized = _normalize_root_kind(root_kind)
    name = os.path.basename(str(filename or ""))
    extension = os.path.splitext(name)[1].lower()
    if normalized == "workflows" and name.lower().endswith(".civitai.json"):
        raise ValueError("Workflow companion metadata is not an asset")
    if extension not in _extensions_for_root(normalized):
        allowed = ", ".join(sorted(_extensions_for_root(normalized)))
        raise ValueError(f"Invalid {normalized} file extension; expected one of: {allowed}")
    return name


def _validate_root_transition(source_root_kind: str, target_root_kind: str) -> None:
    source = _normalize_root_kind(source_root_kind)
    target = _normalize_root_kind(target_root_kind)
    if ROOT_KIND_FAMILIES[source] != ROOT_KIND_FAMILIES[target]:
        raise ValueError(f"Cannot move an asset from {source} to {target}")


def _first_folder_path(folder_name: str, fallback: str) -> str:
    return _folder_paths(folder_name, fallback)[0]


def _folder_paths(folder_name: str, fallback: str) -> list[str]:
    candidates: list[str] = []
    try:
        candidates.extend(folder_paths.get_folder_paths(folder_name) or [])
    except Exception:
        pass
    candidates.append(fallback)
    unique: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        clean = str(candidate or "").strip()
        if not clean:
            continue
        path = os.path.abspath(os.path.expanduser(clean))
        key = os.path.normcase(os.path.realpath(path))
        if key in seen:
            continue
        seen.add(key)
        unique.append(path)
    return unique or [os.path.abspath(fallback)]


def _roots_for_kind(root_kind: str) -> list[str]:
    root_kind = _normalize_root_kind(root_kind)
    if root_kind == "loras":
        return _folder_paths("loras", os.path.join(folder_paths.models_dir, "loras"))
    if root_kind == "checkpoints":
        return _folder_paths("checkpoints", os.path.join(folder_paths.models_dir, "checkpoints"))
    if root_kind == "unet":
        return _folder_paths("diffusion_models", os.path.join(folder_paths.models_dir, "unet"))
    if root_kind == "workflows":
        return [os.path.abspath(str(load_config().get("workflow_dir") or _default_workflow_dir()))]
    raise ValueError(f"Unknown asset root: {root_kind}")


def _root_for_kind(root_kind: str) -> str:
    return _roots_for_kind(root_kind)[0]


def _storage_root_id(root_path: str) -> str:
    normalized = os.path.normcase(os.path.realpath(os.path.abspath(root_path)))
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]


def _storage_root_for_asset(root_kind: str, storage_root_id: Any = "") -> str:
    requested = str(storage_root_id or "").strip().lower()
    if not requested:
        return _root_for_kind(root_kind)
    for root in _roots_for_kind(root_kind):
        if _storage_root_id(root) == requested:
            return root
    raise ValueError("Unknown model storage root")


def _root_display() -> dict[str, str]:
    return {
        "loras": _root_for_kind("loras"),
        "checkpoints": _root_for_kind("checkpoints"),
        "unet": _root_for_kind("unet"),
        "workflows": _root_for_kind("workflows"),
    }


def _category_name(model: dict[str, Any]) -> str:
    category = model.get("category")
    if isinstance(category, dict):
        return _safe_segment(category.get("name"), "Other")
    if isinstance(category, str):
        return _safe_segment(category, "Other")
    for key in ("modelCategory", "categoryName"):
        if model.get(key):
            return _safe_segment(model.get(key), "Other")
    tags = model.get("tags")
    if isinstance(tags, list):
        for tag in tags:
            clean = _safe_segment(tag, "")
            if clean:
                return clean
    return "Other"


def _kind_to_civitai_type(kind: str) -> str:
    kind = str(kind or "").lower()
    if kind == "checkpoint":
        return "Checkpoint"
    if kind == "workflow":
        return "Workflows"
    return "LORA"


def _normalize_asset_kind(kind: str) -> str:
    kind = str(kind or "").lower()
    if kind in {"checkpoint", "workflow", "lora"}:
        return kind
    return "lora"


def _api_key_cache_part(api_key: str | None) -> str:
    if not api_key:
        return "public"
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()[:12]


def _taxonomy_cache_key(kind: str, config: dict[str, Any]) -> str:
    api_key = str(config.get("civitai_api_key") or "").strip() or None
    return "|".join((
        "taxonomy-enums-v1",
        _normalize_asset_kind(kind),
        "nsfw" if config.get("allow_nsfw") else "sfw",
        _api_key_cache_part(api_key),
    ))


def _empty_taxonomy(kind: str, warning: str = "") -> dict[str, Any]:
    data = {
        "kind": _normalize_asset_kind(kind),
        "categories": [],
        "baseModels": [],
        "modelTypes": [],
        "tags": [],
        "updated_at": _now(),
    }
    if warning:
        data["warning"] = warning
    return data


def _model_base_models(model: dict[str, Any]) -> list[str]:
    values: list[str] = []
    raw_models = model.get("baseModels")
    if isinstance(raw_models, list):
        values.extend(str(item) for item in raw_models if item)
    for key in ("baseModel", "baseModelType"):
        if model.get(key):
            values.append(str(model.get(key)))
    versions = model.get("modelVersions")
    if isinstance(versions, list):
        for version in versions:
            if not isinstance(version, dict):
                continue
            for key in ("baseModel", "baseModelType"):
                if version.get(key):
                    values.append(str(version.get(key)))
    cleaned: list[str] = []
    seen: set[str] = set()
    for value in values:
        name = _safe_segment(value, "")
        key = name.lower()
        if not name or key in seen:
            continue
        seen.add(key)
        cleaned.append(name)
    return cleaned or ["Other"]


def _model_tags(model: dict[str, Any]) -> list[str]:
    raw_tags = model.get("tags")
    if not isinstance(raw_tags, list):
        return []
    cleaned: list[str] = []
    seen: set[str] = set()
    for value in raw_tags:
        name = _safe_segment(value, "")
        key = name.lower()
        if not name or key in seen:
            continue
        seen.add(key)
        cleaned.append(name)
    return cleaned


def _taxonomy_from_items(kind: str, items: list[dict[str, Any]]) -> dict[str, Any]:
    categories: dict[str, int] = {}
    base_models: dict[str, int] = {}
    model_types: dict[str, int] = {}
    tags: dict[str, int] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        category = _category_name(item)
        categories[category] = categories.get(category, 0) + 1
        model_type = _model_type(item) or _kind_to_civitai_type(kind)
        model_types[model_type] = model_types.get(model_type, 0) + 1
        for base in _model_base_models(item):
            base_models[base] = base_models.get(base, 0) + 1
        for tag in _model_tags(item):
            tags[tag] = tags.get(tag, 0) + 1

    def to_list(values: dict[str, int]) -> list[dict[str, Any]]:
        return [
            {"name": name, "count": count}
            for name, count in sorted(values.items(), key=lambda entry: (-entry[1], entry[0].lower()))
        ]

    return {
        "kind": _normalize_asset_kind(kind),
        "categories": to_list(categories),
        "baseModels": to_list(base_models),
        "modelTypes": to_list(model_types),
        "tags": to_list(tags),
        "updated_at": _now(),
    }


def _taxonomy_from_tags(kind: str, items: list[dict[str, Any]]) -> dict[str, Any]:
    def safe_count(value: Any) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return 0

    tags: dict[str, int] = {}
    for item in items:
        if isinstance(item, dict):
            name = _safe_segment(item.get("name") or item.get("tag"), "")
            count = safe_count(item.get("modelCount") or item.get("count") or item.get("models") or 0)
        else:
            name = _safe_segment(item, "")
            count = 0
        if not name:
            continue
        tags[name] = max(tags.get(name, 0), count)
    return {
        "kind": _normalize_asset_kind(kind),
        "categories": [],
        "baseModels": [],
        "modelTypes": [],
        "tags": [
            {"name": name, "count": count}
            for name, count in sorted(tags.items(), key=lambda entry: (-entry[1], entry[0].lower()))
        ],
        "updated_at": _now(),
    }


def _taxonomy_from_base_models(kind: str, values: list[Any]) -> dict[str, Any]:
    base_models: list[dict[str, Any]] = []
    seen: set[str] = set()
    for value in values:
        name = _safe_segment(value, "")
        key = name.lower()
        if not name or key in seen:
            continue
        seen.add(key)
        base_models.append({"name": name, "count": 0})
    return {
        "kind": _normalize_asset_kind(kind),
        "categories": [],
        "baseModels": base_models,
        "modelTypes": [],
        "tags": [],
        "updated_at": _now(),
    }


def _merge_taxonomy(current: dict[str, Any], update: dict[str, Any]) -> dict[str, Any]:
    merged = dict(current or {})
    merged["kind"] = update.get("kind") or merged.get("kind") or "lora"
    merged["updated_at"] = _now()
    for key in ("categories", "baseModels", "modelTypes", "tags"):
        counts: dict[str, int] = {}
        for source in (merged.get(key), update.get(key)):
            if isinstance(source, list):
                for item in source:
                    if not isinstance(item, dict):
                        continue
                    name = _safe_segment(item.get("name"), "Other")
                    counts[name] = max(counts.get(name, 0), int(item.get("count") or 0))
        merged[key] = [
            {"name": name, "count": count}
            for name, count in sorted(counts.items(), key=lambda entry: (-entry[1], entry[0].lower()))
        ]
    return merged


def _merge_taxonomy_cache(kind: str, config: dict[str, Any], items: list[dict[str, Any]]) -> dict[str, Any]:
    update = _taxonomy_from_items(kind, items)
    key = _taxonomy_cache_key(kind, config)
    with _TAXONOMY_LOCK:
        cached = _TAXONOMY_CACHE.get(key)
        current = cached.get("data") if isinstance(cached, dict) and isinstance(cached.get("data"), dict) else _empty_taxonomy(kind)
        merged = _merge_taxonomy(current, update)
        _TAXONOMY_CACHE[key] = {"timestamp": _now(), "data": merged}
    return merged


def _set_taxonomy_cache(kind: str, config: dict[str, Any], items: list[dict[str, Any]]) -> dict[str, Any]:
    data = _taxonomy_from_items(kind, items)
    return _set_taxonomy_cache_data(kind, config, data)


def _set_taxonomy_cache_data(kind: str, config: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
    key = _taxonomy_cache_key(kind, config)
    normalized = _merge_taxonomy(_empty_taxonomy(kind), data)
    with _TAXONOMY_LOCK:
        _TAXONOMY_CACHE[key] = {"timestamp": _now(), "data": normalized}
    return normalized


def _taxonomy_cache_get(kind: str, config: dict[str, Any]) -> dict[str, Any] | None:
    key = _taxonomy_cache_key(kind, config)
    with _TAXONOMY_LOCK:
        cached = _TAXONOMY_CACHE.get(key)
        if cached and _now() - int(cached.get("timestamp") or 0) < TAXONOMY_CACHE_TTL:
            data = cached.get("data")
            return dict(data) if isinstance(data, dict) else None
    return None


def _models_url(params: dict[str, Any]) -> str:
    return f"{CIVITAI_API_BASE}/models?{urllib.parse.urlencode(params)}"


def _cursor_offset_to_page(cursor: str, limit: int) -> str:
    try:
        offset = max(0, int(str(cursor).strip()))
        page_size = max(1, int(limit or 40))
        return str((offset // page_size) + 1)
    except Exception:
        return ""


def _model_params_with_page_cursor(params: dict[str, Any]) -> dict[str, Any]:
    cursor = str(params.get("cursor") or "").strip()
    if not cursor.isdigit():
        return dict(params)
    next_params = dict(params)
    next_params.pop("cursor", None)
    next_params["page"] = _cursor_offset_to_page(cursor, int(str(params.get("limit") or "40")))
    return next_params


def _should_prefer_page_cursor(params: dict[str, Any]) -> bool:
    cursor = str(params.get("cursor") or "").strip()
    if not cursor.isdigit():
        return False
    return bool(params.get("tag") or params.get("category") or params.get("baseModels"))


def _normalize_page_cursor_metadata(result: dict[str, Any] | None, params: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(result, dict) or result.get("error"):
        return result
    metadata = result.get("metadata")
    if not isinstance(metadata, dict):
        metadata = {}
    if metadata.get("nextCursor"):
        return result
    page = str(params.get("page") or "").strip()
    if not page.isdigit():
        return result
    items = result.get("items") if isinstance(result.get("items"), list) else []
    limit = max(1, int(str(params.get("limit") or "40")))
    current_page = int(page)
    total_pages = metadata.get("totalPages")
    has_more = len(items) >= limit
    if isinstance(total_pages, int):
        has_more = current_page < total_pages
    elif isinstance(total_pages, str) and total_pages.isdigit():
        has_more = current_page < int(total_pages)
    if has_more:
        next_result = dict(result)
        next_metadata = dict(metadata)
        next_metadata["nextCursor"] = str(current_page * limit)
        next_result["metadata"] = next_metadata
        return next_result
    return result


def _read_models_json(params: dict[str, Any], api_key: str | None, timeout: int = 30) -> dict[str, Any] | None:
    request_params = _model_params_with_page_cursor(params) if _should_prefer_page_cursor(params) else dict(params)
    result = _read_json_url_with_retries(_models_url(request_params), api_key, timeout, retries=2, quiet=True)
    if _is_invalid_cursor_result(result):
        fallback_params = _model_params_with_page_cursor(params)
        if fallback_params != params:
            result = _read_json_url_with_retries(_models_url(fallback_params), api_key, timeout, retries=1, quiet=True)
            return _normalize_page_cursor_metadata(result, fallback_params)
    return _normalize_page_cursor_metadata(result, request_params)


def _tags_url(params: dict[str, Any]) -> str:
    return f"{CIVITAI_API_BASE}/tags?{urllib.parse.urlencode(params)}"


def _enums_url() -> str:
    return f"{CIVITAI_API_BASE}/enums"


def _build_model_query_params(
    kind: str,
    query: str = "",
    cursor: str = "",
    sort: str = "Highest Rated",
    limit: int = 40,
    config: dict[str, Any] | None = None,
    category: str = "",
    tag: str = "",
    base_model: str = "",
    period: str = "AllTime",
) -> dict[str, str]:
    config = config or load_config()
    params = {
        "limit": str(limit),
        "types": _kind_to_civitai_type(kind),
        "sort": str(sort or "Highest Rated"),
        "period": str(period or "AllTime"),
        "nsfw": "true" if config.get("allow_nsfw") else "false",
        "primaryFileOnly": "true",
    }
    if query.strip():
        params["query"] = query.strip()
    if cursor.strip():
        params["cursor"] = cursor.strip()
    if category.strip():
        params["category"] = category.strip()
    if tag.strip():
        params["tag"] = tag.strip()
    if base_model.strip():
        params["baseModels"] = base_model.strip()
    return params


def _category_matches(model: dict[str, Any], category: str) -> bool:
    clean = _safe_segment(category, "").lower()
    if not clean:
        return True
    return _category_name(model).lower() == clean


def _tag_matches(model: dict[str, Any], tag: str) -> bool:
    clean = _safe_segment(tag, "").lower()
    if not clean:
        return True
    return any(item.lower() == clean for item in _model_tags(model))


def _base_model_matches(model: dict[str, Any], base_model: str) -> bool:
    clean = _safe_segment(base_model, "").lower()
    if not clean:
        return True
    return any(item.lower() == clean for item in _model_base_models(model))


def _search_text_values(model: dict[str, Any]) -> list[str]:
    values: list[str] = [
        model.get("name"),
        model.get("description"),
        model.get("type"),
    ]
    creator = model.get("creator")
    if isinstance(creator, dict):
        values.append(creator.get("username"))
    tags = model.get("tags")
    if isinstance(tags, list):
        values.extend(str(tag) for tag in tags if tag)
    versions = model.get("modelVersions")
    if isinstance(versions, list):
        for version in versions:
            if not isinstance(version, dict):
                continue
            values.extend([
                version.get("name"),
                version.get("baseModel"),
                version.get("description"),
            ])
            trained_words = version.get("trainedWords")
            if isinstance(trained_words, list):
                values.extend(str(word) for word in trained_words if word)
            files = version.get("files")
            if isinstance(files, list):
                values.extend(str(file.get("name")) for file in files if isinstance(file, dict) and file.get("name"))
    return [str(value) for value in values if value]


def _model_text_matches(model: dict[str, Any], *queries: str) -> bool:
    tokens: list[str] = []
    for query in queries:
        clean = re.sub(r"<[^>]+>", " ", str(query or "").lower())
        tokens.extend(token for token in re.split(r"\s+", clean) if token)
    if not tokens:
        return True
    haystack = " ".join(_search_text_values(model)).lower()
    haystack = re.sub(r"<[^>]+>", " ", haystack)
    return all(token in haystack for token in tokens)


def _version_base_model(version: dict[str, Any], model: dict[str, Any]) -> str:
    for value in (
        version.get("baseModel"),
        version.get("baseModelType"),
        model.get("baseModel"),
        model.get("baseModelType"),
    ):
        if value:
            return _safe_segment(value, "Other")
    return "Other"


def _model_type(model: dict[str, Any]) -> str:
    return str(model.get("type") or model.get("modelType") or "").strip()


def _is_workflow(model: dict[str, Any], requested_kind: str = "") -> bool:
    model_type = _model_type(model).lower()
    requested_kind = requested_kind.lower()
    return requested_kind == "workflow" or "workflow" in model_type


def _is_lora(model: dict[str, Any], requested_kind: str = "") -> bool:
    model_type = _model_type(model).lower()
    requested_kind = requested_kind.lower()
    return requested_kind == "lora" or model_type in {"lora", "locon", "lycoris"} or "lora" in model_type


def _is_unet_model(model: dict[str, Any], version: dict[str, Any], file_info: dict[str, Any]) -> bool:
    candidates = [
        model.get("type"),
        model.get("name"),
        model.get("description"),
        version.get("name"),
        version.get("baseModel"),
        version.get("description"),
        file_info.get("name"),
        file_info.get("type"),
        file_info.get("format"),
        file_info.get("pickleScanResult"),
    ]
    metadata = file_info.get("metadata")
    if isinstance(metadata, dict):
        candidates.extend(str(value) for value in metadata.values() if value is not None)
    haystack = " ".join(str(item or "") for item in candidates).lower()
    explicit_tokens = (
        "unet",
        "diffusion model",
        "diffusion_models",
        "diffusion-model",
        "dit model",
        "transformer model",
    )
    return any(token in haystack for token in explicit_tokens)


def _root_kind_for(model: dict[str, Any], version: dict[str, Any], file_info: dict[str, Any], requested_kind: str = "") -> str:
    if _is_workflow(model, requested_kind):
        return "workflows"
    if _is_lora(model, requested_kind):
        return "loras"
    if _is_unet_model(model, version, file_info):
        return "unet"
    return "checkpoints"


def _file_extension_for(root_kind: str, file_info: dict[str, Any]) -> str:
    name = str(file_info.get("name") or "")
    ext = os.path.splitext(name)[1].lower()
    if root_kind == "workflows":
        return ".json"
    if ext in MODEL_EXTENSIONS:
        return ext
    return ".safetensors"


def _filename_for(model: dict[str, Any], version: dict[str, Any], file_info: dict[str, Any], root_kind: str) -> str:
    ext = _file_extension_for(root_kind, file_info)
    if file_info.get("name"):
        return _safe_filename(file_info["name"], "civitai_asset", ext)
    base = " - ".join(part for part in (model.get("name"), version.get("name")) if part)
    return _safe_filename(base, f"civitai_{model.get('id') or version.get('id') or _now()}", ext)


def _download_url_for(version: dict[str, Any], file_info: dict[str, Any]) -> str:
    for key in ("downloadUrl", "download_url", "url"):
        value = file_info.get(key)
        if isinstance(value, str) and value.startswith(("http://", "https://")):
            return _civitai_red_url(value)
    version_id = version.get("id")
    if version_id:
        return f"{CIVITAI_DOWNLOAD_BASE}/{version_id}"
    return ""


def resolve_download_path(
    model: dict[str, Any],
    version: dict[str, Any],
    file_info: dict[str, Any],
    requested_kind: str = "",
    overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    overrides = overrides or {}
    default_root_kind = _normalize_root_kind(_root_kind_for(model, version, file_info, requested_kind))
    root_kind = _normalize_root_kind(overrides.get("root_kind") or default_root_kind)
    _validate_root_transition(default_root_kind, root_kind)

    base_model_dir = _safe_segment(overrides.get("base_model_dir") or _version_base_model(version, model), "Other")
    category_dir = _safe_segment(overrides.get("category_dir") or _category_name(model), "Other")
    default_extension = _file_extension_for(root_kind, file_info)
    override_filename = str(overrides.get("filename") or "").strip()
    if override_filename:
        filename = _safe_filename(override_filename, "civitai_asset", default_extension)
        _validate_asset_filename(root_kind, filename)
    else:
        filename = _filename_for(model, version, file_info, root_kind)
        if os.path.splitext(filename)[1].lower() not in _extensions_for_root(root_kind):
            filename = f"{os.path.splitext(filename)[0]}{default_extension}"
        _validate_asset_filename(root_kind, filename)

    root_dir = _root_for_kind(root_kind)
    if root_kind == "workflows":
        relative_path = os.path.join(category_dir, filename)
    else:
        relative_path = os.path.join(base_model_dir, category_dir, filename)
    absolute_path = _safe_join(root_dir, relative_path)

    return {
        "root_kind": root_kind,
        "root_dir": root_dir,
        "base_model_dir": "" if root_kind == "workflows" else base_model_dir,
        "category_dir": category_dir,
        "filename": filename,
        "relative_path": relative_path.replace("\\", "/"),
        "absolute_path": absolute_path,
        "download_url": _download_url_for(version, file_info),
    }


def _unique_path(path: str) -> str:
    if not os.path.exists(path):
        return path
    base, ext = os.path.splitext(path)
    index = 1
    while True:
        candidate = f"{base} ({index}){ext}"
        if not os.path.exists(candidate):
            return candidate
        index += 1


def _companion_metadata_path(asset_path: str, root_kind: str) -> str:
    base, ext = os.path.splitext(asset_path)
    if root_kind == "workflows" and ext.lower() == ".json":
        return f"{base}.civitai.json"
    return f"{base}.json"


def _companion_preview_path(asset_path: str, image_url: str) -> str:
    ext = ".png"
    lowered = image_url.lower()
    if ".jpg" in lowered or ".jpeg" in lowered:
        ext = ".jpg"
    elif ".webp" in lowered:
        ext = ".webp"
    return os.path.splitext(asset_path)[0] + ext


def _metadata_payload(model: dict[str, Any], version: dict[str, Any], file_info: dict[str, Any], resolution: dict[str, Any]) -> dict[str, Any]:
    creator = model.get("creator") if isinstance(model.get("creator"), dict) else {}
    file_hashes = file_info.get("hashes") if isinstance(file_info.get("hashes"), dict) else {}
    return {
        "source": "civitai",
        "downloaded_at": _now(),
        "model_id": model.get("id"),
        "version_id": version.get("id"),
        "type": model.get("type"),
        "name": model.get("name"),
        "version_name": version.get("name"),
        "creator": creator.get("username") or model.get("username") or "",
        "category": _category_name(model),
        "base_model": _version_base_model(version, model),
        "trained_words": version.get("trainedWords") if isinstance(version.get("trainedWords"), list) else [],
        "tags": model.get("tags") if isinstance(model.get("tags"), list) else [],
        "hashes": file_hashes,
        "resolution": {
            "root_kind": resolution.get("root_kind"),
            "base_model_dir": resolution.get("base_model_dir"),
            "category_dir": resolution.get("category_dir"),
            "filename": resolution.get("filename"),
            "relative_path": resolution.get("relative_path"),
        },
        "model": model,
        "version": version,
        "file": file_info,
    }


def _first_preview_url(version: dict[str, Any], model: dict[str, Any]) -> str:
    for images in (version.get("images"), model.get("images")):
        if isinstance(images, list):
            for image in images:
                url = str(image.get("url") or "") if isinstance(image, dict) else str(image or "")
                media_type = str(image.get("type") or "").lower() if isinstance(image, dict) else ""
                clean_url = url.split("?", 1)[0].lower()
                if not url or "video" in media_type or re.search(r"\.(?:mp4|webm|mov|m4v|avi)$", clean_url):
                    continue
                return url
    return ""


class _SafeDownloadRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Do not forward Civitai credentials to redirected storage hosts."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected is None:
            return None
        source_host = (urllib.parse.urlparse(req.full_url).hostname or "").lower()
        target_host = (urllib.parse.urlparse(newurl).hostname or "").lower()
        if source_host != target_host:
            redirected.remove_header("Authorization")
            redirected.remove_header("Cookie")
        return redirected


_DOWNLOAD_URL_OPENER = urllib.request.build_opener(_SafeDownloadRedirectHandler())


class DownloadCancelled(Exception):
    pass


class DownloadQueueFull(Exception):
    pass


def _download_store() -> DownloadJobStore:
    global _DOWNLOAD_STORE
    if _DOWNLOAD_STORE is not None:
        return _DOWNLOAD_STORE
    with _DOWNLOAD_STORE_LOCK:
        if _DOWNLOAD_STORE is None:
            _DOWNLOAD_STORE = DownloadJobStore(
                os.path.join(_plugin_data_dir(), "downloads.json"),
                history_limit=DOWNLOAD_JOB_HISTORY_LIMIT,
                retention_seconds=DOWNLOAD_JOB_RETENTION_SECONDS,
            )
        return _DOWNLOAD_STORE


def _download_queue_worker() -> None:
    while True:
        task = _DOWNLOAD_QUEUE.get()
        try:
            _download_worker(*task)
        finally:
            _DOWNLOAD_QUEUE.task_done()


def _ensure_download_workers() -> None:
    global _DOWNLOAD_WORKERS_STARTED
    if _DOWNLOAD_WORKERS_STARTED:
        return
    with _DOWNLOAD_WORKERS_LOCK:
        if _DOWNLOAD_WORKERS_STARTED:
            return
        for index in range(DOWNLOAD_MAX_WORKERS):
            worker = threading.Thread(
                target=_download_queue_worker,
                name=f"anima-lora-download-{index + 1}",
                daemon=True,
            )
            worker.start()
        _DOWNLOAD_WORKERS_STARTED = True


DOWNLOAD_HTTP_REASONS = {401: "auth", 404: "not_found", 429: "rate_limited"}


def _download_failure(exc: Exception) -> tuple[str, str]:
    """Classify a failed download for the UI, keeping Civitai's own wording."""
    if isinstance(exc, urllib.error.HTTPError):
        try:
            body = json.loads(exc.read(4096) or b"null")
        except (OSError, ValueError):
            body = None
        body = body if isinstance(body, dict) else {}
        detail = str(body.get("message") or body.get("error") or "").strip()
        message = f"Civitai refused the download: {detail}" if detail and exc.code < 500 else f"HTTP {exc.code}: {exc.reason}"
        if exc.code == 403:
            # Civitai explains refusals such as Early Access in the body; only
            # an unexplained 403 points at the API Key.
            if "early access" in f"{body.get('error') or ''} {detail}".lower():
                return "early_access", message
            return ("forbidden" if detail else "auth"), message
        if exc.code >= 500:
            return "server", message
        return DOWNLOAD_HTTP_REASONS.get(exc.code, "http"), message
    if isinstance(exc, (urllib.error.URLError, TimeoutError, ConnectionError, http.client.HTTPException)):
        return "network", str(getattr(exc, "reason", "") or exc)
    if isinstance(exc, OSError):
        return "disk", str(exc)
    return "unknown", str(exc)


def _download_worker(
    task_id: str,
    download_url: str,
    target_path: str,
    root_kind: str,
    metadata: dict[str, Any],
    preview_url: str,
) -> None:
    temp_path = f"{target_path}.download"
    store = _download_store()
    cancel_event = store.cancel_event(task_id)
    config = load_config()
    api_key = str(config.get("civitai_api_key") or "").strip() or None
    total = 0
    progress = 0

    try:
        if cancel_event.is_set():
            raise DownloadCancelled()
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        req = urllib.request.Request(download_url, headers=_request_headers(api_key, json_content=False))
        with _DOWNLOAD_URL_OPENER.open(req, timeout=60) as resp, open(temp_path, "wb") as handle:
            total = int(resp.headers.get("Content-Length") or 0)
            store.update(task_id, status="downloading", total=total, error="", error_reason="")
            while True:
                if cancel_event.is_set():
                    raise DownloadCancelled()
                chunk = resp.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)
                progress += len(chunk)
                store.update(task_id, persist=False, progress=progress)

        if cancel_event.is_set():
            raise DownloadCancelled()
        final_path = _unique_path(target_path)
        os.replace(temp_path, final_path)
        metadata["saved_path"] = final_path
        metadata["saved_filename"] = os.path.basename(final_path)

        if config.get("save_metadata", True):
            _write_asset_metadata(final_path, root_kind, metadata)
        # The preview is saved before the job reports completion: the library
        # rescan that completion triggers (e.g. to apply the LoRA to a node)
        # must already find it, or the node keeps the "No Preview" placeholder.
        if config.get("save_preview", True) and preview_url:
            try:
                preview_path = _companion_preview_path(final_path, preview_url)
                _download_binary(preview_url, preview_path, api_key=None, timeout=30)
            except Exception as exc:
                print(f"[Anima Tools] Preview download failed: {exc}")

        store.update(
            task_id,
            status="completed",
            progress=total or progress or os.path.getsize(final_path),
            target_path=final_path,
            relative_path=os.path.relpath(final_path, _root_for_kind(root_kind)).replace("\\", "/"),
            completed_at=_now(),
        )
        _LIBRARY_INDEX.invalidate()
    except DownloadCancelled:
        store.update(task_id, status="cancelled", error="", cancelled_at=_now())
    except Exception as exc:
        if cancel_event.is_set():
            store.update(task_id, status="cancelled", error="", cancelled_at=_now())
        else:
            reason, error = _download_failure(exc)
            store.update(task_id, status="failed", error=error, error_reason=reason, failed_at=_now())
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


def _download_binary(url: str, target_path: str, api_key: str | None = None, timeout: int = 30) -> None:
    req = urllib.request.Request(url, headers=_request_headers(api_key, json_content=False))
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        with open(target_path, "wb") as handle:
            shutil.copyfileobj(resp, handle)


def _build_library_snapshot() -> dict[str, Any]:
    return {
        "roots": _root_display(),
        "root_paths": {"loras": _roots_for_kind("loras")},
        "items": _scan_all_library_items(),
        "generated_at": _now(),
    }


def _scan_roots(force: bool = False) -> dict[str, Any]:
    return _LIBRARY_INDEX.get(_build_library_snapshot, force=force)


def _metadata_for_asset(abs_path: str, root_kind: str) -> tuple[str, dict[str, Any]]:
    path = _companion_metadata_path(abs_path, root_kind)
    if not os.path.isfile(path):
        return "missing", {}
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        return "cached", data if isinstance(data, dict) else {}
    except Exception:
        return "invalid", {}


def _write_asset_metadata(abs_path: str, root_kind: str, metadata: dict[str, Any]) -> None:
    path = _companion_metadata_path(abs_path, root_kind)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    temp_path = f"{path}.{uuid.uuid4().hex}.tmp"
    try:
        with open(temp_path, "w", encoding="utf-8") as handle:
            json.dump(metadata, handle, indent=2, ensure_ascii=False)
        os.replace(temp_path, path)
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass


def _preview_for_asset(abs_path: str) -> str:
    base = os.path.splitext(abs_path)[0]
    for ext in IMAGE_EXTENSIONS:
        candidate = base + ext
        if os.path.isfile(candidate):
            return candidate
    return ""


def _civitai_ids_from_metadata(metadata: dict[str, Any]) -> tuple[Any, Any]:
    model = metadata.get("model") if isinstance(metadata.get("model"), dict) else {}
    version = metadata.get("version") if isinstance(metadata.get("version"), dict) else {}
    model_id = (
        metadata.get("model_id")
        or metadata.get("modelId")
        or model.get("id")
        or version.get("modelId")
        or version.get("model_id")
    )
    version_id = metadata.get("version_id") or metadata.get("versionId") or version.get("id")
    return model_id, version_id


def _scan_library_kind(root_kind: str) -> list[dict[str, Any]]:
    extensions = WORKFLOW_EXTENSIONS if root_kind == "workflows" else MODEL_EXTENSIONS
    items: list[dict[str, Any]] = []
    roots = _roots_for_kind(root_kind)
    primary_root = _root_for_kind(root_kind)
    if all(os.path.normcase(os.path.realpath(root)) != os.path.normcase(os.path.realpath(primary_root)) for root in roots):
        roots.insert(0, primary_root)
    for root in roots:
        if not os.path.isdir(root):
            continue
        storage_root_id = _storage_root_id(root)
        for dirpath, _, filenames in os.walk(root):
            for name in filenames:
                ext = os.path.splitext(name)[1].lower()
                if ext not in extensions:
                    continue
                if root_kind == "workflows" and name.endswith(".civitai.json"):
                    continue

                abs_path = os.path.join(dirpath, name)
                rel_path = os.path.relpath(abs_path, root).replace("\\", "/")
                folder_path = os.path.dirname(rel_path).replace("\\", "/")
                metadata_status, metadata = _metadata_for_asset(abs_path, root_kind)
                preview_file = _preview_for_asset(abs_path)
                rel_parts = rel_path.split("/")
                inferred_base = rel_parts[0] if root_kind != "workflows" and len(rel_parts) > 2 else ""
                inferred_category = rel_parts[1] if root_kind != "workflows" and len(rel_parts) > 2 else (rel_parts[0] if root_kind == "workflows" and len(rel_parts) > 1 else "Other")
                resolution = metadata.get("resolution") if isinstance(metadata.get("resolution"), dict) else {}
                hashes = metadata.get("hashes") if isinstance(metadata.get("hashes"), dict) else {}
                model_id, version_id = _civitai_ids_from_metadata(metadata)
                civitai_url = _civitai_red_url(str(metadata.get("civitai_url") or ""))
                if not civitai_url and model_id:
                    civitai_url = f"https://civitai.red/models/{model_id}"
                    if version_id:
                        civitai_url += f"?modelVersionId={version_id}"
                try:
                    stat = os.stat(abs_path)
                except OSError:
                    continue
                preview_version = int(os.path.getmtime(preview_file)) if preview_file else int(stat.st_mtime)
                items.append({
                    "id": f"{root_kind}:{storage_root_id}:{rel_path}",
                    "root_kind": root_kind,
                    "storage_root_id": storage_root_id,
                    "storage_root": root,
                    "name": metadata.get("name") or os.path.splitext(name)[0],
                    "version_name": metadata.get("version_name") or "",
                    "filename": name,
                    "relative_path": rel_path,
                    "folder_path": folder_path,
                    "absolute_path": abs_path,
                    "size": stat.st_size,
                    "mtime": int(stat.st_mtime),
                    "base_model": metadata.get("base_model") or resolution.get("base_model_dir") or inferred_base,
                    "category": metadata.get("category") or resolution.get("category_dir") or inferred_category,
                    "creator": metadata.get("creator") or "",
                    "model_id": model_id,
                    "version_id": version_id,
                    "civitai_url": civitai_url,
                    "metadata_match_status": metadata.get("metadata_match_status") or ("matched" if model_id else "unknown"),
                    "source": metadata.get("source") or "local",
                    "trained_words": metadata.get("trained_words") if isinstance(metadata.get("trained_words"), list) else [],
                    "tags": metadata.get("tags") if isinstance(metadata.get("tags"), list) else [],
                    "hash": hashes.get("SHA256") or hashes.get("sha256") or metadata.get("sha256") or "",
                    "favorite": bool(metadata.get("favorite")),
                    "metadata_status": metadata_status,
                    "has_preview": bool(preview_file),
                    "thumb_url": f"{API_PREFIX}/local-preview?root_kind={urllib.parse.quote(root_kind)}&root_id={urllib.parse.quote(storage_root_id)}&path={urllib.parse.quote(rel_path)}&v={preview_version}",
                })
    return items


def _scan_all_library_items() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    items.extend(_scan_library_kind("loras"))

    by_hash: dict[str, list[dict[str, Any]]] = {}
    for item in items:
        item_hash = str(item.get("hash") or "").lower()
        if item_hash:
            by_hash.setdefault(item_hash, []).append(item)
    for group in by_hash.values():
        if len(group) > 1:
            for item in group:
                item["duplicate_count"] = len(group)
    return sorted(items, key=lambda item: (item["root_kind"], item.get("storage_root", "").lower(), item["relative_path"].lower()))


def _resolve_asset_path(root_kind: str, rel_path: str, storage_root_id: Any = "") -> str:
    root_kind = _normalize_root_kind(root_kind)
    root = _storage_root_for_asset(root_kind, storage_root_id)
    rel_path = str(rel_path or "").replace("\\", "/").lstrip("/")
    abs_path = _safe_join(root, rel_path)
    _validate_asset_filename(root_kind, os.path.basename(abs_path))
    return abs_path


def _companion_move_pairs(
    src_path: str,
    dst_path: str,
    source_root_kind: str,
    target_root_kind: str,
) -> list[tuple[str, str]]:
    companions = [(
        _companion_metadata_path(src_path, source_root_kind),
        _companion_metadata_path(dst_path, target_root_kind),
    )]
    for ext in IMAGE_EXTENSIONS:
        companions.append((os.path.splitext(src_path)[0] + ext, os.path.splitext(dst_path)[0] + ext))
    return [(src, dst) for src, dst in companions if os.path.isfile(src)]


def _move_asset_bundle(
    src_path: str,
    dst_path: str,
    source_root_kind: str,
    target_root_kind: str,
) -> None:
    moves = [(src_path, dst_path), *_companion_move_pairs(
        src_path,
        dst_path,
        source_root_kind,
        target_root_kind,
    )]
    for _, dst in moves:
        if os.path.exists(dst):
            raise FileExistsError(f"Target already exists: {dst}")

    completed: list[tuple[str, str]] = []
    try:
        for src, dst in moves:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.move(src, dst)
            completed.append((src, dst))
    except Exception:
        for src, dst in reversed(completed):
            if os.path.exists(dst) and not os.path.exists(src):
                try:
                    os.makedirs(os.path.dirname(src), exist_ok=True)
                    shutil.move(dst, src)
                except Exception as rollback_exc:
                    print(f"[Anima Tools] Failed to roll back move {dst}: {rollback_exc}")
        raise


def _update_moved_asset_metadata(
    dst_path: str,
    target_root_kind: str,
    relative_path: str,
    base_model_dir: str,
    category_dir: str,
    filename: str,
) -> None:
    status, metadata = _metadata_for_asset(dst_path, target_root_kind)
    if status != "cached":
        return
    resolution = metadata.get("resolution") if isinstance(metadata.get("resolution"), dict) else {}
    resolution.update({
        "root_kind": target_root_kind,
        "base_model_dir": "" if target_root_kind == "workflows" else base_model_dir,
        "category_dir": category_dir,
        "filename": filename,
        "relative_path": relative_path,
    })
    metadata["resolution"] = resolution
    _write_asset_metadata(dst_path, target_root_kind, metadata)


def _delete_companions(asset_path: str, root_kind: str) -> None:
    for path in [_companion_metadata_path(asset_path, root_kind), *[os.path.splitext(asset_path)[0] + ext for ext in IMAGE_EXTENSIONS]]:
        if os.path.isfile(path):
            try:
                os.remove(path)
            except Exception as exc:
                print(f"[Anima Tools] Failed to delete companion {path}: {exc}")


def _hash_file(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _metadata_from_hash(sha256: str) -> dict[str, Any] | None:
    config = load_config()
    api_key = str(config.get("civitai_api_key") or "").strip() or None
    url = f"{CIVITAI_API_BASE}/model-versions/by-hash/{urllib.parse.quote(sha256)}"
    data = _read_json_url_with_retries(url, api_key=api_key, timeout=30, retries=1)
    if not data or data.get("error"):
        return None
    return data


def _stored_sha256(metadata: dict[str, Any]) -> str:
    hashes = metadata.get("hashes") if isinstance(metadata.get("hashes"), dict) else {}
    for value in (hashes.get("SHA256"), hashes.get("sha256"), metadata.get("sha256")):
        clean = str(value or "").strip().lower()
        if re.fullmatch(r"[0-9a-f]{64}", clean):
            return clean
    return ""


def _complete_civitai_model(version: dict[str, Any]) -> dict[str, Any]:
    summary = version.get("model") if isinstance(version.get("model"), dict) else {}
    model_id = summary.get("id") or version.get("modelId") or version.get("model_id")
    if not model_id:
        return summary
    summary = {**summary, "id": model_id}
    config = load_config()
    api_key = str(config.get("civitai_api_key") or "").strip() or None
    url = f"{CIVITAI_API_BASE}/models/{urllib.parse.quote(str(model_id))}"
    full = _read_json_url_with_retries(url, api_key=api_key, timeout=30, retries=1, quiet=True)
    if not full or full.get("error"):
        return summary
    return {**summary, **full}


def _enrich_metadata_worker(abs_path: str, root_kind: str) -> dict[str, Any]:
    """Hash and enrich one asset entirely off the asyncio event-loop thread."""
    with _HASH_METADATA_LOCK:
        existing_status, existing = _metadata_for_asset(abs_path, root_kind)
        metadata = existing if existing_status in {"cached", "invalid"} else {}
        sha256 = _stored_sha256(metadata) or _hash_file(abs_path)
        civitai_data = _metadata_from_hash(sha256)
        metadata.update({
            "source": metadata.get("source") or "local",
            "sha256": sha256,
            "hashes": {
                **(metadata.get("hashes") if isinstance(metadata.get("hashes"), dict) else {}),
                "SHA256": sha256.upper(),
            },
            "metadata_enriched_at": _now(),
            "metadata_checked_at": _now(),
            "metadata_match_status": "matched" if civitai_data else "not_found",
        })
        preview_saved = bool(_preview_for_asset(abs_path))
        preview_error = ""
        if civitai_data:
            model = _complete_civitai_model(civitai_data)
            preview_url = _first_preview_url(civitai_data, model)
            metadata.update({
                "source": "civitai",
                "model_id": model.get("id") or metadata.get("model_id"),
                "version_id": civitai_data.get("id") or metadata.get("version_id"),
                "type": model.get("type") or metadata.get("type"),
                "name": model.get("name") or metadata.get("name"),
                "version_name": civitai_data.get("name") or metadata.get("version_name"),
                "creator": (model.get("creator") or {}).get("username")
                if isinstance(model.get("creator"), dict)
                else metadata.get("creator", ""),
                "category": _category_name(model) if model else metadata.get("category", "Other"),
                "base_model": civitai_data.get("baseModel") or metadata.get("base_model"),
                "trained_words": civitai_data.get("trainedWords")
                if isinstance(civitai_data.get("trainedWords"), list)
                else metadata.get("trained_words", []),
                "tags": model.get("tags") if isinstance(model.get("tags"), list) else metadata.get("tags", []),
                "description": model.get("description") or metadata.get("description", ""),
                "preview_url": preview_url or metadata.get("preview_url", ""),
                "civitai_url": f"https://civitai.red/models/{model.get('id')}?modelVersionId={civitai_data.get('id')}"
                if model.get("id")
                else metadata.get("civitai_url", ""),
                "model": model or metadata.get("model", {}),
                "version": civitai_data,
            })
        _write_asset_metadata(abs_path, root_kind, metadata)
        if civitai_data and not preview_saved and load_config().get("save_preview", True):
            preview_url = str(metadata.get("preview_url") or "")
            if preview_url:
                try:
                    optimized_url = _civitai_media_cache_url(preview_url, REMOTE_IMAGE_CACHE_WIDTH_DEFAULT)
                    preview_path = _companion_preview_path(abs_path, optimized_url)
                    _download_binary(optimized_url, preview_path, api_key=None, timeout=30)
                    preview_saved = True
                except Exception as exc:
                    preview_error = str(exc)
        return {
            "sha256": sha256,
            "metadata": metadata,
            "matched": bool(civitai_data),
            "preview_saved": preview_saved,
            "preview_error": preview_error,
        }


def _cache_dir(name: str) -> str:
    path = os.path.join(_plugin_data_dir(), name)
    os.makedirs(path, exist_ok=True)
    return path


def _search_base_model_text_fallback(
    kind: str,
    query: str,
    tag: str,
    category: str,
    base_model: str,
    sort: str,
    limit: int,
    cursor: str,
    config: dict[str, Any],
    api_key: str | None,
    existing_ids: set[str] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if limit <= 0:
        return [], {}
    existing_ids = existing_ids or set()
    collected: list[dict[str, Any]] = []
    metadata: dict[str, Any] = {}
    current_cursor = cursor
    pages = 0
    while pages < SEARCH_FALLBACK_MAX_PAGES and len(collected) < limit:
        params = _build_model_query_params(
            kind,
            query="",
            cursor=current_cursor,
            sort=sort,
            limit=100,
            config=config,
            category="",
            tag="",
            base_model=base_model,
        )
        result = _read_models_json(params, api_key, 30)
        if not result or (isinstance(result, dict) and result.get("error")):
            break
        page_items = result.get("items") if isinstance(result.get("items"), list) else []
        page_items = [item for item in page_items if isinstance(item, dict)]
        if page_items:
            _merge_taxonomy_cache(kind, config, page_items)
        for item in page_items:
            item_id = str(item.get("id") or "")
            if item_id in existing_ids:
                continue
            if not _base_model_matches(item, base_model):
                continue
            if not _model_text_matches(item, query, tag, category):
                continue
            existing_ids.add(item_id)
            collected.append(item)
            if len(collected) >= limit:
                break
        metadata = result.get("metadata") if isinstance(result.get("metadata"), dict) else {}
        next_cursor = str(metadata.get("nextCursor") or "")
        pages += 1
        if not next_cursor:
            metadata = {}
            break
        current_cursor = next_cursor
    if current_cursor and metadata.get("nextCursor"):
        metadata = dict(metadata)
        metadata["nextCursor"] = f"{SEARCH_FALLBACK_CURSOR_PREFIX}{metadata['nextCursor']}"
    return collected, metadata


def _pick(source: Any, fields: tuple[str, ...]) -> dict[str, Any]:
    return {field: source[field] for field in fields if field in source} if isinstance(source, dict) else {}


def _search_card(model: dict[str, Any]) -> dict[str, Any]:
    card = _pick(model, SEARCH_MODEL_FIELDS)
    creator = model.get("creator")
    if isinstance(creator, dict):
        card["creator"] = {"username": creator.get("username")}
    versions = []
    for index, version in enumerate(model.get("modelVersions") or []):
        if not isinstance(version, dict):
            continue
        slim = _pick(version, SEARCH_VERSION_FIELDS)
        images = [_pick(image, SEARCH_IMAGE_FIELDS) for image in version.get("images") or [] if isinstance(image, dict)]
        slim["images"] = images[:SEARCH_PRIMARY_IMAGE_LIMIT if index == 0 else 1]
        slim["files"] = [_pick(file, SEARCH_FILE_FIELDS) for file in version.get("files") or [] if isinstance(file, dict)]
        versions.append(slim)
    card["modelVersions"] = versions
    return card


def _search_civitai_models(
    kind: str,
    query: str,
    cursor: str,
    sort: str,
    limit: int,
    tag: str,
    base_model: str,
    category: str,
    config: dict[str, Any],
) -> dict[str, Any]:
    api_key = str(config.get("civitai_api_key") or "").strip() or None
    category = _safe_segment(category, "") if category else ""
    tag = _safe_segment(tag, "") if tag else ""
    base_model = _safe_segment(base_model, "") if base_model else ""
    if category.lower() == "other":
        category = ""
    api_tag = tag or category
    collected: list[dict[str, Any]] = []
    warning = ""
    metadata: dict[str, Any] = {}
    attempted: set[tuple[str, str, str]] = set()
    fallback_cursor = ""
    attempt_index = 0
    if cursor.startswith(SEARCH_FALLBACK_CURSOR_PREFIX):
        fallback_cursor = cursor[len(SEARCH_FALLBACK_CURSOR_PREFIX):]
        cursor = ""
    elif cursor.startswith(SEARCH_ATTEMPT_CURSOR_PREFIX):
        index_text, _, cursor = cursor[len(SEARCH_ATTEMPT_CURSOR_PREFIX):].partition(":")
        attempt_index = int(index_text) if index_text.isdigit() else 0

    def add_attempt(attempts: list[tuple[str, str, str]], attempt_query: str, attempt_tag: str, attempt_base: str) -> None:
        key = (attempt_query.strip(), attempt_tag.strip(), attempt_base.strip())
        if key in attempted:
            return
        attempted.add(key)
        attempts.append(key)

    attempts: list[tuple[str, str, str]] = []
    if not fallback_cursor:
        add_attempt(attempts, query, api_tag, base_model)
        if query and api_tag:
            add_attempt(attempts, query, "", base_model)
        if query and not api_tag:
            add_attempt(attempts, "", query, base_model)
        if query and api_tag:
            add_attempt(attempts, "", api_tag, base_model)
    if cursor:
        # Later pages continue the attempt that produced the first page.
        attempts = attempts[attempt_index:attempt_index + 1]
    else:
        attempt_index = 0

    for index, (attempt_query, attempt_tag, attempt_base) in enumerate(attempts, start=attempt_index):
        fetch_limit = 100 if base_model else limit
        params = _build_model_query_params(
            kind,
            attempt_query,
            cursor,
            sort,
            fetch_limit,
            config,
            "",
            attempt_tag,
            attempt_base,
        )
        result = _read_models_json(params, api_key, 30)
        if not result:
            warning = "Empty response from Civitai"
            continue
        if isinstance(result, dict) and result.get("error"):
            warning = str(result.get("error") or "")
            continue

        page_items = result.get("items") if isinstance(result.get("items"), list) else []
        page_items = [item for item in page_items if isinstance(item, dict)]
        if attempt_tag and not attempt_query and attempt_tag == query.strip():
            # Civitai ignores unknown tags, so a query retried as a tag must
            # still match the query or the page is just the unfiltered listing.
            page_items = [item for item in page_items if _model_text_matches(item, query)]
        if page_items:
            metadata = result.get("metadata") if isinstance(result.get("metadata"), dict) else {}
            if index and metadata.get("nextCursor"):
                metadata = {**metadata, "nextCursor": f"{SEARCH_ATTEMPT_CURSOR_PREFIX}{index}:{metadata['nextCursor']}"}
            _merge_taxonomy_cache(kind, config, page_items)
            if base_model:
                page_items = [item for item in page_items if _base_model_matches(item, base_model)]
            collected.extend(page_items)
            warning = ""
            if collected or not base_model:
                break

    should_fallback = base_model and (query or tag or category) and len(collected) < limit
    if should_fallback:
        existing_ids = {str(item.get("id")) for item in collected}
        fallback_items, fallback_metadata = _search_base_model_text_fallback(
            kind,
            query,
            tag,
            category,
            base_model,
            sort,
            limit - len(collected),
            fallback_cursor,
            config,
            api_key,
            existing_ids,
        )
        if fallback_items:
            collected.extend(fallback_items)
            metadata = fallback_metadata
            warning = ""
        elif fallback_metadata:
            metadata = fallback_metadata

    taxonomy = _taxonomy_cache_get(kind, config) or _empty_taxonomy(kind)
    response = {
        "items": [_search_card(item) for item in collected[:limit]],
        "metadata": metadata or {},
        "taxonomy": taxonomy,
        "content_filter_active": not bool(config.get("allow_nsfw", False)),
    }
    if warning:
        response["warning"] = warning
    return response


def _load_taxonomy(kind: str, config: dict[str, Any], force: bool = False) -> dict[str, Any]:
    cached = None if force else _taxonomy_cache_get(kind, config)
    if cached:
        return cached

    api_key = str(config.get("civitai_api_key") or "").strip() or None
    params = _build_model_query_params(kind, sort="Highest Rated", limit=100, config=config)
    with ThreadPoolExecutor(max_workers=3) as pool:
        models_request = pool.submit(_read_models_json, params, api_key, 30)
        enums_request = pool.submit(_read_json_url, _enums_url(), api_key, 30)
        tags_request = pool.submit(_read_json_url, _tags_url({"limit": "200"}), api_key, 30)
        result = models_request.result()
        enums_result = enums_request.result()
        tag_result = tags_request.result()
    if not result or result.get("error"):
        stale_key = _taxonomy_cache_key(kind, config)
        with _TAXONOMY_LOCK:
            stale = _TAXONOMY_CACHE.get(stale_key, {}).get("data")
        taxonomy = dict(stale) if isinstance(stale, dict) else _empty_taxonomy(kind)
        taxonomy["warning"] = result.get("error") if isinstance(result, dict) else "Failed to load taxonomy"
    else:
        items = result.get("items") if isinstance(result.get("items"), list) else []
        items = [item for item in items if isinstance(item, dict)]
        taxonomy = _taxonomy_from_items(kind, items)

    if isinstance(enums_result, dict) and not enums_result.get("error"):
        base_models = enums_result.get("BaseModel")
        if isinstance(base_models, list):
            taxonomy = _merge_taxonomy(taxonomy, _taxonomy_from_base_models(kind, base_models))

    if isinstance(tag_result, dict) and not tag_result.get("error"):
        tag_items = tag_result.get("items") if isinstance(tag_result.get("items"), list) else []
        taxonomy = _merge_taxonomy(taxonomy, _taxonomy_from_tags(kind, tag_items))
    return _set_taxonomy_cache_data(kind, config, taxonomy)


def _placeholder_svg(text: str = "No Preview") -> web.Response:
    body = f"""<svg xmlns="http://www.w3.org/2000/svg" width="450" height="600" viewBox="0 0 450 600">
<rect width="450" height="600" fill="#16181d"/>
<rect x="24" y="24" width="402" height="552" rx="8" fill="#20242c" stroke="#3a404b"/>
<text x="225" y="300" fill="#9aa3b2" font-family="Arial, sans-serif" font-size="24" text-anchor="middle">{text}</text>
</svg>"""
    return web.Response(body=body.encode("utf-8"), content_type="image/svg+xml", headers={"Cache-Control": "public, max-age=3600"})


async def get_config_api(request: web.Request) -> web.Response:
    config = load_config()
    return web.json_response(_public_config(config))


async def save_config_api(request: web.Request) -> web.Response:
    try:
        body = await request.json()
        if not isinstance(body, dict):
            return web.json_response({"success": False, "error": "Config payload must be an object"}, status=400)
        config = await asyncio.to_thread(save_config, body)
        return web.json_response({"success": True, "config": _public_config(config)})
    except ValueError as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=400)
    except Exception as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=500)


async def roots_api(request: web.Request) -> web.Response:
    return web.json_response(_root_display())


async def taxonomy_api(request: web.Request) -> web.Response:
    try:
        config = load_config()
        kind = _normalize_asset_kind(request.query.get("kind", "lora"))
        force = request.query.get("force", "").lower() in {"1", "true", "yes"}
        data = await asyncio.to_thread(_load_taxonomy, kind, config, force)
        return web.json_response(data)
    except Exception as exc:
        return web.json_response(_empty_taxonomy(request.query.get("kind", "lora"), str(exc)))


async def search_api(request: web.Request) -> web.Response:
    try:
        config = load_config()
        kind = _normalize_asset_kind(request.query.get("kind", "lora"))
        query = request.query.get("query", "")
        cursor = request.query.get("cursor", "")
        sort = request.query.get("sort", "Highest Rated")
        category = request.query.get("category", "")
        tag = request.query.get("tag", "")
        base_model = request.query.get("base_model") or request.query.get("baseModel") or request.query.get("baseModels") or ""
        limit = max(1, min(int(request.query.get("limit", "40")), 100))
        cache_key = (
            kind,
            query,
            cursor,
            sort,
            limit,
            tag,
            base_model,
            category,
            bool(config.get("allow_nsfw", True)),
            bool(str(config.get("civitai_api_key") or "").strip()),
        )
        now = _now()
        with _SEARCH_RESULT_CACHE_LOCK:
            cached = _SEARCH_RESULT_CACHE.get(cache_key)
            if cached and now - int(cached.get("timestamp") or 0) < SEARCH_RESULT_CACHE_TTL:
                return web.json_response(cached["data"])
        result = await asyncio.to_thread(
            _search_civitai_models,
            kind,
            query,
            cursor,
            sort,
            limit,
            tag,
            base_model,
            category,
            config,
        )
        if isinstance(result, dict) and not result.get("error"):
            with _SEARCH_RESULT_CACHE_LOCK:
                stale_keys = [
                    key for key, value in _SEARCH_RESULT_CACHE.items()
                    if now - int(value.get("timestamp") or 0) >= SEARCH_RESULT_CACHE_TTL
                ]
                for key in stale_keys:
                    _SEARCH_RESULT_CACHE.pop(key, None)
                if len(_SEARCH_RESULT_CACHE) >= SEARCH_RESULT_CACHE_LIMIT:
                    oldest_key = min(
                        _SEARCH_RESULT_CACHE,
                        key=lambda key: int(_SEARCH_RESULT_CACHE[key].get("timestamp") or 0),
                    )
                    _SEARCH_RESULT_CACHE.pop(oldest_key, None)
                _SEARCH_RESULT_CACHE[cache_key] = {"timestamp": now, "data": result}
        return web.json_response(result)
    except Exception as exc:
        return web.json_response({"items": [], "metadata": {}, "error": str(exc)}, status=500)


async def test_api_api(request: web.Request) -> web.Response:
    try:
        config = load_config()
        api_key = str(config.get("civitai_api_key") or "").strip() or None
        params = _build_model_query_params("lora", limit=1, config=config)
        result = await asyncio.to_thread(_read_json_url, _models_url(params), api_key, 20)
        if not result or result.get("error"):
            return web.json_response({
                "success": False,
                "api_key_set": bool(api_key),
                "error": result.get("error") if isinstance(result, dict) else "No response from Civitai red",
            })
        return web.json_response({
            "success": True,
            "api_key_set": bool(api_key),
            "count": len(result.get("items") if isinstance(result.get("items"), list) else []),
        })
    except Exception as exc:
        return web.json_response({"success": False, "error": str(exc), "api_key_set": bool(load_config().get("civitai_api_key"))})


async def model_detail_api(request: web.Request) -> web.Response:
    try:
        model_id = str(request.query.get("id", "")).strip()
        if not model_id:
            return web.json_response({"success": False, "error": "Missing model id"}, status=400)
        api_key = str(load_config().get("civitai_api_key") or "").strip() or None
        cache_key = (model_id, _api_key_cache_part(api_key))
        now = _now()
        with _MODEL_DETAIL_CACHE_LOCK:
            cached = _MODEL_DETAIL_CACHE.get(cache_key)
        if cached and now - cached["timestamp"] < MODEL_DETAIL_CACHE_TTL:
            return web.json_response({"success": True, "model": cached["model"]})
        url = f"{CIVITAI_API_BASE}/models/{urllib.parse.quote(model_id)}"
        data = await asyncio.to_thread(_read_json_url, url, api_key, 30)
        if not data or data.get("error"):
            return web.json_response({"success": False, "error": data.get("error") if data else "Model not found"}, status=404)
        with _MODEL_DETAIL_CACHE_LOCK:
            if len(_MODEL_DETAIL_CACHE) >= MODEL_DETAIL_CACHE_LIMIT:
                _MODEL_DETAIL_CACHE.pop(min(_MODEL_DETAIL_CACHE, key=lambda key: _MODEL_DETAIL_CACHE[key]["timestamp"]), None)
            _MODEL_DETAIL_CACHE[cache_key] = {"timestamp": now, "model": data}
        return web.json_response({"success": True, "model": data})
    except Exception as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=500)


async def resolve_path_api(request: web.Request) -> web.Response:
    try:
        body = await request.json()
        model = body.get("model") if isinstance(body.get("model"), dict) else {}
        version = body.get("version") if isinstance(body.get("version"), dict) else {}
        file_info = body.get("file") if isinstance(body.get("file"), dict) else {}
        requested_kind = str(body.get("kind") or "")
        overrides = body.get("overrides") if isinstance(body.get("overrides"), dict) else {}
        resolution = resolve_download_path(model, version, file_info, requested_kind, overrides)
        resolution["exists"] = os.path.exists(resolution["absolute_path"])
        return web.json_response({"success": True, "resolution": resolution})
    except ValueError as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=400)
    except Exception as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=500)


def _enqueue_download_request(body: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    model = body.get("model") if isinstance(body.get("model"), dict) else {}
    version = body.get("version") if isinstance(body.get("version"), dict) else {}
    file_info = body.get("file") if isinstance(body.get("file"), dict) else {}
    requested_kind = str(body.get("kind") or "")
    overrides = body.get("overrides") if isinstance(body.get("overrides"), dict) else {}
    resolution = resolve_download_path(model, version, file_info, requested_kind, overrides)
    download_url = _civitai_red_url(str(body.get("download_url") or resolution.get("download_url") or ""))
    if not download_url or not _validate_civitai_https(download_url):
        raise ValueError("Only Civitai HTTPS downloads are supported")

    store = _download_store()
    _ensure_download_workers()
    task_id = str(uuid.uuid4())
    metadata = _metadata_payload(model, version, file_info, resolution)
    preview_url = _first_preview_url(version, model)
    retry_payload = {
        "kind": requested_kind,
        "model": model,
        "version": version,
        "file": file_info,
        "overrides": overrides,
        "download_url": download_url,
    }
    added = store.add_if_capacity({
        "id": task_id,
        "status": "pending",
        "progress": 0,
        "total": 0,
        "error": "",
        "root_kind": resolution["root_kind"],
        "target_path": resolution["absolute_path"],
        "relative_path": resolution["relative_path"],
        "filename": resolution["filename"],
        "model_id": model.get("id") or "",
        "version_id": version.get("id") or "",
        "model_name": str(model.get("name") or ""),
        "model_type": str(model.get("type") or ""),
        "version_name": str(version.get("name") or ""),
        "base_model": str(version.get("baseModel") or model.get("baseModel") or ""),
        "file_size": int(float(file_info.get("sizeKB") or 0) * 1024),
        "preview_url": preview_url or "",
        "created_at": _now(),
    }, retry_payload, DOWNLOAD_MAX_ACTIVE_JOBS)
    if not added:
        raise DownloadQueueFull(f"Download queue is full ({DOWNLOAD_MAX_ACTIVE_JOBS} active jobs)")
    try:
        _DOWNLOAD_QUEUE.put_nowait((
            task_id,
            download_url,
            resolution["absolute_path"],
            resolution["root_kind"],
            metadata,
            preview_url,
        ))
    except queue.Full as exc:
        store.remove(task_id)
        raise DownloadQueueFull("Download queue is full") from exc
    return task_id, resolution


async def download_api(request: web.Request) -> web.Response:
    try:
        body = await request.json()
        if not isinstance(body, dict):
            raise ValueError("Download payload must be an object")
        task_id, resolution = _enqueue_download_request(body)
        return web.json_response({"success": True, "task_id": task_id, "resolution": resolution})
    except DownloadQueueFull as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=429)
    except ValueError as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=400)
    except Exception as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=500)


async def download_status_api(request: web.Request) -> web.Response:
    task_id = request.query.get("task_id", "")
    return web.json_response(_download_store().snapshot(task_id))


async def cancel_download_api(request: web.Request) -> web.Response:
    try:
        body = await request.json()
        task_id = str(body.get("task_id") or "") if isinstance(body, dict) else ""
        if not task_id:
            raise ValueError("Missing task_id")
        job = _download_store().request_cancel(task_id)
        if not job:
            return web.json_response({"success": False, "error": "Download is not active"}, status=409)
        return web.json_response({"success": True, "job": job})
    except ValueError as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=400)
    except Exception as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=500)


async def retry_download_api(request: web.Request) -> web.Response:
    try:
        body = await request.json()
        task_id = str(body.get("task_id") or "") if isinstance(body, dict) else ""
        if not task_id:
            raise ValueError("Missing task_id")
        payload = _download_store().retry_payload(task_id)
        if not payload:
            return web.json_response({"success": False, "error": "Download is not retryable"}, status=409)
        new_task_id, resolution = _enqueue_download_request(payload)
        return web.json_response({
            "success": True,
            "task_id": new_task_id,
            "retry_of": task_id,
            "resolution": resolution,
        })
    except DownloadQueueFull as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=429)
    except ValueError as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=400)
    except Exception as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=500)


async def remove_download_api(request: web.Request) -> web.Response:
    try:
        body = await request.json()
        if not isinstance(body, dict):
            raise ValueError("Download removal payload must be an object")
        task_id = str(body.get("task_id") or "")
        task_ids = body.get("task_ids")
        if task_id and task_ids is not None:
            raise ValueError("Provide task_id or task_ids, not both")
        if task_ids is not None and not isinstance(task_ids, list):
            raise ValueError("task_ids must be an array")
        store = _download_store()
        removed = (
            store.remove_finished_many([str(item) for item in task_ids if str(item)])
            if task_ids is not None
            else store.remove_finished(task_id)
        )
        if task_id and not removed:
            job = store.snapshot(task_id)
            if job.get("status") == "not_found":
                return web.json_response({"success": False, "error": "Download record not found"}, status=404)
            return web.json_response({"success": False, "error": "Active downloads cannot be removed"}, status=409)
        return web.json_response({"success": True, "removed": removed})
    except ValueError as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=400)
    except Exception as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=500)


async def library_api(request: web.Request) -> web.Response:
    try:
        force = request.query.get("force", "").lower() in {"1", "true", "yes"}
        data = await asyncio.to_thread(_scan_roots, force)
        return web.json_response(data)
    except Exception as exc:
        return web.json_response({"roots": _root_display(), "items": [], "error": str(exc)}, status=500)


def _update_local_favorite_metadata(item: dict[str, Any], favorite: bool) -> None:
    local = item.get("local") if isinstance(item.get("local"), dict) else {}
    root_kind = str(local.get("root_kind") or "")
    relative_path = str(local.get("relative_path") or "")
    if not root_kind or not relative_path:
        return
    try:
        abs_path = _resolve_asset_path(root_kind, relative_path, local.get("storage_root_id"))
    except ValueError:
        return
    if not os.path.isfile(abs_path):
        return
    status, metadata = _metadata_for_asset(abs_path, root_kind)
    if status == "missing":
        metadata = {
            "source": "local",
            "name": item.get("name") or os.path.splitext(os.path.basename(abs_path))[0],
            "resolution": {"root_kind": root_kind, "relative_path": relative_path},
        }
    metadata["favorite"] = favorite
    metadata["favorite_updated_at"] = _now()
    _write_asset_metadata(abs_path, root_kind, metadata)
    _LIBRARY_INDEX.invalidate()


async def favorites_api(_request: web.Request) -> web.Response:
    try:
        return web.json_response(await asyncio.to_thread(_load_favorites))
    except Exception as exc:
        return web.json_response({"folders": [], "items": [], "error": str(exc)}, status=500)


async def favorite_item_api(request: web.Request) -> web.Response:
    try:
        body = await request.json()
        if not isinstance(body, dict) or not isinstance(body.get("item"), dict):
            raise ValueError("Favorite item is required")
        favorite = _config_bool(body.get("favorite"), "favorite", True)
        folder_id = str(body.get("folder_id") or "") if "folder_id" in body else None
        normalized = _normalize_favorite_item(body["item"])
        store = await asyncio.to_thread(_mutate_favorite_item, normalized, favorite, folder_id)
        await asyncio.to_thread(_update_local_favorite_metadata, normalized, favorite)
        return web.json_response({"success": True, **store})
    except ValueError as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=400)
    except Exception as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=500)


def _mutate_favorite_folder(action: str, folder_id: str, name: str) -> dict[str, Any]:
    with _FAVORITES_LOCK:
        store = _load_favorites_unlocked()
        folders = store["folders"]
        if action == "create":
            clean_name = _favorite_folder_name(name)
            if any(folder["name"].casefold() == clean_name.casefold() for folder in folders):
                raise ValueError("Favorite folder already exists")
            folders.append({
                "id": uuid.uuid4().hex,
                "name": clean_name,
                "created_at": _now(),
                "updated_at": _now(),
            })
        elif action == "rename":
            clean_name = _favorite_folder_name(name)
            folder = next((entry for entry in folders if entry["id"] == folder_id), None)
            if not folder:
                raise ValueError("Favorite folder not found")
            if any(entry["id"] != folder_id and entry["name"].casefold() == clean_name.casefold() for entry in folders):
                raise ValueError("Favorite folder already exists")
            folder["name"] = clean_name
            folder["updated_at"] = _now()
        elif action == "delete":
            if not any(folder["id"] == folder_id for folder in folders):
                raise ValueError("Favorite folder not found")
            store["folders"] = [folder for folder in folders if folder["id"] != folder_id]
            for item in store["items"]:
                if item.get("folder_id") == folder_id:
                    item["folder_id"] = ""
                    item["updated_at"] = _now()
        else:
            raise ValueError("Invalid favorite folder action")
        store["updated_at"] = _now()
        _write_favorites_unlocked(store)
        return _favorite_store_response(store)


async def favorite_folder_api(request: web.Request) -> web.Response:
    try:
        body = await request.json()
        if not isinstance(body, dict):
            raise ValueError("Favorite folder payload must be an object")
        action = str(body.get("action") or "").strip().lower()
        folder_id = str(body.get("folder_id") or "").strip()
        name = str(body.get("name") or "")
        store = await asyncio.to_thread(_mutate_favorite_folder, action, folder_id, name)
        return web.json_response({"success": True, **store})
    except ValueError as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=400)
    except Exception as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=500)


async def local_preview_api(request: web.Request) -> web.StreamResponse:
    try:
        root_kind = request.query.get("root_kind", "")
        storage_root_id = request.query.get("root_id", "")
        rel_path = request.query.get("path", "")
        abs_path = _resolve_asset_path(root_kind, rel_path, storage_root_id)
        preview_file = _preview_for_asset(abs_path)
        if preview_file and os.path.isfile(preview_file):
            resp = web.FileResponse(preview_file)
            resp.headers["Cache-Control"] = "public, max-age=86400"
            return resp
        return _placeholder_svg()
    except Exception:
        return _placeholder_svg()


def _snap_remote_image_width(width: int) -> int:
    for common_width in REMOTE_IMAGE_COMMON_WIDTHS:
        if width <= common_width:
            return common_width
    return width


def _civitai_media_cache_url(source_url: str, width: int) -> str:
    try:
        parsed = urllib.parse.urlparse(source_url)
    except Exception:
        return source_url
    if not parsed.hostname or parsed.hostname.lower() not in CIVITAI_IMAGE_HOSTS:
        return source_url
    if re.search(r"\.(?:mp4|webm|mov|m4v|avi)(?:$|/)", parsed.path, re.IGNORECASE):
        return source_url
    media_id_match = CIVITAI_MEDIA_ID_RE.search(parsed.path)
    if not media_id_match:
        return source_url
    media_id = media_id_match.group(1).lower()
    snapped_width = _snap_remote_image_width(width)
    return (
        f"{CIVITAI_IMAGE_LOCATION}/{media_id}/"
        f"width={snapped_width},optimized=true/{media_id}.jpeg"
    )


async def delete_asset_api(request: web.Request) -> web.Response:
    try:
        body = await request.json()
        root_kind = _normalize_root_kind(body.get("root_kind"))
        rel_path = str(body.get("relative_path") or "")
        abs_path = _resolve_asset_path(root_kind, rel_path, body.get("storage_root_id"))
        if not os.path.isfile(abs_path):
            return web.json_response({"success": False, "error": "Asset not found"}, status=404)
        os.remove(abs_path)
        _delete_companions(abs_path, root_kind)
        _LIBRARY_INDEX.invalidate()
        return web.json_response({"success": True})
    except ValueError as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=400)
    except Exception as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=500)


async def move_asset_api(request: web.Request) -> web.Response:
    try:
        body = await request.json()
        source_root_kind = _normalize_root_kind(body.get("root_kind"))
        source_storage_root_id = str(body.get("storage_root_id") or "")
        source_rel_path = str(body.get("relative_path") or "")
        target_root_kind = _normalize_root_kind(body.get("target_root_kind") or source_root_kind)
        _validate_root_transition(source_root_kind, target_root_kind)
        base_model_dir = _safe_segment(body.get("base_model_dir"), "Other")
        category_dir = _safe_segment(body.get("category_dir"), "Other")
        filename = _safe_filename(body.get("filename"), os.path.basename(source_rel_path), os.path.splitext(source_rel_path)[1] or ".safetensors")
        _validate_asset_filename(target_root_kind, filename)

        source_root = _storage_root_for_asset(source_root_kind, source_storage_root_id)
        src_path = _resolve_asset_path(source_root_kind, source_rel_path, source_storage_root_id)
        if not os.path.isfile(src_path):
            return web.json_response({"success": False, "error": "Source asset not found"}, status=404)
        target_root = source_root if target_root_kind == source_root_kind else _root_for_kind(target_root_kind)
        if target_root_kind == "workflows":
            dst_path = _safe_join(target_root, category_dir, filename)
        else:
            dst_path = _safe_join(target_root, base_model_dir, category_dir, filename)
        relative_path = os.path.relpath(dst_path, target_root).replace("\\", "/")
        _move_asset_bundle(src_path, dst_path, source_root_kind, target_root_kind)
        _update_moved_asset_metadata(
            dst_path,
            target_root_kind,
            relative_path,
            base_model_dir,
            category_dir,
            filename,
        )
        _LIBRARY_INDEX.invalidate()
        return web.json_response({
            "success": True,
            "relative_path": relative_path,
            "absolute_path": dst_path,
            "root_kind": target_root_kind,
            "storage_root_id": _storage_root_id(target_root),
        })
    except FileExistsError as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=409)
    except ValueError as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=400)
    except Exception as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=500)


async def favorite_asset_api(request: web.Request) -> web.Response:
    try:
        body = await request.json()
        root_kind = _normalize_root_kind(body.get("root_kind"))
        rel_path = str(body.get("relative_path") or "")
        favorite = _config_bool(body.get("favorite"), "favorite", False)
        abs_path = _resolve_asset_path(root_kind, rel_path, body.get("storage_root_id"))
        if not os.path.isfile(abs_path):
            return web.json_response({"success": False, "error": "Asset not found"}, status=404)
        status, metadata = _metadata_for_asset(abs_path, root_kind)
        if status == "missing":
            metadata = {
                "source": "local",
                "name": os.path.splitext(os.path.basename(abs_path))[0],
                "resolution": {
                    "root_kind": root_kind,
                    "relative_path": rel_path,
                },
            }
        metadata["favorite"] = favorite
        metadata["favorite_updated_at"] = _now()
        _write_asset_metadata(abs_path, root_kind, metadata)
        model_id, version_id = _civitai_ids_from_metadata(metadata)
        resolution = metadata.get("resolution") if isinstance(metadata.get("resolution"), dict) else {}
        favorite_item = _normalize_favorite_item({
            "asset_kind": _favorite_asset_kind(root_kind),
            "source": "local",
            "model_id": model_id,
            "version_id": version_id,
            "name": metadata.get("name") or os.path.splitext(os.path.basename(abs_path))[0],
            "creator": metadata.get("creator") or "",
            "base_model": metadata.get("base_model") or resolution.get("base_model_dir") or "",
            "type": root_kind,
            "civitai_url": metadata.get("civitai_url") or "",
            "local": {
                "root_kind": root_kind,
                "storage_root_id": body.get("storage_root_id") or "",
                "relative_path": rel_path,
                "filename": os.path.basename(abs_path),
            },
        })
        _mutate_favorite_item(favorite_item, favorite)
        _LIBRARY_INDEX.invalidate()
        return web.json_response({"success": True, "favorite": favorite})
    except ValueError as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=400)
    except Exception as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=500)


async def open_folder_api(request: web.Request) -> web.Response:
    try:
        body = await request.json()
        root_kind = _normalize_root_kind(body.get("root_kind"))
        rel_path = str(body.get("relative_path") or "")
        abs_path = _resolve_asset_path(root_kind, rel_path, body.get("storage_root_id"))
        if not os.path.exists(abs_path):
            return web.json_response({"success": False, "error": "Asset not found"}, status=404)
        folder = os.path.dirname(abs_path)
        if os.name == "nt":
            os.startfile(folder)  # type: ignore[attr-defined]
        elif sys_platform() == "darwin":
            subprocess.Popen(["open", folder])
        else:
            subprocess.Popen(["xdg-open", folder])
        return web.json_response({"success": True, "folder": folder})
    except ValueError as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=400)
    except Exception as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=500)


def sys_platform() -> str:
    return sys.platform


async def enrich_metadata_api(request: web.Request) -> web.Response:
    try:
        body = await request.json()
        root_kind = _normalize_root_kind(body.get("root_kind"))
        rel_path = str(body.get("relative_path") or "")
        abs_path = _resolve_asset_path(root_kind, rel_path, body.get("storage_root_id"))
        if not os.path.isfile(abs_path):
            return web.json_response({"success": False, "error": "Asset not found"}, status=404)
        async with _HASH_METADATA_REQUEST_LOCK:
            result = await asyncio.to_thread(_enrich_metadata_worker, abs_path, root_kind)
        _LIBRARY_INDEX.invalidate()
        return web.json_response({"success": True, **result})
    except ValueError as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=400)
    except Exception as exc:
        return web.json_response({"success": False, "error": str(exc)}, status=500)


routes = PromptServer.instance.routes
register_routes(routes, API_PREFIX, globals())
