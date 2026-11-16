"""HTTP skill catalog downloader for opc-sync (stdlib only)."""

import json
import sys
import urllib.request
from pathlib import Path

from .config import strip_jsonc_comments
from .fs import atomic_write_text


def fetch_skill_catalogs(src_root, agents_target, dry_run=False):
    """Download skills from HTTP catalog URLs listed in configs/opencode.jsonc.

    Returns 0 always (catalog failures are logged to stderr, not fatal).
    """
    cfg = src_root / "configs" / "opencode.jsonc"
    if not cfg.exists():
        return 0
    try:
        data = json.loads(strip_jsonc_comments(cfg.read_text(encoding="utf-8")))
    except Exception:
        return 0
    urls = data.get("skills", [])
    if not urls:
        return 0
    skills_root = agents_target / "skills"
    fetched = 0
    for base_url in urls:
        base_url = base_url.rstrip("/")
        index_url = base_url + "/index.json"
        try:
            with urllib.request.urlopen(index_url, timeout=15) as resp:
                catalog = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print(f"skill catalog fetch failed ({index_url}): {e}", file=sys.stderr)
            continue
        for skill in catalog.get("skills", []):
            skill_id = skill.get("id")
            version = skill.get("version", "")
            if not skill_id:
                continue
            skill_dir = skills_root / skill_id
            for f in skill.get("files", []):
                dest = f.get("dest")
                url = f.get("url")
                if not dest or not url:
                    continue
                dst = skill_dir / dest
                if dry_run:
                    print(f"[dry-run] fetch skill {skill_id}/{dest}")
                    continue
                try:
                    with urllib.request.urlopen(url, timeout=30) as resp:
                        data_bytes = resp.read()
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    atomic_write_text(dst, data_bytes.decode("utf-8"))
                    fetched += 1
                except Exception as e:
                    print(f"skill fetch failed ({url}): {e}", file=sys.stderr)
                    continue
            if version and not dry_run:
                try:
                    (skill_dir / "VERSION").write_text(version + "\n", encoding="utf-8")
                except Exception:
                    pass
    if fetched:
        print(f"Fetched {fetched} skill file(s) from HTTP catalogs.")
    return 0
