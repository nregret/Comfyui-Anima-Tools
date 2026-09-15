"""Anima LoRA API integration for ComfyUI Anima Tools.

Provides backend API wrappers, config loading/saving, and background downloader.
"""

import json
import os
import re
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
import folder_paths

CIVITAI_API_BASE = "https://civitai.red/api/v1"
CIVITAI_SEARCH_HOST = "https://search-new.civitai.com"
# Public browser search key embedded by Civitai's own frontend for InstantSearch.
CIVITAI_SEARCH_CLIENT_KEY = "8c46eb2508e21db1e9828a97968d91ab1ca1caa5f70a00e88a2ba1e286603b61"
USER_AGENT = "ComfyUI-Anima-Tools/1.0"
VALID_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")
CIVITAI_HOSTS = ("civitai.com", "www.civitai.com", "civitai.red")
CIVITAI_IMAGE_HOSTS = ("image.civitai.com", "image-b2.civitai.com", "image-b3.civitai.com")
PREVIEW_MAX_BYTES = 8 * 1024 * 1024


def _validate_civitai_url(url: str, allow_storage: bool = False) -> None:
    parsed = urllib.parse.urlsplit(url)
    host = parsed.hostname or ""
    allowed = host in (*CIVITAI_HOSTS, *CIVITAI_IMAGE_HOSTS)
    if allow_storage:
        allowed = allowed or host.endswith(".r2.cloudflarestorage.com")
    if parsed.scheme != "https" or not allowed or parsed.port not in (None, 443) or parsed.username or parsed.password:
        raise ValueError("Only trusted Civitai HTTPS URLs are supported")


class _CivitaiRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        _validate_civitai_url(newurl, allow_storage=True)
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected is not None:
            redirected.remove_header("Authorization")
            redirected.remove_header("Cookie")
        return redirected


def normalize_lora_filename(filename: str) -> str | None:
    filename = str(filename or "").replace("\\", "/").strip()
    if not filename.lower().endswith(".safetensors") or re.search(r'[<>:"|?*\x00-\x1f]', filename):
        return None
    parts = filename.split("/")
    if any(part in ("", ".", "..") or part.endswith((" ", ".")) for part in parts):
        return None
    if any(re.fullmatch(r"(?i)(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?", part) for part in parts):
        return None
    return filename


def validate_lora_directory(directory: str) -> str:
    candidate = Path(directory).expanduser().resolve()
    for root in folder_paths.get_folder_paths("loras"):
        if candidate.is_relative_to(Path(root).resolve()) and candidate.is_dir():
            return str(candidate)
    raise ValueError("Choose a directory registered under loras in ComfyUI extra_model_paths.yaml")


def _write_lora_companion(path: str, data: bytes) -> None:
    directory = validate_lora_directory(str(Path(path).parent))
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(dir=directory, prefix=".anima-", delete=False) as target:
            temp_path = target.name
            target.write(data)
        os.replace(temp_path, path)
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

# Thread-safe download tracking
_DOWNLOAD_JOBS = {}
_DOWNLOAD_JOBS_LOCK = threading.Lock()


def _extract_civitai_image_id(image_url: str) -> str:
    if not image_url or "civitai" not in image_url:
        match = re.search(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", str(image_url or ""), re.I)
        return match.group(0) if match else ""
    parsed = urllib.parse.urlparse(image_url)
    parts = [part for part in parsed.path.split("/") if part]
    if "civitai-media-cache" in parts:
        idx = parts.index("civitai-media-cache")
        if idx + 1 < len(parts):
            return parts[idx + 1]
    match = re.search(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", parsed.path, re.I)
    return match.group(0) if match else ""


def get_civitai_preview_image_url(image_url: str, width: int = 512) -> str:
    image_id = _extract_civitai_image_id(image_url)
    if image_id:
        return f"https://image-b2.civitai.com/file/civitai-media-cache/{image_id}/{width}x%3Cauto%3E_so"
    return image_url


def _safe_lora_filename(name: str, fallback_id: int | str = "") -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "_", str(name or "")).strip(" ._")
    cleaned = re.sub(r"\s+", " ", cleaned)[:140].strip()
    if not cleaned:
        cleaned = f"civitai_lora_{fallback_id or int(time.time())}"
    if not cleaned.lower().endswith(".safetensors"):
        cleaned += ".safetensors"
    return cleaned


def get_config_path() -> str:
    """Gets the path to the anima_lora_config.json configuration file."""
    try:
        user_dir = folder_paths.get_user_directory()
    except AttributeError:
        user_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "user"))
        if not os.path.exists(user_dir):
            user_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "user"))
    
    os.makedirs(user_dir, exist_ok=True)
    return os.path.join(user_dir, "anima_lora_config.json")


