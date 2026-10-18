"""Sample a random Danbooru post and hand it over as an image plus Anima tags.

Why this node exists: the composer in this pack needs prompt material, and a
random *image* with its real Danbooru tags is both an inspiration source and a
reference picture.  Aaalice's ``BooruGalleryNode`` (preview build, heavy UI) and
``ComfyUI-Ranbooru`` (tags only, no image) already cover parts of this - what is
added here is a small, dependency-free node that speaks Anima's tag format
directly and survives the networks this project actually runs on.

What the site allows, verified 2026-10-12 against danbooru.donmai.us:

* Read access needs no account at all: ``/posts.json`` answers 200 anonymously.
* Anonymous search is limited to **2 tags**, and ``rating:*`` / ``id:*`` do not
  count towards that budget while ``random:1``, ``order:*`` and ``-tag`` do (the
  API answers ``PostQuery::TagLimitError`` beyond it).  The free metatags are the
  ones in the site's own ``PostQuery::UNLIMITED_METATAGS`` list (*status rating
  limit is id date age ...*), which is why this node can add an ``id:`` window
  without spending a slot - ``order:`` is deliberately *not* used for the same
  reason.  The official level table (``help:users``) gives 2 tags to anonymous
  *and* to a free Member account, 6 to Gold; so an API key is worth having - it
  also unlocks censored tags, which the anonymous ``tag_string`` hides - but it
  does not lift this limit.
* ``rating:general,sensitive,explicit`` is **one** term, an OR over the listed
  ratings (verified 2026-10-17 on safebooru, which runs the same software: the
  single-rating counts add up to the multi-value count), and it does not consume
  a tag slot, so that is how a run draws from several tiers.  The site has a
  fourth tier, ``questionable`` (``q``, ~1.2M posts): it is accepted in the list
  too, it is just left out of the examples below.  ``rating:*`` is *not* a
  wildcard - it matches nothing.
* ``/posts.json?tags=...&random=1`` returns one random post from the whole set,
  ``counts/posts.json`` returns the match count, and ``limit`` up to 200 works
  together with ``page``.
* Post ids are the one stable key the site has: they only ever grow, they are
  never reused (deleted posts leave gaps - there is no post 2), and tag edits or
  score changes do not touch them.  A page number, by contrast, is an offset into
  a newest-first list, so every upload shifts it.  A seeded run therefore reads a
  window of ids that **ends at** the anchor: an upload always gets an id above
  that window, so it can never push the chosen post aside - and the site's
  ``limit`` cap drops the *oldest* ids of a wide window, which is the end this
  node does not need.
* ``robots.txt`` disallows ``/*.json``, so this node keeps its footprint tiny:
  one search request plus one image request per run, always through the cache.
  Only a seeded anchor with nothing around it costs extra searches, and those
  stay inside the same time budget as the random path.

Network reality: on this project's networks ``danbooru.donmai.us`` is answered by
a poisoned DNS record (it resolved to a Dropbox address from CN), which makes the
first request time out.  ``HOST_PINS`` therefore carries Cloudflare addresses that
were probed by hand; they are used *only* when the normal request fails, and the
connection keeps the real hostname for SNI and certificate validation.  A host
that needed them is remembered for the rest of the process (``_PINNED_GOOD``), so
only the first request per host pays the dead-DNS timeout; pinning the domains at
startup (``comfyui-run/launch/dns.py``) removes even that one.

Zero third-party dependencies on purpose - the pack declares
``dependencies = []``, the CI installs nothing, and this container has no Pillow
and no torch, so every helper below is stdlib-only and every seam that needs the
outside world (``http_get``, ``load_image_tensor``) is replaceable in tests.
"""

from __future__ import annotations

import base64
import fnmatch
import hashlib
import http.client
import io
import json
import os
import re
import socket
import ssl
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

# --- what the site is --------------------------------------------------------

DANBOORU_BASE = "https://danbooru.donmai.us"
DANBOORU_POSTS_URL = DANBOORU_BASE + "/posts.json"

# The site asks clients to identify themselves and not to impersonate a browser,
# so the project shows up by name and the version lives in the pack manifest.
USER_AGENT = "Anima-Tools-Danbooru/1.0 (+https://github.com/nregret/Comfyui-Anima-Tools)"

# Danbooru splits a post's tags into these groups; they are also the outputs.
TAG_GROUPS = ("artist", "character", "copyright", "general", "meta")
DEFAULT_TAG_TYPES = ("character", "copyright", "general")
DEFAULT_QUERY_TAGS = "rating:general"
SIZE_OPTIONS = ("sample", "original", "720x720", "360x360", "180x180")
DEFAULT_SIZE = "sample"
STATIC_EXTENSIONS = ("jpg", "jpeg", "png", "webp", "gif")
ANIMATED_TAGS = ("animated", "video")

# Tags that describe the upload rather than the picture.  `character_request`
# ("nobody specific in here") and `artist_name` (a signature is visible) actively
# hurt a prompt, and the level/resolution markers are not asked for.
DEFAULT_BLOCKED_TAGS = (
    "artist_name",
    "character_request",
    "commentary_request",
    "bad_id",
    "bad_source",
    "twitter_username",
    "web_address",
    "watermark",
    "english_text",
    "translated",
    "third-party_edit",
)

