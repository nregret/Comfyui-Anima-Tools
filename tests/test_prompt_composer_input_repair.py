"""Values a saved workflow can hand to `AnimaPromptComposer` that the queue rejects.

``execution.py::validate_inputs`` converts every *literal* input with
``int()`` / ``float()`` / ``str()`` / ``bool()`` and answers with
``invalid_input_type`` when that raises - before the node class is constructed, so
no Python default or signature can save the run.  That is what happened with a
workflow saved before 3.3.0: the frontend writes ``null`` for a widget it has no
value for and restores a positional ``widgets_values`` array, so ``character_seed``
came back as ``None`` and the queue answered

    Failed to convert an input value to a INT value: character_seed, None

``AnimaPromptComposer.sanitize_inputs`` repairs such values on the queue hook and
``_set_workflow_widget_value`` refuses to write into a slot another widget owns.
"""

import ast
import re
import unittest
import urllib
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]

LEGACY_INPUTS = (
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
)

ADDED_INPUTS = (
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



def conversion_errors(input_types, inputs):
    """Port of the conversion block in ``validate_inputs``: what raises is an error."""
    errors = []
    for category in ("required", "optional"):
        for name, spec in input_types.get(category, {}).items():
            if name not in inputs:
                continue
            value = inputs[name]
            if isinstance(value, list):  # a link, resolved after execution
                continue
            declared = spec[0]
            try:
                if isinstance(declared, (list, tuple)):
                    if value not in declared:
                        raise ValueError(f"{value!r} not in {declared!r}")
                elif declared == "INT":
                    int(value)
                elif declared == "FLOAT":
                    float(value)
                elif declared == "STRING":
                    str(value)
                elif declared == "BOOLEAN":
                    bool(value)
            except Exception as ex:
                errors.append((name, str(ex)))
    return errors


class AnimaPromptComposerInputRepairTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        namespace = load_composer_namespace()
        cls.composer_class = namespace["AnimaPromptComposer"]
        cls.resolve_queue = staticmethod(namespace["_resolve_anima_prompt_composer_nodes"])
        cls.input_types = cls.composer_class.INPUT_TYPES()

    def setUp(self):
        self.composer_class._data_cache = {}
        self.composer = self.composer_class()

    def payload(self, **overrides):
        payload = dict(WIDGET_DEFAULTS)
        payload.update(overrides)
        return payload

    # --- the failure that started this --------------------------------------

    def test_a_null_character_seed_is_rejected_by_the_validator(self):
        payload = self.payload(character_seed=None)

        errors = conversion_errors(self.input_types, payload)

        self.assertEqual([name for name, _ in errors], ["character_seed"])
        self.assertIn("NoneType", errors[0][1])

    def test_sanitize_inputs_repairs_the_null_and_the_prompt_passes(self):
        payload = self.payload(character_seed=None, clothing_seed=None)

        replaced = self.composer.sanitize_inputs(payload)

        self.assertEqual(replaced, ["character_seed", "clothing_seed"])
        self.assertEqual(payload["character_seed"], WIDGET_DEFAULTS["character_seed"])
        self.assertEqual(payload["clothing_seed"], WIDGET_DEFAULTS["clothing_seed"])
        self.assertEqual(conversion_errors(self.input_types, payload), [])

    def test_the_queue_hook_repairs_the_prompt_the_validator_would_reject(self):
        """End to end over the hook that runs before `validate_inputs`."""
        inputs = self.payload(
            seed=150,
            character_seed=None,
            character_tag_count=None,
            character_keep_features=None,
            clothing_seed=None,
            clothing_source=None,
        )
        prompt = {"714": {"class_type": "AnimaPromptComposer", "inputs": inputs}}
        extra_pnginfo = {"workflow": {"nodes": []}}

        self.resolve_queue(prompt, extra_pnginfo, self.composer)

        self.assertEqual(conversion_errors(self.input_types, prompt["714"]["inputs"]), [])
        self.assertEqual(inputs["character_seed"], -1)
        self.assertEqual(inputs["clothing_source"], "author")
        # and the node still draws the prompt of the fixed seed
        self.assertIn("result", self.composer.compose_prompt(**inputs))

    def test_every_widget_of_the_node_is_repaired_from_null(self):
        payload = {name: None for name in WIDGET_DEFAULTS}

        replaced = self.composer.sanitize_inputs(payload)

        self.assertEqual(set(replaced), set(WIDGET_DEFAULTS))
        self.assertEqual(conversion_errors(self.input_types, payload), [])
        for name, value in WIDGET_DEFAULTS.items():
            self.assertEqual(payload[name], value, name)

    # --- what must not be touched -------------------------------------------

    def test_links_are_left_for_the_execution_stage(self):
        payload = self.payload(character_seed=["610", 0], seed=["610", 1])

        replaced = self.composer.sanitize_inputs(payload)

        self.assertEqual(replaced, [])
        self.assertEqual(payload["character_seed"], ["610", 0])
        self.assertEqual(payload["seed"], ["610", 1])

    def test_usable_values_are_kept_as_they_are(self):
        payload = self.payload(
            seed=0,
            artist_count="2",
            character_seed=4242,
            character_tag_count=0,
            character_keep_features=False,
            enable_artist=False,
            resolved_prompt="1girl, solo, ",
        )
        expected = dict(payload)

        self.assertEqual(self.composer.sanitize_inputs(payload), [])
        self.assertEqual(payload, expected)

    def test_a_combo_value_that_is_not_listed_falls_back_to_the_default(self):
        payload = self.payload(character_detail="bogus", clothing_source="bogus")

        replaced = self.composer.sanitize_inputs(payload)

        self.assertEqual(replaced, ["character_detail", "clothing_source"])
        self.assertEqual(payload["character_detail"], "trigger")
        self.assertEqual(payload["clothing_source"], "author")

    def test_unknown_keys_are_ignored(self):
        payload = self.payload()
        payload["Collapse Preview"] = None
        payload["anima_prompt_composer_dom_preview"] = None

        self.assertEqual(self.composer.sanitize_inputs(payload), [])
        self.assertIsNone(payload["Collapse Preview"])
        self.assertIsNone(payload["anima_prompt_composer_dom_preview"])

    # --- writing the drawn prompt back into the workflow --------------------

    def test_the_drawn_prompt_lands_in_the_resolved_prompt_slot(self):
        workflow_node = {"widgets_values": [False] * 10 + ["old text"]}

        self.composer._set_workflow_widget_value(workflow_node, "resolved_prompt", "drawn, ")

        widgets_values = workflow_node["widgets_values"]
        self.assertEqual(widgets_values[self.composer._workflow_widget_index("resolved_prompt")], "drawn, ")
        self.assertEqual(widgets_values[9], False, "the preview_collapsed slot stays a boolean")

    def test_a_slot_that_belongs_to_another_widget_is_not_overwritten(self):
        # A workflow written by a frontend without the seed control combo keeps
        # `resolved_prompt` at index 9; index 10 then holds a boolean.
        workflow_node = {"widgets_values": [False] * 12}

        self.composer._set_workflow_widget_value(workflow_node, "resolved_prompt", "drawn, ")

        self.assertEqual(workflow_node["widgets_values"], [False] * 12)

    def test_a_short_array_is_extended_to_reach_the_slot(self):
        workflow_node = {"widgets_values": [False, True]}

        self.composer._set_workflow_widget_value(workflow_node, "resolved_prompt", "drawn, ")

        index = self.composer._workflow_widget_index("resolved_prompt")
        self.assertEqual(len(workflow_node["widgets_values"]), index + 1)
        self.assertEqual(workflow_node["widgets_values"][index], "drawn, ")

    def test_a_dict_layout_is_written_by_name(self):
        workflow_node = {"widgets_values": {"resolved_prompt": "old"}}

        self.composer._set_workflow_widget_value(workflow_node, "resolved_prompt", "drawn, ")

        self.assertEqual(workflow_node["widgets_values"]["resolved_prompt"], "drawn, ")


if __name__ == "__main__":
    unittest.main()
