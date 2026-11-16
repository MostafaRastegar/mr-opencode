# mr-opencode

Central source repository for OpenCode configuration shared across the organization. Synced with a zero-dependency Python tool (stdlib only).

## Usage (developers)

```bash
python3 <(curl -fsSL https://raw.githubusercontent.com/MostafaRastegar/mr-opencode/main/scripts/opc-sync.py) --repo git@github.com:MostafaRastegar/mr-opencode.git pull
```

Or clone and run:

```bash
git clone git@github.com:MostafaRastegar/mr-opencode.git ~/opencode-config
cd ~/opencode-config
python3 scripts/opc-sync.py pull
```

Verify:

```bash
python3 scripts/opc-sync.py verify
python3 scripts/opc-sync.py doctor
```

## Commands

| command | purpose |
|---------|---------|
| `pull` | Clone/update the repo and sync `agents/`, `skills/`, `commands/` to `~/.agents` and `configs/` to `~/.config/opencode`. Backs up targets before writing. |
| `status` | Show source/target file counts (`--list` lists source files; `--diff` shows pending add/update/delete/conflict per group). |
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

## Updating

```bash
python3 scripts/opc-sync.py pull
python3 scripts/opc-sync.py clean --yes
```

## Catalog

- Agents: `agents/` -> synced to `~/.agents` (shared, harness-agnostic)
- Skills: `skills/` -> synced to `~/.agents/skills`
- Commands: `commands/` -> synced to `~/.agents/commands`
- Configs: `configs/` -> synced to `~/.config/opencode` (opencode-specific)

### `~/.agents` (cross-platform, shared)

`~/.agents` holds shared, harness-agnostic content (agents, skills, commands) so
it works no matter which harness you use (OpenCode, CLI, IDE, etc.).
Settings specific to OpenCode live in `~/.config/opencode` and are **not** put
into `~/.agents`.

On Windows `~/.agents` resolves to `%USERPROFILE%\.agents`.
- Plugins: `plugins/`

## Prerequisites (MCPs)

The following MCP servers are referenced in `configs/opencode.json`. Install them before syncing:

- **codebase-memory-mcp** — `pip install codebase-memory-mcp` (or download binary)
- **codegraph** — `cargo install codegraph` (or prebuilt binary)
- **deepwiki** — optional, remote; set `DEEPWIKI_TOKEN`

Run `python3 scripts/opc-sync.py doctor` to verify.

1. Edit files, open a PR.
2. CI runs `python3 scripts/opc-sync.py verify`.
3. Developers pull updates.

## Rollout

Pilot with 2-3 developers, then org-wide. Back up `~/.config/opencode/` before first pull.

## Skills (third-party)

OpenCode supports HTTP skill catalogs. Add a catalog URL to `configs/opencode.jsonc` under `skills`, e.g.:

```jsonc
"skills": ["https://example.com/opencode/skills/"]
```

OpenCode downloads and caches skills automatically; bump `version` in the catalog's `index.json` to refresh. For git-only skills, use a submodule under `skills/<id>/`.
