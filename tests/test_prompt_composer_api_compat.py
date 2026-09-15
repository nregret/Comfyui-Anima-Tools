"""The API contract of ``AnimaPromptComposer`` across the 3.3.0 input additions.

ComfyUI's ``execution.py::validate_inputs`` walks ``required | optional`` and
answers an input that is absent from a prompt with ``required_input_missing``
when its category is ``required``, while an absent ``optional`` input is simply
skipped - the node signature fills it in at execution time (``f(**inputs)``).
Python argument defaults therefore do not make a ``required`` input optional.

The tests below pin that contract for a prompt saved by 3.2.9 and for a 3.3.0
one, and pin the widget order that ``widgets_values`` indexes into.
"""

import ast
import inspect
import re
import unittest
import urllib
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]

# The widgets of 3.2.9, in the order they are serialized into `widgets_values`.
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

# The 3.3.0 widgets, appended so that the indices above keep their meaning.
ADDED_INPUTS = (
    "character_seed",
    "character_tag_count",
    "character_keep_features",
    "clothing_seed",
    "clothing_source",
)

WIDGET_ORDER = LEGACY_INPUTS + ADDED_INPUTS


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
    """Port of the presence check in ComfyUI's ``execution.py::validate_inputs``.

    "An input is missing only when the key is absent from the prompt, and only a
    ``required`` input turns that into an error."
    """
    errors = []
    for category in ("required", "optional"):
        for name in input_types.get(category, {}):
            if name in inputs:
                continue
            if category == "required":
                errors.append(
                    {
                        "type": "required_input_missing",
                        "message": "Required input is missing",
                        "details": name,
                        "extra_info": {"input_name": name},
                    }
                )
    return errors


class AnimaPromptComposerApiCompatTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.composer_class = load_prompt_composer_class()
        cls.input_types = cls.composer_class.INPUT_TYPES()

    def legacy_payload(self):
        """The ``inputs`` of a node saved by 3.2.9, built from the widget defaults."""
        return {
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
        }

    def new_payload(self):
        payload = self.legacy_payload()
        payload.update(
            {
                "character_seed": -1,
                "character_tag_count": 3,
                "character_keep_features": True,
                "clothing_seed": -1,
                "clothing_source": "author",
            }
        )
        return payload

    def test_required_inputs_are_still_the_329_set(self):
        self.assertEqual(tuple(self.input_types["required"]), LEGACY_INPUTS)

    def test_added_inputs_are_optional_and_defaulted(self):
        self.assertEqual(tuple(self.input_types["optional"]), ADDED_INPUTS)
        for name in ADDED_INPUTS:
            _, extra_info = self.input_types["optional"][name]
            self.assertIn("default", extra_info, name)

    def test_widget_order_is_appended_after_resolved_prompt(self):
        combined = tuple(self.input_types["required"]) + tuple(self.input_types["optional"])
        self.assertEqual(combined, WIDGET_ORDER)

        composer = self.composer_class()
        for index, name in enumerate(WIDGET_ORDER):
            self.assertEqual(composer._workflow_widget_index(name), index, name)
        self.assertEqual(composer._workflow_widget_index("not_a_widget"), -1)

    def test_legacy_api_payload_has_no_missing_required_input(self):
        self.assertEqual(missing_input_errors(self.input_types, self.legacy_payload()), [])

    def test_new_api_payload_has_no_missing_required_input(self):
        self.assertEqual(missing_input_errors(self.input_types, self.new_payload()), [])

    def test_the_presence_check_still_reports_a_missing_required_input(self):
        payload = self.legacy_payload()
        payload.pop("seed")

        errors = missing_input_errors(self.input_types, payload)

        self.assertEqual([error["details"] for error in errors], ["seed"])
        self.assertEqual(errors[0]["type"], "required_input_missing")

    def test_execution_defaults_cover_every_optional_input(self):
        signature = inspect.signature(self.composer_class.compose_prompt)
        for name in WIDGET_ORDER:
            self.assertIn(name, signature.parameters, name)
        for name in ADDED_INPUTS:
            self.assertIsNot(
                signature.parameters[name].default,
                inspect.Parameter.empty,
                f"{name} needs a Python default: an absent optional input is filled in by the signature",
            )


if __name__ == "__main__":
    unittest.main()
