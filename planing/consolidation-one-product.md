# Consolidation: One Product, Two Install Channels

## [Overview]

`mr-opencode` runs two independent configuration paths: `product/` (global sync via `opc-sync`) and `product/templates/vibecoding/` (a copy-paste project template). They drifted: different config schemas (V1 `permission:`/`bash:` vs V2 `permissions:`/`agents.*`), duplicate agent/command/plugin content, and invented plugin formats (`code-reviewer.json`). This plan merges them into one product with two install channels:

1. **Global** — `opc-sync pull` → `~/.config/opencode` + `~/.agents` (shared infra, MCP, provider, cross-project agents).
2. **Project** — new `opc-sync init <dir>` → copy the vibecoding template into a project with placeholder fill-in.

The vibecoding template becomes the single source of truth for workflow content; `product/` keeps only what is genuinely global.

## [Scope]

| Path | Role | Action |
|---|---|---|
| `product/templates/vibecoding/` | Canonical workflow source (V2) | No content change; kept canonical |
| `product/configs/` | Global opencode config | One `opencode.jsonc`; remove `opencode.json` + `global-settings.yaml` |
| `product/agents/` | Global agents only | Keep `codebase-memory*` (V2); delete `code-reviewer.md` (V1, duplicate) |
| `product/commands/` | Was example-only | Delete `review.md` |
| `product/plugins/` | Invented format | Delete `code-reviewer.json` + `README.md` |
| `product/skills/` | Third-party catalog | Keep as-is (external HTTP skills) |
| `product/docs/` | New | Move `presentation.md` + `presentation.html` here |
| `dev/scripts/opc_sync/` | Tool | Add `init` subcommand; drop `commands`/`plugins` sync groups |
| `dev/tests/` | Tests | Add `init` tests |

## [Decisions]

- **Canonical source = vibecoding template.** It is the newer, complete, V2, stack-neutral workflow. `product/` content was explicitly example, so it does not compete.
- **Single config schema = V2** (`permissions:` array, `agents.*` model, `policies`). No V1 `permission:`/`bash:`/`small_model` survives anywhere.
- **Single OpenCode config file.** `product/configs/opencode.json` and `opencode.jsonc` merge into one `opencode.jsonc` (MCP servers + provider + default model + global settings).
- **Global agents = cross-project only.** `codebase-memory-auditor/scout`, `codebase-memory`. `code-reviewer` agent lives only in the template (its own `mro-code-review-checklist` skill).
- **No invented plugin format.** `product/plugins/code-reviewer.json` deleted; real JS plugins (`mro-protect-secrets`, `mro-test-feedback`, `mro-project-tools`) live only in the template.
- **Global vs project split by config semantics.** OpenCode merges global `~/.config/opencode/opencode.jsonc` and project `./opencode.jsonc`. Global carries MCP/provider/model; project carries permissions/policies/compaction/workflow.
- **Presentation files are org collateral, not template content.** Move `presentation.{md,html}` to `product/docs/`.
- **Install via tool, not `cp -r`.** New `opc-sync init <dir>` copies the template, leaves `.opencode/plans|reviews` out, refuses overwrite unless `--force`, prints the 12-placeholder fill-in checklist.

## [Changes]

### 1. `product/configs/opencode.jsonc` (merge + clean)
- Combine `opencode.json` + `opencode.jsonc` into one file: MCP servers (`codebase-memory-mcp`, optional `deepwiki`), provider `9router`, default model, plus global settings.
- Remove `"model": ""`, the singular `"agent"` key, duplicate `code-reviewer` plugin entry, and anything V1-styled.
- Delete `product/configs/opencode.json` and `product/configs/global-settings.yaml`.

### 2. `product/agents/`
- Upgrade `codebase-memory*.md` frontmatter from V1 (`permission:`/`bash:*`) to V2 (`permissions:` array) so the global merge does not reintroduce V1.
- Delete `product/agents/code-reviewer.md` (V1, duplicates template `mro-reviewer`).

### 3. `product/commands/`
- Delete `review.md` (example-only; template has `/mro-run-review`, `/mro-plan-feature`, `/mro-fix-tests`, `/mro-deliver`).
- Remove the `product/commands` group from `sync.py`.

### 4. `product/plugins/`
- Delete `code-reviewer.json` (invented hook format, never a real OpenCode plugin) and `product/plugins/README.md`.
- Remove the `product/plugins` group from `sync.py`.
- Real JS plugins stay only inside `.opencode/plugins/` of the template.

### 5. `product/skills/`
- Leave third-party skills untouched; they are optional HTTP-catalog content. No decision needed.

### 6. `product/templates/vibecoding/` (unchanged content, canonical)
- `opencode.jsonc`, `AGENTS.md`, `.env.example`, `.githooks/`, `.opencode/{agents,commands,plugins,skills}` all stay as-is — this is the canonical workflow.

