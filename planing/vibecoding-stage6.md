# Vibecoding Template — Stage 6: LSP Reality Check + Stability Guards

## [Scope]

The "LSP integration" step and the "session stability" step of the source plan.
No MCP, no CI/CD.

## [Decisions]

- **LSP does not work in `opencode v2.3.0`, so it is not shipped as if it did.**
  Verified three ways with `"lsp": true` (and `"lsp": {}`) on a project with a
  real `typescript` dependency and a file containing a type error:
  1. no `tsserver`/language-server process is ever spawned;
  2. the `edit` tool result is `Edited src/a.ts (1 replacement)` — no
     diagnostics, unlike V1 which appends them to edit results;
  3. the V2 tool catalog has no diagnostics/LSP tool, and the V2 docs index has
     no LSP page (only the V1 page documents the feature).
  The key is accepted by the config schema, so a `"lsp": true` line would look
  healthy and do nothing. `opencode.jsonc` gets a commented-out block with the
  measured reason, so it can be turned on when a build actually supports it.
- **The working substitute is a CLI typecheck, stated as a rule.** V2's own LSP
  docs recommend CLI lint/typecheck over LSP in most projects. `AGENTS.md` gains
  a "Type Checking & Diagnostics" section with the exact commands and an
  obligation to run them before reporting completion.
- **`test-feedback` is extended to typecheck/lint failures.** This is the part
  of the LSP intent that actually pays off in V2: a failing `tsc`/`eslint`/
  `pyright` run now injects a fix-required reminder into the agent loop instead
  of failing silently. No new plugin.
- **Plan mode is enforced at three levels:** the agent's `edit: deny`
  permissions (already present), an explicit instruction in `architect.md` to
  stop instead of bypassing, and a global `AGENTS.md` rule.
- **Manual compaction exists but is not `/compact` in the TUI.** V2 documents
  `opencode api post /api/session/<id>/compact`; the TUI keybind is
  `session.compact` (`<leader>c`, leader defaults to `ctrl+x`). `/compact` also
  exists as a command (verified: `opencode run "/compact"` answered "no prior
  conversation to compact" rather than being treated as chat).
- **Meta-planning loops get a stop rule**, not tooling: two consecutive turns
  with no file change and no command means stop and report.

## [Deliverables]

1. `opencode.jsonc` — commented `lsp` block with the measured reason
2. `AGENTS.md` — typecheck commands, plan-mode rule, session hygiene, loop rule
3. `.opencode/agents/implementer.md` — typecheck before reporting
4. `.opencode/agents/architect.md` — never attempt to bypass plan-mode edit denial
5. `.opencode/plugins/test-feedback/index.js` — typecheck/lint coverage
6. `README.md` — LSP status, typecheck section, stability notes

## [Known Limits]

- The typecheck rule is only as good as the command the project fills in.
- `test-feedback` matches command text; a typecheck hidden inside a wrapper
  script (`make check`) is not detected.
- `lsp` behaviour was tested on v2.3.0 only; re-test before enabling.
- A stop rule cannot force a model to obey it; it only gives the human a clear
  signal to intervene.

## [Verification]

```sh
opencode debug config                       # still parses; lsp stays off
opencode debug agents                      # rules present
opencode run --auto "run: node tsc --noEmit"  # failing typecheck appends the reminder
```

Plus: a project with real `typescript` + a type error, checking for a spawned
language server and for diagnostics in the edit result (both absent).

## [Validation Findings]

- `lsp: true` and `lsp: {}` on a project with real `typescript` 5.9.3 and
  `export const n: number = "hello"`:
  - `ps` never showed `tsserver` / a language server during a run;
  - the agent received `Edited src/a.ts (1 replacement)` with no diagnostics;
  - the log contains no LSP lines.
- `opencode.jsonc` still parses with the commented block:
  `opencode debug config` shows no `lsp` key.
- `opencode debug agents` shows the new plan-mode text in the architect prompt.
- `npx tsc --noEmit` on that project exited 2 and the hook appended
  `[CHECK FEEDBACK] The check command exited with code 2...` to the tool result.
- The final regex (command-start anchoring) was checked against 23 sample
  commands: tests/typecheck/lint match; `ls`, `echo tsc`, `grep tsc file`,
  `npm install typescript`, `npm run build`, `cat mytscfile` do not.
- `/compact` is a real command, not chat: `opencode run "/compact"` answered
  "There's no prior conversation to compact". TUI keybind `session.compact` is
  `<leader>c`, leader default `ctrl+x`.
- **Limit:** the account's free-model quota was exhausted during validation, so
  the final regex was not re-run end-to-end through an agent (the earlier
  end-to-end run used the previous, unanchored regex). Only the regex itself
  changed; the hook code path is identical.

