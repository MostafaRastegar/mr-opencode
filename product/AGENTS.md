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
- A failing run is surfaced automatically by the `mro-test-feedback` plugin. Treat that reminder as a hard stop, not a suggestion.

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

## Product Documentation

`README.md` at the project root is a deliverable, not scratch space. Create it if
it does not exist and keep it current.

- The README must answer: what the product does, prerequisites, install, run,
  configuration and environment variables, a usage example, how to run the tests,
  the project layout, and known limitations.
- Update it whenever a change affects user-facing behavior, configuration, an
  environment variable, a command, a dependency, or an API.
- `docs/behaviors/` holds per-feature detail. The README is the short start-here
  guide and links to the relevant behavior docs instead of duplicating them.
- If a change genuinely needs no README edit, say so explicitly and give the
  reason. Do not rewrite unrelated README sections.
- Never document a command you have not verified against the project profile.

`CHANGELOG.md` at the project root records completed, human-approved work. Write
it only after the human gives final approval, and only then:

- Add a new section at the top under the intro: `## <YYYY-MM-DD> — <feature>`.
- Record what changed (added, changed, fixed, removed), the test command and exit
  code, and the plan/review/behavior paths as evidence.
- Mention deferrals and known limitations instead of hiding them.
- Never invent version numbers, and never rewrite earlier entries.

## Skills

Project skills are part of the instructions. Use them.

- Before planning, implementing, or reviewing, discover the available skills:
  read `.opencode/skills/` (the `read` tool lists a directory) and any
  user-configured global skill directory.
- Load every skill that matches the task with the `skill` tool. Do not stop at the
  shipped `mro-*` skills; the user may have added their own.
- Do not load unrelated skills: they cost context.
- Project skills and `AGENTS.md` override general assumptions. If a skill
  conflicts with `AGENTS.md`, follow `AGENTS.md` and report the conflict.
- Report which skills were actually used; never claim to have used one you did
  not load.

## Agent Handoff Protocol

There are two supported paths. They share the same roles, so use whichever the
human asked for.

### Orchestrated workflow (default)

1. The Orchestrator (`mro-orchestrator`) reads the request and the Project
   Profile, inventories the available skills, then launches the Architect as a
   subagent.
2. Architect writes the plan to `.opencode/plans/<feature>.md` with an
   **Acceptance Criteria** section and a **Documentation impact** section
   (README, config, behavior doc). It returns the path and open questions.
3. Orchestrator validates the plan and stops for explicit human approval. No code
   is written before that approval.
4. Orchestrator launches the Implementer with the plan path, the available
   skills, and the README requirement. The Implementer does not launch the
   Reviewer: the Orchestrator owns review in this path.
5. Orchestrator checks that `README.md` exists and matches the change, then
   launches the Reviewer and Test Runner in parallel. Reviewer writes to
   `.opencode/reviews/<feature>.md`; Test Runner writes its log there too.
6. Orchestrator sends CRITICAL/HIGH findings and failures back to the same
   Implementer session, then re-runs tests and reviews once. If issues remain, it
   stops and asks the human.
7. Orchestrator reports evidence (test exit code, severity counts, acceptance
   status, README state) and asks for final approval. It never pushes.
8. After explicit final approval, the Orchestrator has the Implementer add the
   `CHANGELOG.md` entry, verifies it, and only then marks the work done.

Subagents start with fresh context and cannot talk to the human, so every handoff
must carry the feature slug, plan path, review path, diff scope, prior findings,
available skills, and a return contract. The Orchestrator state file is
`.opencode/plans/<feature>.orchestrator.md`.

### Manual workflow

1. Architect writes the plan to `.opencode/plans/<feature>.md` and stops there.
2. Implementer reads the most recent plan file, then discovers and loads the
   relevant project skills before coding.
3. The Implementer creates or updates `README.md` as part of the Definition of
   Done when the change affects usage, config, or behavior.
4. When the work is done, Implementer launches the `mro-reviewer` subagent with the plan path and the diff scope.
   Slash commands are user-invoked; agents cannot run them, so use the subagent tool.
5. Reviewer writes findings to `.opencode/reviews/<feature>.md` (or `current.md`) and returns a one-paragraph summary.
6. Implementer fixes every CRITICAL and HIGH finding, then re-runs the reviewer once.
   If issues remain after that, stop and ask the human.
7. After the human gives final approval, Implementer adds the `CHANGELOG.md`
   entry. Do not write it before approval.

`.opencode/plans/` and `.opencode/reviews/` are git-ignored scratch space, not deliverables.
