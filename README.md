# mr-opencode

One product, two channels, for OpenCode configuration shared across the
organization. Everything is driven by a zero-dependency Python tool (stdlib only).

- **Global** (`opc-sync pull`) installs shared infrastructure into
  `~/.config/opencode` and `~/.agents` on a developer machine.
- **Project** installs the vibecoding workflow template by copying it from the
  folders under `product/` into a repository (see
  [Project install](#project-install)).

The project template is the single source of truth for the Architect →
Implementer → Reviewer workflow. Its project-layer files live in the
folders under `product/agents/`, `product/commands/`, `product/plugins/`, and
`product/skills/`, plus `product/AGENTS.md` and `product/configs/opencode.jsonc`.
Those `product/` directories also feed the global `opc-sync` payload, and
`product/docs/` holds org collateral.

## Usage (developers)

Global install:

```bash
python3 <(curl -fsSL https://raw.githubusercontent.com/MostafaRastegar/mr-opencode/main/dev/scripts/opc-sync.py) --repo git@github.com:MostafaRastegar/mr-opencode.git pull
```

Or clone and run:

```bash
git clone git@github.com:MostafaRastegar/mr-opencode.git ~/opencode-config
cd ~/opencode-config
python3 dev/scripts/opc-sync.py --repo . pull
python3 dev/scripts/opc-sync.py --repo . verify
python3 dev/scripts/opc-sync.py doctor
```

`--repo .` uses the checkout you are standing in. Without it the tool takes the
default remote URL, refreshes `~/.cache/opc-sync` over the network, and only then
falls back to the local checkout when the current directory contains `product/`
— the same result, one network round-trip slower.

## Project install

The project template's project-layer files live under
`product/`: `product/agents/`, `product/commands/`,
`product/plugins/`, `product/skills/`, plus `product/AGENTS.md` and
`product/configs/opencode.jsonc`. Assemble them into the target project's
OpenCode layout:

```bash
cd /path/to/mr-opencode
mkdir -p /path/to/new-project/.opencode/{agents,commands,plugins,skills,scripts}
cp    product/agents/mro-*.md        /path/to/new-project/.opencode/agents/
cp -r product/commands/. /path/to/new-project/.opencode/commands/
cp -r product/plugins/.  /path/to/new-project/.opencode/plugins/
cp -r product/skills/.   /path/to/new-project/.opencode/skills/
cp -r product/scripts/.  /path/to/new-project/.opencode/scripts/
cp    product/configs/opencode.jsonc /path/to/new-project/opencode.jsonc
cp -r product/AGENTS.md product/.githooks product/.env.example \
      product/.gitignore /path/to/new-project/
cd /path/to/new-project
git init
git config core.hooksPath .githooks   # enables the pre-commit secret scan
```

`.opencode/scripts/` is required: `mro-doctor.mjs` and `mro-model-check.mjs`
are the hard preflight every workflow runs (see the Install section of
`product/README.md`).

Do **not** copy `product/agents/codebase-memory*.md` (global agents),
`product/workflows/`, `product/tests/`, `product/docs/`, or `planing/` — those
are global agents, shared workflows, template self-tests, and org/internal
collateral, not part of a project. Then fill in the Project Profile placeholders
(`<STACK>`, `<TEST_CMD>`, `<MODEL_ID>`, …) in `AGENTS.md` and
`opencode.jsonc`.

## Commands

| command | purpose |
|---------|---------|
| `pull` | Clone/update the repo and sync `agents/`, `commands/`, `plugins/`, and `configs/` into `~/.config/opencode`, plus `skills/` and `workflows/` into `~/.agents`. Backs up targets before writing, then writes the manifest each target keeps. |
| `status` | Show source/target file counts (`--list` lists source files; `--diff` shows pending add/update/delete/conflict per group with content diffs; `--diff --json` emits machine-readable JSON). |
| `clean` | Delete target files that no longer exist in the source. Use `--yes` to skip confirmation. |
| `verify` | Read-only check that all synced targets match the source with no drift; exits non-zero if drift is found. `--dry-run` only prints the groups it would check. |
| `doctor` | Print environment info (python, git, MCP binaries, target paths, write access) for troubleshooting. |

## Global options

| option | default | purpose |
|--------|---------|---------|
| `--repo` | `git@github.com:MostafaRastegar/mr-opencode.git` | Git repo URL (or local path) to clone/pull as the config source. |
| `--target` | `~/.config/opencode` | Target directory for OpenCode-specific configs (`configs/`). |
| `--agents-target` | `~/.agents` | Target directory for shared, harness-agnostic skills/workflows. |
| `--staging` | `~/.cache/opc-sync` | Local staging clone used when `--repo` is a remote URL. |
| `--force` | off | Overwrite local conflicts instead of reporting them. |
| `--dry-run` | off | Show what would change without writing anything. |
| `--verbose` | off | Print per-file add/update/skip/conflict details. |

## Environment variable substitution

Values in `${VAR}` or `$VAR` form inside synced config files (`.json` / `.jsonc`) are replaced with the matching environment variable before writing. If the variable is unset, the placeholder is left unchanged. This lets each developer inject their own API keys / endpoints without editing shared files.

Example:

```bash
export ROUTER_API_KEY="sk-123..."
python3 dev/scripts/opc-sync.py pull
```

## Pre-push verification hook

A zero-dependency git `pre-push` hook runs `dev/tests/test_opc_sync.py` and `opc-sync.py --repo . verify` on every `git push`, blocking the push if tests fail or config drift is detected. Install once after cloning:

```bash
python3 dev/scripts/install-git-hooks.py
```

The hook is sourced from `dev/scripts/git-hooks/pre-push` and copied into `.git/hooks/`. No npm / node_modules required, stdlib Python only.

The hook runs from the repository root with the default targets, so `verify`
fails while `~/.config/opencode` and `~/.agents` are behind the source. Sync
first with `python3 dev/scripts/opc-sync.py --repo . pull`. A `conflict` line
means your local file differs from the source: merge it by hand, or pass
`--force` to overwrite it — `pull` takes a timestamped backup of every target
first, so the previous content is always recoverable.

## HTTP skill catalogs

`pull` also downloads skills listed under `skills` in the sync source config
(`configs/opencode.jsonc`, or `product/configs/opencode.jsonc` in this repo's
`product/` layout) from HTTP catalog URLs. Each catalog's `index.json` describes
skill `id`, `version`, and `files` (with `dest` and `url`). Files are written to
`~/.agents/skills/<id>/`, and a `VERSION` marker is created when a version is
provided.

Example:

```jsonc
{
  "skills": ["https://example.com/opencode/skills/"]
}
```

Bump `version` in the catalog's `index.json` to refresh. For git-only skills, use a submodule under `skills/<id>/`.

## CI-friendly output

`status --diff --json` emits machine-readable JSON listing every pending change per group (add/update/delete/conflict) with unified-content diffs, suitable for CI pipelines.

## Catalog

Global groups synced by `pull` (six groups, defined in `opc_sync/sync.py`):

- Agents: `product/agents/` -> `~/.config/opencode/agents` (opencode-specific)
- Skills: `product/skills/` -> `~/.agents/skills`
- Workflows: `product/workflows/` -> `~/.agents/workflows` (shared, harness-agnostic)
- Configs: `product/configs/` -> `~/.config/opencode` (opencode-specific)
- Commands: `product/commands/` -> `~/.config/opencode/commands` (opencode-specific)
- Plugins: `product/plugins/` -> `~/.config/opencode/plugins` (opencode-specific)

`pull` syncs everything under those folders; it does not skip the project
template. Only a top-level `core/` folder is excluded (a leftover guard: no such
folder exists today). A project gets the same files by copying them by hand, so
`pull` and a project install stay in step.

Project template (copied manually, see [Project install](#project-install)):

- `product/AGENTS.md`, `product/configs/opencode.jsonc`, `.gitignore`,
  `.env.example`, `.githooks/`
- `product/agents/` — orchestrator, architect, implementer, reviewer, test-runner, bootstrap
  (the `codebase-memory*` agents in the same folder are global, not project files)
- `product/commands/` — mro-orchestrate, mro-plan-feature, mro-run-review, mro-fix-tests, mro-debug, mro-deliver, mro-status, mro-bootstrap
- `product/plugins/` — mro-protect-secrets, mro-test-feedback, mro-project-tools (JS), mro-redact (TS)
- `product/skills/` — mro-project-stack, mro-data-model, mro-behavior-docs, mro-code-review-checklist
- `product/scripts/` — mro-doctor, mro-model-check (the workflow's hard preflight)

The workflow commands assume the per-project plan/review layout, so they are
only useful inside a project even though `pull` installs them globally.

### `~/.agents` (cross-platform, shared)

`~/.agents` holds shared, harness-agnostic content (skills, workflows) so
it works no matter which harness you use (OpenCode, CLI, IDE, etc.).
Settings specific to OpenCode live in `~/.config/opencode` and are **not** put
into `~/.agents`.

On Windows `~/.agents` resolves to `%USERPROFILE%\.agents`.

## Repo layout

- `product/` — the product:
  - project template: `AGENTS.md`, `README.md`, `REVIEW_POLICY.md`,
    `.env.example`, `.gitignore`, `.githooks/`, `configs/opencode.jsonc`, and the
    folders under `agents/`, `commands/`, `plugins/`, `skills/`, and `scripts/`
  - `product/agents/` -> `~/.config/opencode/agents` (the `mro-*` files are the
    project template; `codebase-memory*` are global agents)
  - `product/skills/` -> `~/.agents/skills` (the `mro-*` project skills, shared
    globally so every harness sees them)
  - `product/workflows/` -> `~/.agents/workflows`
  - `product/configs/` -> `~/.config/opencode` (global `opencode.jsonc`; the same
    file is the project template config)
  - `product/commands/` -> `~/.config/opencode/commands`
  - `product/plugins/` -> `~/.config/opencode/plugins`
  - `product/tests/` — self-tests for the template's own tools (`node --test`)
  - `product/docs/` — org collateral (e.g. the board presentation)
- `dev/` — development tooling for this repo itself:
  - `dev/scripts/opc_sync/` — the sync tool (split into modules)
  - `dev/scripts/opc-sync.py` — backward-compatible shim
  - `dev/scripts/setup-opencode.sh` / `.ps1` — installer scripts
  - `dev/scripts/git-hooks/` + `dev/scripts/install-git-hooks.py` — pre-push hook
  - `dev/tests/` — unit tests for the sync tool
- `planing/` — internal planning notes for this repository (not shipped)

## Optional tooling

`product/configs/opencode.jsonc` ships with **no** `mcp` block: the template is
deliberately MCP-free to keep context small (see `product/README.md`).
`opc-sync doctor` reports whether the optional helpers it knows about are on
`PATH`:

- **codebase-memory-mcp** — `pip install codebase-memory-mcp` (or download binary)
- **codegraph** — `cargo install codegraph` (or prebuilt binary)

A missing binary only turns that `doctor` line into `MISSING`; nothing in the
workflow depends on it. Run `python3 dev/scripts/opc-sync.py doctor` to check.

## Contributing

1. Edit files, open a PR.
2. The pre-push hook runs `dev/tests/test_opc_sync.py` and
   `python3 dev/scripts/opc-sync.py --repo . verify`; a failing test or config
   drift blocks the push.
3. Developers pull updates.

## Rollout

Pilot with 2-3 developers, then org-wide. Back up `~/.config/opencode/` before first pull.