# ``rating:general,sensitive`` is ONE search term on the site (an OR over the
# listed ratings), so the commas inside it must survive comma-splitting.  A
# ``rating:`` followed by an ordinary tag still splits, so ``rating:g, 1girl``
# keeps meaning "general posts that have 1girl".
RATING_VALUES = (
    "general",
    "sensitive",
    "questionable",
    "explicit",
    "g",
    "s",
    "q",
    "e",
)
_RATING_LIST = re.compile(
    r"rating:\s*(?:%s)\b(?:\s*,\s*(?:%s)\b)+"
    % ("|".join(RATING_VALUES), "|".join(RATING_VALUES)),
    re.IGNORECASE,
)
_RATING_COMMA = "\x00"

# A seeded run samples the *id space*, not a page: post ids only ever grow, so a
# post at a given id never moves when the site uploads something new, while a page
# number shifts by every upload.  The ceiling freezes that space and should sit
# just above the site's current largest id: the small headroom below 12.5M fills up
# within days (12,401,582 was the largest post id on 2026-10-18), while a ceiling
# far above the corpus spends most seeds on ids no window can reach.
DEFAULT_ID_CEILING = 12_500_000
ID_WINDOW_LIMIT = 200  # verified: limit=200 answers fine anonymously
# Widening only reaches *older* ids, and a window is clamped at id 1, so a sparse
# query near the start of the id space simply stops instead of wrapping around.
ID_WINDOW_WIDTHS = (200, 2_000, 20_000, 200_000)
RANDOM_MODE_LIMIT = 1
DEFAULT_MAX_ATTEMPTS = 3
DEFAULT_TIMEOUT = 20.0
CACHE_DIR_NAME = "danbooru_cache"
# The cache is keyed by upload *and* size, and only files this node wrote are
# pruned - a user who points cache_dir at a folder of their own keeps it.
CACHE_MAX_FILES = 500
CACHE_NAME_PATTERN = re.compile(
    r"^(?:(?:%s)-)?[0-9a-zA-Z]{6,40}\.(?:jpg|jpeg|png|webp|gif|bin)$"
    % "|".join(re.escape(size) for size in SIZE_OPTIONS)
)

# Probed by hand on 2026-10-12: the local resolver answered danbooru with
# 162.125.80.6 (a Dropbox address) and every request timed out, while these
# Cloudflare addresses answered 200.  Last resort only, and every candidate is
# tried in turn because the addresses do drift.
HOST_PINS = {
    "danbooru.donmai.us": ("104.26.10.39", "104.26.11.39", "172.67.70.99"),
    "cdn.donmai.us": ("104.26.10.39", "104.26.11.39", "172.67.70.99"),
    "safebooru.donmai.us": ("172.67.70.99",),
}

# Hosts that already needed the pins in this process.  Remembering them saves a
# full ``timeout`` on every later request, which matters because a run always
# searches the site (only the image is served from the cache).
_PINNED_GOOD = set()

# Headers are only sent to hosts that can legitimately see the API key.
DANBOORU_HOSTS = ("danbooru.donmai.us", "safebooru.donmai.us")


class DanbooruError(RuntimeError):
    """Raised for anything the user has to read and act on.

    ``status`` is the HTTP status when the site answered at all, so callers can
    tell "this query is invalid" (4xx - asking again will not help) apart from
    "the server had a bad moment" (5xx - the same window or another one might
    answer).  ``transient`` marks a failure that says nothing about the query (a
    timeout, a dropped connection): asking again is worth one of the attempts.
    """

    def __init__(self, message, status=None, transient=False):
        super(DanbooruError, self).__init__(message)
        self.status = status
        self.transient = transient


# --- tags --------------------------------------------------------------------


def split_post_tags(value):
    """Danbooru fields are space separated, and a tag never contains a space yet."""

    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        collected = []
        for item in value:
            collected.extend(split_post_tags(item))
        return collected
    return str(value).split()


def normalize_post_tag(value):
    """``irene_(arknights)`` -> ``irene (arknights)``, the way Anima writes it."""

    return " ".join(str(value if value is not None else "").strip().lower().replace("_", " ").split())


def _protect_rating_lists(value):
    """Freeze the commas inside ``rating:a,b`` so the splitter cannot eat them."""

    if isinstance(value, (list, tuple, set)):
        return [_protect_rating_lists(item) for item in value]
    if value is None:
        return value
    return _RATING_LIST.sub(
        lambda match: re.sub(r"\s+", "", match.group(0)).replace(",", _RATING_COMMA),
        str(value),
    )


def normalize_query_tags(value):
    """Turn user input into Danbooru search syntax.

    A comma is an extra convenience, a space is a separator (that is how the site
    reads ``tags=``), and underscores are **kept**: search talks about
    ``black_hair``, while the space form is only how a tag is written in a prompt.
    A comma-separated rating list (``rating:general,sensitive,explicit``) is kept
    as one term - the site reads it as "any of these ratings" - which is how a
    run can draw from all three tiers instead of being pinned to one.
    """

    tags = []
    for part in split_query_parts(_protect_rating_lists(value)):
        tag = part.strip().lower().replace(_RATING_COMMA, ",")
        if tag and tag not in tags:
            tags.append(tag)
    return tags


def normalize_block_tags(value):
    """Blocklist entries are compared against prompt-form tags, so align them.

    A blocklist entry is one tag, not a search expression: ``black hair`` and
    ``black_hair`` have to mean the same single tag, while splitting on spaces
    would turn them into ``black`` + ``hair`` and silently block nothing.  That
    is why entries are separated by commas/newlines only.
    """

    return [tag for tag in (normalize_post_tag(part) for part in split_block_parts(value)) if tag]


