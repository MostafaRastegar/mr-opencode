"""Core SyncTool class for opc-sync (stdlib only)."""

import datetime
import hashlib
import json
import shutil
import sys
from pathlib import Path

from .catalog import fetch_skill_catalogs
from .config import deep_merge, strip_jsonc_comments, substitute_env
from .fs import atomic_write_text, collect_files, content_diff, file_hash
from .git import ensure_clone

# Project-template folders that must never be part of the global sync payload.
# They are copied into a project by hand (see README "Project install").
SYNC_EXCLUDE_TOP = ("core",)


class SyncTool:
    def __init__(self, repo_url, target, agents_target, staging,
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
        # product/agents is opencode-specific -> ~/.config/opencode/agents.
        # product/skills and product/workflows are harness-agnostic -> ~/.agents.
        # product/configs is opencode-specific -> ~/.config/opencode.
        # Project-layer workflow content lives in the core/ folders under
        # product/{agents,commands,plugins,skills} plus product/AGENTS.md
        # (copied manually per project). core/ is excluded from the global sync
        # via SYNC_EXCLUDE_TOP.
        self.groups = [
            ("product/agents", self.target / "agents"),
            ("product/skills", self.agents_target / "skills"),
            ("product/workflows", self.agents_target / "workflows"),
            ("product/configs", self.target),
            # OpenCode-specific project-layer commands/plugins synced globally.
            ("product/commands", self.target / "commands"),
            ("product/plugins", self.target / "plugins"),
        ]

    def log(self, msg):
        if self.verbose or self.dry_run:
            print(msg)

    def ensure_clone(self):
        self._local_source = ensure_clone(self.staging, self.repo_url)
        # When repo_url is a remote URL, _local_source is the staging clone.
        # If staging uses flat layout but the local repo (cwd) uses product/
        # layout, prefer the local repo as the source so plugins/configs sync
        # correctly without requiring --repo.
        if self._local_source == self.staging.resolve():
            local_repo = Path.cwd().resolve()
            if (local_repo / "product").is_dir():
                self._local_source = local_repo
        return self._local_source is not None

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
            # Support both `product/<name>` (upstream layout) and flat
            # `<name>` (some staging/checkouts) layouts.
            if not src_root.exists():
                flat = self.staging / source_subdir.rsplit("/", 1)[-1]
                if flat.exists():
                    src_root = flat
        src_files = (collect_files(src_root, exclude_top=SYNC_EXCLUDE_TOP)
                     if src_root.exists() else set())
        tgt_files = collect_files(target_dir, exclude_top=SYNC_EXCLUDE_TOP)
        manifest = target_dir / '.opc-manifest'
        tracked = set()
        if manifest.exists():
            tracked = set(x.strip() for x in manifest.read_text().splitlines() if x.strip())
        changes = []
        for rel in sorted(src_files):
            if rel not in tgt_files:
                changes.append(("add", rel, "new from source"))
            else:
                # For JSON/JSONC, normalize both sides (strip comments/env) before
                # hashing so the written (canonical) target matches the source hash.
                if rel.endswith((".json", ".jsonc")):
                    sh = self._json_hash(src_root / rel)
                    th = self._json_hash(target_dir / rel)
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

    def _json_hash(self, path):
        """Return SHA-256 hex digest of canonical JSON/JSONC (comments/env stripped)."""
        h = hashlib.sha256()
        h.update(self._json_normalized(path))
        return h.hexdigest()

    def _json_normalized(self, path):
        """Return canonical bytes of a JSON/JSONC file (comments/env stripped)."""
        text = path.read_text(encoding="utf-8")
        text = strip_jsonc_comments(text)
        text = substitute_env(text)
        try:
            obj = json.loads(text)
            text = json.dumps(obj, indent=2) + "\n"
        except Exception:
            pass
        return text.encode("utf-8")

    def _write_json_file(self, src, dst):
        """Write a JSON/JSONC file with env substitution and comment stripping.

        The target is written as the canonical source so `verify` reports no
        drift after a pull. Local additions are preserved via target backups
        taken before each pull.
        """
        src_text = substitute_env(strip_jsonc_comments(src.read_text()))
        json.loads(src_text)  # validate source JSON
        atomic_write_text(dst, src_text)

    def _write_text_file(self, src, dst):
        atomic_write_text(dst, src.read_text(encoding="utf-8"))

    def apply_changes(self, changes, source_subdir="", target_dir=None):
        target_dir = target_dir or self.target
        src_root = self._local_source or self.staging
        if source_subdir:
            src_root = src_root / source_subdir
            if not src_root.exists():
                flat = self.staging / source_subdir.rsplit("/", 1)[-1]
                if flat.exists():
                    src_root = flat
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
                            self._write_json_file(src, dst)
                        except Exception as e:
                            self.errors.append(f"{rel}: invalid JSON source ({e}); skipped")
                            continue
                    else:
                        self._write_text_file(src, dst)
                added += 1
            elif action == "update":
                if self.dry_run:
                    self.log(f"[dry-run] update {rel}")
                else:
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    if rel.endswith((".json", ".jsonc")):
                        try:
                            self._write_json_file(src, dst)
                        except Exception as e:
                            self.errors.append(f"{rel}: invalid JSON source ({e}); skipped")
                            continue
                    else:
                        self._write_text_file(src, dst)
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
                files = (sorted(collect_files(src_root, exclude_top=SYNC_EXCLUDE_TOP))
                         if src_root.exists() else [])
                manifest = target_dir / '.opc-manifest'
                atomic_write_text(manifest, "\n".join(files) + "\n")
        if not self.dry_run:
            fetch_skill_catalogs(self._local_source or self.staging,
                                 self.agents_target, self.dry_run)
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
                  f"{len(collect_files(target_dir, exclude_top=SYNC_EXCLUDE_TOP))}")
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
        from .git import run_git
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
