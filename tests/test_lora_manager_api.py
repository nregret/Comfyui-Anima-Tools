from __future__ import annotations

import asyncio
import gzip
import importlib.util
import io
import json
import os
import sys
import tempfile
import threading
import time
import types
import unittest
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest import mock


PROJECT_ROOT = Path(__file__).resolve().parents[1]
LORA_MANAGER_ROOT = PROJECT_ROOT / "lora_manager"
TEST_DATA_ROOT = Path(tempfile.mkdtemp(prefix="anima-lora-manager-test-"))


class _FakeRoutes:
    def get(self, _path):
        return lambda handler: handler

    def post(self, _path):
        return lambda handler: handler


class _FakeResponse:
    def __init__(self, body=None, status=200, **_kwargs):
        self.body = body
        self.status = status
        self.headers = {}


def _fake_json_response(payload, status=200, **_kwargs):
    return _FakeResponse(body=payload, status=status)


class _JsonRequest:
    def __init__(self, payload):
        self.payload = payload

    async def json(self):
        return self.payload


class _QueryRequest:
    def __init__(self, query=None):
        self.query = query or {}


def _load_manager_api():
    folder_paths = types.ModuleType("folder_paths")
    folder_paths.models_dir = str(TEST_DATA_ROOT / "models")
    folder_paths.get_user_directory = lambda: str(TEST_DATA_ROOT / "user")
    folder_paths.get_folder_paths = lambda _name: []

    server = types.ModuleType("server")
    server.PromptServer = types.SimpleNamespace(
        instance=types.SimpleNamespace(routes=_FakeRoutes())
    )

    aiohttp = types.ModuleType("aiohttp")
    aiohttp.web = types.SimpleNamespace(
        Request=object,
        Response=_FakeResponse,
        StreamResponse=_FakeResponse,
        FileResponse=_FakeResponse,
        json_response=_fake_json_response,
    )

    sys.modules["folder_paths"] = folder_paths
    sys.modules["server"] = server
    sys.modules["aiohttp"] = aiohttp
    module_name = "anima_lora_manager_test_manager_api"
    sys.modules.pop(module_name, None)
    if str(LORA_MANAGER_ROOT) not in sys.path:
        sys.path.insert(0, str(LORA_MANAGER_ROOT))
    spec = importlib.util.spec_from_file_location(module_name, LORA_MANAGER_ROOT / "manager_api.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load manager_api.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


manager = _load_manager_api()


class RemoteImageVariantTests(unittest.TestCase):
    def test_civitai_original_url_becomes_optimized_thumbnail(self):
        source = (
            "https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA/"
            "04a43bd2-a6f2-493f-ba86-c677fe642f00/original=true/592643.jpeg?width=450"
        )
        self.assertEqual(
            manager._civitai_media_cache_url(source, 450),
            "https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA/"
            "04a43bd2-a6f2-493f-ba86-c677fe642f00/width=450,optimized=true/"
            "04a43bd2-a6f2-493f-ba86-c677fe642f00.jpeg",
        )

    def test_width_snaps_to_official_common_size(self):
        source = (
            "https://image-b2.civitai.com/file/civitai-media-cache/"
            "04a43bd2-a6f2-493f-ba86-c677fe642f00/original"
        )
        self.assertIn("/width=800,optimized=true/", manager._civitai_media_cache_url(source, 700))

    def test_non_civitai_and_video_urls_are_not_rewritten(self):
        external = "https://example.com/image.jpg"
        video = (
            "https://image.civitai.com/x/"
            "04a43bd2-a6f2-493f-ba86-c677fe642f00/original=true/preview.mp4"
        )
        self.assertEqual(manager._civitai_media_cache_url(external, 450), external)
        self.assertEqual(manager._civitai_media_cache_url(video, 450), video)


class KeepAliveFetchTests(unittest.TestCase):
    def setUp(self):
        self.ports = []
        self.drop_after_first = False
        test = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def do_GET(self):
                test.ports.append(self.client_address[1])
                body = gzip.compress(json.dumps({"path": self.path}).encode("utf-8"))
                self.send_response(200)
                self.send_header("Content-Encoding", "gzip")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                # Simulate a server that silently drops idle keep-alive connections.
                self.close_connection = test.drop_after_first

            def log_message(self, *_args):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.server.server_address[1]}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()

    def test_reuses_connection_and_decodes_gzip(self):
        first = manager._fetch(f"{self.base}/a?x=1", {}, 5)
        second = manager._fetch(f"{self.base}/b", {}, 5)

        self.assertEqual(json.loads(first[2]), {"path": "/a?x=1"})
        self.assertEqual(json.loads(second[2]), {"path": "/b"})
        self.assertEqual(len(set(self.ports)), 1)

    def test_retries_once_when_kept_connection_was_dropped(self):
        self.drop_after_first = True
        manager._fetch(f"{self.base}/a", {}, 5)
        status, _reason, body = manager._fetch(f"{self.base}/b", {}, 5)

        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {"path": "/b"})
        self.assertEqual(len(set(self.ports)), 2)


class SearchCardTests(unittest.TestCase):
    def test_search_card_keeps_card_fields_and_drops_heavy_ones(self):
        image = {"url": "https://image.civitai.com/x/a.jpeg", "type": "image", "hash": "h", "meta": {"prompt": "p"}}
        model = {
            "id": 1,
            "name": "Model",
            "type": "LORA",
            "description": "<p>long</p>",
            "creator": {"username": "me", "image": "avatar"},
            "modelVersions": [
                {"id": 10, "baseModel": "SDXL 1.0", "description": "v", "images": [image] * 20, "files": [{"name": "a.safetensors", "sizeKB": 1, "pickleScanMessage": "ok"}]},
                {"id": 11, "baseModel": "Pony", "images": [image] * 5, "files": []},
            ],
        }

        card = manager._search_card(model)

        self.assertNotIn("description", card)
        self.assertEqual(card["creator"], {"username": "me"})
        self.assertEqual(len(card["modelVersions"][0]["images"]), manager.SEARCH_PRIMARY_IMAGE_LIMIT)
        self.assertEqual(len(card["modelVersions"][1]["images"]), 1)
        self.assertEqual(card["modelVersions"][0]["images"][0], {"url": image["url"], "type": "image"})
        self.assertEqual(card["modelVersions"][0]["files"], [{"name": "a.safetensors", "sizeKB": 1}])
        self.assertNotIn("description", card["modelVersions"][0])


class ModelDetailCacheTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        manager._MODEL_DETAIL_CACHE.clear()

    def tearDown(self):
        manager._MODEL_DETAIL_CACHE.clear()

    async def test_repeated_detail_requests_hit_the_cache(self):
        with (
            mock.patch.object(manager, "load_config", return_value={"civitai_api_key": ""}),
            mock.patch.object(manager, "_read_json_url", return_value={"id": 5, "name": "Model"}) as read,
        ):
            first = await manager.model_detail_api(_QueryRequest({"id": "5"}))
            second = await manager.model_detail_api(_QueryRequest({"id": "5"}))

        self.assertEqual(first.body["model"]["name"], "Model")
        self.assertEqual(second.body, first.body)
        self.assertEqual(read.call_count, 1)


class SearchResultCacheTests(unittest.TestCase):
    def setUp(self):
        manager._SEARCH_RESULT_CACHE.clear()

    def tearDown(self):
        manager._SEARCH_RESULT_CACHE.clear()

    def test_identical_search_uses_short_lived_backend_cache(self):
        request = _QueryRequest({
            "kind": "lora",
            "query": "speed",
            "sort": "Newest",
            "limit": "20",
        })
        result = {"items": [{"id": 1}], "metadata": {}}
        with (
            mock.patch.object(manager, "load_config", return_value={"allow_nsfw": True}),
            mock.patch.object(manager, "_search_civitai_models", return_value=result) as search,
        ):
            first = asyncio.run(manager.search_api(request))
            second = asyncio.run(manager.search_api(request))

        self.assertEqual(first.body, result)
        self.assertEqual(second.body, result)
        self.assertEqual(search.call_count, 1)


class PathAndConfigTests(unittest.TestCase):
    def test_safe_join_rejects_parent_escape(self):
        with tempfile.TemporaryDirectory() as root:
            inside = manager._safe_join(root, "base", "model.safetensors")
            self.assertEqual(
                inside,
                os.path.abspath(os.path.join(root, "base", "model.safetensors")),
            )
            with self.assertRaises(ValueError):
                manager._safe_join(root, "..", "outside.safetensors")

    def test_public_config_never_returns_api_key(self):
        config = {
            "civitai_api_key": "secret",
            "allow_nsfw": False,
            "workflow_dir": "workflows",
            "save_metadata": True,
            "save_preview": True,
        }
        with mock.patch.object(manager, "_root_display", return_value={}):
            public = manager._public_config(config)
        self.assertEqual(public["civitai_api_key"], "")
        self.assertTrue(public["api_key_set"])

    def test_reserved_windows_segment_is_prefixed(self):
        self.assertEqual(manager._safe_segment("CON"), "_CON")
        self.assertEqual(manager._safe_filename("NUL.safetensors", "model"), "_NUL.safetensors")

    def test_config_normalizes_boolean_strings_and_absolute_workflow_path(self):
        normalized = manager._normalize_config({
            "allow_nsfw": "false",
            "save_metadata": "yes",
            "save_preview": 0,
            "workflow_dir": ".",
        })
        self.assertFalse(normalized["allow_nsfw"])
        self.assertTrue(normalized["save_metadata"])
        self.assertFalse(normalized["save_preview"])
        self.assertTrue(os.path.isabs(normalized["workflow_dir"]))

    def test_config_rejects_file_as_workflow_directory(self):
        with tempfile.TemporaryDirectory() as root:
            file_path = Path(root) / "workflow.json"
            file_path.write_text("{}", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "must be a directory"):
                manager._normalize_config({"workflow_dir": str(file_path)})

    def test_asset_path_rejects_escape_and_companion_metadata(self):
        with tempfile.TemporaryDirectory() as root, mock.patch.object(
            manager,
            "_root_for_kind",
            return_value=root,
        ):
            with self.assertRaisesRegex(ValueError, "escapes allowed root"):
                manager._resolve_asset_path("loras", "../outside.safetensors")
            with self.assertRaisesRegex(ValueError, "file extension"):
                manager._resolve_asset_path("loras", "model.json")
            with self.assertRaisesRegex(ValueError, "companion metadata"):
                manager._resolve_asset_path("workflows", "flow.civitai.json")

    def test_asset_path_resolves_configured_secondary_root(self):
        with tempfile.TemporaryDirectory() as base:
            primary = Path(base) / "primary"
            secondary = Path(base) / "secondary"
            primary.mkdir()
            secondary.mkdir()
            asset = secondary / "model.safetensors"
            asset.write_bytes(b"model")
            secondary_id = manager._storage_root_id(str(secondary))
            with (
                mock.patch.object(manager, "_root_for_kind", return_value=str(primary)),
                mock.patch.object(manager, "_roots_for_kind", return_value=[str(primary), str(secondary)]),
            ):
                resolved = manager._resolve_asset_path("loras", "model.safetensors", secondary_id)
                with self.assertRaisesRegex(ValueError, "Unknown model storage root"):
                    manager._resolve_asset_path("loras", "model.safetensors", "missing")

        self.assertEqual(resolved, str(asset))

    def test_download_path_restricts_root_family_and_override_extension(self):
        model = {"name": "Example", "type": "LORA"}
        version = {"name": "v1", "baseModel": "SDXL 1.0"}
        file_info = {"name": "example.safetensors"}
        with tempfile.TemporaryDirectory() as root, mock.patch.object(
            manager,
            "_root_for_kind",
            return_value=root,
        ):
            with self.assertRaisesRegex(ValueError, "Cannot move"):
                manager.resolve_download_path(
                    model,
                    version,
                    file_info,
                    "lora",
                    {"root_kind": "workflows"},
                )
            with self.assertRaisesRegex(ValueError, "file extension"):
                manager.resolve_download_path(
                    model,
                    version,
                    file_info,
                    "lora",
                    {"filename": "example.json"},
                )

    def test_workflow_download_normalizes_automatic_filename_to_json(self):
        with tempfile.TemporaryDirectory() as root, mock.patch.object(
            manager,
            "_root_for_kind",
            return_value=root,
        ):
            resolution = manager.resolve_download_path(
                {"name": "Flow", "type": "Workflows"},
                {"name": "v1"},
                {"name": "flow.safetensors"},
                "workflow",
            )
        self.assertEqual(resolution["filename"], "flow.json")
        self.assertEqual(resolution["root_kind"], "workflows")