def compile_blocklist(value, include_defaults=True):
    """Turn the blocklist text into a predicate for prompt-form tags.

    An entry is still one tag, but ``*`` (any run of characters, empty included)
    and ``?`` (exactly one character) work as wildcards, so ``*censor*`` drops
    ``bar censor`` and ``censored`` in one rule.  Entries without a wildcard keep
    the old meaning - the whole tag, not a substring - so ``smile`` never eats
    ``smiley``.
    """

    exact = set()
    wildcards = []
    for entry in normalize_block_tags(value):
        if "*" in entry or "?" in entry:
            wildcards.append(re.compile(fnmatch.translate(entry)))
        else:
            exact.add(entry)
    if include_defaults:
        exact.update(normalize_post_tag(tag) for tag in DEFAULT_BLOCKED_TAGS)

    def is_blocked(tag):
        return tag in exact or any(pattern.match(tag) for pattern in wildcards)

    return is_blocked


def split_block_parts(value):
    """Blocklist entries split on commas, semicolons and newlines - spaces stay."""

    if isinstance(value, (list, tuple, set)):
        parts = []
        for item in value:
            parts.extend(split_block_parts(item))
        return parts
    if value is None:
        return []
    return [part for part in re.split(r"[,\n;]+", str(value)) if part.strip()]


def split_query_parts(value):
    """Commas and spaces split; handed a list, every item is split the same way."""

    if isinstance(value, (list, tuple, set)):
        parts = []
        for item in value:
            parts.extend(split_query_parts(item))
        return parts
    if value is None:
        return []
    return [part for part in re.split(r"[,\s]+", str(value)) if part.strip()]


def format_tag_groups(
    post,
    tag_types=DEFAULT_TAG_TYPES,
    block_tags=(),
    use_default_blocklist=True,
    artist_prefix=True,
):
    """Turn a post into one string per tag group plus the joined Anima prompt.

    Underscores become spaces, everything is lowercased and deduplicated, groups
    follow Anima's draw order (artist, character, copyright, general, meta) and
    the result is joined with ``", "`` - the shape the composer already produces,
    e.g. ``"hatsune miku, vocaloid, 1girl, twintails"``.
    """

    post = post if isinstance(post, dict) else {}
    wanted = set(tag_types or ())
    is_blocked = compile_blocklist(block_tags, include_defaults=use_default_blocklist)

    groups = {}
    for group in TAG_GROUPS:
        tags = []
        if group in wanted:
            for token in split_post_tags(post.get("tag_string_%s" % group)):
                tag = normalize_post_tag(token)
                if not tag or tag in tags or is_blocked(tag):
                    continue
                tags.append(tag)
            if group == "artist" and artist_prefix:
                tags = ["@" + tag for tag in tags]
        groups[group] = ", ".join(tags)

    groups["prompt"] = ", ".join(groups[group] for group in TAG_GROUPS if groups[group])
    return groups


# --- choosing what to show ---------------------------------------------------


def coerce_seed(seed):
    """``-1`` (or a link, or nonsense) means "surprise me"."""

    if seed is None or isinstance(seed, (list, tuple)):
        return -1
    try:
        return int(seed)
    except (TypeError, ValueError):
        return -1


def coerce_id_ceiling(value):
    """A ceiling has to be a positive id, otherwise every window is empty."""

    try:
        ceiling = int(value)
    except (TypeError, ValueError):
        return DEFAULT_ID_CEILING
    return ceiling if ceiling > 0 else DEFAULT_ID_CEILING


def id_anchors(seed, ceiling=DEFAULT_ID_CEILING, attempts=1):
    """Where a fixed seed starts looking, one anchor per attempt.

    Every anchor is a pure function of ``(seed, attempt, ceiling)``: recompute it
    a year later and it is the same number.  The extra attempts only matter for a
    seed that lands where no matching post exists any more (the tail of the id
    space, or a query with nothing near it); they keep that fallback reproducible
    instead of "draw another random number and hope".
    """

    ceiling = coerce_id_ceiling(ceiling)
    anchors = []
    for attempt in range(max(1, int(attempts or 1))):
        digest = hashlib.sha1(
            ("danbooru-seed:%d:%d" % (int(seed), attempt)).encode("utf-8")
        ).digest()
        anchor = int.from_bytes(digest[:8], "big") % ceiling + 1
        if anchor not in anchors:
            anchors.append(anchor)
    return anchors


def id_windows(anchor, ceiling=DEFAULT_ID_CEILING, widths=ID_WINDOW_WIDTHS):
    """Windows **ending at** the anchor, narrowest first, clamped at id 1.

    The anchor is the window's last id on purpose.  A post id only ever grows, so
    an upload always lands above the window and can never enter it - the seeded
    pick stays put.  Widening therefore reaches further *back* in time, and the
    site's ``limit`` cap (which drops the oldest ids of a wide answer) can only
    remove candidates this node does not want: the pick is the newest one.
    """

    ceiling = coerce_id_ceiling(ceiling)
    end = min(max(1, int(anchor or 1)), ceiling)
    windows = []
    for width in widths:
        start = max(1, end - max(1, int(width)) + 1)
        if not windows or start < windows[-1][0]:
            windows.append((start, end))
    return windows


