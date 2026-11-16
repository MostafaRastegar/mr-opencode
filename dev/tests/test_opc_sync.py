#!/usr/bin/env python3
"""Unit tests for opc-sync (stdlib only)."""

import hashlib
import json
import os
import unittest
from pathlib import Path

# Import the opc_sync package under dev/scripts/
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from opc_sync import (
    SyncTool,
    file_hash,
    strip_jsonc_comments,
    deep_merge,
    collect_files,
)


class TestHelpers(unittest.TestCase):
    def test_file_hash(self):
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"hello world")
            path = f.name
        try:
            expected = hashlib.sha256(b"hello world").hexdigest()
            self.assertEqual(file_hash(path), expected)
        finally:
            os.unlink(path)

    def test_file_hash_empty(self):
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False) as f:
            path = f.name
        try:
            expected = hashlib.sha256(b"").hexdigest()
            self.assertEqual(file_hash(path), expected)
        finally:
            os.unlink(path)

    def test_strip_jsonc_comments(self):
        text = '{"a": 1} // line comment\n{"b": 2} /* block */\n{"c": "https://x.com//y"}'
        result = strip_jsonc_comments(text)
        self.assertNotIn("// line comment", result)
        self.assertNotIn("/* block */", result)
        self.assertNotIn("*/", result)
        # URLs inside strings must be preserved intact
        self.assertIn("https://x.com//y", result)

    def test_deep_merge_dicts(self):
        base = {"a": 1, "b": {"x": 1, "y": 2}}
        local = {"b": {"y": 99, "z": 3}, "c": 4}
        merged = deep_merge(base, local)
        self.assertEqual(merged["a"], 1)
        self.assertEqual(merged["b"]["x"], 1)
        self.assertEqual(merged["b"]["y"], 99)
        self.assertEqual(merged["b"]["z"], 3)
        self.assertEqual(merged["c"], 4)

    def test_deep_merge_lists_union(self):
        base = {"a": [1, 2]}
        local = {"a": [2, 3]}
        merged = deep_merge(base, local)
        self.assertEqual(merged["a"], [1, 2, 3])

    def test_collect_files(self):
        import tempfile
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "a.txt").write_text("a")
            (root / "sub").mkdir()
            (root / "sub" / "b.txt").write_text("b")
            (root / ".git").mkdir()
            (root / ".git" / "config").write_text("c")
            files = collect_files(root)
            self.assertIn("a.txt", files)
            self.assertIn("sub/b.txt", files)
            self.assertNotIn(".git/config", files)


class TestSyncToolInit(unittest.TestCase):
    def test_defaults(self):
        tool = SyncTool(repo_url="x", target="~/.config/opencode",
                        agents_target="~/.agents", staging="~/.cache/opc-sync")
        self.assertEqual(str(tool.agents_target), str(Path.home() / ".agents"))
        self.assertEqual(len(tool.groups), 6)
        self.assertEqual(tool.groups[0], ("product/agents", tool.target / "agents"))
        self.assertEqual(tool.groups[1], ("product/skills", tool.agents_target / "skills"))
        self.assertEqual(tool.groups[2], ("product/commands", tool.agents_target / "commands"))
        self.assertEqual(tool.groups[3], ("product/plugins", tool.target / "plugins"))
        self.assertEqual(tool.groups[4], ("product/workflows", tool.agents_target / "workflows"))
        self.assertEqual(tool.groups[5], ("product/configs", tool.target))


if __name__ == "__main__":
    unittest.main()