class SearchFallbackTests(unittest.TestCase):
    def test_search_response_reports_when_content_filter_is_active(self):
        result = {"items": [{"id": 1, "name": "Example"}], "metadata": {}}
        config = manager._default_config()
        with (
            mock.patch.object(manager, "_read_models_json", return_value=result),
            mock.patch.object(manager, "_merge_taxonomy_cache"),
            mock.patch.object(manager, "_taxonomy_cache_get", return_value={}),
        ):
            response = manager._search_civitai_models(
                "lora", "Example", "", "Highest Rated", 40, "", "", "", config,
            )

        self.assertTrue(response["content_filter_active"])

    def search(self, query, cursor, pages):
        with (
            mock.patch.object(manager, "_read_models_json", side_effect=pages) as read_models,
            mock.patch.object(manager, "_merge_taxonomy_cache"),
            mock.patch.object(manager, "_taxonomy_cache_get", return_value={}),
        ):
            response = manager._search_civitai_models(
                "lora", query, cursor, "Highest Rated", 40, "", "", "", manager._default_config(),
            )
        return response, [call.args[0] for call in read_models.call_args_list]

    def test_query_retried_as_unknown_tag_does_not_return_the_unfiltered_listing(self):
        unfiltered = {"items": [{"id": 1, "name": "Detail Tweaker", "tags": ["concept"]}], "metadata": {"nextCursor": "1|2"}}
        response, requests = self.search("zzqxv", "", [{"items": [], "metadata": {}}, unfiltered])

        self.assertEqual(requests[1]["tag"], "zzqxv")
        self.assertEqual(response["items"], [])
        self.assertNotIn("nextCursor", response["metadata"])

    def test_tag_retry_pages_continue_the_tag_search(self):
        tagged = {"items": [{"id": 3, "name": "Brush", "tags": ["watercolor"]}], "metadata": {"nextCursor": "9|8"}}
        first, _ = self.search("watercolor", "", [{"items": [], "metadata": {}}, tagged])
        cursor = first["metadata"]["nextCursor"]
        second, requests = self.search("watercolor", cursor, [tagged])

        self.assertEqual([item["id"] for item in first["items"]], [3])
        self.assertEqual(cursor, f"{manager.SEARCH_ATTEMPT_CURSOR_PREFIX}1:9|8")
        self.assertEqual(len(requests), 1)
        self.assertEqual(requests[0]["tag"], "watercolor")
        self.assertNotIn("query", requests[0])
        self.assertEqual(requests[0]["cursor"], "9|8")
        self.assertEqual(second["metadata"]["nextCursor"], cursor)

    def test_fallback_filters_items_and_prefixes_next_cursor(self):
        result = {
            "items": [
                {"id": 1, "name": "Landscape", "baseModels": ["SDXL 1.0"], "tags": ["style"]},
                {"id": 2, "name": "Portrait Hero", "baseModels": ["SDXL 1.0"], "tags": ["character"]},
            ],
            "metadata": {"nextCursor": "200"},
        }
        with (
            mock.patch.object(manager, "_read_models_json", return_value=result) as read_models,
            mock.patch.object(manager, "_merge_taxonomy_cache"),
        ):
            items, metadata = manager._search_base_model_text_fallback(
                kind="lora",
                query="Portrait",
                tag="character",
                category="",
                base_model="SDXL 1.0",
                sort="Highest Rated",
                limit=1,
                cursor="",
                config=manager._default_config(),
                api_key=None,
            )

        self.assertEqual([item["id"] for item in items], [2])
        self.assertEqual(metadata["nextCursor"], f"{manager.SEARCH_FALLBACK_CURSOR_PREFIX}200")
        self.assertEqual(read_models.call_args.args[0]["baseModels"], "SDXL 1.0")


class LibraryScanTests(unittest.TestCase):
    def test_scan_reads_metadata_preview_and_ignores_non_assets(self):
        with tempfile.TemporaryDirectory() as root:
            asset_dir = Path(root) / "SDXL 1.0" / "Character"
            asset_dir.mkdir(parents=True)
            asset = asset_dir / "hero.safetensors"
            asset.write_bytes(b"model")
            asset.with_suffix(".json").write_text(json.dumps({
                "name": "Hero LoRA",
                "base_model": "SDXL 1.0",
                "category": "Character",
                "hashes": {"SHA256": "ABC"},
                "source": "civitai",
                "metadata_match_status": "matched",
                "version": {"id": 22, "modelId": 11},
            }), encoding="utf-8")
            asset.with_suffix(".png").write_bytes(b"preview")
            (asset_dir / "notes.txt").write_text("ignored", encoding="utf-8")

            with mock.patch.object(manager, "_root_for_kind", return_value=root):
                items = manager._scan_library_kind("loras")

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["name"], "Hero LoRA")
        self.assertEqual(items[0]["metadata_status"], "cached")
        self.assertTrue(items[0]["has_preview"])
        self.assertEqual(items[0]["hash"], "ABC")
        self.assertEqual(items[0]["model_id"], 11)
        self.assertEqual(items[0]["version_id"], 22)
        self.assertEqual(items[0]["civitai_url"], "https://civitai.red/models/11?modelVersionId=22")

    def test_workflow_scan_skips_companion_json(self):
        with tempfile.TemporaryDirectory() as root:
            asset_dir = Path(root) / "Generation"
            asset_dir.mkdir(parents=True)
            (asset_dir / "flow.json").write_text("{}", encoding="utf-8")
            (asset_dir / "flow.civitai.json").write_text(json.dumps({"name": "Flow"}), encoding="utf-8")
            with mock.patch.object(manager, "_root_for_kind", return_value=root):
                items = manager._scan_library_kind("workflows")

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["filename"], "flow.json")
        self.assertEqual(items[0]["name"], "Flow")

    def test_scan_reads_every_configured_model_root(self):
        with tempfile.TemporaryDirectory() as base:
            primary = Path(base) / "primary"
            secondary = Path(base) / "secondary"
            for root in (primary, secondary):
                asset_dir = root / "Shared"
                asset_dir.mkdir(parents=True)
                (asset_dir / "model.safetensors").write_bytes(root.name.encode("utf-8"))
            with (
                mock.patch.object(manager, "_root_for_kind", return_value=str(primary)),
                mock.patch.object(manager, "_roots_for_kind", return_value=[str(primary), str(secondary)]),
            ):
                items = manager._scan_library_kind("loras")

        self.assertEqual(len(items), 2)
        self.assertEqual(len({item["id"] for item in items}), 2)
        self.assertEqual({item["storage_root"] for item in items}, {str(primary), str(secondary)})
        self.assertTrue(all("root_id=" in item["thumb_url"] for item in items))


