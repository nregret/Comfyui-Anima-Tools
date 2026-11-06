"""Build the community tag library data files from a local quicktagcloud codex archive.

    python tools/import_codex_libraries.py D:/Project/TAGSdataset [--webp-dir OUT]

Each library folder needs `全量条目.jsonl`. With --webp-dir, thumbnails downloaded by the
library's own `download_images.py --kind thumb` are converted to OUT/<folder>/<id>.webp
for upload to the AnimaTags-DB repository.
"""
import argparse
import json
import re
from pathlib import Path

from PIL import Image

JS_DIR = Path(__file__).resolve().parent.parent / "js"
# Pinned to a commit: jsDelivr answers some @main paths of this large repo with "Package size exceeded".
# After uploading new previews, set it to the new commit.
PREVIEW_BASE = "https://cdn.jsdelivr.net/gh/nregret/AnimaTags-DB@1c4bf5bde9acba5b54396f0bdc9807f09b68bf9c/images"
# archive folder, data variable, image folder / data file prefix, skipped top-level categories
LIBRARIES = [
    ("千藤衣柜", "qiantengData", "qianteng", ()),
    # 秋季课堂 entries are full NovelAI prompts with ||a|b|| random syntax and negatives.
    ("渡鸦的构图鉴", "ravenData", "raven", ("秋季课堂",)),
    ("构图风格", "compositionStyleData", "composition_style", ()),
]
WEIGHT_SUFFIX = re.compile(r":\s*-?\d+(?:\.\d+)?\s*$")


def escape_literal_parens(text):
    """Keep (tag:1.2) weight groups and escape every other parenthesis, e.g. irma (queen's blade)."""
    literal = set()
    stack = []
    for index, char in enumerate(text):
        if char == "(":
            stack.append(index)
        elif char == ")":
            if not stack:
                literal.add(index)
                continue
            start = stack.pop()
            if not WEIGHT_SUFFIX.search(text[start + 1:index]):
                literal.update((start, index))
    literal.update(stack)
    return "".join(f"\\{char}" if index in literal else char for index, char in enumerate(text))


def normalize_tags(text):
    # Short tags such as ^_^ or >_< keep their underscores.
    tokens = [token.strip() for token in text.split(",") if token.strip()]
    tokens = [token if len(token) <= 3 else token.replace("_", " ") for token in tokens]
    return escape_literal_parens(", ".join(tokens))


def build_items(entries, folder, skipped):
    entries = [entry for entry in entries if entry["path"][0] not in skipped]
    has_categories = len({entry["path"][0] for entry in entries}) > 1
    items = []
    for entry in entries:
        path = entry["path"]
        item = {
            "id": entry["id"],
            "name": entry["title"],
            "tags": normalize_tags(entry["tags"]),
            "categories": path[:1] if has_categories else [],
            "traits": path[1:],
        }
        if entry.get("note"):
            item["note"] = entry["note"]
        item["preview"] = f"{PREVIEW_BASE}/{folder}/{entry['id']}.webp" if entry.get("image") else ""
        items.append(item)
    return items


def write_data_js(name, folder, items):
    body = ",\n".join(json.dumps(item, ensure_ascii=False) for item in items)
    (JS_DIR / f"{folder}_data.js").write_text(
        f"const {name} = [\n{body}\n];\n\n"
        f'if (typeof window !== "undefined") {{\n  window.{name} = {name};\n}}\n\n'
        f"export {{ {name} }};\n",
        encoding="utf-8",
        newline="\n",
    )


def convert_thumbnails(library_dir, entries, out_dir):
    out_dir.mkdir(parents=True, exist_ok=True)
    codex_id = json.loads((library_dir / "_raw" / "source.json").read_text(encoding="utf-8"))["id"]
    missing = 0
    for entry in entries:
        if not entry.get("image"):
            continue
        source = library_dir / "配图_缩略图" / (entry.get("assetCodexId") or codex_id) / entry["image"]
        if not source.exists():
            missing += 1
            continue
        # The archive "thumbnails" are full size; match the ~300x440 previews already in AnimaTags-DB.
        with Image.open(source) as image:
            image = image.convert("RGB")
            image.thumbnail((440, 440))
            image.save(out_dir / f"{entry['id']}.webp", "WEBP", quality=80, method=6)
    return missing


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("archive", type=Path, help="folder that holds the codex library folders")
    parser.add_argument("--webp-dir", type=Path, help="write preview images here, one sub folder per library")
    args = parser.parse_args()

    for library, name, folder, skipped in LIBRARIES:
        library_dir = args.archive / library
        with open(library_dir / "全量条目.jsonl", encoding="utf-8") as handle:
            entries = [json.loads(line) for line in handle if line.strip()]
        items = build_items(entries, folder, skipped)
        write_data_js(name, folder, items)
        print(f"{library}: {len(items)} entries -> js/{folder}_data.js")
        if args.webp_dir:
            kept = {item["id"] for item in items}
            missing = convert_thumbnails(library_dir, [entry for entry in entries if entry["id"] in kept], args.webp_dir / folder)
            if missing:
                print(f"  {missing} thumbnails not downloaded yet, run download_images.py --kind thumb in {library_dir}")


if __name__ == "__main__":
    main()