### 7. `product/docs/` (new)
- Move `product/templates/vibecoding/presentation.md` → `product/docs/presentation.md`.
- Move `product/templates/vibecoding/presentation.html` → `product/docs/presentation.html`.
- Remove them from the template so the template ships only project content.

### 8. `dev/scripts/opc-sync.py` + `opc_sync/` (new `init`)
- `cli.py`: add `cmd_init(source_root, dest_dir, force, dry_run)`:
  - Copy `product/templates/vibecoding/` → dest, excluding `.opencode/plans/`, `.opencode/reviews/`, `.gitignore`, `.env.example` (kept as `.env.example`? kept as placeholder), and anything dot/ignore-specific.
  - Refuse if dest has content unless `--force`.
  - `--dry-run` prints plan without writing.
  - Print the 12-placeholder fill-in checklist at the end.
- `sync.py`: remove `commands`/`plugins` groups; keep `agents/skills/configs/workflows`.
- `dev/tests/test_opc_sync.py`: add tests for `init` (copy completeness, no overwrite, dry-run).

### 9. `README.md` (root)
- Rewrite as one-product narrative: two install channels (`pull` global vs `init` project), layout table, rollout note. Remove example-only command/plugin docs.

### 10. `.gitignore` (root)
- Add `product/templates/vibecoding/.opencode/plans/` and `/reviews/` if not already ignored via the template's own `.gitignore`.

## [Files]

- `product/configs/opencode.jsonc` — merged global config (modified)
- `product/configs/opencode.json` — deleted
- `product/configs/global-settings.yaml` — deleted
- `product/agents/codebase-memory.md` — V2 frontmatter (modified)
- `product/agents/codebase-memory-auditor.md` — V2 frontmatter (modified)
- `product/agents/codebase-memory-scout.md` — V2 frontmatter (modified)
- `product/agents/code-reviewer.md` — deleted
- `product/commands/review.md` — deleted
- `product/plugins/code-reviewer.json` — deleted
- `product/plugins/README.md` — deleted
- `product/docs/presentation.md` — new (moved)
- `product/docs/presentation.html` — new (moved)
- `product/templates/vibecoding/presentation.md` — deleted
- `product/templates/vibecoding/presentation.html` — deleted
- `dev/scripts/opc_sync/cli.py` — `init` subcommand (modified)
- `dev/scripts/opc_sync/sync.py` — drop `commands`/`plugins` groups (modified)
- `dev/tests/test_opc_sync.py` — `init` tests (modified)
- `README.md` — one-product rewrite (modified)

## [Validation]

Run from repo root:

1. `python3 dev/scripts/opc-sync.py verify` — no drift across remaining groups (`agents`, `skills`, `configs`, `workflows`).
2. `python3 dev/scripts/opc-sync.py init /tmp/vibe-demo --dry-run` — lists template files without writing.
3. `python3 dev/scripts/opc-sync.py init /tmp/vibe-demo` — copies template completely; second run without `--force` refuses; `--force` overwrites.
4. `grep -rn "permission:\|bash:\|small_model" product/` — zero matches (V1 fully gone).
5. `grep -rn "code-reviewer.json\|hooks.pre-push\|skills/code-reviewed" product/` — zero matches (invented plugin format gone).
6. `opencode debug config` / `opencode debug agents` / `opencode plugin list` on a copied template — parse cleanly, four agents present, three JS plugins present.
7. `python3 -m pytest dev/tests/` — all pass, including new `init` tests.

## [Open issues]

- OpenCode merge semantics: confirm global `~/.config/opencode/opencode.jsonc` + project `./opencode.jsonc` merge (permissions from project, MCP from global). Verify with `opencode debug config` after implementing `init`.
- `code-reviewer` agent deletion: if any org member relied on the global `code-reviewer.md`, it is gone; replacement is the template's `mro-reviewer` + `mro-code-review-checklist` skill, run per-project.
- `product/skills/` third-party skills: not audited in this plan; pruning them is out of scope.
- `product/docs/` needs a short index file explaining what the docs folder holds.

## [Status: Implemented]

All phases applied on 2026-11-18. Summary of the actual result:

### Done
- Deleted `product/agents/code-reviewer.md`, `product/commands/review.md` (+ dir),
  `product/plugins/{code-reviewer.json,README.md}` (+ dir),
  `product/configs/global-settings.yaml`.
- Merged `product/configs/opencode.json` into `opencode.jsonc` in V2 shape:
  `agents` (not `agent`), `mcp.servers`, `providers`, no `model: ""`, no duplicate
  plugin entry. Deleted the old `opencode.json`.
