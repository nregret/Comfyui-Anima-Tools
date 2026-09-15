import ast
import asyncio
import importlib.util
import io
import json
import os
import sys
import tempfile
import unittest
import urllib.request
from email.message import Message
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch


ROOT = Path(__file__).resolve().parents[1]


class LoraSecurityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.loras = self.root / "loras"
        self.loras.mkdir()
        self.outside = self.root / "outside"
        self.outside.mkdir()
        self.folder_paths = SimpleNamespace(
            get_folder_paths=lambda kind: [str(self.loras)],
            get_full_path=lambda kind, name: None,
            get_filename_list=lambda kind: [],
        )
        spec = importlib.util.spec_from_file_location("anima_security_api", ROOT / "anima_lora_api.py")
        self.api = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {"folder_paths": self.folder_paths}):
            spec.loader.exec_module(self.api)
        self.api._LORA_CONFIG_CACHE = {"custom_lora_dir": "", "civitai_api_key": "TEST_ONLY_KEY"}

        names = {
            "AnimaMultiLoraLoader", "get_custom_lora_dir_status", "get_lora_root_infos",
            "get_lora_roots", "resolve_lora_root", "is_relative_to_path",
            "resolve_lora_candidate_under_root", "is_lora_path_contained",
            "resolve_lora_companion_path", "resolve_lora_abs_path",
            "lora_get_config_api", "lora_save_config_api", "lora_remote_preview_api",
        }
        tree = ast.parse((ROOT / "nodes.py").read_text(encoding="utf-8"))
        definitions = [node for node in tree.body if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in names]
        for node in definitions:
            node.decorator_list = []
        self.saved = []
        self.web = SimpleNamespace(
            json_response=lambda data, status=200: SimpleNamespace(data=data, status=status),
            Response=lambda status=200: SimpleNamespace(status=status),
            HTTPException=RuntimeError,
        )
        self.ns = {
            "__file__": str(ROOT / "nodes.py"), "os": os, "Path": Path, "json": json,
            "folder_paths": self.folder_paths, "web": self.web, "urllib": urllib,
            "load_lora_config": self.api.load_config,
            "save_lora_config": lambda config: self.saved.append(config) or True,
            "get_lora_save_dir": self.api.get_lora_save_dir,
            "validate_lora_directory": self.api.validate_lora_directory,
            "normalize_lora_filename": self.api.normalize_lora_filename,
            "CIVITAI_IMAGE_HOSTS": self.api.CIVITAI_IMAGE_HOSTS,
        }
        exec(compile(ast.Module(body=definitions, type_ignores=[]), "<lora-security-tests>", "exec"), self.ns)

    def request(self, body):
        async def read_json():
            return body
        return SimpleNamespace(json=read_json)

    def test_rejects_windows_posix_and_non_model_filenames(self):
        for name in ("../x.safetensors", "..\\x.safetensors", "/x.safetensors", "C:x.safetensors", "C:\\x.safetensors", "//server/x.safetensors", "x.py", "x.pt", "x.safetensors:stream", "NUL.safetensors", "a/../x.safetensors", "a\x00.safetensors"):
            with self.subTest(name=name):
                self.assertIsNone(self.api.normalize_lora_filename(name))
        self.assertEqual(self.api.normalize_lora_filename("sub\\normal.safetensors"), "sub/normal.safetensors")

    def test_config_never_returns_stored_key(self):
        response = asyncio.run(self.ns["lora_get_config_api"](None))
        self.assertTrue(response.data["has_civitai_api_key"])
        self.assertNotIn("civitai_api_key", response.data)
        self.assertNotIn("TEST_ONLY_KEY", json.dumps(response.data))

    def test_directory_change_preserves_existing_key(self):
        sub = self.loras / "anima"
        sub.mkdir()
        response = asyncio.run(self.ns["lora_save_config_api"](self.request({"custom_lora_dir": str(sub)})))
        self.assertEqual(response.status, 200)
        self.assertEqual(self.saved[0]["civitai_api_key"], "TEST_ONLY_KEY")
        self.assertNotIn("TEST_ONLY_KEY", json.dumps(response.data))

    def test_key_can_be_explicitly_replaced_or_cleared(self):
        for key in ("REPLACEMENT_TEST_KEY", ""):
            response = asyncio.run(self.ns["lora_save_config_api"](self.request({"civitai_api_key": key})))
            self.assertEqual(response.status, 200)
            self.assertEqual(self.saved[-1]["civitai_api_key"], key)
            self.assertEqual(response.data["has_civitai_api_key"], bool(key))

    def test_config_rejects_directory_outside_registered_roots(self):
        response = asyncio.run(self.ns["lora_save_config_api"](self.request({"custom_lora_dir": str(self.outside)})))
        self.assertEqual(response.status, 400)
        self.assertEqual(self.saved, [])

    def test_invalid_legacy_directory_remains_editable(self):
        self.api._LORA_CONFIG_CACHE["custom_lora_dir"] = str(self.outside)
        response = asyncio.run(self.ns["lora_get_config_api"](None))
        self.assertEqual(response.status, 200)
        self.assertFalse(response.data["custom_lora_dir_valid"])
        self.assertEqual(response.data["resolved_save_dir"], "")
        with self.assertRaises(ValueError):
            self.api.get_lora_save_dir()

    def test_download_rejects_unsafe_names_before_starting_thread(self):
        with patch.object(self.api.threading, "Thread") as thread:
            for name in ("D:outside.safetensors", "../outside.safetensors", "sub/model.safetensors", "model.py"):
                with self.subTest(name=name), self.assertRaises(ValueError):
                    self.api.start_download_task(123, "https://civitai.com/api/download/models/123", name)
            thread.assert_not_called()

    def test_download_only_accepts_matching_civitai_version(self):
        for url in ("https://example.com/file", "https://civitai.com/api/download/models/456", "https://civitai.com/other", "http://civitai.com/api/download/models/123", "https://civitai.com/api/download/models/123?token=TEST_ONLY_KEY", "https://civitai.com:8443/api/download/models/123"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                self.api.start_download_task(123, url, "model.safetensors")

    def test_valid_download_stays_in_registered_root(self):
        with patch.object(self.api.threading, "Thread") as thread:
            self.api.start_download_task(123, "https://civitai.red/api/download/models/123?format=SafeTensor", "model.safetensors")
            args = thread.call_args.kwargs["args"]
            self.assertEqual(args[1], "https://civitai.com/api/download/models/123?format=SafeTensor")
            self.assertEqual(Path(args[2]), self.loras / "model.safetensors")
            thread.return_value.start.assert_called_once()

    def test_redirect_strips_auth_and_cookies(self):
        request = urllib.request.Request("https://civitai.com/api/download/models/123", headers={"Authorization": "Bearer TEST_ONLY_KEY", "Cookie": "test=value"})
        handler = self.api._CivitaiRedirectHandler()
        for target in ("https://civitai.com/redirect", "https://bucket.r2.cloudflarestorage.com/model?signature=test"):
            redirect = handler.redirect_request(request, None, 307, "", {}, target)
            self.assertIsNone(redirect.get_header("Authorization"))
            self.assertIsNone(redirect.get_header("Cookie"))
            self.assertNotIn("TEST_ONLY_KEY", redirect.full_url)

    def test_redirect_rejects_private_untrusted_and_plain_http_destinations(self):
        request = urllib.request.Request("https://civitai.com/api/download/models/123")
        for target in ("https://127.0.0.1/file", "http://civitai.com/file", "https://example.com/file", "https://image.civitai.com.evil.invalid/file", "file:///tmp/file", "https://user:pass@image.civitai.com/file"):
            with self.subTest(target=target), self.assertRaises(ValueError):
                self.api._CivitaiRedirectHandler().redirect_request(request, None, 307, "", {}, target)

    def test_preview_rejects_untrusted_urls_before_network_access(self):
        with patch.object(self.api.urllib.request, "build_opener") as opener:
            for url in ("http://127.0.0.1/image", "https://example.com/image", "https://civitai.com/api/file"):
                with self.subTest(url=url), self.assertRaises(ValueError):
                    self.api.read_civitai_preview(url)
            opener.assert_not_called()

    def test_preview_route_rejects_untrusted_source(self):
        request = SimpleNamespace(query={"url": "http://127.0.0.1/private"})
        response = asyncio.run(self.ns["lora_remote_preview_api"](request))
        self.assertEqual(response.status, 400)

    def test_download_writes_model_metadata_without_key_in_url(self):
        response = io.BytesIO(b"MODEL_TEST_BYTES")
        response.headers = {"Content-Length": "16"}
        opener = Mock()
        opener.open.return_value = response
        self.api._DOWNLOAD_JOBS["123"] = {}
        with patch.object(self.api.urllib.request, "build_opener", return_value=opener):
            self.api._download_thread("123", "https://civitai.com/api/download/models/123", str(self.loras / "model.safetensors"), "TEST_ONLY_KEY", {"version": {"images": []}})
        self.assertEqual((self.loras / "model.safetensors").read_bytes(), b"MODEL_TEST_BYTES")
        self.assertEqual(json.loads((self.loras / "model.json").read_text()), {"version": {"images": []}})
        req = opener.open.call_args.args[0]
        self.assertNotIn("TEST_ONLY_KEY", req.full_url)
        self.assertEqual(req.get_header("Authorization"), "Bearer TEST_ONLY_KEY")
        self.assertEqual(self.api._DOWNLOAD_JOBS["123"]["status"], "completed")
        self.assertEqual(list(self.loras.glob(".anima-*")), [])

    def make_symlink(self, link, target, directory=False):
        try:
            link.symlink_to(target, target_is_directory=directory)
        except OSError as error:
            self.skipTest(f"Symlinks unavailable: {error}")

    def test_symlink_directory_cannot_escape_registered_roots(self):
        link = self.loras / "escape"
        self.make_symlink(link, self.outside, directory=True)
        with self.assertRaises(ValueError):
            self.api.validate_lora_directory(str(link))

    def test_model_resolver_blocks_symlink_escape_and_non_safetensor_target(self):
        outside = self.outside / "model.safetensors"
        outside.write_bytes(b"outside")
        self.make_symlink(self.loras / "escape.safetensors", outside)
        pickle = self.loras / "unsafe.pt"
        pickle.write_bytes(b"not a checkpoint")
        self.make_symlink(self.loras / "disguised.safetensors", pickle)
        self.assertIsNone(self.ns["resolve_lora_abs_path"]("escape.safetensors"))
        self.assertIsNone(self.ns["resolve_lora_abs_path"]("disguised.safetensors"))

    def test_companion_atomic_write_does_not_follow_symlink(self):
        victim = self.outside / "victim.json"
        victim.write_bytes(b"keep")
        companion = self.loras / "model.json"
        self.make_symlink(companion, victim)
        self.api._write_lora_companion(str(companion), b"{}")
        self.assertEqual(victim.read_bytes(), b"keep")
        self.assertEqual(companion.read_bytes(), b"{}")

    def test_model_resolver_accepts_nested_registered_lora(self):
        sub = self.loras / "sub"
        sub.mkdir()
        model = sub / "model.safetensors"
        model.write_bytes(b"test")
        self.assertEqual(self.ns["resolve_lora_abs_path"]("sub/model.safetensors"), str(model))

    def test_loader_never_passes_absolute_or_pickle_paths_to_comfy(self):
        comfy = SimpleNamespace(sd=SimpleNamespace(load_lora_for_models=Mock()), utils=SimpleNamespace(load_torch_file=Mock()))
        modules = {"comfy": comfy, "comfy.sd": comfy.sd, "comfy.utils": comfy.utils, "folder_paths": self.folder_paths}
        with patch.dict(sys.modules, modules):
            loader = self.ns["AnimaMultiLoraLoader"]()
            for name in ("../unsafe.pt", "unsafe.pt", "C:unsafe.safetensors", str(self.outside / "model.safetensors")):
                with self.subTest(name=name), self.assertRaises(ValueError):
                    loader.load_loras(object(), json.dumps([{"name": name}]))
            comfy.utils.load_torch_file.assert_not_called()

    def test_preview_enforces_content_type_and_size(self):
        for content_type, data in (("text/html", b"<html>"), ("image/png", b"x" * (self.api.PREVIEW_MAX_BYTES + 1))):
            response = io.BytesIO(data)
            response.headers = Message()
            response.headers["Content-Type"] = content_type
            opener = Mock()
            opener.open.return_value = response
            with patch.object(self.api.urllib.request, "build_opener", return_value=opener), self.assertRaises(ValueError):
                self.api.read_civitai_preview("https://image.civitai.com/test.png")


if __name__ == "__main__":
    unittest.main()
