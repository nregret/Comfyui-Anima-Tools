from __future__ import annotations

import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "tools" / "build_catalog_bundle.py"
SPEC = importlib.util.spec_from_file_location("build_catalog_bundle", MODULE_PATH)
build_catalog_bundle = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(build_catalog_bundle)


class CatalogBundleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sources = build_catalog_bundle.load_sources()
        cls.files = build_catalog_bundle.build_files()
        cls.index = json.loads(cls.files["index.json"])

    def test_manifest_contract_and_counts(self):
        self.assertEqual(self.index["format"], "comfyui-anima-tools-catalog")
        self.assertEqual(self.index["schema_version"], 1)
        self.assertEqual(self.index["provider_id"], "comfyui-anima-tools")
        self.assertEqual(self.index["package_version"], build_catalog_bundle.package_version())
        self.assertEqual(self.index["catalog_version"], self.index["package_version"])
        self.assertEqual(
            {kind: spec["count"] for kind, spec in self.index["artifacts"].items()},
            {"artist": 40600, "character": 8000, "pose": 297, "clothing": 430, "background": 1087},
        )
        self.assertEqual(self.index["artifacts"]["character"]["official_count"], 7999)

    def test_artifacts_preserve_source_records_order_and_values(self):
        artifacts = {
            kind: json.loads(self.files[spec["href"]])
            for kind, spec in self.index["artifacts"].items()
        }
        self.assertEqual(artifacts["artist"], self.sources["artist"])
        self.assertEqual(artifacts["pose"], self.sources["pose"])
        self.assertEqual(artifacts["clothing"], self.sources["clothing"])
        self.assertEqual(artifacts["background"], self.sources["background"])

        characters = artifacts["character"]
        official_seen = 0
        for source, bundled in zip(self.sources["character"], characters):
            self.assertEqual({key: value for key, value in bundled.items() if key != "official"}, source)
            key = f"{build_catalog_bundle._normalize(source.get('name'))}||{build_catalog_bundle._normalize(source.get('copyright'))}"
            expected = self.sources["character_official"].get(key)
            if expected is None:
                self.assertNotIn("official", bundled)
            else:
                official_seen += 1
                self.assertEqual(bundled["official"], expected)
        self.assertEqual(official_seen, 7999)

    def test_hash_names_sizes_and_byte_parity(self):
        for kind, spec in self.index["artifacts"].items():
            raw = self.files[spec["href"]]
            digest = hashlib.sha256(raw).hexdigest()
            self.assertEqual(spec["sha256"], digest)
            self.assertEqual(spec["size_bytes"], len(raw))
            self.assertEqual(Path(spec["href"]).name, f"{kind}-{digest[:12]}.json")

        build_catalog_bundle.check_files(self.files)
        with tempfile.TemporaryDirectory(prefix="anima-catalog-test-") as temp:
            output = Path(temp) / "catalog"
            build_catalog_bundle.write_files(self.files, output)
            build_catalog_bundle.check_files(build_catalog_bundle.build_files(), output)

    def test_generated_files_are_deterministic_and_have_safe_declarations(self):
        self.assertEqual(self.files, build_catalog_bundle.build_files())
        all_text = b"".join(self.files.values()).decode("utf-8")
        for field in ("generated_at", "created_at", "updated_at", "timestamp"):
            self.assertNotIn(f'"{field}"', all_text)
        self.assertEqual(self.index["provenance"]["license_spdx"], "NOASSERTION")
        self.assertIn("external", self.index["provenance"]["ownership"])
        self.assertTrue(self.index["preview_templates"]["artist"]["mutable_ref"])
        self.assertTrue(self.index["preview_templates"]["character"]["mutable_ref"])
        self.assertEqual(self.index["preview_templates"]["pose"]["field"], "preview")


if __name__ == "__main__":
    unittest.main()
