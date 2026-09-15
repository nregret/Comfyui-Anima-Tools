import ast
import json
import re
import unittest
import urllib
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


def load_prompt_composer_class():
    nodes_path = REPO_ROOT / "nodes.py"
    tree = ast.parse(nodes_path.read_text(encoding="utf-8"), filename=str(nodes_path))
    class_node = next(
        node
        for node in tree.body
        if isinstance(node, ast.ClassDef) and node.name == "AnimaPromptComposer"
    )
    namespace = {
        "__file__": str(nodes_path),
        "re": re,
        "urllib": urllib,
    }
    exec(
        compile(ast.Module(body=[class_node], type_ignores=[]), str(nodes_path), "exec"),
        namespace,
    )
    return namespace["AnimaPromptComposer"]


class AnimaPromptComposerRandomComboTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.composer_class = load_prompt_composer_class()
        cls.attire = json.loads(
            (REPO_ROOT / "js" / "danbooru_attire_data.json").read_text(encoding="utf-8")
        )

    def setUp(self):
        self.composer_class._data_cache = {}
        self.composer = self.composer_class()
        self.inputs = {
            "enable_artist": True,
            "enable_character": True,
            "enable_clothing": True,
            "enable_background": True,
            "enable_pose": True,
            "artist_count": 1,
            "preview_collapsed": False,
            "resolved_prompt": "",
        }

    def compose(self, **overrides):
        payload = dict(self.inputs)
        payload.update(overrides)
        return self.composer.compose_prompt(**payload)

    def selection(self, **overrides):
        return self.compose(**overrides)["ui"]["anima_prompt_composer"][0]

    def test_author_clothing_source_is_the_default(self):
        selected = self.selection(character_detail="trigger_tags", seed=4242)
        self.assertEqual(len(selected["clothing"]), 1)
        self.assertTrue(selected["clothing"][0]["key"].startswith("clothing:"))
        self.assertNotIn("clothing:danbooru:", selected["clothing"][0]["key"])
        self.assertNotIn("clothing:character_tags:", selected["clothing"][0]["key"])

    def test_random_character_tags_drop_gender_and_keep_features(self):
        for seed in range(1, 40):
            result = self.compose(character_detail="trigger_random_tags", seed=seed, character_tag_count=3)
            text = result["result"][0].lower()
            selected = result["ui"]["anima_prompt_composer"][0]
            entry = selected["character"][0]

            self.assertNotIn("1girl", text)
            self.assertNotIn("1boy", text)

            outfit = [tag for tag in entry["outfit_parts"]]
            for tag in self.composer._dedupe_prompt_tokens(outfit):
                self.assertFalse(self.composer._is_gender_tag(tag))
                self.assertFalse(self.composer._is_character_feature_tag(tag))

            import random

            parts = self.composer._entry_parts(
                entry,
                "character",
                "trigger_random_tags",
                random.Random(seed),
                {"tag_count": 3, "keep_features": False},
            )
            extra = [tag for tag in parts if tag not in entry["trigger_parts"]]
            self.assertLessEqual(len(extra), 3)

    def test_random_character_tags_ignore_feature_words_from_the_random_pool(self):
        composer = self.composer
        features, outfit = composer._split_character_tags(["1girl", "aqua eyes", "long hair", "detached sleeves"])
        self.assertEqual(features, ["aqua eyes", "long hair"])
        self.assertEqual(outfit, ["detached sleeves"])

    def test_conflicting_feature_colours_are_collapsed_to_one_pick(self):
        composer = self.composer
        parts = ["grey eyes", "purple eyes", "hair between eyes", "black hair", "grey hair", "twintails"]
        import random

        for seed in range(20):
            collapsed = composer._collapse_character_feature_colours(parts, random.Random(seed))
            eyes = [tag for tag in collapsed if composer._character_feature_colour_group(tag) == "eyes"]
            hair = [tag for tag in collapsed if composer._character_feature_colour_group(tag) == "hair"]
            self.assertEqual(len(eyes), 1)
            self.assertEqual(len(hair), 1)
            self.assertIn("hair between eyes", collapsed)
            self.assertIn("twintails", collapsed)

    def test_keep_features_can_be_disabled(self):
        result = self.compose(
            character_detail="trigger_random_tags",
            seed=777,
            character_keep_features=False,
        )
        text = result["result"][0].lower()
        entry = result["ui"]["anima_prompt_composer"][0]["character"][0]
        for tag in entry["feature_parts"]:
            self.assertNotIn(tag.lower(), text)

    def test_danbooru_source_only_uses_bundled_pools(self):
        pools = {
            slot: set(self.attire[slot])
            for slot in self.composer_class.DANBOORU_SLOT_ORDER
        }
        seen_variants = set()
        for seed in range(1, 60):
            selected = self.selection(
                character_detail="trigger",
                seed=seed,
                clothing_source="danbooru",
            )
            entries = selected["clothing"]
            self.assertTrue(entries)
            for entry in entries:
                slot = entry["subtitle"].split()[1]
                self.assertIn(slot, pools)
                self.assertIn(entry["title"], pools[slot])

            slots = [entry["subtitle"].split()[1] for entry in entries]
            self.assertEqual(len(slots), len(set(slots)))

            mains = [slot for slot in slots if slot in ("top", "bottom", "uniform", "traditional")]
            self.assertTrue(mains)
            if "top" in slots or "bottom" in slots:
                self.assertIn("top", slots)
                self.assertIn("bottom", slots)
                self.assertEqual(set(mains), {"top", "bottom"})
                seen_variants.add("top_bottom")
            else:
                self.assertEqual(len(mains), 1)
                seen_variants.add(mains[0])

        self.assertEqual(seen_variants, {"top_bottom", "uniform", "traditional"})

    def test_danbooru_outfits_pick_at_most_one_tag_per_pool(self):
        """No outfit may use a slot twice - the review of 2026-09-14 reported two
        kinds of footwear, which only a pool that holds footwear can produce."""
        pools = {slot: set(self.attire[slot]) for slot in self.composer_class.DANBOORU_SLOT_ORDER}

        for seed in range(1, 200):
            selected = self.selection(
                character_detail="trigger",
                seed=seed,
                clothing_source="danbooru",
            )
            titles = [entry["title"] for entry in selected["clothing"]]
            for slot, tags in pools.items():
                picked = sorted(tag for tag in titles if tag in tags)
                self.assertLessEqual(len(picked), 1, f"seed {seed} picked {picked} from {slot}")

    def test_a_main_outfit_is_never_a_layered_garment(self):
        layered = {
            tag
            for slot in ("decoration", "top", "bottom", "socks", "shoes")
            for tag in self.attire[slot]
        }

        for seed in range(1, 120):
            selected = self.selection(
                character_detail="trigger",
                seed=seed,
                clothing_source="danbooru",
            )
            for entry in selected["clothing"]:
                slot = entry["subtitle"].split()[1]
                if slot in ("uniform", "traditional"):
                    self.assertNotIn(entry["title"], layered, f"seed {seed} drew {entry['title']} as a {slot}")

    def test_the_reported_clothing_seed_still_draws_one_main_outfit(self):
        """`clothing_seed=26` produced `geta, frilled thigh strap, socks, pumps`."""
        selected = self.selection(
            character_detail="trigger",
            seed=1,
            clothing_seed=26,
            clothing_source="danbooru",
        )
        entries = selected["clothing"]
        titles = [entry["title"] for entry in entries]
        slots = [entry["subtitle"].split()[1] for entry in entries]
        mains = [slot for slot in slots if slot in ("top", "bottom", "uniform", "traditional")]

        self.assertTrue(mains, f"clothing_seed=26 picked no main outfit: {titles}")
        if "top" in slots or "bottom" in slots:
            self.assertEqual(set(mains), {"top", "bottom"})
        else:
            self.assertEqual(len(mains), 1)

        for slot in ("shoes", "socks"):
            picked = [title for title in titles if title in self.attire[slot]]
            self.assertLessEqual(len(picked), 1, f"clothing_seed=26: {titles}")

    def test_character_tag_clothing_stays_inside_the_attire_vocabulary(self):
        vocabulary = set(self.attire["vocabulary"])
        for seed in range(1, 40):
            selected = self.selection(
                character_detail="trigger",
                seed=seed,
                clothing_source="character_tags",
            )
            entries = selected["clothing"]
            self.assertEqual(len(entries), 1)
            self.assertTrue(entries[0]["key"].startswith("clothing:character_tags:"))
            self.assertGreaterEqual(len(entries[0]["prompt_parts"]), 2)
            for tag in entries[0]["prompt_parts"]:
                self.assertIn(tag.lower(), vocabulary)

    def test_labels_do_not_leak_body_tags_into_borrowed_outfits(self):
        selected = self.selection(character_detail="trigger", seed=66, clothing_source="character_tags")
        for tag in selected["clothing"][0]["prompt_parts"]:
            self.assertNotIn(tag, ("large breasts", "beard", "fangs", "no humans"))

    def test_split_seeds_lock_one_section_only(self):
        locked = {
            self.selection(
                character_detail="trigger_random_tags",
                seed=-1,
                character_seed=4242,
                clothing_seed=99,
            )["character"][0]["key"]
            for _ in range(5)
        }
        self.assertEqual(len(locked), 1)

        other = self.selection(
            character_detail="trigger_random_tags",
            seed=-1,
            character_seed=7,
            clothing_seed=99,
        )["character"][0]["key"]
        self.assertNotEqual(other, locked.pop())

    def test_clothing_seed_controls_the_outfit_independently(self):
        def outfit(seed):
            return tuple(
                entry["title"]
                for entry in self.selection(
                    character_detail="trigger",
                    seed=-1,
                    clothing_seed=seed,
                    clothing_source="danbooru",
                )["clothing"]
            )

        self.assertEqual(outfit(1234), outfit(1234))
        self.assertNotEqual(outfit(1234), outfit(5678))

    def test_bundled_attire_pools_are_populated_and_pair_safe(self):
        for slot in self.composer_class.DANBOORU_SLOT_ORDER:
            self.assertGreaterEqual(len(self.attire[slot]), 10, slot)
            self.assertEqual(self.attire[slot], sorted(set(self.attire[slot])), slot)
            for tag in self.attire[slot]:
                self.assertEqual(tag, tag.lower(), tag)

        full_body = {"dress", "nightgown", "robe", "sweater dress", "deel"}
        self.assertFalse(full_body.intersection(self.attire["top"]))
        self.assertGreaterEqual(len(self.attire["vocabulary"]), 100)

        for tag in ("skirt", "pants", "shirt", "socks", "shoes", "kimono", "school uniform"):
            self.assertIn(tag, self.attire["vocabulary"], tag)


if __name__ == "__main__":
    unittest.main()