- Upgraded `product/agents/codebase-memory{,-auditor,-scout}.md` from V1
  `permission:`/`bash:` to V2 `permissions:` arrays.
- Moved `presentation.md` / `presentation.html` to `product/docs/` and added
  `product/docs/README.md`.
- Added `opc-sync init <dir>` (`sync.py:cmd_init`, `cli.py` subparser):
  copies the template, skips `.opencode/plans|reviews`, supports `--force` and
  `--dry-run`, prints the 12-placeholder checklist, and uses the local checkout
  when run inside the repo so it never blocks on a network clone.
- Removed the `commands` and `plugins` groups from `sync.py` (now 4 groups:
  `agents`, `skills`, `workflows`, `configs`).
- Updated `dev/tests/test_opc_sync.py`: group count 6 -> 4, added
  `TestCmdInit` (copy + scratch skip, non-empty refusal, dry-run).
- Rewrote root `README.md` as "one product, two install channels".

### Validation results
- `python3 dev/tests/test_opc_sync.py` -> **10 tests OK**.
- Controlled `pull` + `verify` on temp targets (`--repo . --target /tmp/opc-t
  --agents-target /tmp/opc-a`) -> **no drift**; synced 3 agents, 79 skills,
  1 workflow README, 1 config; no commands/plugins synced globally.
- `opc-sync init /tmp/vibe-demo` -> **21 files** copied, plans/reviews skipped.
- `init` on a non-empty destination -> refused (rc=1); `--dry-run` -> no write.
- `grep` for `code-reviewer.json|hooks.pre-push|skills/code-reviewed` -> none.
- V1 tokens (`permission:`, `bash:`, `small_model`) now appear only in
  documentation that explains they are deprecated; no live config uses them.
- Template `opencode.jsonc` and global `opencode.jsonc` both parse as valid
  JSONC against the real schema key set.

### Deviations / notes
- `product/configs/opencode.json` was merged by hand, not auto-generated; the
  `9router` provider block and `mcp` servers were preserved.
- `opencode debug config` could not be run in this environment: the managed
  OpenCode service port (49374) was already in use by a running process. Config
  correctness was checked by JSONC parsing plus schema-key inspection instead.
  Run `opencode debug config` and `opencode debug agents` once on a machine with
  a free service port to confirm end-to-end.
- `.gitignore` was left unchanged: the template contains no `plans/` or
  `reviews/` directories, and the copied project gets the template's own
  `.gitignore` via `init`.

## [Status: Flattened, init removed]

Later on 2026-11-18 the layout changed again. This section supersedes the
`init` and `product/templates/vibecoding/` statements above.

### Done
- Flattened `product/templates/vibecoding/` into the root of `product/`:
  `AGENTS.md`, `opencode.jsonc`, `README.md`, `.env.example`, `.gitignore`,
  `.githooks/`, `.opencode/{agents,commands,plugins,skills}`. The
  `product/templates/` tree no longer exists.
- Chose the flat layout without a `global/` subfolder: the global sync dirs
  (`product/agents/`, `product/configs/`, `product/skills/`,
  `product/workflows/`) and `product/docs/` stay at the `product/` root
  alongside the project template.
- Removed the `init` command entirely: `SyncTool.cmd_init` deleted from
  `dev/scripts/opc_sync/sync.py`, the `init` subparser and dispatch branch
  deleted from `dev/scripts/opc_sync/cli.py`, and `TestCmdInit` deleted from
  `dev/tests/test_opc_sync.py`. `pull` is now the only install command; project
  install is a documented manual copy.
- Added a "Repository maintenance note" to the repo-root `AGENTS.md`: it states
  that `product/AGENTS.md` is a shipped template artifact, its `<...>`
  placeholders are intentional and must be ignored while maintaining this repo,
  and `product/.opencode/` is downstream template content, not active config.
- Updated root `README.md`: removed `init` from the commands table and project
  install, documented the manual `cp` command with an explicit list of files to
  copy and the global dirs to skip, and rewrote the Catalog / Repo layout
  sections for the flattened `product/`.

### Validation results
- `python3 dev/tests/test_opc_sync.py` -> **7 tests OK** (the 3 `init` tests
  were removed with the command).
- `grep` for `cmd_init|TestCmdInit|add_parser("init")|templates/vibecoding` in
  `dev/` and `README.md` -> none.
- `find product -type d -name templates` -> empty.
- Controlled `pull` + `verify` (`--repo . --target /tmp/opc-t --agents-target
  /tmp/opc-a`) -> **no drift**; global targets contain only `agents/` +
  `opencode.jsonc` and `skills/` + `workflows/`, so no project-layer content
  (`.opencode/`, `AGENTS.md`) leaked into the global sync.
- `opc-sync --help` -> subcommands are `{pull,status,clean,verify,doctor}`.
