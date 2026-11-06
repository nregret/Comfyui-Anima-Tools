"""Build the artist list js/data.js from a local Anima Style Gallery archive.

    python tools/import_style_gallery.py D:/Project/TAGSdataset/AnimaStyleGallery [--webp-dir OUT]

The archive is written by its own download.py (search.json + images/<imageId>.avif). With
--webp-dir, both sample images of every artist are converted to OUT/<id>-p1.webp and
OUT/<id>-p2.webp for upload to images/artist in the AnimaTags-DB repository. After the
upload, set PREVIEW_COMMIT in js/anima_artist_selector.js and ARTIST_PREVIEW_BASE in nodes.py
to the new commit.
"""
import argparse
import json
import re
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image

JS_DIR = Path(__file__).resolve().parent.parent / "js"
VARIANTS = ("p1", "p2")


def artist_name(tag):
    # "@aoi_nagisa_(metalder)" -> "aoi nagisa \(metalder\)", the name the selector writes after "@".
    return re.sub(r"([()])", r"\\\1", tag[1:].replace("_", " "))


def build_items(search):
    return [
        {"name": artist_name(hit["tag"]), "post_count": hit["postCount"], "id": hit["imageId"].removesuffix("-p1")}
        for hit in search
    ]


def write_data_js(items):
    body = ",\n".join(json.dumps(item, ensure_ascii=False) for item in items)
    (JS_DIR / "data.js").write_text(
        f"const galleryData = [\n{body}\n];\n\nwindow.galleryData = galleryData;\n",
        encoding="utf-8",
        newline="\n",
    )


def convert(job):
    source, dest = job
    with Image.open(source) as image:
        image = image.convert("RGB")
        image.thumbnail((320, 480))
        image.save(dest, "WEBP", quality=65, method=6)


def convert_previews(image_dir, items, out_dir):
    out_dir.mkdir(parents=True, exist_ok=True)
    jobs = []
    missing = []
    for item in items:
        for variant in VARIANTS:
            source = image_dir / f"{item['id']}-{variant}.avif"
            dest = out_dir / f"{item['id']}-{variant}.webp"
            if dest.exists():
                continue
            if source.exists():
                jobs.append((source, dest))
            else:
                missing.append(source.name)
    with ProcessPoolExecutor() as pool:
        for done, _ in enumerate(pool.map(convert, jobs, chunksize=64), 1):
            if done % 5000 == 0:
                print(f"  {done}/{len(jobs)}", flush=True)
    return missing


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("archive", type=Path, help="AnimaStyleGallery folder with search.json and images/")
    parser.add_argument("--webp-dir", type=Path, help="write the preview images here")
    args = parser.parse_args()

    search = json.loads((args.archive / "search.json").read_text(encoding="utf-8"))
    items = build_items(search)
    write_data_js(items)
    print(f"{len(items)} artists -> js/data.js")
    if args.webp_dir:
        missing = convert_previews(args.archive / "images", items, args.webp_dir)
        if missing:
            print(f"  {len(missing)} images missing in the archive: {', '.join(missing)}")


if __name__ == "__main__":
    main()
