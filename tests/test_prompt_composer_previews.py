import ast
import unittest
import urllib.parse
from pathlib import Path


def load_preview_url_builders():
    nodes_path = Path(__file__).resolve().parents[1] / "nodes.py"
    tree = ast.parse(nodes_path.read_text(encoding="utf-8"), filename=str(nodes_path))
    assignment_names = {"ANIMADEX_CHARACTER_THUMB_BASE"}
    function_names = {"_animadex_character_preview_url"}
    selected_nodes = []
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id in assignment_names
            for target in node.targets
        ):
            selected_nodes.append(node)
        if isinstance(node, ast.FunctionDef) and node.name in function_names:
            selected_nodes.append(node)
    namespace = {"urllib": urllib}
    exec(compile(ast.Module(body=selected_nodes, type_ignores=[]), str(nodes_path), "exec"), namespace)
    return namespace


class PromptComposerPreviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.builders = load_preview_url_builders()

    def test_builds_animadex_character_thumbnail_url(self):
        self.assertEqual(
            self.builders["_animadex_character_preview_url"]("hatsune miku", "vocaloid"),
            "https://blobs.animadex.net/Outputs/thumbs/hatsune%20miku%2C%20vocaloid.webp",
        )

    def test_encodes_reserved_character_name_characters(self):
        self.assertEqual(
            self.builders["_animadex_character_preview_url"]("alice/bob", "series & more"),
            "https://blobs.animadex.net/Outputs/thumbs/alice%2Fbob%2C%20series%20%26%20more.webp",
        )


if __name__ == "__main__":
    unittest.main()
