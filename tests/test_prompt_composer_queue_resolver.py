"""Queue/execution flow of ``resolved_prompt`` and linked composer inputs.

``_resolve_anima_prompt_composer_nodes`` runs on the server's ``on_prompt`` hook,
that is before ComfyUI evaluates the graph, so a linked input is still
``[node_id, output_index]`` at that moment.  ``compose_prompt`` reuses whatever
text the hook stored while ``seed`` is ``-1``, which is what keeps the widget, the
preview and the run in sync - and what made a linked ``character_seed`` or
``clothing_seed`` ineffective (review of nregret, 2026-09-14).

These tests replay whole cycles: the widget values the client would send, the
queue hook, the evaluated inputs, the node call, and the next cycle built from the
widget values the node just wrote back.
"""

import ast
import re
import unittest
import urllib
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
NODE_ID = "10"
# What ComfyUI puts in `inputs[name]` while a widget is driven by a link.
LINK = ["20", 0]

WIDGET_ORDER = (
    "enable_artist",
    "enable_character",
    "enable_clothing",
    "enable_background",
    "enable_pose",
    "character_detail",
    "seed",
    "artist_count",
    "preview_collapsed",
    "resolved_prompt",
    "character_seed",
    "character_tag_count",
    "character_keep_features",
    "clothing_seed",
    "clothing_source",
)

WIDGET_DEFAULTS = {
    "enable_artist": True,
    "enable_character": True,
    "enable_clothing": True,
    "enable_background": True,
    "enable_pose": True,
    "character_detail": "trigger",
    "seed": -1,
    "artist_count": 1,
    "preview_collapsed": False,
    "resolved_prompt": "",
    "character_seed": -1,
    "character_tag_count": 3,
    "character_keep_features": True,
    "clothing_seed": -1,
    "clothing_source": "author",
}

RESOLVE_INPUT_NAMES = tuple(
    name for name in WIDGET_ORDER if name not in ("preview_collapsed", "resolved_prompt")
)

def load_composer_namespace():
    nodes_path = REPO_ROOT / "nodes.py"
    tree = ast.parse(nodes_path.read_text(encoding="utf-8"), filename=str(nodes_path))
    wanted = [
        node
        for node in tree.body
        if isinstance(node, (ast.ClassDef, ast.FunctionDef))
        and node.name in ("AnimaPromptComposer", "_resolve_anima_prompt_composer_nodes")
    ]
    namespace = {
        "__file__": str(nodes_path),
        "re": re,
        "urllib": urllib,
    }
    exec(
        compile(ast.Module(body=wanted, type_ignores=[]), str(nodes_path), "exec"),
        namespace,
    )
    return namespace


class AnimaPromptComposerQueueResolverTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        namespace = load_composer_namespace()
        cls.composer_class = namespace["AnimaPromptComposer"]
        cls.resolve_queue = staticmethod(namespace["_resolve_anima_prompt_composer_nodes"])

    def setUp(self):
        self.composer_class._data_cache = {}
        self.composer = self.composer_class()
        self.start_workflow()

    # --- workflow / queue / execution harness -------------------------------

    def start_workflow(self, **overrides):
        """Build the saved workflow the client would send on the next queue."""
        values = dict(WIDGET_DEFAULTS)
        values.update(overrides)
        self.extra_pnginfo = {
            "workflow": {
                "nodes": [
                    {
                        "id": int(NODE_ID),
                        "type": "AnimaPromptComposer",
                        "widgets_values": [values[name] for name in WIDGET_ORDER],
                    }
                ]
            }
        }

    def workflow_inputs(self):
        """Read the node inputs back out of the workflow, as the client sends them."""
        widgets_values = self.extra_pnginfo["workflow"]["nodes"][0]["widgets_values"]
        return {
            name: widgets_values[self.composer._workflow_widget_index(name)]
            for name in WIDGET_ORDER
        }

    def cycle(self, linked=None):
        """Run one queue + execution cycle and return the node's UI payload."""
        linked = linked or {}
        inputs = self.workflow_inputs()
        for name in linked:
            inputs[name] = list(LINK)

        prompt = {NODE_ID: {"class_type": "AnimaPromptComposer", "inputs": inputs}}
        self.resolve_queue(prompt, self.extra_pnginfo, self.composer)
        self.queued_resolved_prompt = prompt[NODE_ID]["inputs"]["resolved_prompt"]

        evaluated = dict(inputs)
        evaluated.update(linked)
        return self.composer.compose_prompt(
            prompt=prompt,
            extra_pnginfo=self.extra_pnginfo,
            unique_id=NODE_ID,
            **evaluated,
        )

    # --- helpers ------------------------------------------------------------

    def selected(self, result):
        return result["ui"]["anima_prompt_composer"][0]

    def character_key(self, result):
        return self.selected(result)["character"][0]["key"]

    def outfit_titles(self, result):
        return tuple(entry["title"] for entry in self.selected(result)["clothing"])

    def direct(self, **overrides):
        """Resolve the node's draw without the queue hook, for reference values."""
        inputs = dict(WIDGET_DEFAULTS)
        inputs.update(overrides)
        payload = {name: inputs[name] for name in RESOLVE_INPUT_NAMES}
        selected, _ = self.composer._resolve_prompt_data(**payload)
        return selected

    # --- an unresolved link defers the draw --------------------------------

    def test_linked_character_seed_is_deferred_and_locks_the_character(self):
        self.start_workflow(seed=-1, character_seed=-1)

        first = self.cycle({"character_seed": 4242})
        self.assertEqual(self.queued_resolved_prompt, "", "a linked input cannot be read before execution")

        keys = {self.character_key(first)}
        for _ in range(2):
            keys.add(self.character_key(self.cycle({"character_seed": 4242})))

        self.assertEqual(len(keys), 1, "a linked character seed must pick the same character every run")
        self.assertEqual(keys.pop(), self.direct(character_seed=4242)["character"][0]["key"])

    def test_linked_clothing_seed_keeps_the_outfit_of_that_seed(self):
        self.start_workflow(seed=-1, clothing_source="author", clothing_seed=-1)

        linked = {"clothing_seed": 26, "clothing_source": "danbooru"}
        first = self.cycle(linked)
        self.assertEqual(self.queued_resolved_prompt, "")

        titles = {self.outfit_titles(first)}
        for _ in range(2):
            titles.add(self.outfit_titles(self.cycle(linked)))

        self.assertEqual(len(titles), 1, "a linked clothing seed must draw the same outfit every run")
        self.assertEqual(
            titles.pop(),
            tuple(entry["title"] for entry in self.direct(clothing_seed=26, clothing_source="danbooru")["clothing"]),
        )

    def test_a_linked_source_is_not_replaced_by_the_widget_default(self):
        self.start_workflow(seed=-1, clothing_source="author", clothing_seed=-1)

        result = self.cycle({"clothing_source": "danbooru", "clothing_seed": 26})

        self.assertTrue(
            all(entry["key"].startswith("clothing:danbooru:") for entry in self.selected(result)["clothing"]),
            "the linked clothing_source wins over the `author` widget value",
        )

    def test_a_linked_non_seed_input_is_deferred_too(self):
        self.start_workflow(seed=-1, enable_pose=True)

        result = self.cycle({"enable_pose": False})

        self.assertEqual(self.queued_resolved_prompt, "")
        self.assertEqual(self.selected(result)["pose"], [])

    # --- no link: the queue hook still decides the run ---------------------

    def test_unlinked_inputs_are_still_resolved_before_the_queue(self):
        self.start_workflow(seed=-1)

        result = self.cycle()

        self.assertTrue(self.queued_resolved_prompt)
        self.assertEqual(result["result"][0], self.queued_resolved_prompt)

    def test_a_literal_character_seed_is_resolved_before_the_queue(self):
        self.start_workflow(seed=-1, character_seed=4242)

        result = self.cycle()

        self.assertTrue(self.queued_resolved_prompt)
        self.assertEqual(result["result"][0], self.queued_resolved_prompt)

    def test_fixed_seed_matches_between_queue_and_execution(self):
        self.start_workflow(seed=1234)

        result = self.cycle()

        self.assertTrue(self.queued_resolved_prompt)
        self.assertEqual(result["result"][0], self.queued_resolved_prompt)

    # --- a changed link must not reuse the previous run's prompt -----------

    def test_switching_a_linked_seed_drops_the_prompt_of_the_previous_run(self):
        self.start_workflow(seed=-1, character_seed=-1)
        locked_first = self.direct(character_seed=4242)["character"][0]["key"]
        locked_second = self.direct(character_seed=7)["character"][0]["key"]
        self.assertNotEqual(locked_first, locked_second, "pick two seeds that lock different characters")

        first = self.cycle({"character_seed": 4242})
        # The node wrote its prompt back into the workflow widget; the next cycle
        # sends that text again, and it must not be reused for the new seed.
        self.assertEqual(self.workflow_inputs()["resolved_prompt"], self.selected(first)["_resolved_prompt"])

        second = self.cycle({"character_seed": 7})

        self.assertEqual(self.character_key(first), locked_first)
        self.assertEqual(self.character_key(second), locked_second)


if __name__ == "__main__":
    unittest.main()
