# Project Rules

## Project Profile (fill in before use)

This template is deliberately not tied to a language, runner, or framework. Fill
in the values below, then delete this note. While any `<...>` token remains,
agents must stop and ask the human instead of guessing a command.

The supported way to fill them is `node .opencode/scripts/mro-doctor.mjs --init`
(it detects the manifest, suggests commands, and writes both this profile and
`.opencode/mro-profile.json`). `node .opencode/scripts/mro-doctor.mjs` checks for
gaps and exits non-zero; the Orchestrator runs it as a hard preflight.

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
- Before reporting, run the `secret-audit` tool on the working tree. Pattern
  detectors are best-effort (see README), so a clean result is not a guarantee.

## Acceptance Criteria

Plans use a fixed, machine-readable shape. The `check-acceptance` tool reports
each field, so an incomplete plan is visible before implementation.

```md
- [ ] AC-1: When <trigger>, <observable outcome>. — verify: `<command>`
- [x] AC-2: ... — verify: `<command>` evidence: `<command>` exit 0, N passed
- [~] AC-3: ... — verify: manual: <what to check> — reason: <why, and who agreed>
```

- `[ ]` is pending. `[x]` is confirmed **with evidence**; a tick with no evidence
  is not acceptance. `[~]` is deliberately deferred and **requires a reason**.
- Every non-deferred criterion needs a `verify:` command, or `manual: <check>`
  when no automated check exists.
- `check-acceptance` never executes the verify commands. Run them through the
  normal shell permissions; it only reports missing fields.
- A plan that omits `verify:` on a criterion is incomplete. The Architect must fix
  it before the plan gate.

## Fix Loop

The review loop is conditional, not a fixed single retry:

- CRITICAL must reach zero before final approval.
- Another round is allowed while the CRITICAL count strictly decreases, up to
  three rounds total.
- If CRITICAL stays flat or rises, stop and ask the human.
- HIGH findings do not block by themselves, but each one is either fixed or
  listed with a reason and explicitly accepted by the human. Never drop one
  silently.
- Record the round and severity counts in the orchestration state file.

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
- Every plan includes an Acceptance Criteria section in the format above,
  including a `verify:` for each criterion, and a Documentation impact section.
  A plan without them is incomplete.

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

## Behavior Docs

`docs/behaviors/<feature>.md` is a deliverable with retention rules:

- Front matter must include `last_verified: <YYYY-MM-DD>` and
  `source_files: <comma-separated paths>`. `last_verified` changes only when the
  tests were actually re-run against the current code.
- When a source file in `source_files` changes, update the doc in the same change.
  `node .opencode/scripts/mro-doctor.mjs --docs` reports stale docs; the
  Orchestrator treats a stale doc as a gap and the Reviewer as a HIGH finding.
- The Reviewer checks that the behavior doc describes what the diff does, not what
  the plan intended.

## Unconfigured Tools

`db-status` and `check-file` say "not configured" until
`.opencode/mro-profile.json` exists. That is an honest gap, not a pass. Run
`node .opencode/scripts/mro-doctor.mjs --init` before relying on them; the
Orchestrator preflight fails while the profile is missing.

Credentials (`ROUTER_API_KEY` and any provider key) are the human's own
configuration. Agents never ask for them and never treat a missing key as a
blocker: skip the dependent check silently and continue.

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

## Review policy

Merge gating is defined in `REVIEW_POLICY.md` (this directory). It lists what
must always block a change (security, missing tests, unverifiable code,
unreviewed dependencies, contract violation, CI gaming, unresolved
placeholders) and what must never block (personal style, "I would write it
elsewhere," perfectionism). Every reviewer — human or agent — applies this
policy identically.

## Directory-level context

When an agent enters a directory, it reads that directory's `AGENTS.md` first
(if one exists) for local rules, then the root `AGENTS.md` for repository-wide
rules. Directory-level `AGENTS.md` files override root rules only for scope,
never for safety or review policy.

## Agent Handoff Protocol

There are two supported paths. They share the same roles, so use whichever the
human asked for.

### Orchestrated workflow (default)

1. The Orchestrator (`mro-orchestrator`) runs the hard preflight
   (`mro-doctor`, model reachability), reads the Project Profile, inventories the
   available skills, then launches the Architect as a subagent.
2. Architect writes the plan to `.opencode/plans/<feature>.md` with an
   **Acceptance Criteria** section (every criterion has `verify:`) and a
   **Documentation impact** section (README, config, behavior doc). It returns the
   path and open questions.
3. Orchestrator validates the plan and stops for explicit human approval. No code
   is written before that approval.
4. Orchestrator launches the Implementer with the plan path, the available
   skills, and the README requirement. The Implementer does not launch the
   Reviewer: the Orchestrator owns review in this path.
5. Orchestrator checks that `README.md` exists and matches the change, then
   launches the Reviewer and Test Runner in parallel. The Reviewer gets the diff,
   the acceptance criteria, and `AGENTS.md` — not the plan's rationale — so its
   judgement stays independent. Reviewer writes to
   `.opencode/reviews/<feature>.md`; Test Runner writes its log there too.
6. Orchestrator sends CRITICAL/HIGH findings and failures back to the same
   Implementer session. The loop is conditional (see "Fix Loop"): another round is
   allowed while CRITICAL decreases, up to three rounds; flat or rising CRITICAL
   stops the run. CRITICAL must reach zero.
7. Orchestrator reports evidence (test exit code, severity counts and round
   history, acceptance status, README state) and asks for final approval. It never
   pushes.
8. After explicit final approval, the Orchestrator has the Implementer add the
   `CHANGELOG.md` entry, verifies it, and only then marks the work done.

Subagents start with fresh context and cannot talk to the human, so every handoff
must carry the feature slug, plan path, review path, diff scope, prior findings,
available skills, and a return contract. The Orchestrator state file is
`.opencode/plans/<feature>.orchestrator.json` (structured JSON, not a scratch
markdown note) and its audit trail is `.opencode/plans/<feature>.log.jsonl`.

### Manual workflow

1. Architect writes the plan to `.opencode/plans/<feature>.md` and stops there.
2. Implementer reads the most recent plan file, then discovers and loads the
   relevant project skills before coding.
3. The Implementer creates or updates `README.md` as part of the Definition of
   Done when the change affects usage, config, or behavior.
4. When the work is done, Implementer launches the `mro-reviewer` subagent with the diff scope and the acceptance criteria (not the design rationale).
   Slash commands are user-invoked; agents cannot run them, so use the subagent tool.
5. Reviewer writes findings to `.opencode/reviews/<feature>.md` (or `current.md`) and returns a one-paragraph summary.
6. Implementer fixes every CRITICAL and HIGH finding, then re-runs the suite and
   the reviewer. The same conditional loop applies: another round while CRITICAL
   decreases, at most three; flat or rising CRITICAL stops the run.
7. After the human gives final approval, Implementer adds the `CHANGELOG.md`
   entry. Do not write it before approval.

`.opencode/plans/` and `.opencode/reviews/` are git-ignored scratch space, not deliverables.
