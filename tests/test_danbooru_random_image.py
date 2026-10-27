"""Offline tests for the Danbooru random image node.

Everything here runs without ComfyUI, Pillow, torch or the network: the module is
loaded with the same ``ast`` trick the other tests use, and the two things that
touch the outside world are seams that get replaced - ``http_get`` for every HTTP
request and ``load_image_tensor`` for the Pillow/torch decode.  What is left to
test is exactly what this node owns: which request it builds, which post it picks
out of the answer, how it formats the tags for Anima, what it caches, and how it
behaves when the site (or the poisoned DNS) misbehaves.
"""

import ast
import base64
import hashlib
import http.client
import io
import json
import os
import random
import re
import socket
import ssl
import tempfile
import time
import unittest
import urllib
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

MODULE_NAME = "nodes_danbooru.py"


def load_danbooru_namespace():
    """Exec the module's top level without ComfyUI, Pillow or torch installed.

    The module's own ``import`` statements run for real, so a missing import
    fails here exactly like it would inside ComfyUI; only the function and class
    bodies are defined and never called.  The two seams that need the outside
    world - ``http_get`` and ``load_image_tensor`` - are replaced by the tests.
    """

    module_path = Path(__file__).resolve().parents[1] / MODULE_NAME
    tree = ast.parse(module_path.read_text(encoding="utf-8"), filename=str(module_path))
    body = [
        node
        for node in tree.body
        if isinstance(
            node,
            (ast.Import, ast.ImportFrom, ast.FunctionDef, ast.ClassDef, ast.Assign, ast.AnnAssign),
        )
        and not (isinstance(node, ast.ImportFrom) and node.module == "__future__")
    ]
    namespace = {"__file__": str(module_path), "__name__": "nodes_danbooru"}
    exec(
        compile(ast.Module(body=body, type_ignores=[]), str(module_path), "exec"),
        namespace,
    )
    return namespace


def sample_post(**overrides):
    """A post shaped like a real ``/posts.json`` entry (id 12361469, trimmed)."""

    post = {
        "id": 12361469,
        "md5": "00dec0ec3dcd33dfd49bdbdb627757b0",
        "file_ext": "jpg",
        "file_size": 162748,
        "rating": "g",
        "score": 12,
        "source": "https://example.invalid/art",
        "image_width": 914,
        "image_height": 1200,
        # Trimmed from the live response; some of these sit in ``meta`` on the real
        # site, and both spellings exist in the wild, so the blocklist has to cope.
        "tag_string_general": "1girl solo artist_name black_hair character_request",
        "tag_string_character": "irene_(arknights)",
        "tag_string_copyright": "arknights",
        "tag_string_artist": "sakuratani_hane",
        "tag_string_meta": "absurdres highres",
        "file_url": "https://cdn.donmai.us/original/f3/7e/payload.jpg",
        "large_file_url": "https://cdn.donmai.us/sample/f3/7e/sample-payload.jpg",
        "preview_file_url": "https://cdn.donmai.us/180x180/f3/7e/payload.jpg",
        "media_asset": {
            "variants": [
                {"type": "180x180", "url": "https://cdn.donmai.us/180x180/f3/7e/payload.jpg"},
                {"type": "360x360", "url": "https://cdn.donmai.us/360x360/f3/7e/payload.jpg"},
                {
                    "type": "720x720",
                    "url": "https://cdn.donmai.us/720x720/f3/7e/payload.webp",
                    "file_ext": "webp",
                },
                {"type": "sample", "url": "https://cdn.donmai.us/sample/f3/7e/sample-payload.jpg"},
                {"type": "original", "url": "https://cdn.donmai.us/original/f3/7e/payload.jpg"},
            ]
        },
    }
    post.update(overrides)
    return post