_LORA_CONFIG_CACHE = None


def load_config() -> dict:
    """Loads configuration dictionary."""
    global _LORA_CONFIG_CACHE
    if _LORA_CONFIG_CACHE is not None:
        return _LORA_CONFIG_CACHE
    path = get_config_path()
    default_config = {
        "custom_lora_dir": "",
        "civitai_api_key": ""
    }
    if not os.path.exists(path):
        _LORA_CONFIG_CACHE = default_config
        return default_config
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                _LORA_CONFIG_CACHE = {**default_config, **data}
                return _LORA_CONFIG_CACHE
    except Exception as e:
        print(f"[Anima Tools] Error loading config: {e}")
    _LORA_CONFIG_CACHE = default_config
    return default_config


def save_config(config: dict) -> bool:
    """Saves configuration dictionary."""
    global _LORA_CONFIG_CACHE
    path = get_config_path()
    try:
        tmp_path = path + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, path)
        _LORA_CONFIG_CACHE = config
        return True
    except Exception as e:
        print(f"[Anima Tools] Error saving config: {e}")
        return False


def get_lora_save_dir() -> str:
    """Resolves directory path where downloaded LoRA models should be saved."""
    config = load_config()
    custom_dir = config.get("custom_lora_dir", "").strip()
    if custom_dir:
        return validate_lora_directory(custom_dir)
    for root in folder_paths.get_folder_paths("loras"):
        if os.path.isdir(root):
            return validate_lora_directory(root)
    raise ValueError("No existing LoRA directory is registered in ComfyUI")


def _request_headers(api_key: str | None = None, json_content: bool = True) -> dict:
    headers = {"User-Agent": USER_AGENT}
    if json_content:
        headers["Content-Type"] = "application/json"
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


def _read_json_url(url: str, api_key: str | None = None, timeout: int = 30) -> dict | None:
    _validate_civitai_url(url)
    req = urllib.request.Request(url, headers=_request_headers(api_key), method="GET")
    try:
        with urllib.request.build_opener(_CivitaiRedirectHandler()).open(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"[Anima Tools] Civitai API error {e.code}: {e.reason} at {url}")
        return None
    except urllib.error.URLError as e:
        print(f"[Anima Tools] Civitai connection error: {e.reason} at {url}")
        return None
    except Exception as e:
        print(f"[Anima Tools] Civitai unexpected error: {e}")
        return None


def _post_json_url(url: str, body: dict, api_key: str | None = None, timeout: int = 30) -> dict | None:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=_request_headers(api_key), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = e.read().decode("utf-8", errors="ignore")[:300]
        except Exception:
            pass
        print(f"[Anima Tools] Civitai search error {e.code}: {e.reason} {detail}")
        return None
    except urllib.error.URLError as e:
        print(f"[Anima Tools] Civitai search connection error: {e.reason}")
        return None
    except Exception as e:
        print(f"[Anima Tools] Civitai search unexpected error: {e}")
        return None


def _official_sort_value(sort: str) -> str:
    mapping = {
        "Relevancy": "models_v9",
        "Highest Rated": "models_v9:metrics.thumbsUpCount:desc",
        "Most Downloaded": "models_v9:metrics.downloadCount:desc",
        "Most Liked": "models_v9:metrics.favoriteCount:desc",
        "Most Discussed": "models_v9:metrics.commentCount:desc",
        "Most Collected": "models_v9:metrics.collectedCount:desc",
        "Most Buzz": "models_v9:metrics.tippedAmountCount:desc",
        "Newest": "models_v9:createdAt:desc",
    }
    clean_sort = str(sort or "").strip()
    if clean_sort.startswith("models_v9"):
        return clean_sort
    return mapping.get(clean_sort, "models_v9")


