from __future__ import annotations

from collections.abc import Mapping
from typing import Any


ROUTE_SPECS = (
    ("get", "/config", "get_config_api"),
    ("post", "/config", "save_config_api"),
    ("get", "/roots", "roots_api"),
    ("get", "/taxonomy", "taxonomy_api"),
    ("get", "/search", "search_api"),
    ("get", "/test-api", "test_api_api"),
    ("get", "/model-detail", "model_detail_api"),
    ("post", "/resolve-path", "resolve_path_api"),
    ("post", "/download", "download_api"),
    ("get", "/download-status", "download_status_api"),
    ("post", "/download/cancel", "cancel_download_api"),
    ("post", "/download/retry", "retry_download_api"),
    ("post", "/download/remove", "remove_download_api"),
    ("get", "/library", "library_api"),
    ("get", "/favorites", "favorites_api"),
    ("post", "/favorites/item", "favorite_item_api"),
    ("post", "/favorites/folder", "favorite_folder_api"),
    ("get", "/local-preview", "local_preview_api"),
    ("post", "/asset/delete", "delete_asset_api"),
    ("post", "/asset/move", "move_asset_api"),
    ("post", "/asset/favorite", "favorite_asset_api"),
    ("post", "/asset/open-folder", "open_folder_api"),
    ("post", "/asset/metadata", "enrich_metadata_api"),
)


def register_routes(routes: Any, prefix: str, handlers: Mapping[str, Any]) -> None:
    for method, suffix, handler_name in ROUTE_SPECS:
        getattr(routes, method)(f"{prefix}{suffix}")(handlers[handler_name])