class LibraryIndexTests(unittest.TestCase):
    def test_cache_reuses_snapshot_until_forced_or_invalidated(self):
        index = manager.LibraryIndex(ttl_seconds=60)
        calls = []

        def load():
            calls.append(len(calls) + 1)
            return {"items": [{"generation": calls[-1]}]}

        first = index.get(load)
        second = index.get(load)
        forced = index.get(load, force=True)
        index.invalidate()
        invalidated = index.get(load)

        self.assertEqual(first, second)
        self.assertEqual(forced["items"][0]["generation"], 2)
        self.assertEqual(invalidated["items"][0]["generation"], 3)
        self.assertEqual(len(calls), 3)


class FavoritesApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.path_patch = mock.patch.object(
            manager,
            "_favorites_path",
            return_value=str(Path(self.temp_dir.name) / "favorites.json"),
        )
        self.scan_patch = mock.patch.object(manager, "_scan_roots", return_value={"items": []})
        self.path_patch.start()
        self.scan_patch.start()

    async def asyncTearDown(self):
        self.scan_patch.stop()
        self.path_patch.stop()
        self.temp_dir.cleanup()

    async def test_remote_favorite_can_be_grouped_renamed_and_unfiled(self):
        created = await manager.favorite_folder_api(_JsonRequest({"action": "create", "name": "Styles"}))
        self.assertEqual(created.status, 200)
        folder_id = created.body["folders"][0]["id"]
        item = {
            "asset_kind": "lora",
            "model_id": 1060551,
            "name": "Illustrious Style Pack",
            "model": {"id": 1060551, "name": "Illustrious Style Pack", "type": "LORA"},
        }

        favorited = await manager.favorite_item_api(_JsonRequest({
            "favorite": True,
            "folder_id": folder_id,
            "item": item,
        }))

        self.assertEqual(favorited.status, 200)
        self.assertEqual(favorited.body["items"][0]["key"], "civitai:lora:1060551")
        self.assertEqual(favorited.body["items"][0]["folder_id"], folder_id)

        renamed = await manager.favorite_folder_api(_JsonRequest({
            "action": "rename",
            "folder_id": folder_id,
            "name": "Illustration",
        }))
        self.assertEqual(renamed.body["folders"][0]["name"], "Illustration")

        deleted = await manager.favorite_folder_api(_JsonRequest({
            "action": "delete",
            "folder_id": folder_id,
        }))
        self.assertEqual(deleted.body["folders"], [])
        self.assertEqual(deleted.body["items"][0]["folder_id"], "")

        loaded = await manager.favorites_api(_QueryRequest())
        self.assertEqual(loaded.body["items"][0]["model"]["id"], 1060551)

    async def test_first_load_migrates_legacy_local_favorites(self):
        self.scan_patch.stop()
        self.scan_patch = mock.patch.object(manager, "_scan_roots", return_value={
            "items": [{
                "id": "loras:root:style.safetensors",
                "root_kind": "loras",
                "storage_root_id": "root",
                "relative_path": "style.safetensors",
                "filename": "style.safetensors",
                "name": "Legacy Style",
                "model_id": 42,
                "favorite": True,
            }],
        })
        self.scan_patch.start()

        loaded = await manager.favorites_api(_QueryRequest())

        self.assertEqual(loaded.status, 200)
        self.assertEqual(loaded.body["items"][0]["key"], "civitai:lora:42")
        self.assertTrue(Path(manager._favorites_path()).is_file())

    async def test_downloaded_asset_merges_with_existing_remote_favorite(self):
        remote = {
            "asset_kind": "lora",
            "model_id": 42,
            "name": "Remote Style",
            "model": {"id": 42, "name": "Remote Style", "type": "LORA"},
        }
        local = {
            "asset_kind": "lora",
            "model_id": 42,
            "version_id": 7,
            "name": "Local Style",
            "local": {
                "asset_id": "loras:root:style.safetensors",
                "root_kind": "loras",
                "storage_root_id": "root",
                "relative_path": "style.safetensors",
                "filename": "style.safetensors",
            },
        }

        await manager.favorite_item_api(_JsonRequest({"favorite": True, "item": remote}))
        merged = await manager.favorite_item_api(_JsonRequest({"favorite": True, "item": local}))

        self.assertEqual(len(merged.body["items"]), 1)
        item = merged.body["items"][0]
        self.assertEqual(item["key"], "civitai:lora:42")
        self.assertEqual(item["model"]["id"], 42)
        self.assertEqual(item["local"]["relative_path"], "style.safetensors")
        self.assertEqual(item["sources"], ["local", "remote"])


class ConfigApiAsyncTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.original_cache = manager._CONFIG_CACHE
        manager._CONFIG_CACHE = manager._normalize_config(manager._default_config())

    async def asyncTearDown(self):
        manager._CONFIG_CACHE = self.original_cache

    async def test_invalid_boolean_returns_bad_request_without_writing(self):
        with tempfile.TemporaryDirectory() as root, mock.patch.object(
            manager,
            "_config_path",
            return_value=str(Path(root) / "config.json"),
        ):
            response = await manager.save_config_api(_JsonRequest({
                "allow_nsfw": "sometimes",
            }))
            self.assertFalse((Path(root) / "config.json").exists())

        self.assertEqual(response.status, 400)
        self.assertIn("must be a boolean", response.body["error"])


