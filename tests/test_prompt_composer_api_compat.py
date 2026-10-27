"""The API contract of ``AnimaPromptComposer`` across its input layouts.

ComfyUI's ``execution.py::validate_inputs`` walks ``required | optional`` and
answers an input that is absent from a prompt with ``required_input_missing``
when its category is ``required``, while an absent ``optional`` input is simply
skipped - the node signature fills it in at execution time (``f(**inputs)``).
``get_input_data`` drops prompt inputs the node does not declare, so the removed
``preview_collapsed`` and ``resolved_prompt`` inputs of older prompts are ignored.

The tests below pin that contract for prompts saved by 3.2.9 and 3.3.x and pin
the grouped widget order of the current layout.
"""

import ast
import inspect
import re
import unittest
import urllib
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]

PAYLOAD_329 = {
    "enable_artist": True,
    "enable_character": True,
    "enable_clothing": True,
    "enable_background": True,
    "enable_pose": True,
    "character_detail": "trigger",
    "seed": 7,
    "artist_count": 1,
    "preview_collapsed": False,
    "resolved_prompt": "",
}

PAYLOAD_33X = {
    **PAYLOAD_329,
    "character_seed": -1,
    "character_tag_count": 3,
    "character_keep_features": True,
    "clothing_seed": -1,
    "clothing_source": "author",
}

# Grouped by section; the frontend creates the widgets in this order.
WIDGET_ORDER = (
    "seed",
    "enable_artist",
    "artist_count",
    "enable_character",
    "character_detail",
    "character_tag_count",
    "character_keep_features",
    "character_seed",
    "enable_clothing",
    "clothing_source",
    "clothing_seed",
    "enable_background",
    "enable_pose",
)


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


def missing_input_errors(input_types, inputs):
    """Port of the presence check in ComfyUI's ``execution.py::validate_inputs``."""
    return [
        name
        for name in input_types.get("required", {})
        if name not in inputs
    ]


def declared_inputs(input_types, inputs):
    """Port of ``execution.py::get_input_data``: undeclared prompt inputs are dropped."""
    declared = set(input_types["required"]) | set(input_types["optional"])
    return {name: value for name, value in inputs.items() if name in declared}


class AnimaPromptComposerApiCompatTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.composer_class = load_prompt_composer_class()
        cls.input_types = cls.composer_class.INPUT_TYPES()

    def setUp(self):
        self.composer_class._data_cache = {}

    def test_widget_order_is_grouped_by_section(self):
        combined = tuple(self.input_types["required"]) + tuple(self.input_types["optional"])
        self.assertEqual(combined, WIDGET_ORDER)

    def test_every_required_input_already_existed_in_329(self):
        for name in self.input_types["required"]:
            self.assertIn(name, PAYLOAD_329, f"{name} would break API prompts saved by 3.2.9")

    def test_saved_api_prompts_have_no_missing_required_input(self):
        for payload in (PAYLOAD_329, PAYLOAD_33X):
            self.assertEqual(missing_input_errors(self.input_types, payload), [])

    def test_the_presence_check_still_reports_a_missing_required_input(self):
        payload = dict(PAYLOAD_329)
        payload.pop("seed")
        self.assertEqual(missing_input_errors(self.input_types, payload), ["seed"])

    def test_saved_api_prompts_still_execute(self):
        for payload in (PAYLOAD_329, PAYLOAD_33X):
            result = self.composer_class().compose_prompt(**declared_inputs(self.input_types, payload))
            self.assertTrue(result["result"][0])

    def test_execution_defaults_cover_every_optional_input(self):
        signature = inspect.signature(self.composer_class.compose_prompt)
        for name in WIDGET_ORDER:
            self.assertIn(name, signature.parameters, name)
        for name in self.input_types["optional"]:
            self.assertIsNot(
                signature.parameters[name].default,
                inspect.Parameter.empty,
                f"{name} needs a Python default: an absent optional input is filled in by the signature",
            )


if __name__ == "__main__":
    unittest.main()
