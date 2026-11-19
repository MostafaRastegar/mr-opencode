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
The non-`core` parts of those `product/` directories also feed the global
`opc-sync` payload, and `product/docs/` holds org collateral.

## Usage (developers)

Global install:

```bash
python3 <(curl -fsSL https://raw.githubusercontent.com/MostafaRastegar/mr-opencode/main/dev/scripts/opc-sync.py) --repo git@github.com:MostafaRastegar/mr-opencode.git pull
```

Or clone and run:

```bash
git clone git@github.com:MostafaRastegar/mr-opencode.git ~/opencode-config
cd ~/opencode-config
python3 dev/scripts/opc-sync.py pull
python3 dev/scripts/opc-sync.py verify
python3 dev/scripts/opc-sync.py doctor
```

## Project install

The project template's project-layer files live under
`product/`: `product/agents/`, `product/commands/`,
`product/plugins/`, `product/skills/`, plus `product/AGENTS.md` and
`product/configs/opencode.jsonc`. Assemble them into the target project's
OpenCode layout:

```bash
cd /path/to/mr-opencode
mkdir -p /path/to/new-project/.opencode/{agents,commands,plugins,skills}
cp -r product/agents/.   /path/to/new-project/.opencode/agents/
cp -r product/commands/. /path/to/new-project/.opencode/commands/
cp -r product/plugins/.  /path/to/new-project/.opencode/plugins/
cp -r product/skills/.   /path/to/new-project/.opencode/skills/
cp    product/configs/opencode.jsonc /path/to/new-project/opencode.jsonc
cp -r product/AGENTS.md product/.githooks product/.env.example \
      product/.gitignore /path/to/new-project/
cd /path/to/new-project
git init
git config core.hooksPath .githooks   # enables the pre-commit secret scan
```

Do **not** copy the non-project parts of `product/agents/` (the global
`codebase-memory*` agents), `product/skills/` (third-party catalog),
`product/workflows/`, or `product/docs/` — those are the global sync payload and
org collateral, not part of a project. Then fill in the Project Profile
placeholders (`<STACK>`, `<TEST_CMD>`, `<MODEL_ID>`, …) in `AGENTS.md` and
`opencode.jsonc`.

## Commands

| command | purpose |
|---------|---------|
| `pull` | Clone/update the repo and sync `agents/` to `~/.config/opencode/agents`, `skills/` and `workflows/` to `~/.agents`, and `configs/` to `~/.config/opencode`. Backs up targets before writing. |
| `status` | Show source/target file counts (`--list` lists source files; `--diff` shows pending add/update/delete/conflict per group with content diffs; `--json` emits machine-readable JSON). |
| `clean` | Delete target files that no longer exist in the source. Use `--yes` to skip confirmation. |
| `verify` | Read-only check that all synced targets match the source with no drift; exits non-zero if drift is found. |
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

A zero-dependency git `pre-push` hook runs `dev/tests/test_opc_sync.py` and `opc-sync.py verify` on every `git push`, blocking the push if tests fail or config drift is detected. Install once after cloning:

```bash
python3 dev/scripts/install-git-hooks.py
```

The hook is sourced from `dev/scripts/git-hooks/pre-push` and copied into `.git/hooks/`. No npm / node_modules required, stdlib Python only.

## HTTP skill catalogs

`pull` also downloads skills listed under `skills` in `configs/opencode.jsonc` from HTTP catalog URLs. Each catalog's `index.json` describes skill `id`, `version`, and `files` (with `dest` and `url`). Files are written to `~/.agents/skills/<id>/`, and a `VERSION` marker is created when a version is provided.

Example `configs/opencode.jsonc`:

```jsonc
{
  "skills": ["https://example.com/opencode/skills/"]
}
```

Bump `version` in the catalog's `index.json` to refresh. For git-only skills, use a submodule under `skills/<id>/`.

## CI-friendly output

`status --diff --json` emits machine-readable JSON listing every pending change per group (add/update/delete/conflict) with unified-content diffs, suitable for CI pipelines.

## Catalog

Global groups synced by `pull`:

- Agents: `product/agents/` -> `~/.config/opencode/agents` (opencode-specific)
- Skills: `product/skills/` -> `~/.agents/skills`
- Workflows: `product/workflows/` -> `~/.agents/workflows` (shared, harness-agnostic)
- Configs: `product/configs/` -> `~/.config/opencode` (opencode-specific)

The folders inside `product/agents/` and `product/skills/` are the
project template and are skipped by `pull`; they are never written to the global
targets.

Project template (copied manually, see [Project install](#project-install)):

- `product/AGENTS.md`, `product/configs/opencode.jsonc`, `.gitignore`,
  `.env.example`, `.githooks/`
- `product/agents/` — architect, implementer, reviewer, test-runner
- `product/commands/` — mro-plan-feature, mro-run-review, mro-fix-tests, mro-deliver
- `product/plugins/` — mro-protect-secrets, mro-test-feedback, mro-project-tools (JS)
- `product/skills/` — mro-project-stack, mro-data-model, mro-behavior-docs, mro-code-review-checklist

Workflow commands and plugins intentionally live only in the project template,
not in the global sync: they assume the per-project plan/review layout.

### `~/.agents` (cross-platform, shared)

`~/.agents` holds shared, harness-agnostic content (skills, workflows) so
it works no matter which harness you use (OpenCode, CLI, IDE, etc.).
Settings specific to OpenCode live in `~/.config/opencode` and are **not** put
into `~/.agents`.

On Windows `~/.agents` resolves to `%USERPROFILE%\.agents`.

## Repo layout

- `product/` — the product:
  - project template: `AGENTS.md`, `README.md`, `.env.example`, `.gitignore`,
    `.githooks/`, `configs/opencode.jsonc`, and the folders under
    `agents/`, `commands/`, `plugins/`, and `skills/`
  - `product/agents/` -> `~/.config/opencode/agents` (global agents; project template is
    the project template)
  - `product/skills/` -> `~/.agents/skills` (third-party catalog; project template is the
    project template)
  - `product/workflows/` -> `~/.agents/workflows`
  - `product/configs/` -> `~/.config/opencode` (global `opencode.jsonc`; the same
    file is the project template config)
  - `product/docs/` — org collateral (e.g. the board presentation)
- `dev/` — development tooling for this repo itself:
  - `dev/scripts/opc-sync/` — the sync tool (split into modules)
  - `dev/scripts/opc-sync.py` — backward-compatible shim
  - `dev/scripts/setup-opencode.sh` / `.ps1` — installer scripts
  - `dev/tests/` — unit tests
- `.github/` — CI

## Prerequisites (MCPs)

The following MCP servers are referenced in `configs/opencode.jsonc` under
`mcp.servers`. Install them before syncing:

- **codebase-memory-mcp** — `pip install codebase-memory-mcp` (or download binary)
- **codegraph** — `cargo install codegraph` (or prebuilt binary)
- **deepwiki** — optional, remote; set `DEEPWIKI_TOKEN`

Run `python3 dev/scripts/opc-sync.py doctor` to verify.

## Contributing

1. Edit files, open a PR.
2. CI runs `python3 dev/scripts/opc-sync.py verify` and `dev/tests/test_opc_sync.py`.
3. Developers pull updates.

## Rollout

Pilot with 2-3 developers, then org-wide. Back up `~/.config/opencode/` before first pull.
