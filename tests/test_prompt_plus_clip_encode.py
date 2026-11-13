import ast
import json
import unittest
from pathlib import Path


def load_prompt_node_classes():
    nodes_path = Path(__file__).resolve().parents[1] / "nodes.py"
    source = nodes_path.read_text(encoding="utf-8")
    prompt_node_source = source.split("class AnimaPromptComposer:", 1)[0]
    namespace = {}
    exec(compile(prompt_node_source, str(nodes_path), "exec"), namespace)
    return namespace["AnimaPromptPlus"], namespace["AnimaPromptPlusClipEncode"]


def load_queue_resolvers():
    nodes_path = Path(__file__).resolve().parents[1] / "nodes.py"
    tree = ast.parse(nodes_path.read_text(encoding="utf-8"), filename=str(nodes_path))
    names = {
        "_set_selector_workflow_widget_value",
        "_selector_random_text",
        "_record_selector_random",
        "_resolve_prompt_box_random_nodes",
        "_resolve_anima_prompt_plus_clip_nodes",
    }
    functions = [
        node for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name in names
    ]
    constants = [
        node for node in tree.body
        if isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id in ("SELECTOR_WIDGET_ORDERS", "PROMPT_BOX_NODES") for target in node.targets)
    ]
    namespace = {}
    module = ast.Module(body=[*ast.parse("import json").body, *constants, *functions], type_ignores=[])
    exec(compile(module, str(nodes_path), "exec"), namespace)
    return namespace["_resolve_prompt_box_random_nodes"], namespace["_resolve_anima_prompt_plus_clip_nodes"]


def boxes(*texts, **extra):
    return json.dumps([{"text": text, **extra.get(str(index), {})} for index, text in enumerate(texts)])


class FakeClip:
    def __init__(self):
        self.tokenized_text = None
        self.encoded_tokens = None

    def tokenize(self, text):
        self.tokenized_text = text
        return {"tokens": text}

    def encode_from_tokens_scheduled(self, tokens):
        self.encoded_tokens = tokens
        return [["conditioning", {"pooled_output": "pooled"}]]


class FakeComposer:
    def __init__(self, workflow_node):
        self.workflow_node = workflow_node

    def _find_workflow_node(self, workflow, unique_id):
        return self.workflow_node

    def _resolve_prompt_data(self, artist, character, clothing, background, pose, *args):
        section = "artist" if artist else "background" if background else "character" if character else "clothing" if clothing else "pose"
        return {section: [f"picked {section}"]}, f"drawn {section}, "


class AnimaPromptPlusClipEncodeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.prompt_plus, cls.clip_encode = load_prompt_node_classes()
        cls.box_random_resolver, cls.clip_resolver = (staticmethod(fn) for fn in load_queue_resolvers())

    def prompt_values(self):
        return {
            "prompt_boxes": boxes("masterpiece", "@dairi, @wlop, ", "", "hatsune miku\nsmile", "_raw_:red coat"),
            "separator": ", ",
        }

    def test_text_boxes_are_the_only_prompt_inputs(self):
        for node_class in (self.prompt_plus, self.clip_encode):
            required = node_class.INPUT_TYPES()["required"]
            self.assertEqual([name for name in required if name != "clip"], ["prompt_boxes", "separator"])
        default = json.loads(self.prompt_plus.INPUT_TYPES()["required"]["prompt_boxes"][1]["default"])
        self.assertEqual(default, [{"text": ""}])

    def test_boxes_join_top_to_bottom_as_typed(self):
        result = self.prompt_plus().compose_prompt(**self.prompt_values())

        self.assertEqual(result["result"][0], "masterpiece, @dairi, @wlop, hatsune miku, smile, red coat, ")
        self.assertEqual(result["ui"]["anima_selector_tags"][0], {"prompt_boxes": self.prompt_values()["prompt_boxes"]})

    def test_linked_box_uses_the_linked_text_instead_of_its_own(self):
        prompt_boxes = json.dumps([{"id": "a", "text": "masterpiece"}, {"id": "b", "text": "smile"}])

        result = self.prompt_plus().compose_prompt(prompt_boxes, ", ", box_b="@dairi, hatsune miku")
        self.assertEqual(result["result"][0], "masterpiece, @dairi, hatsune miku, ")
        clip = FakeClip()
        self.clip_encode().encode_prompt(clip=clip, prompt_boxes=prompt_boxes, box_a="")
        self.assertEqual(clip.tokenized_text, "smile, ")

    def test_custom_separator_and_empty_boxes(self):
        node = self.prompt_plus()
        self.assertEqual(node.compose_prompt(boxes("a, b", "c"), " | ")["result"][0], "a | b | c")
        self.assertEqual(node.compose_prompt(boxes("", " , "), ", ")["result"][0], "")

    def test_disabled_boxes_skip_typed_and_linked_text_without_losing_content(self):
        entries = [{"id": "a", "text": "keep"}, {"id": "b", "text": "stored", "disabled": True}]
        prompt_boxes = json.dumps(entries)
        result = self.prompt_plus().compose_prompt(prompt_boxes, box_b="linked")
        self.assertEqual(result["result"][0], "keep, ")
        self.assertEqual(result["ui"]["anima_selector_tags"][0]["prompt_boxes"], prompt_boxes)

        clip = FakeClip()
        self.clip_encode().encode_prompt(clip=clip, prompt_boxes=prompt_boxes, box_b="linked")
        self.assertEqual(clip.tokenized_text, "keep, ")
        entries[1]["disabled"] = False
        self.assertEqual(self.prompt_plus().compose_prompt(json.dumps(entries))["result"][0], "keep, stored, ")

    def test_all_disabled_boxes_encode_an_empty_prompt(self):
        clip = FakeClip()
        self.clip_encode().encode_prompt(clip=clip, prompt_boxes=boxes("stored", **{"0": {"disabled": True}}))
        self.assertEqual(clip.tokenized_text, "")

    def test_clip_node_encodes_and_records_resolved_positive_prompt(self):
        clip = FakeClip()
        extra_pnginfo = {"workflow": {"nodes": []}}

        result = self.clip_encode().encode_prompt(
            clip=clip,
            extra_pnginfo=extra_pnginfo,
            unique_id="42",
            **self.prompt_values(),
        )

        expected_text = "masterpiece, @dairi, @wlop, hatsune miku, smile, red coat, "
        self.assertEqual(clip.tokenized_text, expected_text)
        self.assertEqual(clip.encoded_tokens, {"tokens": expected_text})
        self.assertEqual(result["result"][0], [["conditioning", {"pooled_output": "pooled"}]])
        self.assertEqual(result["result"][1], expected_text)
        self.assertEqual(extra_pnginfo["anima_prompt"]["42"], {"positive": expected_text})
        self.assertEqual(result["ui"]["anima_selector_tags"][0]["prompt_boxes"], self.prompt_values()["prompt_boxes"])

    def test_clip_node_keeps_metadata_text_internal(self):
        required = self.clip_encode.INPUT_TYPES()["required"]

        self.assertNotIn("text", required)

    def test_queue_resolver_writes_standard_text_input(self):
        prompt = {"7": {"class_type": "AnimaPromptPlusClipEncode", "inputs": self.prompt_values()}}
        workflow_node = {"id": 7, "widgets_values": ["old", ", "]}
        extra_pnginfo = {"workflow": {"nodes": [workflow_node]}}

        updates = self.clip_resolver(prompt, extra_pnginfo, self.prompt_plus())

        expected_text = "masterpiece, @dairi, @wlop, hatsune miku, smile, red coat, "
        self.assertEqual(prompt["7"]["inputs"]["text"], expected_text)
        self.assertEqual(workflow_node["widgets_values"], ["old", ", "])
        self.assertEqual(updates["7"], {"prompt_boxes": self.prompt_values()["prompt_boxes"], "separator": ", "})
        self.assertEqual(extra_pnginfo["anima_prompt"]["7"], {"positive": expected_text})

    def test_random_boxes_are_drawn_before_queue(self):
        prompt_boxes = boxes(
            "masterpiece",
            "@old artist, ",
            "keep me",
            **{"1": {"random": ["artist", "background"], "picks": {"artist": {"keys": ["old artist"], "text": "@old artist, "}}}},
        )
        prompt = {"3": {"class_type": "AnimaPromptPlus", "inputs": {"prompt_boxes": prompt_boxes, "separator": ", "}}}
        workflow_node = {"id": 3, "widgets_values": [prompt_boxes, ", "]}
        extra_pnginfo = {"workflow": {"nodes": [workflow_node]}}

        self.box_random_resolver(prompt, extra_pnginfo, FakeComposer(workflow_node))

        resolved = json.loads(prompt["3"]["inputs"]["prompt_boxes"])
        self.assertEqual([box["text"] for box in resolved], ["masterpiece", "drawn artist, drawn background, ", "keep me"])
        self.assertNotIn("picks", resolved[1])
        self.assertEqual(resolved[1]["random"], ["artist", "background"])
        self.assertEqual(workflow_node["widgets_values"], [prompt["3"]["inputs"]["prompt_boxes"], ", "])
        self.assertEqual(extra_pnginfo["anima_selector_random"]["3:1:artist"]["selected"], ["picked artist"])
        self.assertEqual(self.prompt_plus().compose_prompt(**prompt["3"]["inputs"])["result"][0], "masterpiece, drawn artist, drawn background, keep me, ")

    def test_boxes_without_random_are_left_untouched(self):
        prompt_boxes = boxes("a", "b")
        prompt = {"3": {"class_type": "AnimaPromptPlus", "inputs": {"prompt_boxes": prompt_boxes, "separator": ", "}}}

        self.box_random_resolver(prompt, {}, FakeComposer(None))

        self.assertIs(prompt["3"]["inputs"]["prompt_boxes"], prompt_boxes)

    def test_disabled_random_box_preserves_text_picks_and_workflow_state(self):
        disabled = {"text": "saved artist", "disabled": True, "random": ["artist"], "picks": {"artist": {"keys": ["saved artist"]}}}
        prompt_boxes = json.dumps([disabled, {"text": "old background", "random": ["background"]}])
        prompt = {"3": {"class_type": "AnimaPromptPlusClipEncode", "inputs": {"prompt_boxes": prompt_boxes}}}
        workflow_node = {"id": 3, "widgets_values": [prompt_boxes, ", "]}
        extra_pnginfo = {"workflow": {"nodes": [workflow_node]}}

        self.box_random_resolver(prompt, extra_pnginfo, FakeComposer(workflow_node))
        self.clip_resolver(prompt, extra_pnginfo, self.prompt_plus())

        resolved = json.loads(prompt["3"]["inputs"]["prompt_boxes"])
        self.assertEqual(resolved[0], disabled)
        self.assertEqual(resolved[1]["text"], "drawn background, ")
        self.assertEqual(json.loads(workflow_node["widgets_values"][0]), resolved)
        self.assertNotIn("3:0:artist", extra_pnginfo["anima_selector_random"])
        self.assertEqual(prompt["3"]["inputs"]["text"], "drawn background, ")
        self.assertEqual(extra_pnginfo["anima_prompt"]["3"]["positive"], "drawn background, ")

    def test_clip_input_is_required_at_runtime(self):
        with self.assertRaisesRegex(RuntimeError, "clip input is invalid"):
            self.clip_encode().encode_prompt(
                clip=None,
                **self.prompt_values(),
            )


if __name__ == "__main__":
    unittest.main()
