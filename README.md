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

## Updating

```bash
python3 scripts/opc-sync.py pull
python3 scripts/opc-sync.py clean --yes
```

## Catalog

- Agents: `agents/`
- Skills: `skills/`
- Commands: `commands/`
- Configs: `configs/`
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
