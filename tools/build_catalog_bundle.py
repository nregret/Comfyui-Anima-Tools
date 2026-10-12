"""Build deterministic, content-addressed catalog JSON artifacts."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from collections import OrderedDict
from pathlib import Path
from typing import Any, Sequence

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover - Python 3.9/3.10 CI path
    tomllib = None


ROOT = Path(__file__).resolve().parents[1]
JS_DIR = ROOT / "js"
OUTPUT_DIR = JS_DIR / "catalog"
PYPROJECT_PATH = ROOT / "pyproject.toml"

PROVIDER_ID = "comfyui-anima-tools"
FORMAT = "comfyui-anima-tools-catalog"
SCHEMA_VERSION = 1
HASH_LENGTH = 12

SOURCE_PATHS = OrderedDict(
    (
        ("artist", "js/data.js"),
        ("character", "js/character_data.js"),
        ("character_official", "js/character_official_data.json"),
        ("pose", "js/pose_data.js"),
        ("clothing", "js/clothing_data.js"),
        ("background", "js/background_data.js"),
    )
)

EXPECTED_COUNTS = {
    "artist": 40600,
    "character": 8000,
    "character_official": 7999,
    "pose": 297,
    "clothing": 430,
    "background": 1087,
}

PREVIEW_TEMPLATES = {
    "artist": {
        "status": "external",
        "owner": "ThetaCursed/Anima-Assets",
        "mutable_ref": True,
        "fields": ["p", "id"],
        "templates": {
            "jsdelivr": "https://fastly.jsdelivr.net/gh/ThetaCursed/Anima-Assets@main/images/{p}/{id}.webp",
            "github": "https://raw.githubusercontent.com/ThetaCursed/Anima-Assets/main/images/{p}/{id}.webp",
            "statically": "https://cdn.statically.io/gh/ThetaCursed/Anima-Assets/main/images/{p}/{id}.webp",
        },
    },
    "character": {
        "status": "external",
        "owner": "AnimaDex",
        "mutable_ref": True,
        "fields": ["name", "copyright"],
        "template": "https://blobs.animadex.net/Outputs/thumbs/{name[, copyright]}.webp",
        "encoding": "percent-encode the combined name and optional copyright",
    },
    "pose": {
        "status": "record",
        "owner": "nregret/AnimaTags-DB",
        "mutable_ref": True,
        "field": "preview",
    },
    "clothing": {
        "status": "record",
        "owners": ["nregret/Dressing-doll", "hayde0096/Kisegaeningyou"],
        "mutable_ref": True,
        "field": "preview",
    },
    "background": {
        "status": "record",
        "owner": "nregret/AnimaTags-DB",
        "mutable_ref": True,
        "field": "preview",
        "may_be_empty": True,
    },
}

PROVENANCE = {
    "ownership": "catalog records are bundled by the provider; preview media is external",
    "license_spdx": "NOASSERTION",
    "sources": {
        "artist": {
            "name": "Anima-Style-Explorer",
            "url": "https://github.com/ThetaCursed/Anima-Style-Explorer",
        },
        "character": {
            "name": "AnimaDex",
            "url": "https://github.com/zetaneko/AnimaDex",
        },
        "character_official": {
            "name": "AnimaDex search API snapshot",
            "url": "https://animadex.net/api/characters/search",
        },
        "pose": {"name": "AnimaTags-DB", "url": "https://github.com/nregret/AnimaTags-DB"},
        "clothing": {
            "name": "Dressing-doll and Kisegaeningyou",
            "urls": [
                "https://github.com/nregret/Dressing-doll",
                "https://github.com/hayde0096/Kisegaeningyou",
            ],
        },
        "background": {"name": "AnimaTags-DB", "url": "https://github.com/nregret/AnimaTags-DB"},
    },
}


class CatalogCheckError(RuntimeError):
    """Raised when checked-in catalog files do not match a fresh build."""


def canonical_json(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")


def sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def load_js_array(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8-sig")
    start = text.find("[")
    if start < 0:
        raise ValueError(f"missing JSON array in {path}")
    value, _ = json.JSONDecoder().raw_decode(text, start)
    if not isinstance(value, list) or not all(isinstance(item, dict) for item in value):
        raise ValueError(f"expected an object array in {path}")
    return value


def load_json_object(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"expected a JSON object in {path}")
    return value


def package_version(path: Path = PYPROJECT_PATH) -> str:
    raw = path.read_bytes()
    if tomllib is not None:
        value = tomllib.loads(raw.decode("utf-8"))["project"]["version"]
        if not isinstance(value, str) or not value:
            raise ValueError("project.version must be a non-empty string")
        return value

    in_project = False
    for raw_line in raw.decode("utf-8").splitlines():
        line = raw_line.strip()
        if line.startswith("["):
            in_project = line == "[project]"
        elif in_project and line.startswith("version"):
            _, separator, encoded = line.partition("=")
            if not separator:
                break
            value = json.loads(encoded.strip())
            if isinstance(value, str) and value:
                return value
            break
    raise ValueError("project.version is missing from pyproject.toml")


def load_sources(root: Path = ROOT) -> OrderedDict[str, Any]:
    values: OrderedDict[str, Any] = OrderedDict()
    for name, relative_path in SOURCE_PATHS.items():
        path = root / relative_path
        values[name] = load_json_object(path) if path.suffix == ".json" else load_js_array(path)
        actual = len(values[name])
        if actual != EXPECTED_COUNTS[name]:
            raise ValueError(f"unexpected {name} record count: {actual}")
    return values


def character_records(characters: list[dict[str, Any]], official: dict[str, Any]) -> list[dict[str, Any]]:
    records = json.loads(json.dumps(characters, ensure_ascii=False))
    for record in records:
        key = f"{_normalize(record.get('name'))}||{_normalize(record.get('copyright'))}"
        metadata = official.get(key)
        if metadata is not None:
            record["official"] = metadata
    return records


def _normalize(value: Any) -> str:
    return " ".join(str(value or "").replace("_", " ").strip().lower().split())


def build_files(root: Path = ROOT) -> OrderedDict[str, bytes]:
    sources = load_sources(root)
    artifact_values = OrderedDict(
        (
            ("artist", sources["artist"]),
            ("character", character_records(sources["character"], sources["character_official"])),
            ("pose", sources["pose"]),
            ("clothing", sources["clothing"]),
            ("background", sources["background"]),
        )
    )

    files: OrderedDict[str, bytes] = OrderedDict()
    artifacts: OrderedDict[str, dict[str, Any]] = OrderedDict()
    for kind, records in artifact_values.items():
        raw = canonical_json(records)
        digest = sha256(raw)
        filename = f"{kind}-{digest[:HASH_LENGTH]}.json"
        relative_path = f"v1/{filename}"
        files[relative_path] = raw
        artifact = {
            "href": relative_path,
            "sha256": digest,
            "size_bytes": len(raw),
            "count": len(records),
        }
        if kind == "character":
            artifact["official_count"] = len(sources["character_official"])
        artifacts[kind] = artifact

    version = package_version(root / "pyproject.toml")
    index = {
        "format": FORMAT,
        "schema_version": SCHEMA_VERSION,
        "provider_id": PROVIDER_ID,
        "catalog_version": version,
        "package_version": version,
        "artifacts": artifacts,
        "provenance": PROVENANCE,
        "preview_templates": PREVIEW_TEMPLATES,
    }
    files["index.json"] = canonical_json(index)
    return files


def _catalog_files(output_dir: Path) -> set[str]:
    if not output_dir.is_dir():
        return set()
    return {
        path.relative_to(output_dir).as_posix()
        for path in output_dir.rglob("*.json")
        if path.is_file()
    }


def check_files(files: OrderedDict[str, bytes], output_dir: Path = OUTPUT_DIR) -> None:
    failures: list[str] = []
    expected = set(files)
    actual = _catalog_files(output_dir)
    for relative_path, expected_bytes in files.items():
        path = output_dir / relative_path
        if not path.is_file():
            failures.append(f"missing {relative_path}")
        elif path.read_bytes() != expected_bytes:
            failures.append(f"differs {relative_path}")
    for relative_path in sorted(actual - expected):
        failures.append(f"unexpected {relative_path}")
    if failures:
        raise CatalogCheckError("; ".join(failures))


def write_files(files: OrderedDict[str, bytes], output_dir: Path = OUTPUT_DIR) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    for relative_path in sorted(_catalog_files(output_dir) - set(files)):
        (output_dir / relative_path).unlink()
    for relative_path, raw in files.items():
        path = output_dir / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(f".{path.name}.tmp")
        temporary.write_bytes(raw)
        os.replace(temporary, path)


def build(*, root: Path = ROOT, output_dir: Path = OUTPUT_DIR, check: bool = False) -> OrderedDict[str, bytes]:
    files = build_files(root)
    if check:
        check_files(files, output_dir)
    else:
        write_files(files, output_dir)
    return files


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="compare generated bytes with checked-in files")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        files = build(check=args.check)
    except (CatalogCheckError, OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"catalog bundle check failed: {exc}", file=sys.stderr)
        return 1
    action = "verified" if args.check else "built"
    index = json.loads(files["index.json"])
    print(f"catalog bundle {action}: {len(index['artifacts'])} artifacts, version={index['catalog_version']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