class DownloadRedirectTests(unittest.TestCase):
    def _redirect(self, target_url):
        request = urllib.request.Request(
            "https://civitai.red/api/download/models/123",
            headers={
                "Authorization": "Bearer secret",
                "Cookie": "session=secret",
                "User-Agent": "CivitaiManager/test",
            },
        )
        return manager._SafeDownloadRedirectHandler().redirect_request(
            request,
            None,
            302,
            "Found",
            {},
            target_url,
        )

    def test_cross_host_redirect_strips_credentials(self):
        redirected = self._redirect("https://storage.example/model.safetensors")

        self.assertIsNotNone(redirected)
        self.assertIsNone(redirected.get_header("Authorization"))
        self.assertIsNone(redirected.get_header("Cookie"))
        self.assertEqual(redirected.get_header("User-agent"), "CivitaiManager/test")

    def test_same_host_redirect_keeps_credentials(self):
        redirected = self._redirect("https://civitai.red/api/download/models/123?fileId=456")

        self.assertEqual(redirected.get_header("Authorization"), "Bearer secret")
        self.assertEqual(redirected.get_header("Cookie"), "session=secret")

    def _http_error(self, code, body):
        return urllib.error.HTTPError("https://civitai.red/api/download/models/1", code, "Forbidden", {}, io.BytesIO(body))

    def test_early_access_refusal_keeps_civitai_reason(self):
        reason, error = manager._download_failure(self._http_error(403, b'{"error":"Early Access","message":"This asset is in Early Access. You can use Buzz access it now!"}'))

        self.assertEqual(reason, "early_access")
        self.assertEqual(error, "Civitai refused the download: This asset is in Early Access. You can use Buzz access it now!")

    def test_failures_are_classified_by_cause(self):
        cases = [
            (self._http_error(403, b"Forbidden"), "auth"),
            (self._http_error(401, b'{"error":"Unauthorized"}'), "auth"),
            (self._http_error(403, b'{"message":"Purchase required"}'), "forbidden"),
            (self._http_error(404, b""), "not_found"),
            (self._http_error(429, b""), "rate_limited"),
            (self._http_error(502, b'{"message":"boom"}'), "server"),
            (urllib.error.URLError("timed out"), "network"),
            (PermissionError("denied"), "disk"),
        ]
        for exc, expected in cases:
            with self.subTest(expected=expected):
                self.assertEqual(manager._download_failure(exc)[0], expected)
        self.assertEqual(manager._download_failure(self._http_error(502, b'{"message":"boom"}'))[1], "HTTP 502: Forbidden")

    def test_fallback_download_url_uses_download_endpoint_without_v1(self):
        self.assertEqual(
            manager._download_url_for({"id": 123}, {}),
            "https://civitai.red/api/download/models/123",
        )

    def test_civitai_com_download_urls_are_rewritten_to_red(self):
        self.assertEqual(
            manager._download_url_for({}, {"downloadUrl": "https://civitai.com/api/download/models/5?type=Model"}),
            "https://civitai.red/api/download/models/5?type=Model",
        )
        self.assertFalse(manager._validate_civitai_https("https://civitai.com/api/download/models/5"))
        self.assertTrue(manager._validate_civitai_https("https://civitai.red/api/download/models/5"))


class DownloadJobTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.store_path = str(Path(self.temp_dir.name) / "downloads.json")

    def tearDown(self):
        self.temp_dir.cleanup()

    def make_store(self, history_limit=100, retention_seconds=24 * 60 * 60):
        return manager.DownloadJobStore(
            self.store_path,
            history_limit=history_limit,
            retention_seconds=retention_seconds,
        )

    def test_preview_is_saved_before_the_job_reports_completion(self):
        store = self.make_store()
        store.add({"id": "job", "status": "pending", "created_at": 1}, {})
        target = Path(self.temp_dir.name) / "loras" / "hero.safetensors"
        response = mock.MagicMock()
        response.__enter__.return_value = response
        response.headers = {"Content-Length": "5"}
        response.read.side_effect = [b"model", b""]
        statuses = []

        def save_preview(url, path, api_key=None, timeout=30):
            statuses.append(store.snapshot("job")["status"])
            Path(path).write_bytes(b"jpg")

        with (
            mock.patch.object(manager, "_download_store", return_value=store),
            mock.patch.object(manager, "load_config", return_value={"save_metadata": False, "save_preview": True}),
            mock.patch.object(manager._DOWNLOAD_URL_OPENER, "open", return_value=response),
            mock.patch.object(manager, "_download_binary", side_effect=save_preview),
            mock.patch.object(manager, "_root_for_kind", return_value=str(target.parent)),
        ):
            manager._download_worker("job", "https://civitai.red/api/download/models/1", str(target), "loras", {}, "https://image.civitai.com/a/b/preview.jpeg")

        self.assertEqual(statuses, ["downloading"])
        self.assertEqual(store.snapshot("job")["status"], "completed")
        self.assertTrue(target.with_suffix(".jpg").is_file())

    def test_active_count_only_includes_pending_and_downloading(self):
        store = self.make_store()
        for task_id, status in {
            "pending": "pending",
            "running": "downloading",
            "done": "completed",
            "failed": "failed",
        }.items():
            store.add({"id": task_id, "status": status, "created_at": 1}, {})
        self.assertEqual(store.active_count(), 2)

    def test_prune_expires_old_jobs_and_caps_finished_history(self):
        store = self.make_store(history_limit=2, retention_seconds=1_000)
        now = int(time.time())
        store.add({"id": "active", "status": "pending", "created_at": now}, {})
        for task_id, status, finished_at in [
            ("expired", "completed", now - 2_000),
            ("newest", "completed", now - 10),
            ("middle", "failed", now - 20),
            ("oldest-retained", "completed", now - 30),
        ]:
            store.add({"id": task_id, "status": status, "created_at": now}, {})
            field = "failed_at" if status == "failed" else "completed_at"
            store.update(task_id, **{field: finished_at})

        self.assertEqual(set(store.snapshot()), {"active", "newest", "middle"})

    def test_restart_marks_active_jobs_failed_and_preserves_retry_payload(self):
        store = self.make_store()
        store.add(
            {"id": "active", "status": "downloading", "created_at": int(time.time())},
            {"kind": "lora", "download_url": "https://civitai.com/api/download/1"},
        )

        restored = self.make_store()

        self.assertEqual(restored.snapshot("active")["status"], "failed")
        self.assertIn("restart", restored.snapshot("active")["error"])
        self.assertEqual(restored.retry_payload("active")["kind"], "lora")
        self.assertNotIn("retry_payload", restored.snapshot("active"))

    def test_cancel_event_and_status_are_recorded(self):
        store = self.make_store()
        store.add({"id": "active", "status": "pending", "created_at": int(time.time())}, {})

        job = store.request_cancel("active")

        self.assertEqual(job["status"], "cancelling")
        self.assertTrue(store.cancel_event("active").is_set())

    def test_capacity_check_and_add_are_one_operation(self):
        store = self.make_store()
        now = int(time.time())

        first = store.add_if_capacity({"id": "first", "status": "pending", "created_at": now}, {}, 1)
        second = store.add_if_capacity({"id": "second", "status": "pending", "created_at": now}, {}, 1)

        self.assertTrue(first)
        self.assertFalse(second)
        self.assertEqual(set(store.snapshot()), {"first"})

    def test_completed_job_cannot_be_retried(self):
        store = self.make_store()
        store.add(
            {"id": "completed", "status": "completed", "created_at": int(time.time())},
            {"kind": "lora"},
        )

        self.assertIsNone(store.retry_payload("completed"))

    def test_remove_finished_never_removes_active_jobs(self):
        store = self.make_store()
        now = int(time.time())
        store.add({"id": "active", "status": "downloading", "created_at": now}, {})
        store.add({"id": "completed", "status": "completed", "created_at": now}, {})
        store.add({"id": "failed", "status": "failed", "created_at": now}, {})

        self.assertEqual(store.remove_finished("active"), 0)
        self.assertEqual(store.remove_finished("completed"), 1)
        self.assertEqual(store.remove_finished(), 1)
        self.assertEqual(set(store.snapshot()), {"active"})

    def test_remove_finished_many_only_removes_selected_terminal_jobs(self):
        store = self.make_store()
        now = int(time.time())
        for task_id, status in {
            "lora-done": "completed",
            "checkpoint-done": "completed",
            "lora-active": "downloading",
        }.items():
            store.add({"id": task_id, "status": status, "created_at": now}, {})

        self.assertEqual(store.remove_finished_many(["lora-done", "lora-active"]), 1)
        self.assertEqual(set(store.snapshot()), {"checkpoint-done", "lora-active"})


class DownloadApiAsyncTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.original_store = manager._DOWNLOAD_STORE
        self.temp_dir = tempfile.TemporaryDirectory()
        manager._DOWNLOAD_STORE = manager.DownloadJobStore(
            str(Path(self.temp_dir.name) / "downloads.json"),
            history_limit=100,
            retention_seconds=24 * 60 * 60,
        )

    async def asyncTearDown(self):
        manager._DOWNLOAD_STORE = self.original_store
        self.temp_dir.cleanup()

    async def test_rejects_when_active_job_limit_is_reached(self):
        class Request:
            async def json(self):
                return {}

        for index in range(manager.DOWNLOAD_MAX_ACTIVE_JOBS):
            manager._DOWNLOAD_STORE.add({
                "id": str(index),
                "status": "pending",
                "created_at": int(time.time()),
            }, {})
        resolution = {
            "root_kind": "loras",
            "absolute_path": "model.safetensors",
            "relative_path": "Other/Other/model.safetensors",
            "filename": "model.safetensors",
            "download_url": "https://civitai.red/api/download/model",
            "base_model_dir": "Other",
            "category_dir": "Other",
        }
        with (
            mock.patch.object(manager, "_ensure_download_workers"),
            mock.patch.object(manager, "resolve_download_path", return_value=resolution),
        ):
            response = await manager.download_api(Request())

        self.assertEqual(response.status, 429)
        self.assertEqual(len(manager._DOWNLOAD_STORE.snapshot()), manager.DOWNLOAD_MAX_ACTIVE_JOBS)

    async def test_legacy_civitai_com_payload_is_queued_on_red(self):
        resolution = {
            "root_kind": "loras",
            "absolute_path": "model.safetensors",
            "relative_path": "Other/Other/model.safetensors",
            "filename": "model.safetensors",
            "download_url": "",
        }
        with (
            mock.patch.object(manager, "_ensure_download_workers"),
            mock.patch.object(manager, "resolve_download_path", return_value=resolution),
            mock.patch.object(manager._DOWNLOAD_QUEUE, "put_nowait") as put,
        ):
            task_id, _ = manager._enqueue_download_request({
                "kind": "lora",
                "download_url": "https://civitai.com/api/download/models/1",
            })

        self.assertEqual(put.call_args.args[0][1], "https://civitai.red/api/download/models/1")
        self.assertEqual(
            manager._DOWNLOAD_STORE.jobs[task_id]["retry_payload"]["download_url"],
            "https://civitai.red/api/download/models/1",
        )

    async def test_status_endpoint_prunes_expired_history(self):
        manager._DOWNLOAD_STORE.retention_seconds = 100
        now = int(time.time())
        manager._DOWNLOAD_STORE.add({"id": "active", "status": "downloading", "created_at": now}, {})
        manager._DOWNLOAD_STORE.add({"id": "expired", "status": "completed", "created_at": now}, {})
        manager._DOWNLOAD_STORE.update("expired", completed_at=1)

        response = await manager.download_status_api(_QueryRequest())

        self.assertEqual(response.status, 200)
        self.assertEqual(set(response.body), {"active"})

    async def test_cancel_endpoint_marks_active_job_cancelling(self):
        manager._DOWNLOAD_STORE.add({
            "id": "active",
            "status": "pending",
            "created_at": int(time.time()),
        }, {})

        response = await manager.cancel_download_api(_JsonRequest({"task_id": "active"}))

        self.assertEqual(response.status, 200)
        self.assertEqual(response.body["job"]["status"], "cancelling")

    async def test_retry_endpoint_queues_saved_payload(self):
        payload = {"kind": "lora", "download_url": "https://civitai.com/api/download/1"}
        manager._DOWNLOAD_STORE.add({
            "id": "failed",
            "status": "failed",
            "created_at": int(time.time()),
            "failed_at": int(time.time()),
        }, payload)
        with mock.patch.object(
            manager,
            "_enqueue_download_request",
            return_value=("new-task", {"filename": "model.safetensors"}),
        ) as enqueue:
            response = await manager.retry_download_api(_JsonRequest({"task_id": "failed"}))

        self.assertEqual(response.status, 200)
        self.assertEqual(response.body["retry_of"], "failed")
        enqueue.assert_called_once_with(payload)

    async def test_remove_endpoint_clears_only_finished_downloads(self):
        now = int(time.time())
        manager._DOWNLOAD_STORE.add({"id": "active", "status": "downloading", "created_at": now}, {})
        manager._DOWNLOAD_STORE.add({"id": "completed", "status": "completed", "created_at": now}, {})

        response = await manager.remove_download_api(_JsonRequest({}))

        self.assertEqual(response.status, 200)
        self.assertEqual(response.body["removed"], 1)
        self.assertEqual(set(manager._DOWNLOAD_STORE.snapshot()), {"active"})

    async def test_remove_endpoint_rejects_active_download(self):
        manager._DOWNLOAD_STORE.add({
            "id": "active",
            "status": "pending",
            "created_at": int(time.time()),
        }, {})

        response = await manager.remove_download_api(_JsonRequest({"task_id": "active"}))

        self.assertEqual(response.status, 409)
        self.assertIn("active", manager._DOWNLOAD_STORE.snapshot())

    async def test_remove_endpoint_clears_selected_finished_downloads(self):
        now = int(time.time())
        manager._DOWNLOAD_STORE.add({"id": "lora", "status": "completed", "created_at": now}, {})
        manager._DOWNLOAD_STORE.add({"id": "checkpoint", "status": "completed", "created_at": now}, {})

        response = await manager.remove_download_api(_JsonRequest({"task_ids": ["lora"]}))

        self.assertEqual(response.status, 200)
        self.assertEqual(response.body["removed"], 1)
        self.assertEqual(set(manager._DOWNLOAD_STORE.snapshot()), {"checkpoint"})


class AssetApiAsyncTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        base = Path(self.temp_dir.name)
        self.roots = {
            "checkpoints": base / "checkpoints",
            "unet": base / "unet",
            "loras": base / "loras",
            "workflows": base / "workflows",
        }
        for root in self.roots.values():
            root.mkdir(parents=True)
        self.root_patch = mock.patch.object(
            manager,
            "_root_for_kind",
            side_effect=lambda kind: str(self.roots[kind]),
        )
        self.root_patch.start()

    async def asyncTearDown(self):
        self.root_patch.stop()
        self.temp_dir.cleanup()

    async def test_move_checkpoint_to_unet_moves_companions_and_updates_metadata(self):
        source = self.roots["checkpoints"] / "OldBase" / "OldCategory" / "model.safetensors"
        source.parent.mkdir(parents=True)
        source.write_bytes(b"model")
        manager._write_asset_metadata(str(source), "checkpoints", {
            "name": "Example",
            "resolution": {
                "root_kind": "checkpoints",
                "base_model_dir": "OldBase",
                "category_dir": "OldCategory",
                "filename": "model.safetensors",
                "relative_path": "OldBase/OldCategory/model.safetensors",
            },
        })
        source.with_suffix(".png").write_bytes(b"preview")

        response = await manager.move_asset_api(_JsonRequest({
            "root_kind": "checkpoints",
            "relative_path": "OldBase/OldCategory/model.safetensors",
            "target_root_kind": "unet",
            "base_model_dir": "NewBase",
            "category_dir": "NewCategory",
            "filename": "renamed.safetensors",
        }))

        target = self.roots["unet"] / "NewBase" / "NewCategory" / "renamed.safetensors"
        self.assertEqual(response.status, 200)
        self.assertFalse(source.exists())
        self.assertTrue(target.is_file())
        self.assertTrue(target.with_suffix(".png").is_file())
        metadata = json.loads(target.with_suffix(".json").read_text(encoding="utf-8"))
        self.assertEqual(metadata["resolution"], {
            "root_kind": "unet",
            "base_model_dir": "NewBase",
            "category_dir": "NewCategory",
            "filename": "renamed.safetensors",
            "relative_path": "NewBase/NewCategory/renamed.safetensors",
        })

    async def test_move_rejects_cross_type_transition(self):
        source = self.roots["loras"] / "Base" / "Category" / "model.safetensors"
        source.parent.mkdir(parents=True)
        source.write_bytes(b"model")
        response = await manager.move_asset_api(_JsonRequest({
            "root_kind": "loras",
            "relative_path": "Base/Category/model.safetensors",
            "target_root_kind": "workflows",
            "category_dir": "Generation",
            "filename": "model.json",
        }))

        self.assertEqual(response.status, 400)
        self.assertTrue(source.is_file())

    async def test_move_preflight_preserves_source_when_companion_target_exists(self):
        source = self.roots["checkpoints"] / "Old" / "Category" / "model.safetensors"
        source.parent.mkdir(parents=True)
        source.write_bytes(b"model")
        source.with_suffix(".png").write_bytes(b"source-preview")
        target_preview = self.roots["unet"] / "New" / "Category" / "model.png"
        target_preview.parent.mkdir(parents=True)
        target_preview.write_bytes(b"existing-preview")

        response = await manager.move_asset_api(_JsonRequest({
            "root_kind": "checkpoints",
            "relative_path": "Old/Category/model.safetensors",
            "target_root_kind": "unet",
            "base_model_dir": "New",
            "category_dir": "Category",
            "filename": "model.safetensors",
        }))

        self.assertEqual(response.status, 409)
        self.assertTrue(source.is_file())
        self.assertEqual(source.with_suffix(".png").read_bytes(), b"source-preview")
        self.assertEqual(target_preview.read_bytes(), b"existing-preview")

    async def test_delete_removes_asset_companions_only(self):
        asset = self.roots["loras"] / "Base" / "Category" / "delete.safetensors"
        asset.parent.mkdir(parents=True)
        asset.write_bytes(b"model")
        asset.with_suffix(".json").write_text("{}", encoding="utf-8")
        asset.with_suffix(".webp").write_bytes(b"preview")
        unrelated = asset.parent / "keep.txt"
        unrelated.write_text("keep", encoding="utf-8")

        response = await manager.delete_asset_api(_JsonRequest({
            "root_kind": "loras",
            "relative_path": "Base/Category/delete.safetensors",
        }))

        self.assertEqual(response.status, 200)
        self.assertFalse(asset.exists())
        self.assertFalse(asset.with_suffix(".json").exists())
        self.assertFalse(asset.with_suffix(".webp").exists())
        self.assertTrue(unrelated.is_file())

    async def test_delete_rejects_direct_companion_path(self):
        metadata = self.roots["loras"] / "Base" / "Category" / "model.json"
        metadata.parent.mkdir(parents=True)
        metadata.write_text("{}", encoding="utf-8")

        response = await manager.delete_asset_api(_JsonRequest({
            "root_kind": "loras",
            "relative_path": "Base/Category/model.json",
        }))

        self.assertEqual(response.status, 400)
        self.assertTrue(metadata.is_file())

    async def test_delete_normalizes_workflow_root_before_removing_companion(self):
        asset = self.roots["workflows"] / "Generation" / "flow.json"
        asset.parent.mkdir(parents=True)
        asset.write_text("{}", encoding="utf-8")
        companion = asset.with_name("flow.civitai.json")
        companion.write_text("{}", encoding="utf-8")

        response = await manager.delete_asset_api(_JsonRequest({
            "root_kind": "WORKFLOWS",
            "relative_path": "Generation/flow.json",
        }))

        self.assertEqual(response.status, 200)
        self.assertFalse(asset.exists())
        self.assertFalse(companion.exists())

    async def test_delete_resolves_asset_in_secondary_model_root(self):
        secondary = self.roots["loras"].parent / "secondary-loras"
        secondary.mkdir()
        asset = secondary / "model.safetensors"
        asset.write_bytes(b"model")
        with mock.patch.object(
            manager,
            "_roots_for_kind",
            return_value=[str(self.roots["loras"]), str(secondary)],
        ):
            response = await manager.delete_asset_api(_JsonRequest({
                "root_kind": "loras",
                "storage_root_id": manager._storage_root_id(str(secondary)),
                "relative_path": "model.safetensors",
            }))

        self.assertEqual(response.status, 200)
        self.assertFalse(asset.exists())


