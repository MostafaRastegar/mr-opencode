# Implementation Plan

## [Overview]
Transform mr-opencode into central OpenCode config repo synced via zero-dependency Python stdlib tool (scripts/opc-sync.py) for ~150 developers. No pip packages required.

## [Types]
Config dict; file sets set[str]; hash map dict[str,str]; change records (action, path, detail).

## [Files]
- scripts/opc-sync.py (new) - CLI: pull/status/clean/verify/doctor
- scripts/setup-opencode.sh (modified)
- .github/workflows/verify.yml (modified)
- README.md (modified)
- tests/test_opc_sync.py (new)
- sample content already present

## [Functions]
main, cmd_pull, cmd_status, cmd_clean, cmd_verify, cmd_doctor, run_git, ensure_clone, file_hash, collect_files, diff_sets, backup_target, apply_changes.

## [Classes]
SyncTool

## [Dependencies]
Python 3.8+ stdlib, git.

## [Testing]
unittest for hashing/diff; manual smoke; CI verify.

## [Implementation Order]
1. Write opc-sync.py
2. Update bootstrap/CI/README
3. Add tests
4. Validate