def _meili_sort_for_civitai_sort(sort: str) -> tuple[str, list[str]]:
    official_sort = _official_sort_value(sort)
    parts = official_sort.split(":")
    index_uid = parts[0] or "models_v9"
    sort_rules = [":".join(parts[1:])] if len(parts) > 1 else []
    return index_uid, sort_rules


def _public_api_sort_for_civitai_sort(sort: str) -> str:
    mapping = {
        "models_v9": "Highest Rated",
        "models_v9:metrics.thumbsUpCount:desc": "Highest Rated",
        "models_v9:metrics.downloadCount:desc": "Most Downloaded",
        "models_v9:metrics.favoriteCount:desc": "Most Liked",
        "models_v9:metrics.commentCount:desc": "Most Discussed",
        "models_v9:metrics.collectedCount:desc": "Most Collected",
        "models_v9:metrics.tippedAmountCount:desc": "Most Buzz",
        "models_v9:createdAt:desc": "Newest",
    }
    official_sort = _official_sort_value(sort)
    return mapping.get(official_sort, str(sort or "Highest Rated"))


def _quote_meili_value(value: str) -> str:
    return "'" + str(value).replace("\\", "\\\\").replace("'", "\\'") + "'"


def _convert_meili_image(image: dict, width: int = 450) -> dict:
    image = image or {}
    url = get_civitai_preview_image_url(str(image.get("url") or ""), width=width)
    return {
        "id": image.get("id"),
        "url": url,
        "thumbnailUrl": url,
        "type": "image",
        "name": image.get("name") or "",
        "width": image.get("width"),
        "height": image.get("height"),
        "nsfwLevel": image.get("nsfwLevel"),
    }


def _images_for_version(hit: dict, version_id: int | str | None = None) -> list[dict]:
    images = hit.get("images") if isinstance(hit.get("images"), list) else []
    filtered = []
    for image in images:
        if not isinstance(image, dict):
            continue
        if version_id and str(image.get("modelVersionId") or "") != str(version_id):
            continue
        if str(image.get("type") or "").lower() == "video":
            continue
        filtered.append(_convert_meili_image(image))
    if not filtered:
        for image in images:
            if isinstance(image, dict) and str(image.get("type") or "").lower() != "video":
                filtered.append(_convert_meili_image(image))
    return filtered[:12]


def _convert_meili_version(hit: dict, version: dict) -> dict:
    version = version or {}
    version_id = version.get("id")
    model_name = hit.get("name") or "Civitai LoRA"
    version_name = version.get("name") or ""
    filename = _safe_lora_filename(f"{model_name} - {version_name}".strip(" -"), version_id)
    download_url = f"https://civitai.com/api/download/models/{version_id}" if version_id else ""
    return {
        "id": version_id,
        "name": version_name or "Anima",
        "baseModel": version.get("baseModel") or "Anima",
        "trainedWords": version.get("trainedWords") or hit.get("triggerWords") or [],
        "images": _images_for_version(hit, version_id),
        "downloadUrl": download_url,
        "files": [{
            "id": version_id,
            "name": filename,
            "downloadUrl": download_url,
            "type": "Model",
            "metadata": {"format": "SafeTensor"},
        }],
        "stats": version.get("metrics") or {},
        "metrics": version.get("metrics") or {},
    }


