from __future__ import annotations

import os
import re
from typing import Any


CONFIG_MAX_TEXT_LENGTH = 4096


def parse_bool(value: Any, field: str, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in {0, 1}:
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "on"}:
            return True
        if normalized in {"false", "0", "no", "off"}:
            return False
    raise ValueError(f"{field} must be a boolean")


def normalize_config(config: dict[str, Any], defaults: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(defaults)
    normalized.update(config)
    api_key = str(normalized.get("civitai_api_key") or "").strip()
    if len(api_key) > CONFIG_MAX_TEXT_LENGTH or re.search(r"[\x00-\x1f\x7f]", api_key):
        raise ValueError("civitai_api_key contains invalid characters or is too long")

    workflow_dir = str(normalized.get("workflow_dir") or "").strip() or str(defaults["workflow_dir"])
    if len(workflow_dir) > CONFIG_MAX_TEXT_LENGTH or "\x00" in workflow_dir:
        raise ValueError("workflow_dir is invalid or too long")
    workflow_dir = os.path.abspath(os.path.expanduser(workflow_dir))
    if os.path.exists(workflow_dir) and not os.path.isdir(workflow_dir):
        raise ValueError("workflow_dir must be a directory")

    normalized["civitai_api_key"] = api_key
    normalized["allow_nsfw"] = parse_bool(normalized.get("allow_nsfw"), "allow_nsfw", False)
    normalized["save_metadata"] = parse_bool(normalized.get("save_metadata"), "save_metadata", True)
    normalized["save_preview"] = parse_bool(normalized.get("save_preview"), "save_preview", True)
    normalized["workflow_dir"] = workflow_dir
    return normalized
