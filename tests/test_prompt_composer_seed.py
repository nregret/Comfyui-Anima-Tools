import ast
import re
import time
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
            "preview_collapsed": False,
        }

    def test_fixed_seed_ignores_stale_persisted_prompt(self):
        first = self.composer.compose_prompt(
            **self.inputs,
            seed=123456,
            resolved_prompt="stale result, ",
        )
        second = self.composer.compose_prompt(
            **self.inputs,
            seed=123456,
            resolved_prompt="another stale result, ",
        )

        self.assertNotEqual(first["result"][0], "stale result, ")
        self.assertEqual(first["result"][0], second["result"][0])
        self.assertEqual(
            first["ui"]["anima_prompt_composer"][0],
            second["ui"]["anima_prompt_composer"][0],
        )

    def test_random_seed_reuses_prequeue_resolution(self):
        result = self.composer.compose_prompt(
            **self.inputs,
            seed=-1,
            resolved_prompt="queued random result, ",
        )

        self.assertEqual(result["result"][0], "queued random result, ")

    def test_fixed_seed_cache_key_is_stable_and_seed_sensitive(self):
        first = self.composer_class.IS_CHANGED(**self.inputs, seed=7, resolved_prompt="old")
        repeated = self.composer_class.IS_CHANGED(**self.inputs, seed=7, resolved_prompt="new")
        changed = self.composer_class.IS_CHANGED(**self.inputs, seed=8, resolved_prompt="old")

        self.assertEqual(first, repeated)
        self.assertNotEqual(first, changed)

    def test_linked_seed_does_not_invalidate_the_cache_on_every_queue(self):
        """ComfyUI only hands constants over: a linked seed arrives as ``None``.

        Answering with a timestamp here made the node report itself as changed on
        every queue, so a linked *fixed* seed re-ran the node - and everything
        downstream - on every Run.  The answer is deliberately constant: ComfyUI's
        own cache signature already covers every input, constant or link, plus the
        signature of every upstream node, so an upstream that changes still
        invalidates this node while an unchanged one stays cached.
        """
        first = self.composer_class.IS_CHANGED(**self.inputs, seed=None, resolved_prompt="")
        repeated = self.composer_class.IS_CHANGED(**self.inputs, seed=None, resolved_prompt="redrawn")
        other_constants = self.composer_class.IS_CHANGED(
            **{**self.inputs, "artist_count": 1}, seed=None, resolved_prompt=""
        )

        self.assertEqual(first, repeated)
        self.assertEqual(first, other_constants)
        # ...but a linked seed must not be confused with the two constant paths.
        self.assertNotEqual(first, self.composer_class.IS_CHANGED(**self.inputs, seed=7, resolved_prompt=""))
        self.assertNotEqual(first, self.composer_class.IS_CHANGED(**self.inputs, seed=-1, resolved_prompt=""))

    def test_a_seed_link_that_arrives_as_a_list_is_a_link_too(self):
        first = self.composer_class.IS_CHANGED(**self.inputs, seed=["610", 0], resolved_prompt="")
        repeated = self.composer_class.IS_CHANGED(**self.inputs, seed=["610", 0], resolved_prompt="redrawn")
        other_link = self.composer_class.IS_CHANGED(**self.inputs, seed=["871", 0], resolved_prompt="")

        self.assertEqual(first, repeated)
        self.assertEqual(first, other_link, "the link itself is part of ComfyUI's own signature")

    def test_random_seed_still_re_draws_on_every_queue(self):
        first = self.composer_class.IS_CHANGED(**self.inputs, seed=-1)
        time.sleep(0.002)
        second = self.composer_class.IS_CHANGED(**self.inputs, seed=-1)

        self.assertNotEqual(first, second)


if __name__ == "__main__":
    unittest.main()
