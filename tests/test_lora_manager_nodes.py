from __future__ import annotations

import importlib.util
import json
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def _load_nodes_module():
    package_name = "anima_lora_manager_test_nodes_package"
    package = types.ModuleType(package_name)
    package.__path__ = [str(PROJECT_ROOT / "lora_manager")]
    manager_api = types.ModuleType(f"{package_name}.manager_api")
    manager_api._storage_root_for_asset = lambda _kind, _root_id: ""
    sys.modules[package_name] = package
    sys.modules[f"{package_name}.manager_api"] = manager_api
    module_name = f"{package_name}.nodes"
    sys.modules.pop(module_name, None)
    spec = importlib.util.spec_from_file_location(module_name, PROJECT_ROOT / "lora_manager" / "nodes.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load nodes.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


nodes = _load_nodes_module()


class LoraListParsingTests(unittest.TestCase):
    def test_normalizes_entries_and_skips_invalid_values(self):
        parsed = nodes._parse_lora_list(json.dumps([
            {"name": "folder\\one.safetensors", "strength_model": "0.65"},
            {"name": "two.safetensors", "strength_model": "bad", "enabled": False, "storage_root_id": "secondary"},
            {"name": ""},
            "not-an-object",
        ]))
        self.assertEqual(parsed, [
            {"name": "folder/one.safetensors", "strength_model": 0.65, "enabled": True},
            {"name": "two.safetensors", "strength_model": 1.0, "enabled": False, "storage_root_id": "secondary"},
        ])

    def test_invalid_json_becomes_empty_list(self):
        self.assertEqual(nodes._parse_lora_list("not-json"), [])
        self.assertEqual(nodes._parse_lora_list("{}"), [])


class LoraPathResolutionTests(unittest.TestCase):
    def test_storage_root_id_selects_the_exact_configured_root(self):
        with tempfile.TemporaryDirectory() as base:
            primary = Path(base) / "primary"
            secondary = Path(base) / "secondary"
            primary.mkdir()
            secondary.mkdir()
            selected = secondary / "style.safetensors"
            selected.write_bytes(b"lora")

            folder_paths = types.ModuleType("folder_paths")
            folder_paths.get_full_path = lambda _kind, _name: None
            folder_paths.get_folder_paths = lambda _kind: [str(primary), str(secondary)]
            folder_paths.get_filename_list = lambda _kind: ["style.safetensors"]

            with mock.patch.dict(sys.modules, {"folder_paths": folder_paths}), mock.patch.object(
                nodes.manager_api,
                "_storage_root_for_asset",
                return_value=str(secondary),
            ):
                self.assertTrue(os.path.samefile(
                    nodes._resolve_lora_path("style.safetensors", "secondary-id"),
                    selected,
                ))

    def test_root_candidate_rejects_parent_escape(self):
        with tempfile.TemporaryDirectory() as base:
            root = Path(base) / "root"
            root.mkdir()
            outside = Path(base) / "outside.safetensors"
            outside.write_bytes(b"lora")
            self.assertIsNone(nodes._safe_root_candidate(str(root), "../outside.safetensors"))


class MultiLoraLoaderTests(unittest.TestCase):
    def test_applies_enabled_loras_in_order_and_skips_missing(self):
        with tempfile.TemporaryDirectory() as base:
            root = Path(base)
            first = root / "first.safetensors"
            second = root / "nested" / "second.safetensors"
            second.parent.mkdir()
            first.write_bytes(b"first")
            second.write_bytes(b"second")

            folder_paths = types.ModuleType("folder_paths")
            known = {
                "first.safetensors": str(first),
                "nested/second.safetensors": str(second),
            }
            folder_paths.get_full_path = lambda _kind, name: known.get(name)
            folder_paths.get_folder_paths = lambda _kind: [str(root)]
            folder_paths.get_filename_list = lambda _kind: list(known)

            comfy = types.ModuleType("comfy")
            comfy.__path__ = []
            comfy_sd = types.ModuleType("comfy.sd")
            comfy_utils = types.ModuleType("comfy.utils")
            comfy_utils.load_torch_file = lambda path, safe_load=True: Path(path).stem
            calls = []

            def apply_lora(model, clip, lora_data, strength_model, strength_clip):
                calls.append((lora_data, strength_model, strength_clip, clip))
                return f"{model}>{lora_data}:{strength_model}", clip

            comfy_sd.load_lora_for_models = apply_lora
            comfy.sd = comfy_sd
            comfy.utils = comfy_utils

            payload = json.dumps([
                {"name": "first.safetensors", "strength_model": 0.5, "enabled": True},
                {"name": "disabled.safetensors", "strength_model": 2, "enabled": False},
                {"name": "missing.safetensors", "strength_model": 1, "enabled": True},
                {"name": "nested/second.safetensors", "strength_model": -0.25, "enabled": True},
            ])
            modules = {
                "folder_paths": folder_paths,
                "comfy": comfy,
                "comfy.sd": comfy_sd,
                "comfy.utils": comfy_utils,
            }
            with mock.patch.dict(sys.modules, modules):
                result = nodes.AnimaMultiLoraLoader().load_loras("base", payload)

            self.assertEqual(result, ("base>first:0.5>second:-0.25",))
            self.assertEqual(calls, [
                ("first", 0.5, 0.0, None),
                ("second", -0.25, 0.0, None),
            ])


if __name__ == "__main__":
    unittest.main()