class MetadataWorkerTests(unittest.TestCase):
    def test_complete_model_uses_version_model_id_when_summary_omits_it(self):
        version = {
            "id": 22,
            "modelId": 11,
            "model": {"name": "Example", "type": "LORA"},
        }
        with (
            mock.patch.object(manager, "load_config", return_value={}),
            mock.patch.object(manager, "_read_json_url_with_retries", return_value=None) as read_model,
        ):
            model = manager._complete_civitai_model(version)

        self.assertEqual(model["id"], 11)
        self.assertEqual(model["name"], "Example")
        self.assertIn("/models/11", read_model.call_args.args[0])

    def test_worker_hashes_and_writes_companion_metadata(self):
        with tempfile.TemporaryDirectory() as root:
            asset = Path(root) / "model.safetensors"
            asset.write_bytes(b"model-data")
            civitai_data = {
                "id": 22,
                "name": "Version",
                "baseModel": "SDXL 1.0",
                "trainedWords": ["trigger"],
                "images": [{"url": "https://image.civitai.com/x/04a43bd2-a6f2-493f-ba86-c677fe642f00/original=true/preview.jpeg"}],
                "model": {
                    "id": 11,
                    "name": "Example",
                    "type": "LORA",
                    "creator": {"username": "tester"},
                },
            }
            full_model = {
                **civitai_data["model"],
                "tags": ["character", "style"],
                "description": "Example description",
            }

            def save_preview(_url, target_path, **_kwargs):
                Path(target_path).write_bytes(b"preview")

            with (
                mock.patch.object(manager, "_metadata_from_hash", return_value=civitai_data),
                mock.patch.object(manager, "_complete_civitai_model", return_value=full_model),
                mock.patch.object(manager, "_download_binary", side_effect=save_preview),
            ):
                result = manager._enrich_metadata_worker(str(asset), "loras")

            metadata_path = asset.with_suffix(".json")
            self.assertTrue(metadata_path.is_file())
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            self.assertTrue(result["matched"])
            self.assertTrue(result["preview_saved"])
            self.assertEqual(metadata["model_id"], 11)
            self.assertEqual(metadata["version_id"], 22)
            self.assertEqual(metadata["hashes"]["SHA256"], result["sha256"].upper())
            self.assertEqual(metadata["tags"], ["character", "style"])
            self.assertEqual(metadata["metadata_match_status"], "matched")
            self.assertTrue(asset.with_suffix(".jpg").is_file())

    def test_worker_reuses_saved_sha256(self):
        with tempfile.TemporaryDirectory() as root:
            asset = Path(root) / "model.safetensors"
            asset.write_bytes(b"model-data")
            saved_hash = "a" * 64
            asset.with_suffix(".json").write_text(json.dumps({
                "hashes": {"SHA256": saved_hash.upper()},
            }), encoding="utf-8")
            with (
                mock.patch.object(manager, "_hash_file", side_effect=AssertionError("hash should be reused")),
                mock.patch.object(manager, "_metadata_from_hash", return_value=None),
            ):
                result = manager._enrich_metadata_worker(str(asset), "loras")

        self.assertEqual(result["sha256"], saved_hash)
        self.assertFalse(result["matched"])

    def test_preview_selection_skips_video(self):
        version = {"images": [
            {"url": "https://example.com/preview.mp4", "type": "video"},
            {"url": "https://example.com/preview.jpeg", "type": "image"},
        ]}
        self.assertEqual(
            manager._first_preview_url(version, {}),
            "https://example.com/preview.jpeg",
        )


class MetadataApiAsyncTests(unittest.IsolatedAsyncioTestCase):
    async def test_enrichment_runs_without_blocking_event_loop(self):
        class Request:
            async def json(self):
                return {"root_kind": "loras", "relative_path": "model.safetensors"}

        with tempfile.TemporaryDirectory() as root:
            asset = Path(root) / "model.safetensors"
            asset.write_bytes(b"model-data")

            def slow_worker(_path, _kind):
                time.sleep(0.08)
                return {"sha256": "abc", "metadata": {}, "matched": False}

            with (
                mock.patch.object(manager, "_resolve_asset_path", return_value=str(asset)),
                mock.patch.object(manager, "_enrich_metadata_worker", side_effect=slow_worker),
            ):
                task = asyncio.create_task(manager.enrich_metadata_api(Request()))
                await asyncio.sleep(0.02)
                self.assertFalse(task.done())
                marker = []
                await asyncio.sleep(0)
                marker.append("event-loop-responsive")
                response = await task

        self.assertEqual(marker, ["event-loop-responsive"])
        self.assertEqual(response.status, 200)


class AnimaPortTests(unittest.TestCase):
    def test_library_snapshot_only_scans_loras(self):
        with mock.patch.object(manager, "_scan_library_kind", return_value=[]) as scan:
            manager._scan_all_library_items()
        scan.assert_called_once_with("loras")

    def test_first_load_imports_legacy_anima_key_and_lora_favorites(self):
        with tempfile.TemporaryDirectory() as user_dir:
            Path(user_dir, "anima_lora_config.json").write_text(
                json.dumps({"civitai_api_key": "legacy-key", "custom_lora_dir": ""}), encoding="utf-8")
            Path(user_dir, "anima_tools_favorites.json").write_text(json.dumps({"lora": {"items": [
                {"id": 42, "name": "Old Favorite", "creator": {"username": "maker"},
                 "modelVersions": [{"id": 7, "baseModel": "Anima", "images": []}]},
                {"name": "missing id"},
            ]}}), encoding="utf-8")
            with mock.patch.object(manager.folder_paths, "get_user_directory", return_value=user_dir), \
                    mock.patch.object(manager, "_CONFIG_CACHE", None), \
                    mock.patch.object(manager, "_scan_roots", return_value={"items": []}):
                self.assertEqual(manager.load_config()["civitai_api_key"], "legacy-key")
                store = manager._load_favorites()
                self.assertTrue(os.path.isfile(manager._favorites_path()))
        self.assertEqual([item["key"] for item in store["items"]], ["civitai:lora:42"])
        self.assertEqual(store["items"][0]["creator"], "maker")
        self.assertEqual(store["items"][0]["version_id"], "7")
        self.assertEqual(store["items"][0]["model"]["modelVersions"][0]["id"], 7)


if __name__ == "__main__":
    unittest.main()
