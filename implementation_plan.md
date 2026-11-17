# Implementation Plan

## [Overview]

Complete the remaining opc-sync roadmap items and align `implementation_plan.md` with the actual codebase structure (the `opc_sync/` package, not a single `opc-sync.py` file). The plan covers: JSON/YAML validation before write, local user overrides, rollout documentation, README/documentation alignment, and test coverage expansion.

## [Current State]

- `dev/scripts/opc-sync.py` — backward-compatible shim → imports `opc_sync` package
- `dev/scripts/opc_sync/{__init__,cli,sync,config,fs,git,catalog}.py` — real implementation
- `dev/tests/test_opc_sync.py` — 7 unit tests passing
- `dev/scripts/git-hooks/pre-push` — runs tests + `verify` on every push (installed at `.git/hooks/`)
- `product/{agents,skills,commands,plugins,workflows,configs}/` — source config to sync
- `implementation_plan.md` — **outdated**: references single-file `opc-sync.py`, not the `opc_sync/` package

## [Types]

No new type system changes needed. Existing types:

- `SyncTool` class (dev/scripts/opc_sync/sync.py:16)
- `deep_merge(base, local) -> dict` (dev/scripts/opc_sync/config.py:25)
- `strip_jsonc_comments(text) -> str` (dev/scripts/opc_sync/config.py:8)
- `substitute_env(text) -> str` (dev/scripts/opc_sync/config.py:42)
- `file_hash(p) -> str` (dev/scripts/opc_sync/fs.py:8)
- `collect_files(root) -> set[str]` (dev/scripts/opc_sync/fs.py:17)
- `atomic_write_text(path, content)` (dev/scripts/opc_sync/fs.py:33)
- `content_diff(src_path, dst_path, label_a, label_b) -> str` (dev/scripts/opc_sync/fs.py:42)
- `ensure_clone(staging, repo_url) -> Path|None` (dev/scripts/opc_sync/git.py:18)
- `fetch_skill_catalogs(src_root, agents_target, dry_run) -> int` (dev/scripts/opc_sync/catalog.py:12)

## [Files]

### New files

- `dev/tests/test_opc_sync_validation.py` — unit tests for JSON/YAML validation before write
- `dev/tests/test_opc_sync_overrides.py` — unit tests for local user override preservation
- `dev/tests/test_opc_sync_cli.py` — CLI-level integration tests (subprocess-based)
- `docs/rollout.md` — rollout documentation for org-wide deployment (~150 developers)

### Modified files

- `dev/scripts/opc_sync/sync.py` — add JSON/YAML validation before write; add local override preservation; add rollback on write failure
- `dev/scripts/opc_sync/config.py` — add `validate_json(text) -> bool` and `validate_yaml(text) -> bool` helpers
- `dev/tests/test_opc_sync.py` — extend with validation and override test cases
- `README.md` — align with current `opc_sync/` package structure and agent path changes
- `implementation_plan.md` — this document (updated to reflect actual codebase)

### Deleted files

- None

### Configuration updates

- None needed

## [Functions]

### New functions

- `validate_json(text) -> bool` — `dev/scripts/opc_sync/config.py` — validate JSON/JSONC text is parseable
- `validate_yaml(text) -> bool` — `dev/scripts/opc_sync/config.py` — validate YAML text is parseable (if PyYAML available, else basic check)
- `SyncTool._validate_before_write(src, dst) -> bool` — `dev/scripts/opc_sync/sync.py` — validate source file before writing to target
- `SyncTool._preserve_local_overrides(src, dst)` — `dev/scripts/opc_sync/sync.py` — preserve target-side keys not in source for JSON config files
- `SyncTool._rollback_write(dst, backup_path)` — `dev/scripts/opc_sync/sync.py` — restore from backup on write failure

### Modified functions

- `SyncTool._write_json_file(self, src, dst)` — `dev/scripts/opc_sync/sync.py` — add validation before write, local override preservation, rollback on failure
- `SyncTool.cmd_pull` — `dev/scripts/opc_sync/sync.py` — call validation before writing each file; abort on corrupt config
- `SyncTool.cmd_verify` — `dev/scripts/opc_sync/sync.py` — ensure local override files are not flagged as drift

### Removed functions

- None

## [Classes]

No class changes needed.

## [Dependencies]

No new dependencies. Stdlib-only remains. Optional: PyYAML for YAML validation (graceful fallback if not installed).

## [Testing]

- Existing `dev/tests/test_opc_sync.py` — 7 tests passing; extend with validation + override cases
- New `dev/tests/test_opc_sync_validation.py` — test `validate_json`, `validate_yaml`, `_validate_before_write`
- New `dev/tests/test_opc_sync_overrides.py` — test local override preservation across pulls
- New `dev/tests/test_opc_sync_cli.py` — subprocess CLI integration tests for `pull`, `verify`, `status`
- Pre-push hook (`dev/scripts/git-hooks/pre-push`) continues to run `dev/tests/test_opc_sync.py` + `verify` on every push
- Validate end-to-end: `python3 dev/scripts/opc-sync.py pull --force` → `verify` exits 0 → `tests` pass

## [Implementation Order]

1. Add `validate_json` / `validate_yaml` helpers to `dev/scripts/opc_sync/config.py`
2. Update `_write_json_file` in `dev/scripts/opc_sync/sync.py` to validate before write, preserve local overrides, rollback on failure
3. Update `cmd_pull` / `cmd_verify` in sync.py to respect local override files
4. Write unit tests: `test_opc_sync_validation.py`, `test_opc_sync_overrides.py`
5. Write CLI integration tests: `test_opc_sync_cli.py`
6. Run full test suite; fix any failures
7. Write `docs/rollout.md`
8. Update `README.md` and `implementation_plan.md` to reflect final state
9. Run pre-push hook checks (tests + verify) before pushing
10. Push changes to remote

## [Validation Criteria]

- `python3 dev/tests/test_opc_sync.py -v` → 7+ tests OK
- `python3 dev/scripts/opc-sync.py verify` → `OK: no drift`, exit 0
- `python3 dev/scripts/opc-sync.py --force pull` → exit 0, conflicts=0
- Corrupt JSON in source → `pull` aborts with error, target untouched
- Local override keys preserved across pulls
- Pre-push hook installed at `.git/hooks/pre-push` with correct `dev/` paths
- All changes committed and pushed to `origin/main`
