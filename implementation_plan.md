# Implementation Plan

## [Overview]
Transform mr-opencode into central OpenCode config repo synced via zero-dependency Python stdlib tool (scripts/opc-sync.py) for ~150 developers. No pip packages required. Cross-platform (Linux/macOS/Windows).

## [Current State]
- opc-sync.py syncs agents/, skills/, commands/ -> ~/.agents and configs/ -> ~/.config/opencode
- Multi-target groups, backup before pull, manifest tracking
- ~150 developers targeted
- tests/ directory exists but is empty

## [Prioritized Feature Roadmap]

### P0 — Safety & Correctness (do first)
1. Unit tests for opc-sync.py (tests/test_opc_sync.py)
2. Validate JSON/YAML before writing in pull (reject corrupt configs)
3. Atomic write / rollback on failure during pull

### P1 — Organizational Needs
4. Environment variable substitution in synced config files (${VAR})
5. Local user overrides (local.jsonc not managed by sync, preserved across pulls)

### P2 — Developer Experience
6. Enhanced status --diff (show content diffs, not just filenames)
7. HTTP skill catalog download support
8. status --json for CI integration

### P3 — CI / Automation
9. Git pre-push hook (`scripts/git-hooks/pre-push`) runs `tests/test_opc_sync.py` and `opc-sync.py verify` on every `git push`; install once via `python3 scripts/install-git-hooks.py` (no npm required)
10. dry-run flag for verify

## [Files]
- scripts/opc-sync.py (modified)
- scripts/setup-opencode.sh (modified)
- scripts/setup-opencode.ps1 (modified)
- scripts/git-hooks/pre-push (new)
- scripts/install-git-hooks.py (new)
- tests/test_opc_sync.py (new)
- README.md (modified)
- implementation_plan.md (modified)

## [Dependencies]
Python 3.8+ stdlib, git
