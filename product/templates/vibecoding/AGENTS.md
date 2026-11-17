# Project Rules

## Project Profile (fill in before use)

This template is deliberately not tied to a language, runner, or framework. Fill
in the values below, then delete this note. While any `<...>` token remains,
agents must stop and ask the human instead of guessing a command.

- Stack: `<STACK>`
- Primary language: `<LANGUAGE>`
- Test command: `<TEST_CMD>`
- Typecheck command: `<TYPECHECK_CMD>` (use `-` if the project has none)
- Lint command: `<LINT_CMD>` (use `-` if the project has none)
- Build command: `<BUILD_CMD>`
- Migration command: `<MIGRATION_CMD>` (use `-` if the project has none)
- Dependency manifest / lockfile: `<LOCKFILE>`
- Language rules: `<LANGUAGE_RULES>` (strictness, banned escape hatches, naming)

## Code Standards

- `<LANGUAGE_RULES>` from the profile above is mandatory.
- Never suppress a diagnostic (cast, ignore comment, disabled rule) without an
  adjacent explanation and a human's approval.
- Public functions and modules must have explicit types where the language
  supports them.

## Testing

- Every new function or module must have corresponding tests.
- Run `<TEST_CMD>` before considering a task complete.
- A failing run is surfaced automatically by the `test-feedback` plugin. Treat that reminder as a hard stop, not a suggestion.

## Type Checking & Diagnostics

- Run `<TYPECHECK_CMD>` before reporting completion; skip it when the profile
  says `-`.
- Run `<LINT_CMD>` when the profile sets one.
- Fix type errors before running tests; a type error makes a green test run meaningless.
- LSP is accepted by the OpenCode v2.3.0 config but not implemented in that build: no language server starts and no diagnostics reach the agent. Do not claim to have read LSP diagnostics in this project.

## Git & Dependencies

- Do not run `git push --force` under any circumstances.
- A new dependency requires explicit approval from the human user.
- Keep `<LOCKFILE>` committed.

## File Editing

- Do not modify files outside the project root without explicit approval.
- `AGENTS.md`, `opencode.jsonc`, `.opencode/{agents,plugins,skills,commands}/`,
  `.githooks/`, `.git/`, and `.env*` files are locked by permissions. Ask the
  human to change them; do not try to work around the deny.
- Shell commands are not pre-approved for any runner. A maintainer adds `allow`
  rules for this project's commands (see the agent files). If a command is
  rejected, report it instead of retrying or working around it.

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