def build_request(query_tags, seed, id_ceiling=DEFAULT_ID_CEILING):
    """Describe the first request the node will make.

    A random seed asks the site for ``random:1`` - a true draw over the whole
    matching set, at the cost of one tag slot.  A fixed seed instead derives an
    **id anchor** and reads the ids just below it: post ids only ever grow, so an
    upload cannot enter that window and the seeded post does not move.
    """

    tags = normalize_query_tags(query_tags) or [DEFAULT_QUERY_TAGS]
    value = coerce_seed(seed)
    if value < 0:
        return {
            "tags": " ".join(tags + ["random:%d" % RANDOM_MODE_LIMIT]),
            "limit": RANDOM_MODE_LIMIT,
            "mode": "random",
            "seed": value,
            "id_ceiling": None,
        }

    ceiling = coerce_id_ceiling(id_ceiling)
    return {
        "tags": " ".join(tags),
        "limit": ID_WINDOW_LIMIT,
        "mode": "id",
        "seed": value,
        "id_ceiling": ceiling,
        "anchor": id_anchors(value, ceiling, 1)[0],
    }


def request_tag_string(request):
    """The search string for one round: the query plus its id window."""

    tags = str(request.get("tags") or DEFAULT_QUERY_TAGS)
    if request.get("id_end"):
        tags = "%s id:%d..%d" % (tags, int(request["id_start"]), int(request["id_end"]))
    return tags


def choose_image_url(post, size=DEFAULT_SIZE):
    """Prefer the requested entry of ``media_asset.variants``, else a known field."""

    if not isinstance(post, dict):
        return None
    asset = post.get("media_asset")
    variants = asset.get("variants") if isinstance(asset, dict) else None
    for variant in variants or []:
        if isinstance(variant, dict) and str(variant.get("type") or "") == str(size or ""):
            if variant.get("url"):
                return str(variant["url"])

    if size == "original":
        fields = ("file_url", "large_file_url", "preview_file_url")
    elif size == "sample":
        fields = ("large_file_url", "file_url", "preview_file_url")
    else:
        fields = ("preview_file_url", "large_file_url", "file_url")
    for field in fields:
        if post.get(field):
            return str(post[field])
    return None


def is_usable_post(post, size=DEFAULT_SIZE):
    """Skip everything that is not a still image this node can decode."""

    if not isinstance(post, dict):
        return False
    for flag in ("is_deleted", "is_banned", "is_pending", "is_flagged"):
        if post.get(flag):
            return False
    extension = str(post.get("file_ext") or "").lower()
    if extension and extension not in STATIC_EXTENSIONS:
        return False
    for field in ("tag_string_general", "tag_string_meta"):
        for token in split_post_tags(post.get(field)):
            if normalize_post_tag(token) in ANIMATED_TAGS:
                return False
    return choose_image_url(post, size) is not None


def pick_post(posts, index=0, size=DEFAULT_SIZE):
    """Scan forward from ``index`` for the first post that can be used."""

    if not isinstance(posts, (list, tuple)):
        return None
    start = max(0, int(index or 0))
    for post in posts[start:]:
        if is_usable_post(post, size=size):
            return post
    for post in posts[:start]:
        if is_usable_post(post, size=size):
            return post
    return None


def pick_latest_post(posts, size=DEFAULT_SIZE):
    """The usable post with the largest id - the nearest one at or below the anchor.

    Deliberately not "the n-th post": an index would shift whenever *any* post in
    the window is deleted, while the largest id only disappears together with that
    one post.  It also has to be the largest, not the smallest: the site answers
    newest-first and caps an answer at ``limit``, which drops the *oldest* ids of a
    wide window - the newest one this pick needs is always in the answer.
    """

    usable = []
    for post in posts if isinstance(posts, (list, tuple)) else ():
        if not is_usable_post(post, size=size):
            continue
        try:
            usable.append((int(post.get("id")), post))
        except (TypeError, ValueError):
            continue
    return max(usable, key=lambda pair: pair[0])[1] if usable else None


# --- talking to the site -----------------------------------------------------


def basic_auth_token(login, api_key):
    """``None`` unless a complete pair was given - half a pair is no credentials."""

    login = str(login or "").strip()
    api_key = str(api_key or "").strip()
    if not login or not api_key:
        return None
    raw = ("%s:%s" % (login, api_key)).encode("utf-8")
    return "Basic %s" % base64.b64encode(raw).decode("ascii")


def resolve_credentials(login="", api_key=""):
    """Node inputs win, environment variables fill the gap (never the workflow)."""

    login = str(login or "").strip() or str(os.environ.get("DANBOORU_LOGIN") or "").strip()
    api_key = str(api_key or "").strip() or str(os.environ.get("DANBOORU_API_KEY") or "").strip()
    if not login or not api_key:
        return "", ""
    return login, api_key


def build_headers(login="", api_key=""):
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    token = basic_auth_token(login, api_key)
    if token:
        headers["Authorization"] = token
    return headers


def headers_for_url(headers, url):
    """Never send the API key to the CDN - it has no use for it."""

    host = (urllib.parse.urlsplit(url).hostname or "").lower()
    if not headers:
        return {}
    if host in DANBOORU_HOSTS:
        return dict(headers)
    return {name: value for name, value in headers.items() if name.lower() != "authorization"}


