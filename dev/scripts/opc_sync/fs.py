"""Filesystem helpers for opc-sync (stdlib only)."""

import hashlib
import os
from pathlib import Path


def file_hash(p):
    """Return SHA-256 hex digest of a file."""
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def collect_files(root):
    """Return a set of relative POSIX paths for all files under root.

    Skips anything inside a .git directory.
    """
    out = set()
    if not root.exists():
        return out
    for p in root.rglob("*"):
        if any(part == ".git" for part in p.parts):
            continue
        if p.is_file():
            out.add(p.relative_to(root).as_posix())
    return out


def atomic_write_text(path, content):
    """Write content atomically: write to temp file in same dir, then os.replace."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp." + str(os.getpid()))
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, path)


def content_diff(src_path, dst_path, label_a="source", label_b="target"):
    """Return unified diff string between two text files, or '' if identical/binary."""
    import difflib

    try:
        a = src_path.read_text(encoding="utf-8").splitlines(keepends=True)
        b = dst_path.read_text(encoding="utf-8").splitlines(keepends=True)
    except Exception:
        return ""
    diff = difflib.unified_diff(a, b, fromfile=label_a, tofile=label_b, lineterm="")
    return "".join(diff)
