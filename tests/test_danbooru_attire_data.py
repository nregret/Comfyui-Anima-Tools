import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]

BODY = """[expand=Table of Contents]
* 1. "About":#dtext-about
* 2. "Headwear and Headgear":#dtext-headwear

h4#about. About

Tags describing publicly-worn clothing.

h4#headwear. Headwear and Headgear

See also [[tag group:hair]], [[tag group:hair ornaments]].

* [[balaclava]]
* [[hat]]
** [[beret|Beret]]
* plain text tag
* prose entry: describes something

h4#tops. Shirts and Topwear

* [[long_hair]]
* [[shirt]]
* [[trench coat]]
** [[raincoat]]

h4#jewelry. Jewelry and Accessories

h6#jhead. Head and Face

* [[earrings]]
* [[hair ornament]]

h6#jtorso. Torso and Misc

* [[necktie]]
"""


def load_tool_module():
    path = REPO_ROOT / "tools" / "fetch_danbooru_attire.py"
    spec = importlib.util.spec_from_file_location("fetch_danbooru_attire", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class DanbooruAttireToolTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tool = load_tool_module()

    def test_normalize_tag_converts_underscores_to_spaces(self):
        self.assertEqual(self.tool.normalize_tag("long_hair"), "long hair")
        self.assertEqual(self.tool.normalize_tag("  Very  Long_Hair "), "very long hair")

    def test_parse_sections_keeps_wiki_labels_and_plain_text_entries(self):
        sections = self.tool.parse_sections(BODY)
        self.assertIn("hat", sections["Headwear and Headgear"])
        self.assertIn("beret", sections["Headwear and Headgear"])
        self.assertIn("plain text tag", sections["Headwear and Headgear"])
        self.assertNotIn("prose entry: describes something", sections["Headwear and Headgear"])

    def test_child_section_bullets_are_attributed_to_the_parent_section(self):
        sections = self.tool.parse_sections(BODY)
        self.assertIn("earrings", sections["Jewelry and Accessories"])
        self.assertIn("necktie", sections["Jewelry and Accessories"])
        self.assertIn("earrings", sections["Head and Face"])
        self.assertIn("necktie", sections["Torso and Misc"])

    def test_sections_stop_at_the_next_heading(self):
        sections = self.tool.parse_sections(BODY)
        self.assertNotIn("necktie", sections["Shirts and Topwear"])
        self.assertNotIn("balaclava", sections["About"])

    def test_bundled_slot_mapping_is_consistent(self):
        for slot, section_titles in self.tool.SLOT_SECTIONS.items():
            self.assertIn(slot, self.tool.SLOT_ORDER)
            for title in section_titles:
                self.assertIsInstance(title, str)
        self.assertNotIn(self.tool.VOCABULARY_KEY, self.tool.SLOT_ORDER)

    def test_bundled_data_file_shape(self):
        data = json.loads((REPO_ROOT / "js" / "danbooru_attire_data.json").read_text(encoding="utf-8"))
        self.assertEqual(set(data), set(self.tool.SLOT_ORDER) | {self.tool.VOCABULARY_KEY})
        for slot in self.tool.SLOT_ORDER:
            self.assertTrue(data[slot], slot)

        self.assertIn("skirt", data["bottom"])
        self.assertIn("shirt", data["top"])
        self.assertIn("socks", data["socks"])
        self.assertIn("sandals", data["shoes"])
        self.assertIn("school uniform", data["uniform"])
        self.assertIn("kimono", data["traditional"])
        self.assertIn("earrings", data["decoration"])

        # The vocabulary is a superset of every slot.
        for slot in self.tool.SLOT_ORDER:
            self.assertTrue(set(data[slot]).issubset(set(data[self.tool.VOCABULARY_KEY])), slot)

    def test_every_tag_belongs_to_exactly_one_slot(self):
        data = self.bundled_data()
        owners = {}
        for slot in self.tool.SLOT_ORDER:
            for tag in data[slot]:
                self.assertNotIn(tag, owners, f"{tag} is listed by {owners.get(tag)} and {slot}")
                owners[tag] = slot

    def test_main_outfit_slots_do_not_hold_layered_garments(self):
        """A `uniform`/`traditional` entry is drawn as a whole outfit.

        The review of 2026-09-14 found `geta`, `tabi`, `hood` and `cape` in those
        slots, so the node produced outfits without a main garment - and, for
        `geta`, a second kind of footwear from the `shoes` layer.
        """
        data = self.bundled_data()
        layered = {
            tag
            for slot in ("decoration", "top", "bottom", "socks", "shoes")
            for tag in data[slot]
        }
        main_tags = set(data["uniform"]) | set(data["traditional"])

        self.assertEqual(sorted(main_tags & layered), [])

    def test_the_reported_tags_moved_to_the_slot_that_owns_them(self):
        data = self.bundled_data()

        for tag in ("geta", "tabi"):
            self.assertNotIn(tag, data["traditional"], tag)
        self.assertIn("geta", data["shoes"])
        self.assertIn("tabi", data["socks"])

        for tag in ("hood", "cape", "capelet", "side cape"):
            self.assertNotIn(tag, data["uniform"], tag)
            self.assertIn(tag, data["decoration"], tag)

        for tag in ("buruma", "tutu", "fundoshi", "hakama", "kimono skirt", "loincloth", "sweatpants"):
            self.assertNotIn(tag, data["uniform"], tag)

        for tag in ("haori", "happi", "hanten (clothes)", "mizu happi"):
            self.assertNotIn(tag, data["traditional"], tag)
            self.assertIn(tag, data["top"], tag)

        for tag in ("sarashi", "chest sarashi", "tasuki", "sash", "stole"):
            self.assertNotIn(tag, data["traditional"], tag)
            self.assertIn(tag, data["decoration"], tag)

        # Listed by two main-outfit sections; `uniform` owns it.
        self.assertIn("miko", data["uniform"])
        self.assertNotIn("miko", data["traditional"])

    def test_assign_slot_owners_prefers_the_override(self):
        owners = self.tool.assign_slot_owners(
            {"uniform": ["hood", "school uniform"], "decoration": ["hood"]}
        )

        self.assertEqual(owners, {"hood": "decoration", "school uniform": "uniform"})

    def test_assign_slot_owners_settles_the_rest_by_priority(self):
        owners = self.tool.assign_slot_owners({"uniform": ["mystery outfit"], "socks": ["mystery outfit"]})

        self.assertEqual(owners, {"mystery outfit": "socks"})
        self.assertLess(self.tool.SLOT_PRIORITY.index("socks"), self.tool.SLOT_PRIORITY.index("uniform"))

    def test_overrides_and_priority_only_name_known_slots(self):
        self.assertEqual(set(self.tool.SLOT_PRIORITY), set(self.tool.SLOT_ORDER))
        self.assertEqual(len(set(self.tool.SLOT_PRIORITY)), len(self.tool.SLOT_PRIORITY))
        for tag, slot in self.tool.SLOT_OVERRIDES.items():
            self.assertIn(slot, self.tool.SLOT_ORDER, tag)
            self.assertEqual(self.tool.normalize_tag(tag), tag, tag)
            self.assertNotIn(tag, self.tool.TAG_BLOCKLIST, tag)

    def test_assign_slot_owners_rejects_an_unknown_slot(self):
        original = self.tool.SLOT_OVERRIDES
        self.tool.SLOT_OVERRIDES = {**original, "school uniform": "hats"}
        try:
            with self.assertRaises(ValueError):
                self.tool.assign_slot_owners({"uniform": ["school uniform"]})
        finally:
            self.tool.SLOT_OVERRIDES = original

    def test_reassigning_the_bundled_file_keeps_it_unchanged(self):
        bundled = self.bundled_data()
        with tempfile.TemporaryDirectory() as tmp:
            copy = Path(tmp) / "danbooru_attire_data.json"
            copy.write_text(json.dumps(bundled), encoding="utf-8")

            self.assertEqual(self.tool.reassign_bundled_data(copy), bundled)

    def bundled_data(self):
        return json.loads((REPO_ROOT / "js" / "danbooru_attire_data.json").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