class _SniHTTPSConnection(http.client.HTTPSConnection):
    """Connect to a pinned IP while keeping the hostname for SNI and certificates."""

    def __init__(self, host, ip, port=None, timeout=None, context=None):
        super(_SniHTTPSConnection, self).__init__(
            host, port=port or 443, timeout=timeout, context=context
        )
        self._ip = ip

    def connect(self):  # pragma: no cover - exercised by the live smoke script
        sock = socket.create_connection((self._ip, self.port), self.timeout)
        self.sock = self._context.wrap_socket(sock, server_hostname=self.host)


TAG_LIMIT_HINT = (
    "（匿名与免费账号最多 2 个标签，且 rating: / id: 不占名额，"
    "random:1 / order:* / -tag 占名额；要更多标签需要 Gold 账号，详见 help:users）"
)


def _payload_message(body):
    """Pull the site's own message out of an error body, JSON or not."""

    if not body:
        return ""
    if isinstance(body, bytes):
        body = body.decode("utf-8", "replace")
    text = str(body).strip()
    try:
        payload = json.loads(text)
    except (TypeError, ValueError):
        payload = None
    message = error_message_from_payload(payload) if isinstance(payload, dict) else ""
    if message:
        return message
    if "<html" in text.lower():
        return "站点返回了 HTML 拦截页（Cloudflare challenge），稍后重试"
    return " ".join(text.split())[:200]


def _http_error_message(error, body=b""):
    """Say what went wrong in the site's own words, then add an actionable hint."""

    status = getattr(error, "code", "?")
    hints = {
        400: "请求被拒绝（400）",
        401: "鉴权失败：检查 login / api_key（API key 在 Danbooru 个人主页生成）",
        403: "被拒绝（403）：可能是 Cloudflare 拦截 / UA / 权限问题",
        404: "资源不存在（404）",
        422: "查询不被接受（422）：最常见的是标签超限",
        429: "被限速（429）：稍后重试，或加上 API key",
        500: "站点内部错误（500）：换个 seed 或稍后重试",
        503: "站点暂时不可用（503）",
    }
    detail = _payload_message(body)
    text = "Danbooru 返回 HTTP %s" % status
    if detail:
        text = "%s：%s" % (text, detail)
    hint = hints.get(status, "")
    if hint:
        text = "%s［%s］" % (text, hint)
    if status == 422 or "more than" in detail:
        text = "%s%s" % (text, TAG_LIMIT_HINT)
    return text


def _plain_get(url, timeout=DEFAULT_TIMEOUT, headers=None):
    request = urllib.request.Request(url, headers=dict(headers or {}), method="GET")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        # The body carries the site's own explanation (TagLimitError, a database
        # timeout, a Cloudflare challenge); dropping it left bare "HTTP 422".
        try:
            body = error.read(4096)
        except Exception:  # the body is a bonus, not the point
            body = b""
        raise DanbooruError(
            _http_error_message(error, body), status=getattr(error, "code", None)
        ) from error
    except urllib.error.URLError:
        raise
    except (OSError, http.client.HTTPException) as error:
        # A read timeout and a connection dropped mid-body both happen *after*
        # urlopen has returned, so urllib never wraps them.  Passing them on raw
        # was what showed ComfyUI "The read operation timed out": no pinned-IP
        # fallback, no retry, no readable hint.  They are connection failures.
        raise urllib.error.URLError(error) from error


def _pinned_get(url, timeout=DEFAULT_TIMEOUT, headers=None):
    """Ask the pinned addresses directly, for when DNS answers nonsense."""

    parts = urllib.parse.urlsplit(url)
    host = parts.hostname or ""
    candidates = HOST_PINS.get(host) or ()
    if not candidates:
        raise DanbooruError("没有 %s 的内置 IP 备选，无法绕过解析" % host)
    path = parts.path or "/"
    if parts.query:
        path = "%s?%s" % (path, parts.query)

    per_candidate = max(1.0, float(timeout or DEFAULT_TIMEOUT) / max(1, len(candidates)))
    last_error = None
    site_status = None  # a 5xx from any address is still the site answering
    for ip in candidates:
        connection = _SniHTTPSConnection(host, ip, port=parts.port or 443, timeout=per_candidate)
        try:
            connection.request("GET", path, headers=dict(headers or {}))
            response = connection.getresponse()
            data = response.read()
            if response.status < 400:
                return data
            error = DanbooruError(_http_error_message(response, data), status=response.status)
            if response.status < 500:
                # A 4xx is the site's answer, not a broken address - asking the
                # next pinned IP would just spend time on the same answer.
                raise error
            last_error = error  # 5xx: this address may be the unlucky one
            site_status = response.status
        except DanbooruError:
            raise
        except Exception as error:  # try the next candidate address
            last_error = error
        finally:
            connection.close()
    # Keep the status of a 5xx: "every address said 500" is still the site
    # answering, and the caller tries another window on it.  Dropping it turned
    # that retry into a fake "the network is down".
    raise DanbooruError(
        "内置 IP 全部不可达（%s）：%s" % (host, last_error),
        status=site_status,
        transient=site_status is None,
    )


# A 403/429 from a remembered address can be aimed at that address alone (a
# Cloudflare challenge, a per-IP rate limit), so DNS gets one more chance.  Any
# other status is the site answering the query itself and cannot change by
# asking somewhere else.
PIN_RETRY_STATUSES = (403, 429)


def _is_timeout(error):
    """A timeout hides one level down: ``urlopen`` wraps it in ``URLError``."""

    if isinstance(error, (TimeoutError, socket.timeout)):
        return True
    return isinstance(getattr(error, "reason", None), (TimeoutError, socket.timeout))


