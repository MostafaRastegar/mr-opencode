#!/usr/bin/env python3
"""opc-sync: stdlib-only OpenCode configuration sync tool.

Syncs the central mr-opencode repo to one or more local targets:
  * agents/, skills/, commands/ -> ~/.agents       (harness-agnostic, shared)
  * configs/                    -> ~/.config/opencode (opencode-specific)
"""

import argparse
import datetime
import difflib
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request
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


def atomic_write_text(path, content):
    """Write content atomically: write to temp file in same dir, then os.replace."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp." + str(os.getpid()))
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, path)


def substitute_env(text):
    """Replace ${VAR} and $VAR with environment values. Missing vars left unchanged."""
    def repl(m):
        var = m.group(1) or m.group(2)
        return os.environ.get(var, m.group(0))
    return re.sub(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9]*)", repl, text)


def content_diff(src_path, dst_path, label_a="source", label_b="target"):
    """Return unified diff string between two text files, or '' if identical/binary."""
    try:
        a = src_path.read_text(encoding="utf-8").splitlines(keepends=True)
        b = dst_path.read_text(encoding="utf-8").splitlines(keepends=True)
    except Exception:
        return ""
    diff = difflib.unified_diff(a, b, fromfile=label_a, tofile=label_b, lineterm="")
    return "".join(diff)


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
        self.errors = []
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
        import datetime
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
                    if rel.endswith((".json", ".jsonc")):
                        try:
                            src_text = substitute_env(strip_jsonc_comments(src.read_text()))
                            json.loads(src_text)
                            if dst.exists():
                                dst_data = json.loads(substitute_env(strip_jsonc_comments(dst.read_text())))
                                merged = deep_merge(json.loads(src_text), dst_data)
                                atomic_write_text(dst, json.dumps(merged, indent=2) + "\n")
                            else:
                                atomic_write_text(dst, src_text)
                        except Exception as e:
                            self.errors.append(f"{rel}: invalid JSON source ({e}); skipped")
                            continue
                    else:
                        atomic_write_text(dst, substitute_env(src.read_text(encoding="utf-8")))
                added += 1
            elif action == "update":
                if self.dry_run:
                    self.log(f"[dry-run] update {rel}")
                else:
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    if rel.endswith((".json", ".jsonc")):
                        try:
                            src_text = substitute_env(strip_jsonc_comments(src.read_text()))
                            json.loads(src_text)
                            if dst.exists():
                                dst_data = json.loads(substitute_env(strip_jsonc_comments(dst.read_text())))
                                merged = deep_merge(json.loads(src_text), dst_data)
                                atomic_write_text(dst, json.dumps(merged, indent=2) + "\n")
                            else:
                                atomic_write_text(dst, src_text)
                        except Exception as e:
                            self.errors.append(f"{rel}: invalid JSON source ({e}); skipped")
                            continue
                    else:
                        atomic_write_text(dst, substitute_env(src.read_text(encoding="utf-8")))
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
        if self.errors:
            for e in self.errors:
                print(f"ERROR: {e}", file=sys.stderr)
            return 1
        return 0 if conflicts == 0 else 1

    def fetch_skill_catalogs(self):
        """Download skills from HTTP catalog URLs listed in configs/opencode.jsonc."""
        src_root = self._local_source or self.staging
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
        skills_root = self.agents_target / "skills"
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
                    if self.dry_run:
                        self.log(f"[dry-run] fetch skill {skill_id}/{dest}")
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
                if version and not self.dry_run:
                    try:
                        (skill_dir / "VERSION").write_text(version + "\n", encoding="utf-8")
                    except Exception:
                        pass
        if fetched:
            print(f"Fetched {fetched} skill file(s) from HTTP catalogs.")
        return 0

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
        if not self.dry_run:
            self.fetch_skill_catalogs()
        if self.errors:
            rc = 1
        return rc

    def cmd_status(self, list_items=False, diff=False, json_out=False):
        if not self.ensure_clone():
            return 1
        src_root = self._local_source or self.staging
        if list_items:
            for rel in sorted(collect_files(src_root)):
                print(rel)
            return 0
        if diff:
            report = {"groups": []}
            for source_subdir, target_dir in self.groups:
                changes = self.diff_sets(source_subdir, target_dir)
                group = {"source": source_subdir, "target": str(target_dir), "changes": []}
                for a, r, d in changes:
                    entry = {"action": a, "rel": r, "detail": d}
                    src_root_full = self._local_source or self.staging
                    if source_subdir:
                        src_root_full = src_root_full / source_subdir
                    src_file = src_root_full / r
                    dst_file = target_dir / r
                    if a in ("add", "update") and src_file.exists() and dst_file.exists():
                        entry["diff"] = content_diff(src_file, dst_file,
                                                     label_a=f"{source_subdir}/{r}",
                                                     label_b=str(dst_file))
                    elif a == "add" and src_file.exists():
                        entry["diff"] = content_diff(src_file, dst_file,
                                                     label_a=f"{source_subdir}/{r}",
                                                     label_b=str(dst_file))
                    group["changes"].append(entry)
                report["groups"].append(group)
            if json_out:
                print(json.dumps(report, indent=2))
            else:
                for group in report["groups"]:
                    for ch in group["changes"]:
                        print(f"{ch['action']:8} {group['source']}/{ch['rel']}  ({ch['detail']})")
                        if ch.get("diff"):
                            print(ch["diff"])
                            print("---")
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

    def cmd_verify(self, dry_run=False):
        if dry_run:
            print("[dry-run] would verify drift across all sync groups")
            for source_subdir, target_dir in self.groups:
                print(f"  verify {source_subdir} -> {target_dir}")
            return 0
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
    sp.add_argument("--json", action="store_true", help="machine-readable JSON output")
    sp.set_defaults(func=lambda t, a: t.cmd_status(list_items=a.list, diff=a.diff, json_out=a.json))

    sp = sub.add_parser("clean")
    sp.add_argument("--yes", action="store_true")
    sp.set_defaults(func=lambda t, a: t.cmd_clean(yes=a.yes))

    sp = sub.add_parser("verify")
    sp.add_argument("--dry-run", action="store_true", help="show what would be verified without running")
    sp.set_defaults(func=lambda t, a: t.cmd_verify(dry_run=a.dry_run))

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
        return tool.cmd_status(list_items=args.list, diff=args.diff, json_out=args.json)
    if args.cmd == "clean":
        return tool.cmd_clean(yes=args.yes)
    if args.cmd == "verify":
        return tool.cmd_verify(dry_run=args.dry_run)
    if args.cmd == "doctor":
        return tool.cmd_doctor()
    return 2


if __name__ == "__main__":
    sys.exit(main())
