import unittest
from pathlib import Path


def load_selector_namespace():
    nodes_path = Path(__file__).resolve().parents[1] / "nodes.py"
    source = nodes_path.read_text(encoding="utf-8").split("class AnimaPromptComposer:", 1)[0]
    namespace = {}
    exec(compile(source, str(nodes_path), "exec"), namespace)
    return namespace


class TagSelectorNodeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.namespace = load_selector_namespace()

    def selector(self, name):
        return self.namespace[name]()

    def test_each_selector_has_its_tags_extra_text_and_optional_upstream(self):
        for name, section in (
            ("AnimaArtistSelector", "artist"),
            ("AnimaCharacterSelector", "character"),
            ("AnimaClothingSelector", "clothing"),
            ("AnimaBackgroundSelector", "background"),
            ("AnimaPoseSelector", "pose"),
        ):
            input_types = self.namespace[name].INPUT_TYPES()
            self.assertEqual(tuple(input_types["required"]), (f"{section}_tags", "extra_text"), name)
            self.assertEqual(tuple(input_types["optional"]), ("opt_prompt",), name)

    def test_output_order_is_upstream_tags_then_extra_text(self):
        result = self.selector("AnimaClothingSelector").select_tags(
            clothing_tags="school uniform, red ribbon, ",
            extra_text="looking at viewer",
            opt_prompt="masterpiece, @dairi, ",
        )

        self.assertEqual(result["result"][0], "masterpiece, @dairi, school uniform, red ribbon, looking at viewer, ")
        self.assertEqual(result["ui"]["anima_selector_tags"][0], {"clothing_tags": "school uniform, red ribbon, "})

    def test_artist_names_are_written_with_at_prefix(self):
        result = self.selector("AnimaArtistSelector").select_tags(artist_tags="dairi, by ebifurya, @wlop", extra_text="")

        self.assertEqual(result["result"][0], "@dairi, @ebifurya, @wlop, ")

    def test_selectors_chain_through_opt_prompt(self):
        artist = self.selector("AnimaArtistSelector").select_tags(artist_tags="dairi", extra_text="")["result"][0]
        character = self.selector("AnimaCharacterSelector").select_tags(
            character_tags="hatsune miku, vocaloid", extra_text="", opt_prompt=artist
        )["result"][0]

        self.assertEqual(character, "@dairi, hatsune miku, vocaloid, ")

    def test_empty_selector_outputs_nothing(self):
        result = self.selector("AnimaPoseSelector").select_tags(pose_tags="", extra_text="")

        self.assertEqual(result["result"][0], "")


if __name__ == "__main__":
    unittest.main()
