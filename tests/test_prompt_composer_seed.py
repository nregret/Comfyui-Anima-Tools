import ast
import re
import unittest
import urllib
from pathlib import Path


def load_prompt_composer_class():
    nodes_path = Path(__file__).resolve().parents[1] / "nodes.py"
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


class AnimaPromptComposerSeedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.composer_class = load_prompt_composer_class()

    def setUp(self):
        self.composer_class._data_cache = {}
        self.composer = self.composer_class()
        self.inputs = {
            "enable_artist": True,
            "enable_character": True,
            "enable_clothing": True,
            "enable_background": True,
            "enable_pose": True,
            "character_detail": "trigger_tags",
            "artist_count": 2,
        }

    def test_fixed_seed_is_reproducible(self):
        first = self.composer.compose_prompt(**self.inputs, seed=123456)
        second = self.composer.compose_prompt(**self.inputs, seed=123456)

        self.assertTrue(first["result"][0])
        self.assertEqual(first["result"][0], second["result"][0])
        self.assertEqual(
            first["ui"]["anima_prompt_composer"][0],
            second["ui"]["anima_prompt_composer"][0],
        )

    def test_ui_payload_carries_the_output_text(self):
        result = self.composer.compose_prompt(**self.inputs, seed=-1)

        self.assertEqual(result["ui"]["anima_prompt_composer"][0]["_resolved_prompt"], result["result"][0])

    def test_fixed_seed_cache_key_is_stable_and_seed_sensitive(self):
        first = self.composer_class.IS_CHANGED(**self.inputs, seed=7)
        repeated = self.composer_class.IS_CHANGED(**self.inputs, seed=7)
        changed = self.composer_class.IS_CHANGED(**self.inputs, seed=8)

        self.assertEqual(first, repeated)
        self.assertNotEqual(first, changed)


if __name__ == "__main__":
    unittest.main()