def _unreachable_message(host, plain_error, pinned_error, timeout=DEFAULT_TIMEOUT):
    if _is_timeout(plain_error):
        return (
            "Danbooru 请求超时：%.0f 秒内没有读完 %s 的响应（网络受限或站点繁忙）。"
            "把节点的 timeout 调大（如 60 秒）、减少 query_tags，或稍后重试。"
            % (float(timeout or DEFAULT_TIMEOUT), host)
        )
    return (
        "%s 无法访问：正常解析失败（%s），内置 IP 兜底也失败（%s）。"
        "若一直如此，把域名加进启动层的 hosts 钉定（launch/dns.py）。"
        % (host, plain_error, pinned_error)
    )


def http_get(url, timeout=DEFAULT_TIMEOUT, headers=None):
    """One place for every request, and the only seam the tests replace.

    A real HTTP status is final - it is the site's answer, not a broken DNS - so
    only a connection-level failure (``URLError``; after ``_plain_get`` also a
    read timeout) falls through to the pinned addresses.  Once a host has *needed*
    those pins it is remembered for the rest of the process: with a poisoned DNS
    every request would otherwise pay the full ``timeout`` again before getting
    anywhere (there is one search per run).  A 403/429 on that remembered route is
    the one exception: such a block can be aimed at a single address, so DNS gets
    one more chance before it is raised.
    """

    host = urllib.parse.urlsplit(url).hostname or ""
    failed_pin = None
    if host in _PINNED_GOOD:
        try:
            return _pinned_get(url, timeout=timeout, headers=headers)
        except DanbooruError as error:
            if error.status is None:
                _PINNED_GOOD.discard(host)  # the address drifted - let DNS try again
                failed_pin = error
            elif error.status in PIN_RETRY_STATUSES:
                # The block may be aimed at this address; DNS may have recovered.
                _PINNED_GOOD.discard(host)
                try:
                    return _plain_get(url, timeout=timeout, headers=headers)
                except (urllib.error.URLError, OSError):
                    raise error
            else:
                raise  # the site answered (422 and friends): another route cannot help

    try:
        data = _plain_get(url, timeout=timeout, headers=headers)
    except (urllib.error.URLError, OSError) as plain_error:
        if failed_pin is not None:
            # The pins were just tried and failed; asking them a second time would
            # only burn another timeout before reporting the same thing.
            raise DanbooruError(
                _unreachable_message(host, plain_error, failed_pin, timeout),
                transient=True,
            ) from failed_pin
        try:
            data = _pinned_get(url, timeout=timeout, headers=headers)
        except DanbooruError as pinned_error:
            if pinned_error.status is not None:
                raise  # the site answered through the pins too
            raise DanbooruError(
                _unreachable_message(host, plain_error, pinned_error, timeout),
                transient=True,
            ) from pinned_error
        _PINNED_GOOD.add(host)
    return data


def error_message_from_payload(payload):
    """The API answers ``{"success": false, "message": ...}`` instead of a status."""

    if isinstance(payload, dict) and payload.get("success") is False:
        return str(payload.get("message") or payload.get("error") or "unknown error")
    return ""


def raise_for_payload_error(payload):
    message = error_message_from_payload(payload)
    if not message:
        return
    hint = ""
    if "TagLimitError" in str(payload.get("error") or "") or "more than" in message:
        hint = TAG_LIMIT_HINT
    raise DanbooruError("Danbooru 拒绝了这次查询：%s%s" % (message, hint))


def fetch_posts(request, timeout=DEFAULT_TIMEOUT, headers=None):
    params = {
        "tags": request_tag_string(request),
        "limit": int(request.get("limit") or 1),
    }
    url = "%s?%s" % (DANBOORU_POSTS_URL, urllib.parse.urlencode(params))
    payload = json.loads(http_get(url, timeout=timeout, headers=headers))
    raise_for_payload_error(payload)
    if isinstance(payload, dict):
        payload = payload.get("posts") or []
    if not isinstance(payload, list):
        raise DanbooruError("Danbooru 返回了预期之外的结构：%s" % type(payload).__name__)
    return [post for post in payload if isinstance(post, dict)]


# --- storing and decoding ----------------------------------------------------


def default_cache_dir():
    """Inside ComfyUI that is ``input/danbooru_cache``; elsewhere a temp folder."""

    try:
        import folder_paths  # type: ignore # only exists inside ComfyUI

        base = folder_paths.get_input_directory()
    except Exception:
        base = os.path.join(tempfile.gettempdir(), "comfyui-anima-tools")
    return os.path.join(base, CACHE_DIR_NAME)


def cache_file_path(cache_dir, post, size=DEFAULT_SIZE):
    """One file per upload *and* resolution, so changing ``size`` really re-draws.

    The md5 alone collides: every variant of a post shares it, so asking for
    ``original`` after ``sample`` would silently hand back the small file that
    was cached first - and the ``size`` widget would then be lying.
    """

    post = post if isinstance(post, dict) else {}
    stem = str(post.get("md5") or post.get("id") or "unknown")
    extension = str(post.get("file_ext") or "bin")
    prefix = str(size or DEFAULT_SIZE)
    name = re.sub(r"[^0-9A-Za-z._-]", "_", "%s-%s.%s" % (prefix, stem, extension))
    return os.path.join(str(cache_dir), name)