class FakeHttp:
    """Stands in for ``http_get``: answers by URL, remembers what was asked."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.urls = []

    def __call__(self, url, timeout=None, headers=None):
        self.urls.append(url)
        if not self.responses:
            raise AssertionError("unexpected request: %s" % url)
        answer = self.responses.pop(0)
        if isinstance(answer, Exception):
            raise answer
        if callable(answer):
            return answer(url, headers)
        if isinstance(answer, (dict, list)):
            return json.dumps(answer).encode("utf-8")
        return answer


class DanbooruNamespaceTests(unittest.TestCase):
    def setUp(self):
        # A fresh namespace per test: the seams below are replaced in place, so a
        # shared module would leak one test's fake ``http_get`` into the next.
        self.ns = load_danbooru_namespace()
        self.node_class = self.ns["AnimaDanbooruRandomImage"]
        self.node = self.node_class()

    # --- tag formatting ----------------------------------------------------

    def test_tag_groups_are_normalised_and_joined_with_commas(self):
        groups = self.ns["format_tag_groups"](sample_post())

        self.assertEqual(groups["character"], "irene (arknights)")
        self.assertEqual(groups["copyright"], "arknights")
        self.assertEqual(groups["general"], "1girl, solo, black hair")

    def test_artist_tags_get_the_at_prefix_anima_uses(self):
        groups = self.ns["format_tag_groups"](sample_post(), tag_types=("artist",))

        self.assertEqual(groups["artist"], "@sakuratani hane")

    def test_the_default_blocklist_drops_danbooru_noise(self):
        post = sample_post(tag_string_general="1girl artist_name commentary_request bad_id smirk")

        groups = self.ns["format_tag_groups"](post)

        self.assertEqual(groups["general"], "1girl, smirk")

    def test_the_blocklist_can_be_turned_off_and_extended(self):
        post = sample_post(tag_string_general="1girl artist_name smirk")

        kept = self.ns["format_tag_groups"](post, block_tags=(), use_default_blocklist=False)
        extended = self.ns["format_tag_groups"](post, block_tags=("smirk",))

        self.assertIn("artist name", kept["general"])
        self.assertEqual(extended["general"], "1girl")

    def test_meta_is_empty_unless_it_is_asked_for(self):
        default_groups = self.ns["format_tag_groups"](sample_post())
        meta_groups = self.ns["format_tag_groups"](sample_post(), tag_types=("meta",))

        self.assertEqual(default_groups["meta"], "")
        self.assertNotIn("highres", default_groups["prompt"])
        self.assertEqual(meta_groups["meta"], "absurdres, highres")

    def test_the_prompt_joins_the_groups_in_anima_order(self):
        groups = self.ns["format_tag_groups"](sample_post())

        self.assertEqual(
            groups["prompt"],
            "irene (arknights), arknights, 1girl, solo, black hair",
        )

    def test_an_empty_post_formats_to_empty_strings(self):
        groups = self.ns["format_tag_groups"]({})

        self.assertEqual(groups["prompt"], "")
        self.assertEqual(groups["character"], "")

    # --- building the request ---------------------------------------------

    def test_a_random_seed_asks_the_site_for_a_random_post(self):
        request = self.ns["build_request"]("rating:general", -1)

        self.assertIn("random:1", request["tags"])
        self.assertEqual(request["limit"], 1)
        self.assertEqual(request["mode"], "random")

    def test_a_fixed_seed_maps_to_a_stable_id_anchor(self):
        first = self.ns["build_request"]("rating:general", 20261012)
        repeated = self.ns["build_request"]("rating:general", 20261012)
        other = self.ns["build_request"]("rating:general", 20261013)

        self.assertEqual(first, repeated)
        self.assertNotEqual(first["anchor"], other["anchor"])
        self.assertEqual(first["mode"], "id")
        self.assertEqual(first["tags"], "rating:general", "the query stays free of the id range")
        self.assertNotIn("random:1", first["tags"], "the id path must not spend a tag slot")
        self.assertEqual(first["limit"], self.ns["ID_WINDOW_LIMIT"])
        self.assertEqual(first["id_ceiling"], self.ns["DEFAULT_ID_CEILING"])
        self.assertTrue(1 <= first["anchor"] <= first["id_ceiling"])

    def test_the_new_input_is_optional_and_sits_last(self):
        """A required input breaks old API workflows, and a widget inserted in the middle
        shifts every later ``widgets_values`` entry of an existing workflow."""

        inputs = self.node_class.INPUT_TYPES()

        self.assertNotIn("id_ceiling", inputs["required"], "an old workflow does not have it")
        self.assertEqual(
            list(inputs["optional"])[-1],
            "id_ceiling",
            "new inputs are appended, never inserted",
        )
        self.assertIn("default", inputs["optional"]["id_ceiling"][1])

    def test_the_default_id_ceiling_covers_the_known_corpus(self):
        """A ceiling under the corpus cannot reach the newest posts; far over it is dead space."""

        self.assertGreaterEqual(self.ns["DEFAULT_ID_CEILING"], 12_401_582)
        self.assertLess(
            self.ns["DEFAULT_ID_CEILING"],
            12_401_582 * 2,
            "a ceiling far above the corpus spends most seeds on an id space "
            "that will never hold a post",
        )

    def test_a_broken_id_ceiling_falls_back_to_the_default(self):
        for value in (0, -5, None, "nonsense"):
            request = self.ns["build_request"]("rating:general", 7, id_ceiling=value)

            self.assertEqual(request["id_ceiling"], self.ns["DEFAULT_ID_CEILING"], value)
            self.assertLessEqual(request["anchor"], self.ns["DEFAULT_ID_CEILING"])

    def test_the_id_window_ends_at_the_anchor_and_only_reaches_older_ids(self):
        """An upload always gets a bigger id, so a window ending at the anchor is closed for good."""

        windows = self.ns["id_windows"](990, 1_000)

        self.assertEqual(windows[0], (791, 990), "the narrowest window is the 200 ids below the anchor")
        self.assertTrue(all(end == 990 for start, end in windows), "widening only reaches older ids")
        self.assertEqual(
            [start for start, end in windows],
            sorted({start for start, end in windows}, reverse=True),
            "every wider window has to contain the previous one",
        )
        self.assertTrue(all(1 <= start <= end <= 1_000 for start, end in windows))

    def test_a_window_near_id_1_stops_at_1_instead_of_wrapping(self):
        windows = self.ns["id_windows"](5, 1_000)

        self.assertEqual(windows, [(1, 5)], "the window is clamped at 1 and de-duplicated")

    def test_an_anchor_above_the_ceiling_is_clamped_to_it(self):
        windows = self.ns["id_windows"](2_000, 1_000)

        self.assertTrue(all(end == 1_000 for start, end in windows))

    def test_the_newest_usable_post_in_the_window_wins(self):
        """Newest-first answers plus a window that ends at the anchor: the head is the answer."""

        posts = [
            sample_post(id=12000050),
            sample_post(id=12000049, file_ext="mp4", file_url="https://cdn.donmai.us/o.mp4"),
            sample_post(id=12000010),
        ]

        self.assertEqual(self.ns["pick_latest_post"](posts)["id"], 12000050)
        self.assertIsNone(self.ns["pick_latest_post"]([sample_post(file_ext="mp4")]))

    def test_a_truncated_window_still_holds_the_post_that_is_picked(self):
        """``limit`` drops the *oldest* ids of a wide window - the newest one always survives."""

        posts = [sample_post(id=12_000_000 - offset) for offset in range(200)]

        self.assertEqual(self.ns["pick_latest_post"](posts)["id"], 12_000_000)

    def test_query_tags_are_normalised_and_defaulted(self):
        self.assertEqual(self.ns["build_request"]("1Girl, Solo", -1)["tags"], "1girl solo random:1")
        self.assertEqual(
            self.ns["build_request"]("   ", -1)["tags"], "rating:general random:1"
        )

    def test_query_tags_keep_underscores_and_drop_duplicates(self):
        """Search talks about ``black_hair`` - the space form is for prompts only."""
        request = self.ns["build_request"]("black_hair, black_hair, 1Girl", 7)

        self.assertEqual(request["tags"], "black_hair 1girl")
        self.assertEqual(
            self.ns["normalize_query_tags"]("black hair"),
            ["black", "hair"],
            "the site reads a space as a separator, so it must stay two tags",
        )

    def test_a_rating_list_stays_one_search_term(self):
        """``rating:g,s`` is one term on the site: it means "any of these ratings"."""

        self.assertEqual(
            self.ns["normalize_query_tags"]("rating:general,sensitive,explicit"),
            ["rating:general,sensitive,explicit"],
        )
        self.assertEqual(
            self.ns["normalize_query_tags"]("rating:g, s, e"),
            ["rating:g,s,e"],
            "spaces around the commas are fine",
        )
        self.assertEqual(
            self.ns["build_request"]("rating:general,sensitive,explicit", -1)["tags"],
            "rating:general,sensitive,explicit random:1",
        )

    def test_a_rating_list_does_not_swallow_the_tags_after_it(self):
        self.assertEqual(
            self.ns["normalize_query_tags"]("rating:general,sensitive, black_hair"),
            ["rating:general,sensitive", "black_hair"],
        )
        self.assertEqual(
            self.ns["build_request"]("1girl, rating:g,s", 5)["tags"], "1girl rating:g,s"
        )

    # --- choosing a post ---------------------------------------------------

    def test_unusable_posts_are_skipped(self):
        posts = [
            sample_post(id=1, is_deleted=True),
            sample_post(id=2, file_ext="mp4", file_url="https://cdn.donmai.us/original/a.mp4"),
            sample_post(id=3, tag_string_general="1girl animated"),
            sample_post(id=4),
        ]

        chosen = self.ns["pick_post"](posts, 0)

        self.assertEqual(chosen["id"], 4)

    def test_pick_post_returns_none_when_nothing_is_usable(self):
        posts = [sample_post(file_ext="mp4"), sample_post(is_banned=True)]

        self.assertIsNone(self.ns["pick_post"](posts, 0))

    def test_the_requested_size_picks_the_matching_variant(self):
        post = sample_post()

        self.assertEqual(
            self.ns["choose_image_url"](post, "sample"),
            "https://cdn.donmai.us/sample/f3/7e/sample-payload.jpg",
        )
        self.assertEqual(
            self.ns["choose_image_url"](post, "720x720"),
            "https://cdn.donmai.us/720x720/f3/7e/payload.webp",
        )

    def test_the_url_falls_back_when_there_is_no_variant_list(self):
        post = sample_post()
        post.pop("media_asset")

        self.assertEqual(self.ns["choose_image_url"](post, "sample"), post["large_file_url"])
        self.assertEqual(self.ns["choose_image_url"](post, "original"), post["file_url"])
        self.assertIsNone(self.ns["choose_image_url"]({}, "sample"))

    # --- the node itself ---------------------------------------------------

    def test_run_downloads_the_image_and_reuses_it_from_the_cache(self):
        post = sample_post()
        # search, image, then the search of the second run (the image comes from
        # the cache, so it is never downloaded twice).
        http = FakeHttp([[post], b"IMAGEBYTES", [post]])
        self.ns["http_get"] = http
        self.ns["load_image_tensor"] = lambda data: ("tensor", data)
        with tempfile.TemporaryDirectory() as cache_dir:
            first = self.node.fetch_random_post(
                query_tags="rating:general", seed=20261012, cache_dir=cache_dir
            )
            requests_for_the_first_run = len(http.urls)
            second = self.node.fetch_random_post(
                query_tags="rating:general", seed=20261012, cache_dir=cache_dir
            )

            cached_file = os.path.join(cache_dir, "sample-%s.jpg" % post["md5"])
            self.assertTrue(os.path.isfile(cached_file))

        self.assertEqual(first[0], ("tensor", b"IMAGEBYTES"))
        self.assertEqual(first[1], "")  # artist off by default
        self.assertEqual(first[2], "irene (arknights)")
        self.assertEqual(first[5], "irene (arknights), arknights, 1girl, solo, black hair")
        self.assertEqual(json.loads(first[6])["id"], post["id"])
        self.assertFalse(json.loads(first[6])["cached"])
        self.assertEqual(requests_for_the_first_run, 2, "one API request plus one image request")
        self.assertTrue(json.loads(second[6])["cached"])
        self.assertEqual(len(http.urls), 3, "the second run refetches the post, not the image")

    def test_run_retries_when_the_random_post_is_a_video(self):
        http = FakeHttp(
            [
                [sample_post(file_ext="mp4")],
                [sample_post(id=999)],
                b"IMAGEBYTES",
            ]
        )
        self.ns["http_get"] = http
        self.ns["load_image_tensor"] = lambda data: ("tensor", data)
        with tempfile.TemporaryDirectory() as cache_dir:
            result = self.node.fetch_random_post(query_tags="rating:general", cache_dir=cache_dir)

        self.assertEqual(json.loads(result[6])["attempts"], 2)
        self.assertEqual(json.loads(result[6])["id"], 999)

    def test_run_gives_up_with_a_readable_error(self):
        # One random draw per attempt, so the site is asked twice for two tries.
        self.ns["http_get"] = FakeHttp(
            [[sample_post(file_ext="mp4")], [sample_post(file_ext="mp4")]]
        )
        with tempfile.TemporaryDirectory() as cache_dir:
            with self.assertRaises(RuntimeError) as caught:
                self.node.fetch_random_post(
                    query_tags="rating:general", max_attempts=2, cache_dir=cache_dir
                )

        self.assertIn("2 attempt", str(caught.exception))

    def test_run_surfaces_the_sites_own_error_message(self):
        self.ns["http_get"] = FakeHttp(
            [
                {
                    "success": False,
                    "error": "PostQuery::TagLimitError",
                    "message": "You cannot search for more than 2 tags at a time.",
                }
            ]
        )
        with tempfile.TemporaryDirectory() as cache_dir:
            with self.assertRaises(RuntimeError) as caught:
                self.node.fetch_random_post(
                    query_tags="1girl solo cup", cache_dir=cache_dir
                )

        message = str(caught.exception)
        self.assertIn("more than 2 tags", message)
        self.assertIn("rating:", message, "the hint has to explain that rating: is free")

    def test_run_reports_an_empty_result_set(self):
        self.ns["http_get"] = FakeHttp([[]])
        with tempfile.TemporaryDirectory() as cache_dir:
            with self.assertRaises(RuntimeError) as caught:
                self.node.fetch_random_post(query_tags="unicorn nobody", cache_dir=cache_dir)

        self.assertIn("unicorn nobody", str(caught.exception))

    def test_credentials_fall_back_to_the_environment(self):
        os.environ["DANBOORU_LOGIN"] = "someone"
        os.environ["DANBOORU_API_KEY"] = "secretkey"
        self.addCleanup(os.environ.pop, "DANBOORU_LOGIN", None)
        self.addCleanup(os.environ.pop, "DANBOORU_API_KEY", None)
        seen = {}

        def capture(url, timeout=None, headers=None):
            seen.update(headers or {})
            return json.dumps([sample_post()]).encode("utf-8")

        self.ns["http_get"] = capture
        self.ns["load_image_tensor"] = lambda data: ("tensor", data)
        with tempfile.TemporaryDirectory() as cache_dir:
            self.node.fetch_random_post(query_tags="rating:general", cache_dir=cache_dir)

        expected = base64.b64encode(b"someone:secretkey").decode("ascii")
        self.assertEqual(seen.get("Authorization"), "Basic %s" % expected)

    def test_the_api_key_never_reaches_the_url_or_the_output(self):
        calls = []

        def capture(url, timeout=None, headers=None):
            calls.append((url, dict(headers or {})))
            if "posts.json" in url:
                return json.dumps([sample_post()]).encode("utf-8")
            return b"IMAGEBYTES"

        self.ns["http_get"] = capture
        self.ns["load_image_tensor"] = lambda data: ("tensor", data)
        with tempfile.TemporaryDirectory() as cache_dir:
            result = self.node.fetch_random_post(
                query_tags="rating:general",
                login="someone",
                api_key="secretkey",
                cache_dir=cache_dir,
            )

        for url, headers in calls:
            self.assertNotIn("secretkey", url)
            if "cdn.donmai.us" in url:
                self.assertNotIn(
                    "Authorization",
                    headers,
                    "the API key has no business going to the CDN",
                )
        for value in result:
            self.assertNotIn("secretkey", str(value))

    def test_run_needs_no_credentials_at_all(self):
        self.ns["http_get"] = FakeHttp([[sample_post()], b"IMAGEBYTES"])
        self.ns["load_image_tensor"] = lambda data: ("tensor", data)
        with tempfile.TemporaryDirectory() as cache_dir:
            result = self.node.fetch_random_post(query_tags="rating:general", cache_dir=cache_dir)

        self.assertEqual(result[0], ("tensor", b"IMAGEBYTES"))

    # --- the network layer -------------------------------------------------

    def test_a_poisoned_dns_falls_back_to_the_pinned_ips(self):
        asked = []

        def fail(url, timeout=None, headers=None):
            asked.append(("plain", url))
            raise urllib.error.URLError("getaddrinfo failed")

        def pinned(url, timeout=None, headers=None):
            asked.append(("pinned", url))
            return b"PINNED"

        self.ns["_plain_get"] = fail
        self.ns["_pinned_get"] = pinned

        self.assertEqual(self.ns["http_get"]("https://danbooru.donmai.us/posts.json"), b"PINNED")
        self.assertEqual([kind for kind, _ in asked], ["plain", "pinned"])

    def test_a_real_http_error_is_not_retried_through_the_pins(self):
        self.ns["_plain_get"] = lambda url, timeout=None, headers=None: (_ for _ in ()).throw(
            self.ns["DanbooruError"]("HTTP 403: forbidden")
        )
        self.ns["_pinned_get"] = lambda url, timeout=None, headers=None: b"SHOULD NOT RUN"

        with self.assertRaises(self.ns["DanbooruError"]) as caught:
            self.ns["http_get"]("https://danbooru.donmai.us/posts.json")

        self.assertIn("403", str(caught.exception))

    def test_the_pinned_route_is_remembered_once_it_worked(self):
        """A poisoned DNS must not cost the full timeout on *every* run again."""

        asked = []

        def fail(url, timeout=None, headers=None):
            asked.append("plain")
            raise urllib.error.URLError("getaddrinfo: 162.125.80.6")

        def pinned(url, timeout=None, headers=None):
            asked.append("pinned")
            return b"PINNED"

        self.ns["_plain_get"] = fail
        self.ns["_pinned_get"] = pinned
        url = "https://danbooru.donmai.us/posts.json"

        self.assertEqual(self.ns["http_get"](url), b"PINNED")
        self.assertEqual(self.ns["http_get"](url), b"PINNED")
        self.assertEqual(asked, ["plain", "pinned", "pinned"])

    def test_the_remembered_route_is_per_host(self):
        asked = []

        def plain(url, timeout=None, headers=None):
            asked.append(("plain", url))

            if "danbooru" in url:
                raise urllib.error.URLError("poisoned")

            return b"PLAIN"

        def pinned(url, timeout=None, headers=None):
            asked.append(("pinned", url))
            return b"PINNED"

        self.ns["_plain_get"] = plain
        self.ns["_pinned_get"] = pinned

        self.ns["http_get"]("https://danbooru.donmai.us/posts.json")
        self.assertEqual(self.ns["http_get"]("https://cdn.donmai.us/x.jpg"), b"PLAIN")
        self.assertEqual(
            asked[-1][0], "plain", "a healthy host must not be pushed onto someone else's pin"
        )

    def test_a_pin_that_stops_working_hands_the_host_back_to_dns(self):
        asked = []
        plain_rounds = []

        def plain(url, timeout=None, headers=None):
            asked.append("plain")
            plain_rounds.append(url)

            if len(plain_rounds) == 1:  # the first call is the poisoned one
                raise urllib.error.URLError("poisoned")

            return b"PLAIN"

        def pinned(url, timeout=None, headers=None):
            asked.append("pinned")
            return b"PINNED"

        self.ns["_plain_get"] = plain
        self.ns["_pinned_get"] = pinned
        url = "https://danbooru.donmai.us/posts.json"
        self.assertEqual(self.ns["http_get"](url), b"PINNED")

        def dead_pin(url, timeout=None, headers=None):
            asked.append("dead-pin")
            raise self.ns["DanbooruError"]("内置 IP 全部不可达", status=None)

        self.ns["_pinned_get"] = dead_pin
        self.assertEqual(self.ns["http_get"](url), b"PLAIN")
        self.assertEqual(asked, ["plain", "pinned", "dead-pin", "plain"])

        self.ns["_pinned_get"] = pinned
        self.assertEqual(self.ns["http_get"](url), b"PLAIN")
        self.assertEqual(asked[-1], "plain", "the host stays on the normal route")

    def test_a_query_error_from_the_pinned_route_is_final_too(self):
        """A 422 is about the query itself - no other route can answer differently."""

        self.ns["_plain_get"] = lambda url, timeout=None, headers=None: (
            _ for _ in ()
        ).throw(urllib.error.URLError("poisoned"))
        self.ns["_pinned_get"] = lambda url, timeout=None, headers=None: b"PINNED"
        url = "https://danbooru.donmai.us/posts.json"
        self.ns["http_get"](url)

        asked = []

        def refuse(url, timeout=None, headers=None):
            asked.append("pinned")
            raise self.ns["DanbooruError"]("HTTP 422: too many tags", status=422)

        def plain(url, timeout=None, headers=None):
            asked.append("plain")
            return b"SHOULD NOT RUN"

        self.ns["_pinned_get"] = refuse
        self.ns["_plain_get"] = plain
        with self.assertRaises(self.ns["DanbooruError"]) as caught:
            self.ns["http_get"](url)

        self.assertIn("422", str(caught.exception))
        self.assertEqual(asked, ["pinned"], "a real status is the answer, not a broken route")

    def test_all_pinned_addresses_answering_500_keep_the_site_status(self):
        """A 500 from every address is still the site answering, not a dead route."""

        class Response:
            def __init__(self, status, body):
                self.status = status
                self._body = body

            def read(self):
                return self._body

        class Connection:
            def __init__(self, host, ip, port=None, timeout=None, context=None):
                pass

            def request(self, method, path, headers=None):
                pass

            def getresponse(self):
                return Response(
                    500, b'{"success":false,"error":"ActiveRecord::QueryCanceled"}'
                )

            def close(self):
                pass

        self.ns["_SniHTTPSConnection"] = Connection
        with self.assertRaises(self.ns["DanbooruError"]) as caught:
            self.ns["_pinned_get"]("https://danbooru.donmai.us/posts.json?tags=rating%3Ageneral")

        self.assertEqual(
            caught.exception.status,
            500,
            "dropping the status turns a 'retry shallower' into a fake 'unreachable'",
        )

    def test_a_server_error_from_any_pinned_address_counts_as_an_answer(self):
        """One 500 plus two unreachable addresses is still the site answering."""

        class Response:
            def __init__(self, status, body):
                self.status = status
                self._body = body

            def read(self):
                return self._body

        pins = self.ns["HOST_PINS"]["danbooru.donmai.us"]

        class Connection:
            def __init__(self, host, ip, port=None, timeout=None, context=None):
                self.ip = ip

            def request(self, method, path, headers=None):
                if self.ip != pins[0]:
                    raise OSError("connection timed out")

            def getresponse(self):
                return Response(
                    500, b'{"success":false,"error":"ActiveRecord::QueryCanceled"}'
                )

            def close(self):
                pass

        self.ns["_SniHTTPSConnection"] = Connection
        with self.assertRaises(self.ns["DanbooruError"]) as caught:
            self.ns["_pinned_get"]("https://danbooru.donmai.us/posts.json?tags=rating%3Ageneral")

        self.assertEqual(
            caught.exception.status,
            500,
            "the last address timing out must not hide the answer the site did give",
        )

    def test_a_server_error_on_the_remembered_route_keeps_the_pins(self):
        asked = []

        def plain(url, timeout=None, headers=None):
            asked.append("plain")
            raise urllib.error.URLError("poisoned")

        def pinned(url, timeout=None, headers=None):
            asked.append("pinned")
            return b"PINNED"

        self.ns["_plain_get"] = plain
        self.ns["_pinned_get"] = pinned
        url = "https://danbooru.donmai.us/posts.json"
        self.assertEqual(self.ns["http_get"](url), b"PINNED")

        def busy(url, timeout=None, headers=None):
            asked.append("busy-pin")
            raise self.ns["DanbooruError"]("Danbooru 返回 HTTP 500", status=500)

        self.ns["_pinned_get"] = busy
        with self.assertRaises(self.ns["DanbooruError"]) as caught:
            self.ns["http_get"](url)

        self.assertEqual(caught.exception.status, 500)
        self.assertEqual(
            asked,
            ["plain", "pinned", "busy-pin"],
            "a 5xx must not send the host back to a dead DNS (and a dead DNS costs a timeout)",
        )

        self.ns["_pinned_get"] = pinned
        self.assertEqual(self.ns["http_get"](url), b"PINNED")
        self.assertEqual(asked[-1], "pinned", "the pin stays remembered")

    def test_a_blocked_pinned_address_gives_a_recovered_dns_one_chance(self):
        self.ns["_plain_get"] = lambda url, timeout=None, headers=None: (
            _ for _ in ()
        ).throw(urllib.error.URLError("poisoned"))
        self.ns["_pinned_get"] = lambda url, timeout=None, headers=None: b"PINNED"
        url = "https://danbooru.donmai.us/posts.json"
        self.ns["http_get"](url)

        asked = []

        def blocked(url, timeout=None, headers=None):
            asked.append("pinned")
            raise self.ns["DanbooruError"]("HTTP 403: challenge", status=403)

        def plain(url, timeout=None, headers=None):
            asked.append("plain")
            return b"PLAIN"

        self.ns["_pinned_get"] = blocked
        self.ns["_plain_get"] = plain
        self.assertEqual(self.ns["http_get"](url), b"PLAIN")
        self.assertEqual(asked, ["pinned", "plain"])

        def never(url, timeout=None, headers=None):
            raise AssertionError("the healthy DNS route must be kept")

        self.ns["_pinned_get"] = never
        self.assertEqual(
            self.ns["http_get"](url),
            b"PLAIN",
            "a block aimed at the pinned address hands the host back to DNS",
        )

    # --- timeouts (the connection lives, the body stalls) -------------------

    def test_a_read_timeout_counts_as_a_connection_failure(self):
        """``response.read()`` timeouts arrive raw - urllib never wraps them."""

        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *exc_info):
                return False

            def read(self):
                raise TimeoutError("The read operation timed out")

        original = urllib.request.urlopen
        urllib.request.urlopen = lambda request, timeout=None: Response()
        self.addCleanup(setattr, urllib.request, "urlopen", original)

        with self.assertRaises(urllib.error.URLError):
            self.ns["_plain_get"]("https://danbooru.donmai.us/posts.json?tags=rating%3Ageneral")

    def test_a_bare_timeout_falls_back_to_the_pinned_ips(self):
        asked = []

        def plain(url, timeout=None, headers=None):
            asked.append("plain")
            raise TimeoutError("The read operation timed out")

        def pinned(url, timeout=None, headers=None):
            asked.append("pinned")
            return b"PINNED"

        self.ns["_plain_get"] = plain
        self.ns["_pinned_get"] = pinned

        self.assertEqual(self.ns["http_get"]("https://danbooru.donmai.us/posts.json"), b"PINNED")
        self.assertEqual(asked, ["plain", "pinned"])

    def test_a_timed_out_search_is_retried_before_failing(self):
        rounds = []

        def plain(url, timeout=None, headers=None):
            if "posts.json" in url:
                rounds.append(url)
                if len(rounds) == 1:
                    raise TimeoutError("The read operation timed out")
                return json.dumps([sample_post()]).encode("utf-8")
            return b"IMAGEBYTES"

        def pinned(url, timeout=None, headers=None):
            raise self.ns["DanbooruError"]("内置 IP 全部不可达：timed out", status=None)

        self.ns["_plain_get"] = plain
        self.ns["_pinned_get"] = pinned
        self.ns["load_image_tensor"] = lambda data: ("tensor", data)
        with tempfile.TemporaryDirectory() as cache_dir:
            result = self.node.fetch_random_post(
                query_tags="rating:general", max_attempts=2, cache_dir=cache_dir
            )

        self.assertEqual(len(rounds), 2, "a dropped connection is worth another round")
        self.assertEqual(json.loads(result[6])["attempts"], 2)
        self.assertEqual(result[0], ("tensor", b"IMAGEBYTES"))

    def test_a_slow_network_reports_the_timeout_in_words(self):
        calls = []

        def plain(url, timeout=None, headers=None):
            calls.append(url)
            raise urllib.error.URLError(TimeoutError("The read operation timed out"))

        def pinned(url, timeout=None, headers=None):
            raise self.ns["DanbooruError"]("内置 IP 全部不可达：timed out", status=None)

        self.ns["_plain_get"] = plain
        self.ns["_pinned_get"] = pinned
        with tempfile.TemporaryDirectory() as cache_dir:
            with self.assertRaises(RuntimeError) as caught:
                self.node.fetch_random_post(
                    query_tags="rating:general", max_attempts=2, cache_dir=cache_dir
                )

        message = str(caught.exception)
        self.assertIn("超时", message)
        self.assertIn("timeout", message, "the hint has to name the widget to turn up")
        self.assertEqual(len(calls), 2, "both attempts must be spent before giving up")

    def test_a_dead_remembered_route_is_not_asked_twice(self):
        self.ns["_plain_get"] = lambda url, timeout=None, headers=None: (
            _ for _ in ()
        ).throw(urllib.error.URLError("poisoned"))
        self.ns["_pinned_get"] = lambda url, timeout=None, headers=None: b"PINNED"
        url = "https://danbooru.donmai.us/posts.json"
        self.ns["http_get"](url)

        asked = []

        def dead_pin(url, timeout=None, headers=None):
            asked.append("pinned")
            raise self.ns["DanbooruError"]("内置 IP 全部不可达", status=None)

        def plain(url, timeout=None, headers=None):
            asked.append("plain")
            raise urllib.error.URLError("poisoned")

        self.ns["_pinned_get"] = dead_pin
        self.ns["_plain_get"] = plain
        with self.assertRaises(self.ns["DanbooruError"]) as caught:
            self.ns["http_get"](url)

        self.assertEqual(
            asked, ["pinned", "plain"], "asking the dead pin again only burns a second timeout"
        )
        self.assertIn("无法访问", str(caught.exception))
        self.assertIn("poisoned", str(caught.exception))

    def test_a_status_from_the_pinned_route_is_not_reported_as_unreachable(self):
        self.ns["_plain_get"] = lambda url, timeout=None, headers=None: (
            _ for _ in ()
        ).throw(urllib.error.URLError("poisoned"))

        def refuse(url, timeout=None, headers=None):
            raise self.ns["DanbooruError"]("HTTP 403: challenge", status=403)

        self.ns["_pinned_get"] = refuse
        with self.assertRaises(self.ns["DanbooruError"]) as caught:
            self.ns["http_get"]("https://danbooru.donmai.us/posts.json")

        self.assertEqual(caught.exception.status, 403)
        self.assertNotIn(
            "无法访问",
            str(caught.exception),
            "the site answered; calling that 'unreachable' hides the real problem",
        )

    def test_every_host_that_matters_has_a_pinned_ip(self):
        pins = self.ns["HOST_PINS"]

        self.assertIn("danbooru.donmai.us", pins)
        self.assertIn("cdn.donmai.us", pins)
        for host, ips in pins.items():
            with self.subTest(host=host):
                self.assertTrue(ips, "no candidate IP for %s" % host)
                for ip in ips:
                    self.assertRegex(ip, r"^\d{1,3}(\.\d{1,3}){3}$")

    def test_the_user_agent_names_the_project_as_the_site_asks(self):
        headers = self.ns["build_headers"]()

        self.assertIn("Anima-Tools", headers["User-Agent"])
        self.assertIn("User-Agent", headers)

    def test_a_half_filled_credential_pair_is_ignored(self):
        headers = self.ns["build_headers"]("someone", "")

        self.assertNotIn("Authorization", headers)

    def test_the_pinned_connection_keeps_the_real_hostname_for_tls(self):
        """Connecting to an IP must still verify the certificate of the hostname."""
        connection_class = self.ns["_SniHTTPSConnection"]
        connection = connection_class("danbooru.donmai.us", "104.26.10.39", timeout=5)

        self.assertEqual(connection.host, "danbooru.donmai.us")
        self.assertEqual(connection.port, 443)
        self.assertEqual(connection._ip, "104.26.10.39")

    # --- caching key -------------------------------------------------------

    def test_a_random_seed_asks_for_a_new_image_every_queue(self):
        first = self.node_class.IS_CHANGED(seed=-1, query_tags="rating:general")
        time.sleep(0.002)
        second = self.node_class.IS_CHANGED(seed=-1, query_tags="rating:general")

        self.assertNotEqual(first, second)

    def test_a_fixed_seed_is_stable_and_sensitive_to_the_query(self):
        first = self.node_class.IS_CHANGED(seed=7, query_tags="rating:general")
        repeated = self.node_class.IS_CHANGED(seed=7, query_tags="rating:general")
        other_query = self.node_class.IS_CHANGED(seed=7, query_tags="rating:general solo")
        other_seed = self.node_class.IS_CHANGED(seed=8, query_tags="rating:general")

        self.assertEqual(first, repeated)
        self.assertNotEqual(first, other_query)
        self.assertNotEqual(first, other_seed)

    def test_a_linked_seed_leaves_the_decision_to_comfyui(self):
        first = self.node_class.IS_CHANGED(seed=None, query_tags="rating:general")
        repeated = self.node_class.IS_CHANGED(seed=None, query_tags="rating:general solo")
        as_list = self.node_class.IS_CHANGED(seed=["610", 0], query_tags="rating:general")

        self.assertEqual(first, repeated)
        self.assertEqual(first, as_list)
        self.assertNotEqual(first, self.node_class.IS_CHANGED(seed=-1, query_tags="rating:general"))

    def test_is_changed_does_not_hash_the_api_key(self):
        """Rotating a key must not look like a reason to redraw."""
        first = self.node_class.IS_CHANGED(seed=7, query_tags="rating:general", api_key="a")
        second = self.node_class.IS_CHANGED(seed=7, query_tags="rating:general", api_key="b")

        self.assertEqual(first, second)

    # --- regressions found in the 2026-10-17 review ------------------------

    def _fail_urlopen(self, code, reason, body):
        """Make the next ``_plain_get`` answer with a real ``HTTPError`` carrier."""

        error = urllib.error.HTTPError(
            "https://danbooru.donmai.us/posts.json", code, reason, {}, io.BytesIO(body)
        )
        original = urllib.request.urlopen
        urllib.request.urlopen = lambda *args, **kwargs: (_ for _ in ()).throw(error)
        self.addCleanup(setattr, urllib.request, "urlopen", original)

    def test_an_http_422_keeps_the_sites_message_and_explains_the_tag_budget(self):
        body = json.dumps(
            {
                "success": False,
                "error": "PostQuery::TagLimitError",
                "message": "You cannot search for more than 2 tags at a time.",
            }
        ).encode("utf-8")
        self._fail_urlopen(422, "Unprocessable Content", body)

        with self.assertRaises(self.ns["DanbooruError"]) as caught:
            self.ns["_plain_get"]("https://danbooru.donmai.us/posts.json?tags=1girl+solo+cup")

        message = str(caught.exception)
        self.assertIn("more than 2 tags", message)
        self.assertIn("rating:", message)
        self.assertIn("random:1", message, "the hint has to name the slot random:1 spends")
        self.assertEqual(caught.exception.status, 422)

    def test_an_http_500_keeps_the_sites_message_and_status(self):
        body = json.dumps(
            {
                "success": False,
                "error": "ActiveRecord::QueryCanceled",
                "message": "The database timed out running your query.",
            }
        ).encode("utf-8")
        self._fail_urlopen(500, "Internal Server Error", body)

        with self.assertRaises(self.ns["DanbooruError"]) as caught:
            self.ns["_plain_get"]("https://danbooru.donmai.us/posts.json?tags=rating:general&page=50")

        self.assertIn("timed out", str(caught.exception))
        self.assertEqual(caught.exception.status, 500)

    def test_a_block_tag_written_with_spaces_blocks_the_whole_tag(self):
        groups = self.ns["format_tag_groups"](
            sample_post(tag_string_general="black_hair 1girl"), block_tags="black hair"
        )

        self.assertEqual(groups["general"], "1girl")

    def test_block_tags_are_separated_by_commas_or_newlines(self):
        groups = self.ns["format_tag_groups"](
            sample_post(tag_string_general="1girl solo smile"), block_tags="smile,\nsolo"
        )

        self.assertEqual(groups["general"], "1girl")

    def test_a_wildcard_block_tag_drops_every_tag_containing_it(self):
        groups = self.ns["format_tag_groups"](
            sample_post(tag_string_general="1girl bar_censor censored nude"),
            block_tags="*censor*",
        )

        self.assertEqual(groups["general"], "1girl, nude")

    def test_a_wildcard_block_tag_can_anchor_at_the_start_or_the_end(self):
        groups = self.ns["format_tag_groups"](
            sample_post(tag_string_general="1girl hair_ornament long_hair"),
            block_tags="hair*,*hair",
        )

        self.assertEqual(groups["general"], "1girl")

    def test_a_question_mark_wildcard_matches_exactly_one_character(self):
        groups = self.ns["format_tag_groups"](
            sample_post(tag_string_general="1girl 2girls"), block_tags="2girl?"
        )

        self.assertEqual(groups["general"], "1girl")

    def test_a_block_tag_without_wildcards_still_matches_the_whole_tag_only(self):
        groups = self.ns["format_tag_groups"](
            sample_post(tag_string_general="smile smiley smirk"), block_tags="smile"
        )

        self.assertEqual(groups["general"], "smiley, smirk")

    def test_wildcard_block_tags_are_separated_by_commas(self):
        groups = self.ns["format_tag_groups"](
            sample_post(tag_string_general="1girl bar_censor smile nude"),
            block_tags="*censor*, smile",
        )

        self.assertEqual(groups["general"], "1girl, nude")

    def test_a_wildcard_does_not_turn_off_the_default_blocklist(self):
        groups = self.ns["format_tag_groups"](
            sample_post(tag_string_general="1girl artist_name censored"),
            block_tags="*censor*",
        )

        self.assertEqual(groups["general"], "1girl")

    def test_the_cache_file_name_keeps_the_requested_size(self):
        paths = {
            size: self.ns["cache_file_path"]("/cache", sample_post(), size)
            for size in ("sample", "original")
        }

        self.assertNotEqual(paths["sample"], paths["original"])
        self.assertIn("sample", os.path.basename(paths["sample"]))
        self.assertIn("original", os.path.basename(paths["original"]))

    def test_changing_the_size_downloads_the_other_variant(self):
        post = sample_post()
        http = FakeHttp([[post], b"SAMPLE_BYTES", [post], b"ORIGINAL_BYTES"])
        self.ns["http_get"] = http
        self.ns["load_image_tensor"] = lambda data: data
        with tempfile.TemporaryDirectory() as cache_dir:
            first = self.node.fetch_random_post(
                query_tags="rating:general", seed=5, size="sample", cache_dir=cache_dir
            )
            second = self.node.fetch_random_post(
                query_tags="rating:general", seed=5, size="original", cache_dir=cache_dir
            )

        self.assertEqual(first[0], b"SAMPLE_BYTES")
        self.assertEqual(second[0], b"ORIGINAL_BYTES", "a new size must not reuse the other variant")
        self.assertFalse(json.loads(second[6])["cached"])

    def test_a_seeded_run_asks_for_an_id_range_not_a_page(self):
        http = FakeHttp([[sample_post()], b"IMAGEBYTES"])
        self.ns["http_get"] = http
        self.ns["load_image_tensor"] = lambda data: data
        with tempfile.TemporaryDirectory() as cache_dir:
            self.node.fetch_random_post(query_tags="rating:general", seed=99, cache_dir=cache_dir)

        query = urllib.parse.parse_qs(urllib.parse.urlsplit(http.urls[0]).query)
        anchor = self.ns["build_request"]("rating:general", 99)["anchor"]
        self.assertNotIn("page", query, "a page number is what moved when the site gained posts")
        self.assertEqual(query["limit"], ["200"])
        found = re.fullmatch(r"rating:general id:(\d+)\.\.(\d+)", query["tags"][0])
        self.assertEqual(int(found.group(2)), anchor, "the window ends at the anchor")
        self.assertLess(int(found.group(1)), anchor)

    def test_an_empty_id_window_widens_before_moving_to_the_next_anchor(self):
        ranges = []

        def answer(url, timeout=None, headers=None):
            if "posts.json" not in url:
                return b"IMAGEBYTES"
            tags = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)["tags"][0]
            found = re.search(r"id:(\d+)\.\.(\d+)", tags)
            ranges.append((int(found.group(1)), int(found.group(2))))
            if len(ranges) < 3:
                return b"[]"
            return json.dumps([sample_post()]).encode("utf-8")

        self.ns["http_get"] = answer
        self.ns["load_image_tensor"] = lambda data: data
        with tempfile.TemporaryDirectory() as cache_dir:
            result = self.node.fetch_random_post(
                query_tags="rating:general", seed=7, cache_dir=cache_dir
            )

        self.assertEqual(len(ranges), 3)
        self.assertEqual(ranges[0][1], ranges[1][1], "the same anchor is widened first")
        self.assertGreater(ranges[0][0], ranges[1][0], "widening reaches further back in time")
        self.assertEqual(json.loads(result[6])["id"], sample_post()["id"])

    def test_a_timeout_retries_the_same_window_instead_of_widening(self):
        ranges = []

        def answer(url, timeout=None, headers=None):
            if "posts.json" not in url:
                return b"IMAGEBYTES"
            tags = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)["tags"][0]
            found = re.search(r"id:(\d+)\.\.(\d+)", tags)
            ranges.append((int(found.group(1)), int(found.group(2))))
            if len(ranges) == 1:
                raise self.ns["DanbooruError"]("超时", transient=True)
            return json.dumps([sample_post()]).encode("utf-8")

        self.ns["http_get"] = answer
        self.ns["load_image_tensor"] = lambda data: data
        with tempfile.TemporaryDirectory() as cache_dir:
            self.node.fetch_random_post(query_tags="rating:general", seed=5, cache_dir=cache_dir)

        self.assertEqual(len(ranges), 2)
        self.assertEqual(ranges[0], ranges[1], "a dead network must not change which post the seed means")

    def test_a_window_of_videos_widens_instead_of_asking_the_same_range_twice(self):
        ranges = []

        def answer(url, timeout=None, headers=None):
            tags = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)["tags"][0]
            found = re.search(r"id:(\d+)\.\.(\d+)", tags)
            ranges.append((int(found.group(1)), int(found.group(2))))
            return json.dumps([sample_post(file_ext="mp4")]).encode("utf-8")

        self.ns["http_get"] = answer
        with tempfile.TemporaryDirectory() as cache_dir:
            with self.assertRaises(self.ns["DanbooruError"]) as caught:
                self.node.fetch_random_post(
                    query_tags="rating:general", seed=11, cache_dir=cache_dir
                )

        self.assertEqual(len(ranges), len(set(ranges)), "the same window must never be asked twice")
        self.assertIn("窗口", str(caught.exception))
        self.assertIn("id_ceiling", str(caught.exception))

    def test_the_meta_records_the_id_window_and_the_ceiling(self):
        http = FakeHttp([[sample_post()], b"IMAGEBYTES"])
        self.ns["http_get"] = http
        self.ns["load_image_tensor"] = lambda data: data
        with tempfile.TemporaryDirectory() as cache_dir:
            result = self.node.fetch_random_post(
                query_tags="rating:general", seed=3, cache_dir=cache_dir
            )

        meta = json.loads(result[6])
        self.assertEqual(meta["mode"], "id")
        self.assertEqual(meta["id_ceiling"], self.ns["DEFAULT_ID_CEILING"])
        self.assertRegex(meta["id_window"], r"^\d+\.\.\d+$")
        self.assertRegex(meta["anchor"].__str__(), r"^\d+$")
        self.assertEqual(int(meta["id_window"].split("..")[1]), meta["anchor"])

    def test_a_tag_limit_error_is_not_retried_in_another_window(self):
        error = self.ns["DanbooruError"]("You cannot search for more than 2 tags at a time.")
        error.status = 422
        http = FakeHttp([error, error, error])
        self.ns["http_get"] = http
        with tempfile.TemporaryDirectory() as cache_dir:
            with self.assertRaises(self.ns["DanbooruError"]):
                self.node.fetch_random_post(query_tags="1girl solo", seed=7, cache_dir=cache_dir)

        self.assertEqual(len(http.urls), 1, "a 422 cannot change by asking another window")

    def test_the_pinned_fallback_moves_to_the_next_address_after_a_server_error(self):
        payload = json.dumps([sample_post()]).encode("utf-8")
        attempted = []
        pins = self.ns["HOST_PINS"]["danbooru.donmai.us"]

        class Response:
            def __init__(self, status, body):
                self.status = status
                self._body = body

            def read(self):
                return self._body

        class Connection:
            def __init__(self, host, ip, port=None, timeout=None, context=None):
                self.ip = ip
                attempted.append(ip)

            def request(self, method, path, headers=None):
                pass

            def getresponse(self):
                if self.ip == pins[0]:
                    return Response(500, b'{"success":false,"message":"The database is unavailable."}')
                return Response(200, payload)

            def close(self):
                pass

        self.ns["_SniHTTPSConnection"] = Connection
        data = self.ns["_pinned_get"]("https://danbooru.donmai.us/posts.json?tags=rating%3Ageneral")

        self.assertEqual(json.loads(data)[0]["id"], sample_post()["id"])
        self.assertEqual(attempted[:2], [pins[0], pins[1]])

    def test_the_cache_drops_its_oldest_entries_but_not_other_files(self):
        with tempfile.TemporaryDirectory() as cache_dir:
            for index in range(5):
                path = os.path.join(cache_dir, "sample-%032d.jpg" % index)
                with open(path, "wb") as handle:
                    handle.write(b"x")
                os.utime(path, (1000 + index, 1000 + index))
            mine = os.path.join(cache_dir, "notes.txt")
            with open(mine, "w", encoding="utf-8") as handle:
                handle.write("mine")

            removed = self.ns["prune_cache"](cache_dir, max_files=3)

            self.assertEqual(removed, 2)
            remaining = sorted(
                name for name in os.listdir(cache_dir) if name.startswith("sample-")
            )
            self.assertEqual(remaining, ["sample-%032d.jpg" % index for index in (2, 3, 4)])
            self.assertTrue(os.path.isfile(mine), "files the node did not write must be left alone")

    def test_the_meta_does_not_leak_the_cache_directory(self):
        self.ns["http_get"] = FakeHttp([[sample_post()], b"IMAGEBYTES"])
        self.ns["load_image_tensor"] = lambda data: ("tensor", data)
        with tempfile.TemporaryDirectory() as cache_dir:
            result = self.node.fetch_random_post(query_tags="rating:general", cache_dir=cache_dir)

        self.assertEqual(
            json.loads(result[6])["cached_file"], "sample-%s.jpg" % sample_post()["md5"]
        )

    def test_the_run_stops_when_its_time_budget_is_used_up(self):
        class Clock:
            now = 0.0

            def monotonic(self):
                return self.now

            def time(self):
                return self.now

        clock = Clock()
        requests = []

        def answer(url, timeout=None, headers=None):
            requests.append(timeout)
            clock.now += 5.0
            return json.dumps([sample_post(file_ext="mp4")]).encode("utf-8")

        self.ns["time"] = clock
        self.ns["http_get"] = answer
        with tempfile.TemporaryDirectory() as cache_dir:
            with self.assertRaises(RuntimeError) as caught:
                self.node.fetch_random_post(
                    query_tags="rating:general", timeout=2.0, max_attempts=3, cache_dir=cache_dir
                )

        self.assertIn("时间预算", str(caught.exception))
        self.assertEqual(len(requests), 2, "the third attempt would run past the budget")
        self.assertTrue(all(value <= 2.0 for value in requests))

    def test_the_module_namespace_carries_the_real_imports(self):
        """The loader must run the module's own imports, not a hand-kept list."""

        self.assertIn("io", self.ns)


if __name__ == "__main__":
    unittest.main()