def _convert_meili_hit(hit: dict) -> dict:
    versions = []
    primary_version = hit.get("version") if isinstance(hit.get("version"), dict) else {}
    if primary_version:
        versions.append(primary_version)
    for version in hit.get("versions") or []:
        if not isinstance(version, dict):
            continue
        if str(version.get("baseModel") or "").lower() != "anima":
            continue
        if primary_version and str(version.get("id")) == str(primary_version.get("id")):
            continue
        versions.append(version)
    model_versions = [_convert_meili_version(hit, version) for version in versions[:8]]
    if not model_versions:
        model_versions = [_convert_meili_version(hit, primary_version)]
    if not model_versions[0].get("images"):
        model_versions[0]["images"] = _images_for_version(hit)

    user = hit.get("user") if isinstance(hit.get("user"), dict) else {}
    metrics = hit.get("metrics") if isinstance(hit.get("metrics"), dict) else {}
    return {
        "id": hit.get("id"),
        "name": hit.get("name") or "Unnamed Model",
        "type": hit.get("type") or "LORA",
        "description": hit.get("description") or hit.get("descriptionHtml") or hit.get("descriptionPlaintext") or "",
        "creator": {
            "username": user.get("username") or "Unknown",
            "image": user.get("image"),
        },
        "stats": {
            "downloadCount": metrics.get("downloadCount", 0),
            "favoriteCount": metrics.get("favoriteCount", metrics.get("collectedCount", 0)),
            "thumbsUpCount": metrics.get("thumbsUpCount", 0),
            "commentCount": metrics.get("commentCount", 0),
        },
        "modelVersions": model_versions,
        "_search_source": "meili",
        "_category": (hit.get("category") or {}).get("name") if isinstance(hit.get("category"), dict) else "",
    }


def _search_civitai_loras_meili(query: str, tag: str, category: str, sort: str, cursor: str, limit: int) -> dict | None:
    try:
        offset = max(0, int(cursor or "0"))
    except ValueError:
        offset = 0

    filters = [
        "version.baseModel = 'Anima'",
        "type = 'LORA'",
        "fileFormats = 'SafeTensor'",
        "availability != 'Private'",
    ]
    clean_category = str(category or "").strip()
    clean_tag = str(tag or "").strip()
    if clean_category:
        filters.append(f"category.name = {_quote_meili_value(clean_category)}")
    if clean_tag:
        filters.append(f"tags.name = {_quote_meili_value(clean_tag)}")

    index_uid, sort_rules = _meili_sort_for_civitai_sort(sort)
    query_payload = {
        "indexUid": index_uid,
        "q": str(query or "").strip(),
        "filter": filters,
        "limit": max(1, min(limit, 100)),
        "offset": offset,
        "attributesToRetrieve": [
            "id", "name", "type", "metrics", "user", "category", "version",
            "versions", "fileFormats", "triggerWords", "images",
            "description", "descriptionHtml", "descriptionPlaintext"
        ],
    }
    if sort_rules:
        query_payload["sort"] = sort_rules

    body = {
        "queries": [query_payload]
    }
    result = _post_json_url(
        f"{CIVITAI_SEARCH_HOST}/multi-search",
        body,
        api_key=CIVITAI_SEARCH_CLIENT_KEY,
        timeout=20,
    )
    if not result:
        return None
    first = (result.get("results") or [{}])[0]
    hits = first.get("hits") or []
    next_offset = offset + len(hits)
    total = first.get("estimatedTotalHits") or 0
    next_cursor = str(next_offset) if len(hits) >= limit and next_offset < total else ""
    return {
        "items": [_convert_meili_hit(hit) for hit in hits if isinstance(hit, dict)],
        "metadata": {
            "nextCursor": next_cursor,
            "totalItems": total,
            "source": "meili",
        }
    }


