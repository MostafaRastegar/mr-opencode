"""Configuration parsing helpers for opc-sync (stdlib only)."""

import json
import os
import re


def strip_jsonc_comments(text):
    """Remove // and /* */ comments (naive but works for config files).

    Protects URLs so their // is never treated as a comment.
    """
    # Protect URLs (and their //) so they are not mistaken for comments.
    urls = re.findall(r"https?://[^\s\"',}]+", text)
    for i, u in enumerate(urls):
        text = text.replace(u, f"\x00URL{i}\x00")
    # Strip // comments (start-of-line or inline) and /* */ block comments.
    text = re.sub(r"//[^\n]*", "", text)
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    for i, u in enumerate(urls):
        text = text.replace(f"\x00URL{i}\x00", u)
    return text


def deep_merge(base, local):
    """Deep-merge local into base. Dicts merge recursively; lists union (order preserved)."""
    result = dict(base)
    for k, v in local.items():
        if k in result and isinstance(result[k], dict) and isinstance(v, dict):
            result[k] = deep_merge(result[k], v)
        elif k in result and isinstance(result[k], list) and isinstance(v, list):
            merged = list(result[k])
            for item in v:
                if item not in merged:
                    merged.append(item)
            result[k] = merged
        else:
            result[k] = v
    return result


def substitute_env(text):
    """Replace ${VAR} and $VAR with environment values. Missing vars left unchanged."""
    def repl(m):
        var = m.group(1) or m.group(2)
        return os.environ.get(var, m.group(0))
    return re.sub(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9]*)", repl, text)
