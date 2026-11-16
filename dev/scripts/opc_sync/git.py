"""Git helpers for opc-sync (stdlib only)."""

import shutil
import subprocess
import sys
from pathlib import Path


def run_git(args, cwd=None):
    """Run a git command and return (returncode, stdout, stderr)."""
    try:
        r = subprocess.run(["git"] + args, cwd=cwd, capture_output=True, text=True)
        return r.returncode, r.stdout.strip(), r.stderr.strip()
    except FileNotFoundError:
        return 127, "", "git not found"


def ensure_clone(staging, repo_url):
    """Ensure a local clone exists at staging. Returns the resolved local source path or None."""
    rp = Path(repo_url)
    if rp.exists() and rp.is_dir():
        return rp.resolve()
    staging = Path(staging).expanduser()
    if (staging / ".git").exists():
        rc, out, err = run_git(["pull", "--ff-only"], cwd=staging)
        if rc != 0:
            print(f"git pull failed: {err}", file=sys.stderr)
            return None
    else:
        staging.parent.mkdir(parents=True, exist_ok=True)
        if staging.exists():
            shutil.rmtree(staging)
        rc, out, err = run_git(["clone", repo_url, str(staging)])
        if rc != 0:
            print(f"git clone failed: {err}", file=sys.stderr)
            return None
    return staging.resolve()
