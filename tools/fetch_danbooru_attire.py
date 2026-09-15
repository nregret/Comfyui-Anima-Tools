"""Regenerate ``js/danbooru_attire_data.json`` from the Danbooru tag group wiki.

The Anima Prompt Random Draw node can build an outfit from layered Danbooru tag
groups instead of the curated ``js/clothing_data.js`` gallery.  The tag pools are
bundled with the repository so that node execution stays offline, deterministic
and free of Danbooru rate limits; this script only refreshes those pools.

Source: https://danbooru.donmai.us/wiki_pages/tag_group%3Aattire

Section -> slot mapping (slots are intentionally mutually filterable, see
``nodes.py::AnimaPromptComposer``):

* ``decoration``  <- "Jewelry and Accessories" + "Other"
* ``top``         <- "Shirts and Topwear"
* ``bottom``      <- "Pants and Bottomwear"
* ``socks``       <- "Legs and Feet"
* ``shoes``       <- "Shoes and Footwear"
* ``uniform``     <- "Uniforms and Costumes"
* ``traditional`` <- "Traditional Clothing"

The sections are then normalised so that every tag lives in exactly one slot:
the wiki files several single garments and accessories (``geta``, ``hood``,
``haori``, ...) under a main-outfit section and lists a few tags twice, and the
node treats a slot entry as something it can build a whole outfit from.
``SLOT_OVERRIDES`` names the owner of those tags and ``SLOT_PRIORITY`` settles
whatever is left, so ``uniform`` and ``traditional`` only ever hold complete
outfits.

Tags are dropped when they have fewer than ``--min-posts`` Danbooru posts so that
obscure entries never reach a prompt.  Post counts come from the public tags API
and can also be read from a local copy of the community
``a1111-sd-webui-tagcomplete`` ``danbooru.csv`` snapshot when the API is rate
limited::

    curl -o /tmp/danbooru.csv \\
      https://raw.githubusercontent.com/DominikDoom/a1111-sd-webui-tagcomplete/master/tags/danbooru.csv

Usage::

    python3 tools/fetch_danbooru_attire.py                      # refresh the bundled data
    python3 tools/fetch_danbooru_attire.py --min-posts 200
    python3 tools/fetch_danbooru_attire.py --tags-csv /tmp/danbooru.csv
    python3 tools/fetch_danbooru_attire.py --dry-run            # print counts only
    python3 tools/fetch_danbooru_attire.py --reassign js/danbooru_attire_data.json

The script only performs read-only GET requests to the public Danbooru API.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "js" / "danbooru_attire_data.json"

WIKI_API = "https://danbooru.donmai.us/wiki_pages/{title}.json"
TAGS_API = "https://danbooru.donmai.us/tags.json"
WIKI_TITLE = "tag_group:attire"

# Danbooru answers HTTP 403 to several User-Agent patterns (including ones that
# contain "ComfyUI"), so keep this deliberately generic.
USER_AGENT = "AnimaTools/1.0"

# Slot -> sections of ``tag group:attire`` that feed the slot.
SLOT_SECTIONS: dict[str, tuple[str, ...]] = {
    "decoration": ("Jewelry and Accessories", "Other"),
    "top": ("Shirts and Topwear",),
    "bottom": ("Pants and Bottomwear",),
    "socks": ("Legs and Feet",),
    "shoes": ("Shoes and Footwear",),
    "uniform": ("Uniforms and Costumes",),
    "traditional": ("Traditional Clothing",),
}

SLOT_ORDER = tuple(SLOT_SECTIONS)

# Every tag listed anywhere on the wiki page, used by the node to tell wearable
# tags apart from body/pose tags when it borrows a character's own tag set as an
# outfit.  Emitted under this key in addition to the slot pools.
VOCABULARY_KEY = "vocabulary"

# Tags that describe a state or a body detail rather than a wearable item.
TAG_BLOCKLIST = frozenset(
    {
        "clothing cutout",
        "fingernails",
        "see-through clothes",
        "taut shirt",
        "torn clothes",
    }
)

# Full-body garments live in the "Shirts and Topwear" section but must never be
# paired with a bottom, otherwise the prompt asks for two conflicting outfits.
SLOT_EXCLUDE: dict[str, frozenset[str]] = {
    "top": frozenset({"deel", "dress", "nightgown", "robe", "sweater dress"}),
}

# `tag group:attire` is organised by `h4` section, which mixes complete outfits
# with the garments and accessories that make one up: `geta` and `tabi` are filed
# with traditional clothing, `hood` and `cape` with uniforms.  The node draws one
# *complete* main outfit (`uniform` / `traditional` / a `top` + `bottom` pair) and
# then layers decoration, socks and shoes on top, so a lone garment in a main slot
# produces a prompt without an outfit - and, for `geta`, a second pair of shoes.
# Every tag therefore has to live in exactly one slot.
#
# This table names the slot that owns a tag.  It wins over the section mapping and
# over `SLOT_PRIORITY`, so a wiki refresh keeps the correction.
SLOT_OVERRIDES: dict[str, str] = {
    # Footwear and legwear that "Traditional Clothing" lists next to kimono.
    "geta": "shoes",
    "tabi": "socks",
    # Accessories and single garments that "Uniforms and Costumes" lists next to
    # complete outfits.
    "apron": "decoration",
    "cape": "decoration",
    "capelet": "decoration",
    "hood": "decoration",
    "side cape": "decoration",
    "buruma": "bottom",
    "loincloth": "bottom",
    "sweatpants": "bottom",
    "tutu": "bottom",
    "sweater": "top",
    # Traditional wear that is only part of an outfit.
    "chanchanko (clothes)": "top",
    "dotera (clothes)": "top",
    "happi": "top",
    "haori": "top",
    "hanten (clothes)": "top",
    "mizu happi": "top",
    "fundoshi": "bottom",
    "hakama": "bottom",
    "hakama pants": "bottom",
    "hakama short skirt": "bottom",
    "hakama skirt": "bottom",
    "kimono skirt": "bottom",
    "budget sarashi": "decoration",
    "chest sarashi": "decoration",
    "midriff sarashi": "decoration",
    "sarashi": "decoration",
    "undone sarashi": "decoration",
    "tasuki": "decoration",
    # Filed under both "Uniforms and Costumes" and "Traditional Clothing".
    "miko": "uniform",
    "nontraditional miko": "uniform",
    # Accessories that "Jewelry and Accessories" shares with another section.
    "sash": "decoration",
    "shoulder sash": "decoration",
    "stole": "decoration",
    "sarong": "bottom",
}

# Fallback for a tag that several sections list and that SLOT_OVERRIDES does not
# name yet: the first slot of this order wins.  Garment, accessory and footwear
# slots come before the main-outfit slots, so a garment is never promoted into a
# complete outfit.
SLOT_PRIORITY = ("shoes", "socks", "bottom", "top", "decoration", "uniform", "traditional")

HEADING_RE = re.compile(r"^h(?P<level>[0-9])#[^.]*\.\s*(?P<title>.+?)\s*$")
LINK_RE = re.compile(r"\[\[(?P<target>[^\]|]+)(?:\|[^\]]*)?\]\]")
BULLET_RE = re.compile(r"^(?P<indent>\*+)\s*(?P<rest>.+?)\s*$")

# Bullet lines holding prose instead of a bare tag name.
PROSE_MARKERS = (":", "!", "?", ".", "(", ")", ",", ";")

CACHE_DIR = Path(tempfile.gettempdir()) / "anima-tools-danbooru-cache"
CACHE_ENABLED = True


def fetch_json(url: str, params: dict[str, str] | None = None, attempts: int = 5) -> object:
    """GET a JSON document, retrying transient failures and caching every response."""
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"

    cache_path = CACHE_DIR / f"{hashlib.sha256(url.encode('utf-8')).hexdigest()}.json"
    if CACHE_ENABLED and cache_path.exists():
        try:
            return json.loads(cache_path.read_text(encoding="utf-8"))
        except Exception:
            cache_path.unlink(missing_ok=True)

    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    last_error: Exception | None = None
    for attempt in range(attempts):
        if attempt:
            time.sleep(2**attempt)
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                data = json.loads(response.read().decode("utf-8"))
            if CACHE_ENABLED:
                try:
                    CACHE_DIR.mkdir(parents=True, exist_ok=True)
                    cache_path.write_text(json.dumps(data), encoding="utf-8")
                except Exception:
                    pass
            return data
        except Exception as error:  # noqa: BLE001 - retried below, re-raised when exhausted
            last_error = error
    raise RuntimeError(f"Failed to fetch {url}: {last_error}")


def fetch_wiki_body(title: str) -> str:
    data = fetch_json(WIKI_API.format(title=urllib.parse.quote(title, safe="")))
    if not isinstance(data, dict):
        return ""
    return str(data.get("body") or "")


def normalize_tag(raw: object) -> str:
    return re.sub(r"\s+", " ", str(raw or "").replace("_", " ")).strip().lower()


def parse_sections(body: str) -> dict[str, list[str]]:
    """Return ``{section title: [tag, ...]}`` parsed from a Danbooru wiki body.

    Bullets are attributed to their heading *and* to every ancestor heading, so a
    slot can point at a parent section (for example "Jewelry and Accessories")
    and still pick up the tags listed under its ``h6`` subsections.
    """
    sections: dict[str, list[str]] = {}
    active: dict[int, str] = {}

    for line in body.splitlines():
        heading = HEADING_RE.match(line)
        if heading:
            level = int(heading.group("level"))
            title = heading.group("title")
            for deeper in [key for key in active if key >= level]:
                del active[deeper]
            active[level] = title
            sections.setdefault(title, [])
            continue
        if not active:
            continue

        bullet = BULLET_RE.match(line)
        if not bullet:
            continue
        rest = bullet.group("rest")

        tags = LINK_RE.findall(rest)
        if not tags:
            # A handful of wiki entries are plain text instead of wiki links.
            text = rest.strip()
            if not text or any(marker in text for marker in PROSE_MARKERS):
                continue
            tags = [text]

        for title in active.values():
            sections[title].extend(tags)

    return sections


def load_post_counts_from_csv(path: Path) -> dict[str, int]:
    """Read ``tag,category,post_count,aliases`` rows from a tagcomplete-style CSV."""
    counts: dict[str, int] = {}
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            parts = line.rstrip("\n").split(",")
            if len(parts) < 3:
                continue
            tag = normalize_tag(parts[0])
            try:
                count = int(parts[2])
            except ValueError:
                continue
            if tag:
                counts[tag] = count
    return counts


def fetch_post_counts(min_posts: int) -> dict[str, int]:
    """Return ``{tag: post_count}`` for general tags, newest pages until the cutoff."""
    counts: dict[str, int] = {}
    page = 1
    while True:
        rows = fetch_json(
            TAGS_API,
            {"search[order]": "count", "search[category]": "0", "limit": "1000", "page": str(page)},
        )
        if not isinstance(rows, list) or not rows:
            break
        lowest: int | None = None
        for row in rows:
            if not isinstance(row, dict):
                continue
            tag = normalize_tag(row.get("name"))
            count = int(row.get("post_count") or 0)
            if tag:
                counts[tag] = count
            lowest = count if lowest is None else min(lowest, count)
        print(f"  counts page={page} total={len(counts)} lowest={lowest}", flush=True)
        if lowest is None or lowest <= min_posts:
            break
        page += 1
        time.sleep(0.1)
    return counts


def assign_slot_owners(candidates: dict[str, list[str]]) -> dict[str, str]:
    """Return ``{tag: slot}`` with every tag owned by exactly one slot.

    ``candidates`` maps a slot to the tags its sections list.  ``SLOT_OVERRIDES``
    decides first, and tags that several slots list fall back to ``SLOT_PRIORITY``
    so the outcome does not depend on which section was read first.
    """
    unknown = sorted({slot for slot in SLOT_OVERRIDES.values() if slot not in SLOT_ORDER})
    if unknown:
        raise ValueError(f"SLOT_OVERRIDES points outside SLOT_ORDER: {', '.join(unknown)}")

    owners: dict[str, str] = {}

    for slot in SLOT_ORDER:
        for tag in candidates.get(slot, ()):
            override = SLOT_OVERRIDES.get(tag)
            current = owners.get(tag)
            if override is not None:
                owners[tag] = override
            elif current is None:
                owners[tag] = slot
            else:
                owners[tag] = min(current, slot, key=SLOT_PRIORITY.index)

    return owners


def pools_from_owners(owners: dict[str, str]) -> dict[str, list[str]]:
    pools: dict[str, list[str]] = {}
    for slot in SLOT_ORDER:
        pools[slot] = sorted(tag for tag, owner in owners.items() if owner == slot)
    return pools


def report_slot_moves(candidates: dict[str, list[str]], owners: dict[str, str]) -> None:
    """Print the tags the slot assignment pulled out of the section it was in."""
    listed = {tag: slot for slot in SLOT_ORDER for tag in candidates.get(slot, ())}
    stale = sorted(set(SLOT_OVERRIDES) - set(listed))
    if stale:
        print(f"  SLOT_OVERRIDES has no match in the wiki any more: {', '.join(stale)}", flush=True)

    moved = sorted(tag for tag, slot in listed.items() if owners.get(tag) != slot)
    if not moved:
        return
    print(f"  {len(moved)} tag(s) reassigned by SLOT_OVERRIDES/SLOT_PRIORITY:", flush=True)
    for tag in moved:
        print(f"    {tag} -> {owners.get(tag)}", flush=True)


def collect_tag_pools(min_posts: int, tags_csv: Path | None = None) -> dict[str, list[str]]:
    sections = parse_sections(fetch_wiki_body(WIKI_TITLE))

    pools: dict[str, list[str]] = {}

    # The vocabulary keeps every wiki tag, so it does not apply the per-slot
    # exclusions or the post count filter.
    vocabulary: dict[str, None] = {}
    for section_names in sections.values():
        for raw in section_names:
            tag = normalize_tag(raw)
            if tag and not tag.startswith("tag group"):
                vocabulary[tag] = None
    pools[VOCABULARY_KEY] = sorted(vocabulary)

    for slot in SLOT_ORDER:
        names: list[str] = []
        for section_title in SLOT_SECTIONS[slot]:
            names.extend(sections.get(section_title, []))
        pools[slot] = names

    if min_posts <= 0:
        counts: dict[str, int] = {}
    elif tags_csv is not None:
        counts = load_post_counts_from_csv(tags_csv)
        print(f"  loaded {len(counts)} post counts from {tags_csv}", flush=True)
    else:
        counts = fetch_post_counts(min_posts)

    candidates: dict[str, list[str]] = {}
    for slot in SLOT_ORDER:
        excluded = SLOT_EXCLUDE.get(slot, frozenset())
        unique: dict[str, None] = {}
        for raw in pools[slot]:
            tag = normalize_tag(raw)
            if not tag or tag.startswith("tag group"):
                continue
            if tag in TAG_BLOCKLIST or tag in excluded:
                continue
            if counts and counts.get(tag, 0) < min_posts:
                continue
            unique[tag] = None
        candidates[slot] = sorted(unique)

    owners = assign_slot_owners(candidates)
    report_slot_moves(candidates, owners)

    cleaned = pools_from_owners(owners)
    cleaned[VOCABULARY_KEY] = pools[VOCABULARY_KEY]
    return cleaned


def reassign_bundled_data(path: Path) -> dict[str, list[str]]:
    """Re-apply the slot assignment to an existing file, without touching the wiki.

    Useful when only ``SLOT_OVERRIDES`` changed and the Danbooru API is not
    reachable: the slots hold the pools a refresh already filtered, so running the
    assignment over them gives the same result as a full refresh of that same wiki
    snapshot.
    """
    data = json.loads(path.read_text(encoding="utf-8"))
    candidates = {slot: [tag for tag in data.get(slot, ()) if isinstance(tag, str)] for slot in SLOT_ORDER}

    owners = assign_slot_owners(candidates)
    report_slot_moves(candidates, owners)

    cleaned = pools_from_owners(owners)
    vocabulary = data.get(VOCABULARY_KEY) or []
    cleaned[VOCABULARY_KEY] = sorted({tag for tag in vocabulary if isinstance(tag, str)})
    return cleaned


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--min-posts",
        type=int,
        default=100,
        help="Drop tags with fewer than this many Danbooru posts (0 disables the filter).",
    )
    parser.add_argument("--tags-csv", type=Path, help="Read post counts from a local danbooru.csv instead of the API.")
    parser.add_argument("--dry-run", action="store_true", help="Print the resulting pools without writing the file.")
    parser.add_argument("--no-cache", action="store_true", help="Ignore the local HTTP response cache in the temp dir.")
    parser.add_argument(
        "--reassign",
        type=Path,
        help="Re-apply the slot assignment to an existing data file instead of fetching the wiki.",
    )
    args = parser.parse_args()

    if args.no_cache:
        global CACHE_ENABLED
        CACHE_ENABLED = False

    if args.reassign:
        pools = reassign_bundled_data(args.reassign)
    else:
        pools = collect_tag_pools(args.min_posts, args.tags_csv)

    total = sum(len(pools[slot]) for slot in SLOT_ORDER)
    for slot in SLOT_ORDER:
        print(f"{slot:<12} {len(pools[slot]):>5}")
    print(f"{'total':<12} {total:>5}")
    print(f"{'vocabulary':<12} {len(pools[VOCABULARY_KEY]):>5}")

    if args.dry_run:
        return

    OUTPUT.write_text(
        json.dumps(pools, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {OUTPUT} ({OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
