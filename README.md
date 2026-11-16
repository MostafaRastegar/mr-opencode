# mr-opencode

Central source repository for OpenCode configuration shared across the organization. Synced with a zero-dependency Python tool (stdlib only).

## Usage (developers)

```bash
python3 <(curl -fsSL https://raw.githubusercontent.com/MostafaRastegar/mr-opencode/main/dev/scripts/opc-sync.py) --repo git@github.com:MostafaRastegar/mr-opencode.git pull
```

Or clone and run:

```bash
git clone git@github.com:MostafaRastegar/mr-opencode.git ~/opencode-config
cd ~/opencode-config
python3 dev/scripts/opc-sync.py pull
```

Verify:

```bash
python3 dev/scripts/opc-sync.py verify
python3 dev/scripts/opc-sync.py doctor
```

## Commands

| command | purpose |
|---------|---------|
| `pull` | Clone/update the repo and sync `agents/`, `skills/`, `commands/` to `~/.agents` and `configs/` to `~/.config/opencode`. Backs up targets before writing. |
| `status` | Show source/target file counts (`--list` lists source files; `--diff` shows pending add/update/delete/conflict per group with content diffs; `--json` emits machine-readable JSON). |
| `clean` | Delete target files that no longer exist in the source. Use `--yes` to skip confirmation. |
| `verify` | Read-only check that all synced targets match the source with no drift; exits non-zero if drift is found. |
| `doctor` | Print environment info (python, git, MCP binaries, target paths, write access) for troubleshooting. |

## Global options

| option | default | purpose |
|--------|---------|---------|
| `--repo` | `git@github.com:MostafaRastegar/mr-opencode.git` | Git repo URL (or local path) to clone/pull as the config source. |
| `--target` | `~/.config/opencode` | Target directory for OpenCode-specific configs (`configs/`). |
| `--agents-target` | `~/.agents` | Target directory for shared, harness-agnostic agents/skills/commands. |
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

A zero-dependency git `pre-push` hook runs `tests/test_opc_sync.py` and `opc-sync.py verify` on every `git push`, blocking the push if tests fail or config drift is detected. Install once after cloning:

```bash
python3 dev/scripts/install-git-hooks.py
```

The hook is sourced from `dev/scripts/git-hooks/pre-push` and copied into `.git/hooks/`. No npm / node_modules required — stdlib Python only.

## HTTP skill catalogs

`pull` also downloads skills listed under `skills` in `configs/opencode.jsonc` from HTTP catalog URLs. Each catalog's `index.json` describes skill `id`, `version`, and `files` (with `dest` and `url`). Files are written to `~/.agents/skills/<id>/`, and a `VERSION` marker is created when a version is provided.

Example `configs/opencode.jsonc`:

```jsonc
{
  "skills": ["https://example.com/opencode/skills/"]
}
```

## CI-friendly output

`status --diff --json` emits machine-readable JSON listing every pending change per group (add/update/delete/conflict) with unified-content diffs, suitable for CI pipelines.

## Updating

```bash
python3 dev/scripts/opc-sync.py pull
python3 dev/scripts/opc-sync.py clean --yes
```

## Catalog

- Agents: `product/agents/` -> synced to `~/.agents` (shared, harness-agnostic)
- Skills: `product/skills/` -> synced to `~/.agents/skills`
- Commands: `product/commands/` -> synced to `~/.agents/commands`
- Plugins: `product/plugins/` -> synced to `~/.agents/plugins` (shared, harness-agnostic)
- Workflows: `product/workflows/` -> synced to `~/.agents/workflows` (shared, harness-agnostic)
- Configs: `product/configs/` -> synced to `~/.config/opencode` (opencode-specific)

### `~/.agents` (cross-platform, shared)

`~/.agents` holds shared, harness-agnostic content (agents, skills, commands, plugins, workflows) so
it works no matter which harness you use (OpenCode, CLI, IDE, etc.).
Settings specific to OpenCode live in `~/.config/opencode` and are **not** put
into `~/.agents`.

On Windows `~/.agents` resolves to `%USERPROFILE%\.agents`.

## Repo layout

- `product/` — configuration that gets synced to end-user machines:
  - `product/agents/` -> `~/.agents` (shared, harness-agnostic)
  - `product/skills/` -> `~/.agents/skills`
  - `product/commands/` -> `~/.agents/commands`
  - `product/configs/` -> `~/.config/opencode` (opencode-specific)
- `dev/` — development tooling for this repo itself:
  - `dev/scripts/opc-sync/` — the sync tool (split into modules)
  - `dev/scripts/opc-sync.py` — backward-compatible shim
  - `dev/scripts/setup-opencode.sh` / `.ps1` — installer scripts
  - `dev/tests/` — unit tests
- `.github/`, `workflows/`, `plugins/` — CI and optional plugins

- Plugins: `dev/plugins/`

## Prerequisites (MCPs)

The following MCP servers are referenced in `configs/opencode.json`. Install them before syncing:

- **codebase-memory-mcp** — `pip install codebase-memory-mcp` (or download binary)
- **codegraph** — `cargo install codegraph` (or prebuilt binary)
- **deepwiki** — optional, remote; set `DEEPWIKI_TOKEN`

Run `python3 dev/scripts/opc-sync.py doctor` to verify.

1. Edit files, open a PR.
2. CI runs `python3 dev/scripts/opc-sync.py verify`.
3. Developers pull updates.

## Rollout

Pilot with 2-3 developers, then org-wide. Back up `~/.config/opencode/` before first pull.

## Skills (third-party)

OpenCode supports HTTP skill catalogs. Add a catalog URL to `configs/opencode.jsonc` under `skills`, e.g.:

```jsonc
"skills": ["https://example.com/opencode/skills/"]
```

OpenCode downloads and caches skills automatically; bump `version` in the catalog's `index.json` to refresh. For git-only skills, use a submodule under `skills/<id>/`.
