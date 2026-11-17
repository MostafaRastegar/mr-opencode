# Project Rules

## Code Standards

- TypeScript strict mode is mandatory. `any` is forbidden. Use `unknown` and narrow types.
- Never use `@ts-ignore` or `@ts-expect-error` without an adjacent comment explaining why.
- All exported functions must have explicit return types.

## Testing

- Every new function or module must have corresponding unit tests.
- Run `npm test` before considering a task complete. Replace this with the project's real command (`pnpm test`, `pytest`, ...).
- A failing run is surfaced automatically by the `test-feedback` plugin. Treat that reminder as a hard stop, not a suggestion.

## Type Checking & Diagnostics

- Run the typecheck command before reporting completion. TypeScript: `npx tsc --noEmit`. Python: `pyright` or `mypy .`. Go: `go vet ./...`. Rust: `cargo check`.
- Run the linter as well when the project has one: `eslint .`, `ruff check .`, `golangci-lint run`.
- Fix type errors before running tests; a type error makes a green test run meaningless.
- LSP is accepted by the OpenCode v2.3.0 config but not implemented in that build: no language server starts and no diagnostics reach the agent. Do not claim to have read LSP diagnostics in this project.

## Git & Dependencies

- Do not run `git push --force` under any circumstances.
- A new npm/pip dependency requires explicit approval from the human user.
- Keep the lockfile (`package-lock.json`, `pnpm-lock.yaml`, `uv.lock`) committed.

## File Editing

- Do not modify files outside the project root without explicit approval.
- `AGENTS.md`, `opencode.jsonc`, `.opencode/{agents,plugins,skills,commands}/`,
  `.githooks/`, `.git/`, and `.env*` files are locked by permissions. Ask the
  human to change them; do not try to work around the deny.
- Shell commands outside the pre-approved test/typecheck/lint/git set require
  human approval. If a command is rejected, report it instead of retrying.

## Plan Mode

- The Architect must not call `edit`, `write`, or `patch` under any circumstance
  except inside `.opencode/plans/`.
- If producing a plan seems to require changing a source file, stop and ask the
  human to hand off to the Implementer. Do not look for a way around the
  restriction.

## Session Hygiene

- Sessions degrade past roughly 30 turns. Compact at that point with `/compact`,
  or with the `session.compact` keybind (`<leader>c`; the leader defaults to
  `ctrl+x`). Prefer a fresh session when the summary would carry stale state.
- Decisions that matter belong in a plan or behavior doc, not in scrollback:
  write them down before compacting.

## Stuck Loops

- If two consecutive turns produce no file edit and no command, stop and report
  what you are trying to do, what you tried, and what you need. Do not keep
  re-planning.

## Agent Handoff Protocol

1. Architect writes the plan to `.opencode/plans/<feature>.md` and stops there.
2. Implementer reads the most recent plan file before coding.
3. When the work is done, Implementer launches the `reviewer` subagent with the plan path and the diff scope.
   Slash commands are user-invoked; agents cannot run them, so use the subagent tool.
4. Reviewer writes findings to `.opencode/reviews/<feature>.md` (or `current.md`) and returns a one-paragraph summary.
5. Implementer fixes every CRITICAL and HIGH finding, then re-runs the reviewer once.
   If issues remain after that, stop and ask the human.

`.opencode/plans/` and `.opencode/reviews/` are git-ignored scratch space, not deliverables.