def search_civitai_loras(
    query: str = "",
    tag: str = "",
    category: str = "",
    sort: str = "Highest Rated",
    cursor: str = "",
    limit: int = 40,
) -> dict | None:
    """Searches Civitai API for LoRA models based on Anima."""
    meili_result = _search_civitai_loras_meili(query, tag, category, sort, cursor, limit)
    if meili_result is not None:
        return meili_result

    config = load_config()
    api_key = config.get("civitai_api_key", "").strip() or None
    
    params = {
        "limit": str(max(1, min(limit, 100))),
        "types": "LORA",
        "sortBy": _public_api_sort_for_civitai_sort(sort),
        "nsfw": "true",
        "baseModels": "Anima",  # Enforce matching Anima base model only
    }
    
    clean_query = str(query or "").strip()
    clean_tag = str(tag or "").strip()
    clean_category = str(category or "").strip()
    clean_cursor = str(cursor or "").strip()
    
    if clean_query:
        params["query"] = clean_query
    if clean_category:
        params["category"] = clean_category
    if clean_tag:
        params["tag"] = clean_tag
    if clean_cursor:
        params["cursor"] = clean_cursor
        
    encoded = urllib.parse.urlencode(params)
    url = f"{CIVITAI_API_BASE}/models?{encoded}"
    return _read_json_url(url, api_key=api_key)


def fetch_civitai_model(model_id: int | str) -> dict | None:
    """Fetches full model metadata by id."""
    config = load_config()
    api_key = config.get("civitai_api_key", "").strip() or None
    
    url = f"{CIVITAI_API_BASE}/models/{model_id}"
    return _read_json_url(url, api_key=api_key)


def read_civitai_preview(image_url: str) -> bytes:
    _validate_civitai_url(image_url)
    if urllib.parse.urlsplit(image_url).hostname not in CIVITAI_IMAGE_HOSTS:
        raise ValueError("Only Civitai image hosts are supported")
    image_url = get_civitai_preview_image_url(image_url, width=512)
    req = urllib.request.Request(image_url, headers=_request_headers(json_content=False))
    with urllib.request.build_opener(_CivitaiRedirectHandler()).open(req, timeout=30) as resp:
        if not resp.headers.get_content_type().startswith("image/"):
            raise ValueError("Preview response is not an image")
        data = resp.read(PREVIEW_MAX_BYTES + 1)
    if len(data) > PREVIEW_MAX_BYTES:
        raise ValueError("Preview exceeds 8 MiB")
    return data


def download_preview_image(image_url: str, save_path: str) -> bool:
    """Downloads preview image from Civitai."""
    try:
        image_data = read_civitai_preview(image_url)
        _write_lora_companion(save_path, image_data)
        return True
    except Exception as e:
        print(f"[Anima Tools] Failed to download preview image: {e}")
        return False