def prune_cache(cache_dir, max_files=CACHE_MAX_FILES):
    """Keep the newest ``max_files`` files this node wrote; return how many went.

    Only names matching ``CACHE_NAME_PATTERN`` are touched: ``cache_dir`` can be
    pointed at a folder of the user's own, and everything else in there is theirs.
    """

    directory = str(cache_dir or "")
    if not directory or max_files is None or int(max_files) <= 0:
        return 0
    try:
        names = [name for name in os.listdir(directory) if CACHE_NAME_PATTERN.match(name)]
    except OSError:
        return 0
    if len(names) <= int(max_files):
        return 0
    aged = []
    for name in names:
        path = os.path.join(directory, name)
        try:
            aged.append((os.path.getmtime(path), name))
        except OSError:
            continue
    aged.sort(reverse=True)
    removed = 0
    for _, name in aged[int(max_files) :]:
        try:
            os.remove(os.path.join(directory, name))
            removed += 1
        except OSError:
            continue
    return removed


def load_image_tensor(data):
    """Decode bytes into a ComfyUI IMAGE tensor.

    Pillow and torch are imported here rather than at module level: the pack has
    no dependencies, the tests run without them, and only ComfyUI itself needs the
    decode.  Animated uploads are already filtered out upstream, but a still frame
    is taken anyway instead of failing.
    """

    from PIL import Image, ImageOps
    import numpy as np
    import torch

    with Image.open(io.BytesIO(data)) as handle:
        if getattr(handle, "is_animated", False):
            handle.seek(0)
        image = ImageOps.exif_transpose(handle).convert("RGB")
        array = np.asarray(image).astype("float32") / 255.0
    return torch.from_numpy(array)[None, ...]


# --- the node ----------------------------------------------------------------


