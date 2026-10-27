"""Execution of ``AnimaPromptComposer``: section seeds and the recorded draw.

The node draws at execution time, so linked inputs arrive already evaluated, and
the draw is stored in the image metadata and on the workflow node's properties
without touching ``widgets_values``, whose layout belongs to the frontend.
"""

import ast
import re
import unittest
import urllib
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
NODE_ID = "10"
INPUTS = {
    "seed": -1,
    "enable_artist": True,
    "artist_count": 1,
    "enable_character": True,
    "character_detail": "trigger",
}


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


class AnimaPromptComposerExecutionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.composer_class = load_prompt_composer_class()

    def setUp(self):
        self.composer_class._data_cache = {}
        self.composer = self.composer_class()

    def run_node(self, extra_pnginfo=None, **overrides):
        inputs = dict(INPUTS)
        inputs.update(overrides)
        return self.composer.compose_prompt(extra_pnginfo=extra_pnginfo, unique_id=NODE_ID, **inputs)

    def selected(self, result):
        return result["ui"]["anima_prompt_composer"][0]

    def test_draw_is_recorded_in_metadata_and_node_properties(self):
        widgets_values = [-1, "randomize", True, 1, True, "trigger"]
        extra_pnginfo = {
            "workflow": {
                "nodes": [{"id": int(NODE_ID), "type": "AnimaPromptComposer", "widgets_values": list(widgets_values)}]
            }
        }

        result = self.run_node(extra_pnginfo)

        text = result["result"][0]
        record = extra_pnginfo["anima_prompt_composer"][NODE_ID]
        self.assertEqual(record["resolved_prompt"], text)
        self.assertEqual(record["selected"], self.selected(result))
        workflow_node = extra_pnginfo["workflow"]["nodes"][0]
        self.assertEqual(workflow_node["properties"][self.composer_class.SELECTION_PROPERTY]["_resolved_prompt"], text)
        self.assertEqual(workflow_node["widgets_values"], widgets_values)

    def test_character_seed_locks_the_character_while_the_rest_rerolls(self):
        locked = self.composer._resolve_prompt_data(character_seed=4242)[0]["character"][0]["key"]

        keys = {self.selected(self.run_node(character_seed=4242))["character"][0]["key"] for _ in range(3)}

        self.assertEqual(keys, {locked})

    def test_clothing_seed_locks_the_outfit(self):
        expected = tuple(
            entry["title"]
            for entry in self.composer._resolve_prompt_data(clothing_seed=26, clothing_source="danbooru")[0]["clothing"]
        )

        outfits = {
            tuple(entry["title"] for entry in self.selected(self.run_node(clothing_seed=26, clothing_source="danbooru"))["clothing"])
            for _ in range(3)
        }

        self.assertEqual(outfits, {expected})

    def test_disabled_sections_are_left_out(self):
        selected = self.selected(self.run_node(enable_clothing=False, enable_background=False, enable_pose=False))

        self.assertEqual(selected["clothing"], [])
        self.assertEqual(selected["background"], [])
        self.assertEqual(selected["pose"], [])
        self.assertEqual(len(selected["artist"]), 1)


if __name__ == "__main__":
    unittest.main()
