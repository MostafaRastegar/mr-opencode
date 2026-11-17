# Implementation Plan

## [Overview]
Transform mr-opencode into central OpenCode config repo synced via zero-dependency Python stdlib tool (dev/scripts/opc-sync.py) for ~150 developers. No pip packages required. Cross-platform (Linux/macOS/Windows).

## [Current State]
- opc-sync.py syncs product/agents/, product/skills/, product/commands/ -> ~/.agents and product/configs/ -> ~/.config/opencode
- Multi-target groups, backup before pull, manifest tracking
- ~150 developers targeted
- dev/dev/tests/ directory exists with unit tests

## [Prioritized Feature Roadmap]

### P0 — Safety & Correctness (do first)
1. Unit tests for opc-sync.py (dev/tests/test_opc_sync.py)
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
9. Git pre-push hook (`dev/scripts/git-hooks/pre-push`) runs `dev/tests/test_opc_sync.py` and `opc-sync.py verify` on every `git push`; install once via `python3 dev/scripts/install-git-hooks.py` (no npm required)
10. dry-run flag for verify

## [Files]
- dev/scripts/opc-sync.py (modified)
- dev/scripts/setup-opencode.sh (modified)
- dev/scripts/setup-opencode.ps1 (modified)
- dev/scripts/git-hooks/pre-push (new)
- dev/scripts/install-git-hooks.py (new)
- dev/tests/test_opc_sync.py (new)
- README.md (modified)
- implementation_plan.md (modified)

## [Dependencies]
Python 3.8+ stdlib, git
