# Vibecoding Template — Stage 3: Custom Tools, Compaction, Test Feedback

## [Scope]

Steps 11–13 of the source plan. Step 10 (MCP/GitHub) is explicitly out of scope.

## [Decisions]

- `.opencode/tools/` is a V1-only convention. V2 registers tools from a plugin with
  `ctx.tool.transform((editor) => editor.add({...}))`. The `db-status` tool is
  therefore shipped as `.opencode/plugins/project-tools/index.js`.
- `@opencode-ai/plugin` / `@opencode/plugin` are not resolvable in a bare project,
  so plugins stay import-free except for `node:` builtins.
- Test feedback uses `ctx.tool.hook("execute.after", ...)`. A shell failure is
  `status: "completed"` with `result.output.exitCode !== 0` — not `status: "error"`.
  Appending a `{ type: "text", text }` item to `result.content` is visible to the model.
- Compaction uses the documented V2 fields (`compaction.keep.tokens`,
  `compaction.buffer`, `agents.compaction.model`). `anthropic/claude-haiku-4-5`
  is unavailable here; use `opencode/hy4-flash-free`.

## [Deliverables]

1. `.opencode/plugins/project-tools/index.js` — `db-status` tool
   (Prisma, Alembic, Django detection)
2. `.opencode/plugins/test-feedback/index.js` — appends a fix-required reminder
   after a failing test command
3. `opencode.jsonc` — `compaction` block + `agents.compaction.model`
4. `README.md` — plugin inventory, compaction rationale, verification
5. `AGENTS.md` — one line: test failures are surfaced by the plugin, not optional

## [Known Limits]

- `db-status` runs a fixed, read-only command without a permission prompt. It
  accepts no user input, so it cannot be steered into arbitrary commands.
- The test-command detector is regex-based; custom runners need the pattern extended.
- Compaction is lossy regardless of `keep.tokens`; it preserves recent tokens, not
  "important" ones.

## [Verification]

```sh
opencode plugin list                                   # protect-secrets, project-tools, test-feedback
opencode debug agents                                  # compaction agent model resolved
opencode run "call db-status"                          # returns migration status or a clear "not detected"
opencode run "run: false"                              # no reminder (not a test command)
opencode run "run: npm test"                           # failing suite -> reminder appended
```

## [Validation Findings]

- All three plugins load and appear in `opencode plugin list`.
- `agents.compaction.model` resolves to `opencode/hy4-flash-free`.
- `db-status` returned the Django section with `exit=0` for a stub `manage.py`.
- `execute.after` fires with `status: "completed"` for a non-zero shell exit;
  `result.output.exitCode` and `result.metadata.exit` both carry the code.
  Pushing `{ type: "text", text }` onto `result.content` is visible to the model.
- A failing `npm test` produced the reminder; `false` did not.
- Non-interactive `opencode run` auto-rejects `ask` permissions, so the
  feedback test needed `--auto`. Interactive sessions prompt as configured.
- Step 10 (GitHub MCP) intentionally skipped: no MCP entries are added.

