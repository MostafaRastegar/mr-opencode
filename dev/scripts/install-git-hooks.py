#!/usr/bin/env python3
"""Install git hooks from dev/scripts/git-hooks into .git/hooks.

Run once after cloning:

    python3 dev/scripts/install-git-hooks.py
"""
import shutil
import stat
from pathlib import Path


def main() -> int:
    repo_root = Path(__file__).resolve().parents[2]  # dev/scripts/ -> repo root
    hooks_src = repo_root / "dev" / "scripts" / "git-hooks"
    git_dir = repo_root / ".git"

    if not git_dir.is_dir():
        print("error: .git directory not found — are you inside a git clone?")
        return 1

    hooks_dst = git_dir / "hooks"
    hooks_dst.mkdir(parents=True, exist_ok=True)

    installed = 0
    for src in sorted(hooks_src.glob("*")):
        if not src.is_file():
            continue
        dst = hooks_dst / src.name
        shutil.copy2(src, dst)
        dst.chmod(dst.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
        print(f"installed {dst}")
        installed += 1

    print(f"{installed} hook(s) installed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())