class AnimaDanbooruRandomImage:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "query_tags": ("STRING", {"multiline": True, "default": DEFAULT_QUERY_TAGS}),
                "seed": ("INT", {"default": -1, "min": -1, "max": 2147483647}),
                "size": (list(SIZE_OPTIONS), {"default": DEFAULT_SIZE}),
                "tag_character": ("BOOLEAN", {"default": True}),
                "tag_copyright": ("BOOLEAN", {"default": True}),
                "tag_general": ("BOOLEAN", {"default": True}),
                "tag_artist": ("BOOLEAN", {"default": False}),
                "tag_meta": ("BOOLEAN", {"default": False}),
                "block_tags": ("STRING", {"multiline": True, "default": ""}),
                "use_default_blocklist": ("BOOLEAN", {"default": True}),
            },
            "optional": {
                "max_attempts": ("INT", {"default": DEFAULT_MAX_ATTEMPTS, "min": 1, "max": 10}),
                "login": ("STRING", {"default": ""}),
                "api_key": ("STRING", {"default": ""}),
                "cache_dir": ("STRING", {"default": ""}),
                "timeout": ("FLOAT", {"default": DEFAULT_TIMEOUT, "min": 1.0, "max": 120.0}),
                "id_ceiling": (
                    "INT",
                    {"default": DEFAULT_ID_CEILING, "min": 1, "max": 2147483647},
                ),
            },
        }

    RETURN_TYPES = ("IMAGE", "STRING", "STRING", "STRING", "STRING", "STRING", "STRING")
    RETURN_NAMES = ("image", "artist", "character", "copyright", "general", "prompt", "meta")
    FUNCTION = "fetch_random_post"
    CATEGORY = "Anima/Danbooru"

    def fetch_random_post(
        self,
        query_tags=DEFAULT_QUERY_TAGS,
        seed=-1,
        size=DEFAULT_SIZE,
        tag_character=True,
        tag_copyright=True,
        tag_general=True,
        tag_artist=False,
        tag_meta=False,
        block_tags="",
        use_default_blocklist=True,
        max_attempts=DEFAULT_MAX_ATTEMPTS,
        login="",
        api_key="",
        cache_dir="",
        timeout=DEFAULT_TIMEOUT,
        id_ceiling=DEFAULT_ID_CEILING,
    ):
        tag_types = tuple(
            name
            for name, enabled in (
                ("artist", tag_artist),
                ("character", tag_character),
                ("copyright", tag_copyright),
                ("general", tag_general),
                ("meta", tag_meta),
            )
            if enabled
        )
        login, api_key = resolve_credentials(login, api_key)
        headers = build_headers(login, api_key)
        request = build_request(query_tags, seed, id_ceiling=id_ceiling)
        random_mode = request["mode"] == "random"
        attempts_limit = max(1, int(max_attempts or 1))
        timeout = float(timeout or DEFAULT_TIMEOUT)
        # One budget for the whole run: without it a dead network cost
        # timeout x (one plain request + every pinned address) x rounds.
        deadline = time.monotonic() + timeout * attempts_limit
        # A random draw can land on something unusable, so the same request is
        # worth asking again.  A fixed seed instead has a deterministic list of
        # windows - narrow to wide within one anchor, then the next anchor - and
        # every one of them is a pure function of the seed.
        if random_mode:
            rounds = [request] * attempts_limit
        else:
            rounds = [
                dict(request, id_start=start, id_end=end)
                for anchor in id_anchors(request["seed"], request["id_ceiling"], attempts_limit)
                for start, end in id_windows(anchor, request["id_ceiling"])
            ]

        post = None
        attempts = 0
        retries = 0
        spent_budget = False
        index = 0
        while index < len(rounds):
            remaining = deadline - time.monotonic()
            if remaining <= 0.5:
                spent_budget = True
                break
            attempts += 1
            request = rounds[index]
            try:
                posts = fetch_posts(
                    request, timeout=min(timeout, remaining), headers=headers
                )
            except DanbooruError as error:
                # A timeout or a dropped connection says nothing about the query, so
                # the *same* window is asked again: widening it instead would let a
                # flaky network decide which post a fixed seed resolves to.
                if getattr(error, "transient", False) and retries < attempts_limit - 1:
                    retries += 1
                    continue
                # A 5xx is the site having a bad moment; the next window (wider,
                # or at another anchor) can still answer.  A 4xx (tag limit,
                # auth) will not change, so it is raised as is.
                if (error.status or 0) >= 500 and index + 1 < len(rounds):
                    index += 1
                    continue
                raise
            if not posts:
                if random_mode:
                    # ``random:1`` answers ``[]`` only when nothing matches at
                    # all; asking again cannot change that.
                    raise DanbooruError(
                        "Danbooru 没有任何帖子匹配「%s」。换个标签组合，或先用 counts/posts.json 看看量。"
                        % request["tags"]
                    )
                # An empty window is normal near the start of the id space (or
                # above the newest post): widen it, then try the next anchor.  The
                # last round falls through to the error below.
                index += 1
                continue
            candidate = (
                pick_post(posts, 0, size=size)
                if random_mode
                else pick_latest_post(posts, size=size)
            )
            if candidate is not None:
                post = candidate
                break
            index += 1
        if post is None:
            if spent_budget:
                raise DanbooruError(
                    "本次运行的时间预算（约 %.0f 秒 = timeout × max_attempts）已用尽，"
                    "共发出 %d 次请求。把 timeout 调大，或把 max_attempts 调小。"
                    % (timeout * attempts_limit, attempts)
                )
            if not random_mode:
                raise DanbooruError(
                    "固定 seed 在锚点 %s 以下的 %d 个窗口（最宽到 id %s）里都没有可用的静态图"
                    "（id_ceiling=%s：锚点可能落在作品 id 之外，或窗口里只有视频/动图、"
                    "已删除的帖子）。换个 seed，或把 id_ceiling 调到当前作品上限附近。"
                    % (
                        request.get("id_end"),
                        len(rounds),
                        request.get("id_start"),
                        request.get("id_ceiling"),
                    )
                )
            raise DanbooruError(
                "连续 %d attempt 都没抽到可用的静态图（匹配到的多是视频/动图或已删除）。"
                "放宽 query_tags，或把 size 换成更可能有预览图的档位。" % attempts
            )

        image_url = choose_image_url(post, size)
        directory = str(cache_dir or "").strip() or default_cache_dir()
        os.makedirs(directory, exist_ok=True)
        path = cache_file_path(directory, post, size=size)
        cached = os.path.isfile(path)
        if cached:
            with open(path, "rb") as handle:
                data = handle.read()
        else:
            data = http_get(image_url, timeout=timeout, headers=headers_for_url(headers, image_url))
            with open(path, "wb") as handle:
                handle.write(data)
            prune_cache(directory)

        groups = format_tag_groups(
            post,
            tag_types=tag_types,
            block_tags=block_tags,
            use_default_blocklist=use_default_blocklist,
        )
        meta = json.dumps(
            {
                "id": post.get("id"),
                "md5": post.get("md5"),
                "rating": post.get("rating"),
                "score": post.get("score"),
                "source": post.get("source"),
                "file_ext": post.get("file_ext"),
                "image_width": post.get("image_width"),
                "image_height": post.get("image_height"),
                "image_url": image_url,
                "size": size,
                "cached_file": os.path.basename(path),
                "cached": cached,
                "attempts": attempts,
                "mode": request["mode"],
                "seed": request["seed"],
                "anchor": request.get("id_end"),
                "id_window": (
                    "%d..%d" % (request["id_start"], request["id_end"])
                    if request.get("id_end")
                    else None
                ),
                "id_ceiling": request.get("id_ceiling"),
            },
            ensure_ascii=False,
            sort_keys=True,
        )
        image = load_image_tensor(data)
        return (
            image,
            groups["artist"],
            groups["character"],
            groups["copyright"],
            groups["general"],
            groups["prompt"],
            meta,
        )

    @classmethod
    def IS_CHANGED(cls, seed=-1, **kwargs):
        """Mirror the pack's seed convention, which 3.3.x settled on.

        A linked seed arrives as ``None`` (ComfyUI only hands constants over), so
        the answer stays constant and ComfyUI's own signature - inputs *and* the
        signature of every upstream node - decides.  ``-1`` re-draws every queue,
        and a fixed seed is reproducible unless the query itself changes.
        """

        if seed is None or isinstance(seed, (list, tuple)):
            return "linked"
        value = coerce_seed(seed)
        if value < 0:
            return time.time()

        relevant = {
            key: kwargs.get(key)
            for key in sorted(kwargs)
            if key not in ("login", "api_key", "cache_dir", "max_attempts", "timeout")
        }
        payload = json.dumps(relevant, sort_keys=True, default=str)
        return hashlib.sha1(("%d|%s" % (value, payload)).encode("utf-8")).hexdigest()


NODE_CLASS_MAPPINGS = {"AnimaDanbooruRandomImage": AnimaDanbooruRandomImage}
NODE_DISPLAY_NAME_MAPPINGS = {"AnimaDanbooruRandomImage": "Anima Danbooru Random Image"}
