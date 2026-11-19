# Vibecoding Template — Stage 2: Commands, Security Plugin, Cost & Feedback Loop

## [Scope]

Extend `product/templates/vibecoding/` from a three-agent skeleton to a working
pipeline: slash commands, a secret-leak guard (plugin + pre-commit), cheap-model
assignments, and an automated handoff protocol.

Template only. `opc-sync` does not deploy this directory; it is copied into a
target project by hand.

## [Decisions]

- Review artifact: reviewer writes `.opencode/reviews/<feature>.md` and returns a
  one-paragraph summary. Reviewer still cannot edit anything else.
- Secret defence: both layers. In-session plugin (blocks tool calls) and a
  zero-dependency `.githooks/pre-commit` scanner (blocks the commit).
- `small_model` is deprecated in V2. Use `agents.title.model` and
  `agents.summary.model` instead (verified against `opencode debug agents`).
- Agents cannot invoke slash commands. The handoff step uses the `subagent`
  tool; `/mro-run-review` stays a human shortcut.
- Plugin uses the V2 shape `export default { id, setup(ctx) }` with
  `ctx.tool.hook("execute.before")`. Throwing from the hook blocks the tool
  (verified on OpenCode v2.3.0).

## [Corrections Applied To The Source Plan]

| Source plan | Reality on v2.3.0 |
| --- | --- |
| `export const X = async ({ project, client, $ }) => ({ "tool.execute.before": ... })` | V1 API. V2 uses `{ id, setup }` + `ctx.tool.hook` |
| `.opencode/plugins/mro-protect-secrets.js` | loadable, but a directory with `index.js` is the documented layout |
| `small_model` | deprecated in the config schema |
| `anthropic/claude-haiku-4-5` | not available here; use `opencode/hy4-flash-free` |
| `opencode debug skill` / `opencode agent list` | do not exist; use `opencode debug agents`, `opencode plugin list` |
| `bash: allow` in agent permissions | V1 key; V2 action is `shell` |

## [Deliverables]

New:

1. `.opencode/commands/mro-plan-feature.md`
2. `.opencode/commands/mro-run-review.md`
3. `.opencode/commands/mro-fix-tests.md`
4. `.opencode/agents/test-runnermro-test-runner.md`
5. `.opencode/plugins/mro-protect-secrets/index.js`
6. `.githooks/pre-commit`
7. `.gitignore`

Changed:

8. `opencode.jsonc` — cheap title/summary models
9. `.opencode/agents/reviewermro-reviewer.md` — reviews writable area, `steps: 8`
10. `.opencode/agents/mro-implementer.md` — `steps: 30`, handoff reference
11. `AGENTS.md` — Handoff Protocol
12. `README.md` — hook install, plugin limits, verification commands

## [Known Limits]

- Pattern-based detection misses base64, split strings, and real env-var values.
- `execute` (Code Mode) and MCP tools are only partially covered; nested calls
  may bypass the plugin.
- A commit with `--no-verify` skips the pre-commit scanner by design.

## [Verification]

```sh
opencode debug agents        # five agents, effective permissions
opencode plugin list         # mro-protect-secrets registered
opencode run "/mro-run-review"   # command expands, reviewer is selected
opencode run "write secret.txt with sk-proj-AAAABBBBCCCCDDDDEEEEFFFF"  # blocked
git add <staged AKIA line> && git commit   # pre-commit rejects
```

## [Validation Findings]

Recorded after implementing on OpenCode v2.3.0:

- `opencode/plugin` is not installed locally, so the plugin has zero imports and
  exports a plain `{ id, setup }` object. `plugin list` shows it as `mro-protect-secrets`.
- The hook blocks `write`, `edit`, `patch`, `shell`, and `execute` inputs
  containing a matched pattern; a `read` event passes through.
- `opencode run "/cmd"` expands `$ARGUMENTS`, but does **not** apply the
  command's `agent:` frontmatter (session export still reports `build`). The TUI
  may differ. `/mro-run-review` therefore instructs the current agent to launch the
  `mro-reviewer` subagent, which was verified end to end.
- `opencode/claude-fable-5-2` and `opencode/gemini-4-hydrogen` fail with
  "Insufficient balance" on this machine. Shipped models changed to
  `opencode/longcat-2.5-free` (architect/implementer) and
  `opencode/hy4-flash-free` (reviewer/test-runner).
- The plugin also blocks documentation that quotes a fixture key verbatim
  (observed when the reviewer tried to copy the README example into its report).
  Acceptable: keep fixtures split or labelled.
- `agents.title.model` and `agents.summary.model` override the hidden agents;
  `small_model` remains deprecated.

