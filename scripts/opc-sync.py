#!/usr/bin/env python3
"""opc-sync: stdlib-only OpenCode configuration sync tool.

Syncs the central mr-opencode repo to one or more local targets:
  * agents/, skills/, commands/ -> ~/.agents       (harness-agnostic, shared)
  * configs/                    -> ~/.config/opencode (opencode-specific)
"""

import argparse
import datetime
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

DEFAULT_TARGET = Path(os.environ.get("OPENCODE_CONFIG_DIR", str(Path.home() / ".config" / "opencode")))
DEFAULT_AGENTS_TARGET = Path.home() / ".agents"
DEFAULT_STAGING = Path.home() / ".cache" / "opc-sync"
DEFAULT_REPO = "git@github.com:MostafaRastegar/mr-opencode.git"


def run_git(args, cwd=None):
    try:
        r = subprocess.run(["git"] + args, cwd=cwd, capture_output=True, text=True)
        return r.returncode, r.stdout.strip(), r.stderr.strip()
    except FileNotFoundError:
        return 127, "", "git not found"


def file_hash(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def strip_jsonc_comments(text):
    # Remove // and /* */ comments (naive but works for config files)
    text = re.sub(r"//.*?$", "", text, flags=re.MULTILINE)
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    return text


def deep_merge(base, local):
    result = dict(base)
    for k, v in local.items():
        if k in result and isinstance(result[k], dict) and isinstance(v, dict):
            result[k] = deep_merge(result[k], v)
        elif k in result and isinstance(result[k], list) and isinstance(v, list):
            # union preserving order
            merged = list(result[k])
            for item in v:
                if item not in merged:
                    merged.append(item)
            result[k] = merged
        else:
            result[k] = v
    return result


def collect_files(root):
    out = set()
    if not root.exists():
        return out
    for p in root.rglob("*"):
        if any(part == ".git" for part in p.parts):
            continue
        if p.is_file():
            out.add(p.relative_to(root).as_posix())
    return out


class SyncTool:
    def __init__(self, repo_url=DEFAULT_REPO, target=DEFAULT_TARGET,
                 agents_target=DEFAULT_AGENTS_TARGET, staging=DEFAULT_STAGING,
                 force=False, dry_run=False, verbose=False):
        self.repo_url = repo_url
        self.target = Path(target).expanduser()
        self.agents_target = Path(agents_target).expanduser()
        self.staging = Path(staging).expanduser()
        self.force = force
        self.dry_run = dry_run
        self.verbose = verbose
        self._local_source = None
        # (source subdir in repo, local target dir).
        # agents/skills/commands go to ~/.agents (harness-agnostic, shared).
        # configs/ is opencode-specific -> ~/.config/opencode.
        self.groups = [
            ("agents", self.agents_target),
            ("skills", self.agents_target / "skills"),
            ("commands", self.agents_target / "commands"),
            ("configs", self.target),
        ]

    def log(self, msg):
        if self.verbose or self.dry_run:
            print(msg)

    def ensure_clone(self):
        rp = Path(self.repo_url)
        if rp.exists() and rp.is_dir():
            self._local_source = rp.resolve()
            return True
        if (self.staging / ".git").exists():
            rc, out, err = run_git(["pull", "--ff-only"], cwd=self.staging)
            if rc != 0:
                print(f"git pull failed: {err}", file=sys.stderr)
                return False
        else:
            self.staging.parent.mkdir(parents=True, exist_ok=True)
            if self.staging.exists():
                shutil.rmtree(self.staging)
            rc, out, err = run_git(["clone", self.repo_url, str(self.staging)])
            if rc != 0:
                print(f"git clone failed: {err}", file=sys.stderr)
                return False
        return True

    def backup_target(self, target_dir):
        if not target_dir.exists():
            return None
        ts = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        backup = target_dir.with_name(target_dir.name + f".bak.{ts}")
        if self.dry_run:
            self.log(f"[dry-run] would backup {target_dir} -> {backup}")
            return backup
        shutil.copytree(target_dir, backup)
        self.log(f"backed up {target_dir} -> {backup}")
        return backup

    def diff_sets(self, source_subdir="", target_dir=None):
        target_dir = target_dir or self.target
        src_root = self._local_source or self.staging
        if source_subdir:
            src_root = src_root / source_subdir
        src_files = collect_files(src_root) if src_root.exists() else set()
        tgt_files = collect_files(target_dir)
        manifest = target_dir / '.opc-manifest'
        tracked = set()
        if manifest.exists():
            tracked = set(x.strip() for x in manifest.read_text().splitlines() if x.strip())
        changes = []
        for rel in sorted(src_files):
            if rel not in tgt_files:
                changes.append(("add", rel, "new from source"))
            else:
                sh = file_hash(src_root / rel)
                th = file_hash(target_dir / rel)
                if sh != th:
                    if self.force:
                        changes.append(("update", rel, "overwrite"))
                    else:
                        changes.append(("conflict", rel, "local differs"))
                else:
                    changes.append(("skip", rel, "unchanged"))
        for rel in sorted(tracked - src_files):
            if rel in tgt_files:
                changes.append(("delete", rel, "removed from source"))
        return changes

    def apply_changes(self, changes, source_subdir="", target_dir=None):
        target_dir = target_dir or self.target
        src_root = self._local_source or self.staging
        if source_subdir:
            src_root = src_root / source_subdir
        added = updated = deleted = skipped = conflicts = 0
        for action, rel, detail in changes:
            src = src_root / rel
            dst = target_dir / rel
            if action == "add":
                if self.dry_run:
                    self.log(f"[dry-run] add {rel}")
                else:
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    if rel.endswith((".json", ".jsonc")) and dst.exists():
                        try:
                            src_data = json.loads(strip_jsonc_comments(src.read_text()))
                            dst_data = json.loads(strip_jsonc_comments(dst.read_text()))
                            merged = deep_merge(src_data, dst_data)
                            dst.write_text(json.dumps(merged, indent=2) + "\n")
                        except Exception:
                            shutil.copy2(src, dst)
                    else:
                        shutil.copy2(src, dst)
                added += 1
            elif action == "update":
                if self.dry_run:
                    self.log(f"[dry-run] update {rel}")
                else:
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    if rel.endswith((".json", ".jsonc")) and dst.exists():
                        try:
                            src_data = json.loads(strip_jsonc_comments(src.read_text()))
                            dst_data = json.loads(strip_jsonc_comments(dst.read_text()))
                            merged = deep_merge(src_data, dst_data)
                            dst.write_text(json.dumps(merged, indent=2) + "\n")
                        except Exception:
                            shutil.copy2(src, dst)
                    else:
                        shutil.copy2(src, dst)
                updated += 1
            elif action == "delete":
                if self.dry_run:
                    self.log(f"[dry-run] delete {rel}")
                else:
                    try:
                        dst.unlink()
                    except FileNotFoundError:
                        pass
                deleted += 1
            elif action == "conflict":
                self.log(f"CONFLICT {rel} (use --force to overwrite)")
                conflicts += 1
            else:
                skipped += 1
        print(f"Summary: added={added} updated={updated} deleted={deleted} "
              f"skipped={skipped} conflicts={conflicts}")
        return 0 if conflicts == 0 else 1

    def cmd_pull(self):
        if not self.ensure_clone():
            return 1
        if not self.dry_run:
            seen = set()
            for _, target_dir in self.groups:
                if target_dir in seen:
                    continue
                seen.add(target_dir)
                if target_dir.exists():
                    self.backup_target(target_dir)
        rc = 0
        for source_subdir, target_dir in self.groups:
            changes = self.diff_sets(source_subdir, target_dir)
            if self.verbose:
                for a, r, d in changes:
                    print(f"{a:8} {source_subdir}/{r}  ({d})")
            group_rc = self.apply_changes(changes, source_subdir, target_dir)
            rc = max(rc, group_rc)
            if not self.dry_run and group_rc == 0:
                src_root = self._local_source or self.staging
                if source_subdir:
                    src_root = src_root / source_subdir
                files = sorted(collect_files(src_root)) if src_root.exists() else []
                manifest = target_dir / '.opc-manifest'
                manifest.write_text("\n".join(files) + "\n")
        return rc

    def cmd_status(self, list_items=False, diff=False):
        if not self.ensure_clone():
            return 1
        src_root = self._local_source or self.staging
        if list_items:
            for rel in sorted(collect_files(src_root)):
                print(rel)
            return 0
        if diff:
            for source_subdir, target_dir in self.groups:
                changes = self.diff_sets(source_subdir, target_dir)
                for a, r, d in changes:
                    print(f"{a:8} {source_subdir}/{r}  ({d})")
            return 0
        print(f"source files: {len(collect_files(src_root))}")
        for source_subdir, target_dir in self.groups:
            print(f"target files ({source_subdir} -> {target_dir}): "
                  f"{len(collect_files(target_dir))}")
        return 0

    def cmd_clean(self, yes=False):
        if not self.ensure_clone():
            return 1
        changes = []
        for source_subdir, target_dir in self.groups:
            for c in self.diff_sets(source_subdir, target_dir):
                if c[0] == "delete":
                    changes.append((source_subdir, target_dir, c))
        if not changes:
            print("Nothing to clean.")
            return 0
        for source_subdir, target_dir, c in changes:
            print(f"delete {source_subdir}/{c[1]}")
        if self.dry_run:
            print("[dry-run] no changes applied")
            return 0
        if not yes:
            ans = input("Proceed? [y/N] ").strip().lower()
            if ans != "y":
                print("Aborted.")
                return 0
        for source_subdir, target_dir, c in changes:
            p = target_dir / c[1]
            try:
                p.unlink()
            except FileNotFoundError:
                pass
        print(f"Cleaned {len(changes)} item(s).")
        return 0

    def cmd_verify(self):
        if not self.ensure_clone():
            return 1
        drift = []
        for source_subdir, target_dir in self.groups:
            for c in self.diff_sets(source_subdir, target_dir):
                if c[0] in ("add", "update", "delete", "conflict"):
                    drift.append((source_subdir, target_dir, c))
        if drift:
            print("DRIFT DETECTED:")
            for source_subdir, target_dir, c in drift:
                print(f"  {c[0]:8} {source_subdir}/{c[1]}")
            return 1
        print("OK: no drift.")
        return 0

    def cmd_doctor(self):
        rc = 0
        print(f"python: {sys.version.split()[0]}")
        grc, gout, gerr = run_git(["--version"])
        if grc != 0:
            print("git: MISSING")
            rc = 1
        else:
            print(f"git: {gout}")
        for mcp in ["codegraph", "codebase-memory-mcp"]:
            found = shutil.which(mcp) is not None
            print(f"mcp {mcp}: {'ok' if found else 'MISSING'}")
            if not found:
                rc = 1
        print(f"target: {self.target} ({'exists' if self.target.exists() else 'missing'})")
        print(f"agents target: {self.agents_target} ({'exists' if self.agents_target.exists() else 'missing'})")
        print(f"staging: {self.staging}")
        try:
            self.staging.parent.mkdir(parents=True, exist_ok=True)
            test = self.staging.parent / ".opc_write_test"
            test.write_text("ok")
            test.unlink()
            print("write access: ok")
        except Exception as e:
            print(f"write access: FAIL ({e})")
            rc = 1
        return rc


def build_parser():
    p = argparse.ArgumentParser(prog="opc-sync", description="OpenCode config sync (stdlib only)")
    p.add_argument("--repo", default=DEFAULT_REPO)
    p.add_argument("--target", default=str(DEFAULT_TARGET),
                   help="opencode config target dir (default ~/.config/opencode)")
    p.add_argument("--agents-target", default=str(DEFAULT_AGENTS_TARGET),
                   help="shared agents dir (default ~/.agents)")
    p.add_argument("--staging", default=str(DEFAULT_STAGING))
    p.add_argument("--force", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--verbose", action="store_true")
    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("pull")
    sp.set_defaults(func=lambda t: t.cmd_pull())

    sp = sub.add_parser("status")
    sp.add_argument("--list", action="store_true")
    sp.add_argument("--diff", action="store_true")
    sp.set_defaults(func=lambda t, a: t.cmd_status(list_items=a.list, diff=a.diff))

    sp = sub.add_parser("clean")
    sp.add_argument("--yes", action="store_true")
    sp.set_defaults(func=lambda t, a: t.cmd_clean(yes=a.yes))

    sp = sub.add_parser("verify")
    sp.set_defaults(func=lambda t: t.cmd_verify())

    sp = sub.add_parser("doctor")
    sp.set_defaults(func=lambda t: t.cmd_doctor())

    return p


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    tool = SyncTool(repo_url=args.repo, target=args.target,
                    agents_target=args.agents_target, staging=args.staging,
                    force=args.force, dry_run=args.dry_run, verbose=args.verbose)
    if args.cmd == "pull":
        return tool.cmd_pull()
    if args.cmd == "status":
        return tool.cmd_status(list_items=args.list, diff=args.diff)
    if args.cmd == "clean":
        return tool.cmd_clean(yes=args.yes)
    if args.cmd == "verify":
        return tool.cmd_verify()
    if args.cmd == "doctor":
        return tool.cmd_doctor()
    return 2


if __name__ == "__main__":
    sys.exit(main())