def _download_thread(task_id: str, download_url: str, save_path: str, api_key: str | None = None, metadata: dict = None):
    """Worker thread function to execute download and update task status."""
    temp_path = None
    
    try:
        directory = validate_lora_directory(str(Path(save_path).parent))
        _validate_civitai_url(download_url)
        req = urllib.request.Request(download_url, headers=_request_headers(api_key, json_content=False))
        
        with urllib.request.build_opener(_CivitaiRedirectHandler()).open(req, timeout=60) as resp, tempfile.NamedTemporaryFile(dir=directory, prefix=".anima-", suffix=".download", delete=False) as f:
            temp_path = f.name
            total_size = int(resp.headers.get("Content-Length") or 0)
            downloaded = 0
            
            with _DOWNLOAD_JOBS_LOCK:
                _DOWNLOAD_JOBS[task_id]["total"] = total_size
                _DOWNLOAD_JOBS[task_id]["status"] = "downloading"
                
            while True:
                chunk = resp.read(1024 * 1024)  # 1MB chunks
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)
                
                with _DOWNLOAD_JOBS_LOCK:
                    _DOWNLOAD_JOBS[task_id]["progress"] = downloaded
            
        os.replace(temp_path, save_path)
        
        # Save companion metadata JSON
        if metadata:
            meta_path = os.path.splitext(save_path)[0] + ".json"
            try:
                _write_lora_companion(meta_path, json.dumps(metadata, indent=2, ensure_ascii=False).encode("utf-8"))
            except Exception as e:
                print(f"[Anima Tools] Failed to save metadata json: {e}")
                
            # Download companion preview image
            try:
                version_info = metadata.get("version", {})
                images = version_info.get("images", [])
                if not images and isinstance(metadata.get("model"), dict):
                    images = metadata.get("model", {}).get("modelVersions", [{}])[0].get("images", [])
                
                if images:
                    preview_url = images[0].get("url")
                    if preview_url:
                        # Detect extension
                        preview_ext = ".png"
                        if ".jpg" in preview_url.lower() or ".jpeg" in preview_url.lower():
                            preview_ext = ".jpg"
                        elif ".webp" in preview_url.lower():
                            preview_ext = ".webp"
                            
                        preview_path = os.path.splitext(save_path)[0] + preview_ext
                        download_preview_image(preview_url, preview_path)
            except Exception as e:
                print(f"[Anima Tools] Failed to download companion preview: {e}")
                
        with _DOWNLOAD_JOBS_LOCK:
            _DOWNLOAD_JOBS[task_id]["status"] = "completed"
            _DOWNLOAD_JOBS[task_id]["progress"] = total_size
            
    except urllib.error.HTTPError as e:
        print(f"[Anima Tools] Download HTTP error for {task_id}: {e.code} - {e.reason}")
        error_msg = f"HTTP Error {e.code}: {e.reason}"
        if e.code == 401 or e.code == 403:
            error_msg = "HTTP Error 401: Unauthorized. This model requires a Civitai API key; configure it in settings and try again."
        with _DOWNLOAD_JOBS_LOCK:
            _DOWNLOAD_JOBS[task_id]["status"] = "failed"
            _DOWNLOAD_JOBS[task_id]["error"] = error_msg
    except Exception as e:
        print(f"[Anima Tools] Download thread failed for {task_id}: {e}")
        with _DOWNLOAD_JOBS_LOCK:
            _DOWNLOAD_JOBS[task_id]["status"] = "failed"
            _DOWNLOAD_JOBS[task_id]["error"] = str(e)
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
 
 
def start_download_task(version_id: int | str, download_url: str, filename: str, metadata: dict = None) -> str:
    """Starts a background thread to download a model version."""
    task_id = str(version_id)
    if not task_id.isascii() or not task_id.isdigit():
        raise ValueError("Invalid Civitai version id")
    _validate_civitai_url(download_url)
    parsed = urllib.parse.urlsplit(download_url)
    if parsed.hostname not in CIVITAI_HOSTS or parsed.path != f"/api/download/models/{task_id}":
        raise ValueError("Download URL must match the Civitai model version")
    query = urllib.parse.parse_qsl(parsed.query)
    if any(key not in ("type", "format", "size", "fp") for key, _ in query):
        raise ValueError("Unsupported Civitai download parameters")
    download_url = urllib.parse.urlunsplit(("https", "civitai.com", parsed.path, urllib.parse.urlencode(query), ""))
    save_dir = get_lora_save_dir()
    filename = normalize_lora_filename(filename)
    if not filename or "/" in filename:
        raise ValueError("Use a plain .safetensors filename without a path")
    save_path = os.path.join(save_dir, filename)
    if Path(save_path).is_symlink():
        raise ValueError("Cannot replace a symlinked LoRA")
    
    with _DOWNLOAD_JOBS_LOCK:
        if task_id in _DOWNLOAD_JOBS:
            status = _DOWNLOAD_JOBS[task_id]["status"]
            if status in ("pending", "downloading", "completed"):
                return task_id  # Already active or completed
                
        _DOWNLOAD_JOBS[task_id] = {
            "status": "pending",
            "progress": 0,
            "total": 0,
            "error": "",
            "save_path": save_path
        }
        
    config = load_config()
    api_key = config.get("civitai_api_key", "").strip() or None
    
    t = threading.Thread(
        target=_download_thread,
        args=(task_id, download_url, save_path, api_key, metadata),
        daemon=True
    )
    t.start()
    return task_id


def get_download_job_status(task_id: str) -> dict | None:
    """Gets current status of a download job."""
    with _DOWNLOAD_JOBS_LOCK:
        return _DOWNLOAD_JOBS.get(task_id)


def get_all_download_jobs() -> dict:
    """Gets all current active/cached download jobs."""
    with _DOWNLOAD_JOBS_LOCK:
        return dict(_DOWNLOAD_JOBS)
