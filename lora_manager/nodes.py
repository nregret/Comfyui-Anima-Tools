"""Multi LoRA loader node and API registration for the Anima Tools LoRA manager."""

from __future__ import annotations

import json
import os
from typing import Any

try:
    from . import manager_api  # noqa: F401 - importing registers HTTP routes
except Exception as exc:
    print(f"[Anima Tools] Failed to register API routes: {exc}")


def _normalize_lora_entry(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    name = str(value.get("name") or "").strip().replace("\\", "/")
    if not name:
        return None
    try:
        strength = float(value.get("strength_model", 1.0))
    except (TypeError, ValueError):
        strength = 1.0
    normalized = {
        "name": name,
        "strength_model": strength,
        "enabled": value.get("enabled") is not False,
    }
    storage_root_id = str(value.get("storage_root_id") or "").strip()
    if storage_root_id:
        normalized["storage_root_id"] = storage_root_id
    return normalized


def _parse_lora_list(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (TypeError, ValueError, json.JSONDecodeError):
            return []
    if not isinstance(value, list):
        return []
    normalized: list[dict[str, Any]] = []
    for entry in value:
        item = _normalize_lora_entry(entry)
        if item:
            normalized.append(item)
    return normalized


def _safe_root_candidate(root: str, relative_name: str) -> str | None:
    root_path = os.path.realpath(root)
    candidate = os.path.realpath(os.path.join(root_path, relative_name.replace("/", os.sep)))
    try:
        if os.path.commonpath([root_path, candidate]) != root_path:
            return None
    except ValueError:
        return None
    return candidate if os.path.isfile(candidate) else None


def _resolve_lora_path(name: str, storage_root_id: str = "") -> str | None:
    import folder_paths

    normalized = str(name or "").strip().replace("\\", "/").lstrip("/")
    if not normalized:
        return None

    if storage_root_id:
        try:
            selected_root = manager_api._storage_root_for_asset("loras", storage_root_id)
            selected = _safe_root_candidate(selected_root, normalized)
        except Exception:
            selected = None
        if selected:
            return selected

    try:
        direct = folder_paths.get_full_path("loras", normalized)
    except Exception:
        direct = None
    if direct and os.path.isfile(direct):
        return direct

    try:
        roots = list(folder_paths.get_folder_paths("loras") or [])
    except Exception:
        roots = []
    for root in roots:
        candidate = _safe_root_candidate(str(root), normalized)
        if candidate:
            return candidate

    # Older workflows may only contain a basename. Resolve it only when the
    # filename is unambiguous across ComfyUI's registered LoRA directories.
    wanted_basename = os.path.basename(normalized).casefold()
    try:
        known_names = list(folder_paths.get_filename_list("loras") or [])
    except Exception:
        known_names = []
    basename_matches = [
        str(item).replace("\\", "/")
        for item in known_names
        if os.path.basename(str(item)).casefold() == wanted_basename
    ]
    if len(basename_matches) == 1:
        try:
            matched = folder_paths.get_full_path("loras", basename_matches[0])
        except Exception:
            matched = None
        if matched and os.path.isfile(matched):
            return matched
    return None


class AnimaMultiLoraLoader:
    """Apply an ordered list of LoRAs to a model."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "lora_list_json": (
                    "STRING",
                    {
                        "default": "[]",
                        "multiline": True,
                        "tooltip": "Managed by the Anima LoRA manager.",
                    },
                ),
            }
        }

    RETURN_TYPES = ("MODEL",)
    RETURN_NAMES = ("MODEL",)
    FUNCTION = "load_loras"
    CATEGORY = "AnimaArt"
    DESCRIPTION = "Load and apply multiple local LoRAs selected with the Anima LoRA manager."

    def load_loras(self, model, lora_list_json: str):
        import comfy.sd
        import comfy.utils

        current_model = model
        for entry in _parse_lora_list(lora_list_json):
            if not entry["enabled"]:
                continue
            lora_path = _resolve_lora_path(entry["name"], entry.get("storage_root_id", ""))
            if not lora_path:
                print(f"[Anima Tools] LoRA not found, skipped: {entry['name']}")
                continue
            try:
                lora_data = comfy.utils.load_torch_file(lora_path, safe_load=True)
                current_model, _ = comfy.sd.load_lora_for_models(
                    current_model,
                    None,
                    lora_data,
                    entry["strength_model"],
                    0.0,
                )
            except Exception as exc:
                print(f"[Anima Tools] Failed to load LoRA {entry['name']}: {exc}")
        return (current_model,)

