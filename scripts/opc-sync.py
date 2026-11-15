#!/usr/bin/env python3
"""opc-sync: stdlib-only OpenCode configuration sync tool."""

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
from pathlib import Path

DEFAULT_TARGET = Path(os.environ.get("OPENCODE_CONFIG_DIR", str(Path.home() / ".config" / "opencode")))
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


import json
import re

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
                 staging=DEFAULT_STAGING, force=False, dry_run=False, verbose=False):
        self.repo_url = repo_url
        self.target = Path(target).expanduser()
        self.staging = Path(staging).expanduser()
        self.force = force
        self.dry_run = dry_run
        self.verbose = verbose
        self._local_source = None

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

    def backup_target(self):
        if not self.target.exists():
            return None
        import datetime
        ts = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        backup = self.target.with_name(self.target.name + f".bak.{ts}")
        if self.dry_run:
            self.log(f"[dry-run] would backup {self.target} -> {backup}")
            return backup
        shutil.copytree(self.target, backup)
        self.log(f"backed up {self.target} -> {backup}")
        return backup

    def diff_sets(self):
        src_root = self._local_source or self.staging
        src_files = collect_files(src_root)
        tgt_files = collect_files(self.target)
        manifest = self.target / '.opc-manifest'
        tracked = set()
        if manifest.exists():
            tracked = set(x.strip() for x in manifest.read_text().splitlines() if x.strip())
        changes = []
        for rel in sorted(src_files):
            if rel not in tgt_files:
                changes.append(("add", rel, "new from source"))
            else:
                sh = file_hash(src_root / rel)
                th = file_hash(self.target / rel)
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

    def apply_changes(self, changes):
        added = updated = deleted = skipped = conflicts = 0
        for action, rel, detail in changes:
            src_root = self._local_source or self.staging
            src = src_root / rel
            dst = self.target / rel
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
        if self.target.exists() and not self.dry_run:
            self.backup_target()
        changes = self.diff_sets()
        if self.verbose:
            for a, r, d in changes:
                print(f"{a:8} {r}  ({d})")
        rc = self.apply_changes(changes)
        if not self.dry_run and rc == 0:
            src_root = self._local_source or self.staging
            files = sorted(collect_files(src_root))
            manifest = self.target / '.opc-manifest'
            manifest.write_text("\n".join(files) + "\n")
        return rc

    def cmd_status(self, list_items=False, diff=False):
        if not self.ensure_clone():
            return 1
        if list_items:
            for rel in sorted(collect_files(self.staging)):
                print(rel)
            return 0
        if diff:
            changes = self.diff_sets()
            for a, r, d in changes:
                print(f"{a:8} {r}  ({d})")
            return 0
        print(f"source files: {len(collect_files(self.staging))}")
        print(f"target files: {len(collect_files(self.target))}")
        return 0

    def cmd_clean(self, yes=False):
        if not self.ensure_clone():
            return 1
        changes = [c for c in self.diff_sets() if c[0] == "delete"]
        if not changes:
            print("Nothing to clean.")
            return 0
        for a, r, d in changes:
            print(f"delete {r}")
        if self.dry_run:
            print("[dry-run] no changes applied")
            return 0
        if not yes:
            ans = input("Proceed? [y/N] ").strip().lower()
            if ans != "y":
                print("Aborted.")
                return 0
        for a, r, d in changes:
            p = self.target / r
            try:
                p.unlink()
            except FileNotFoundError:
                pass
        print(f"Cleaned {len(changes)} item(s).")
        return 0

    def cmd_verify(self):
        if not self.ensure_clone():
            return 1
        changes = self.diff_sets()
        drift = [c for c in changes if c[0] in ("add", "update", "delete", "conflict")]
        if drift:
            print("DRIFT DETECTED:")
            for a, r, d in drift:
                print(f"  {a:8} {r}")
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
    p.add_argument("--target", default=str(DEFAULT_TARGET))
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
    tool = SyncTool(repo_url=args.repo, target=args.target, staging=args.staging,
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
