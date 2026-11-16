#!/usr/bin/env python3
"""Unit tests for opc-sync.py (stdlib only)."""

import hashlib
import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path

# Import the module under test
import importlib.util
spec = importlib.util.spec_from_file_location(
    "opc_sync", str(Path(__file__).resolve().parent.parent / "scripts" / "opc-sync.py")
)
opc_sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(opc_sync)


class TestHelpers(unittest.TestCase):
    def test_file_hash(self):
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"hello world")
            path = f.name
        try:
            expected = hashlib.sha256(b"hello world").hexdigest()
            self.assertEqual(opc_sync.file_hash(path), expected)
        finally:
            os.unlink(path)

    def test_file_hash_empty(self):
        with tempfile.NamedTemporaryFile(delete=False) as f:
            path = f.name
        try:
            expected = hashlib.sha256(b"").hexdigest()
            self.assertEqual(opc_sync.file_hash(path), expected)
        finally:
            os.unlink(path)

    def test_strip_jsonc_comments(self):
        text = '{"a": 1} // line comment\n{"b": 2} /* block */'
        result = opc_sync.strip_jsonc_comments(text)
        self.assertNotIn("//", result)
        self.assertNotIn("/*", result)
        self.assertNotIn("*/", result)

    def test_deep_merge_dicts(self):
        base = {"a": 1, "b": {"x": 1, "y": 2}}
        local = {"b": {"y": 99, "z": 3}, "c": 4}
        merged = opc_sync.deep_merge(base, local)
        self.assertEqual(merged["a"], 1)
        self.assertEqual(merged["b"]["x"], 1)
        self.assertEqual(merged["b"]["y"], 99)
        self.assertEqual(merged["b"]["z"], 3)
        self.assertEqual(merged["c"], 4)

    def test_deep_merge_lists_union(self):
        base = {"a": [1, 2]}
        local = {"a": [2, 3]}
        merged = opc_sync.deep_merge(base, local)
        self.assertEqual(merged["a"], [1, 2, 3])

    def test_collect_files(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "a.txt").write_text("a")
            (root / "sub").mkdir()
            (root / "sub" / "b.txt").write_text("b")
            (root / ".git").mkdir()
            (root / ".git" / "config").write_text("c")
            files = opc_sync.collect_files(root)
            self.assertIn("a.txt", files)
            self.assertIn("sub/b.txt", files)
            self.assertNotIn(".git/config", files)


class TestSyncToolInit(unittest.TestCase):
    def test_defaults(self):
        tool = opc_sync.SyncTool()
        self.assertEqual(str(tool.agents_target), str(Path.home() / ".agents"))
        self.assertEqual(len(tool.groups), 4)
        self.assertEqual(tool.groups[0], ("agents", tool.agents_target))
        self.assertEqual(tool.groups[1], ("skills", tool.agents_target / "skills"))
        self.assertEqual(tool.groups[2], ("commands", tool.agents_target / "commands"))
        self.assertEqual(tool.groups[3], ("configs", tool.target))


if __name__ == "__main__":
    unittest.main()
