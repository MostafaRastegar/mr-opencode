# Vibecoding project template

Project-local OpenCode setup for an Orchestrator → Architect → Implementer →
Reviewer workflow: from an idea to verified, documented behavior. The Orchestrator
is the default project manager; the same roles still work in the manual
Architect → Implementer → Reviewer flow. Product work only — no CI/CD, no GitHub
Actions, no MCP servers.

The template is **stack-neutral on purpose**. Nothing here assumes a language,
package manager, test runner, database, or framework. Every such value is a
`<PLACEHOLDER>` that must be filled in for the project before the workflow runs
end to end. See [Fill-in checklist](#fill-in-checklist).

The project template's source files are under
`agents/`, `commands/`, `plugins/`, and `skills/`, plus `configs/opencode.jsonc`.
Copy them into a project by hand (see [Install](#install)).

## What's in here

| Layer    | Files                                                                                  | Purpose                                         |
| -------- | -------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Config   | `configs/opencode.jsonc`, `AGENTS.md`, `.gitignore`, `.githooks/pre-commit`            | governance, standards, secret scan              |
| Agents   | `agents/{mro-orchestrator,mro-architect,mro-implementer,mro-reviewer,mro-test-runner}.md`        | role, model, and permission separation          |
| Skills   | `skills/{mro-project-stack,mro-data-model,mro-behavior-docs,mro-code-review-checklist}/SKILL.md`  | on-demand knowledge, no permanent context cost  |
| Commands | `commands/{mro-orchestrate,mro-plan-feature,mro-run-review,mro-fix-tests,mro-deliver,mro-status}.md` | user-invoked entry points                     |
| Plugins  | `plugins/{mro-protect-secrets,mro-test-feedback,mro-project-tools,mro-redact}/`                | secret blocking, failure feedback, custom tools, redaction |
| Scripts  | `scripts/{mro-doctor,mro-model-check}.mjs`                                                | placeholder detection, profile writer, model preflight |
| Tests    | `tests/*.test.mjs`                                                                     | self-tests for the template's own tools         |
| Memory   | `.opencode/plans/`, `.opencode/reviews/`, `docs/behaviors/`                            | plans, state, review reports, behavior docs     |
| Deliverables | `README.md`, `CHANGELOG.md`                                                        | product usage guide and completed-work history  |

`.opencode/plans/` and `.opencode/reviews/` are git-ignored scratch space.
`docs/behaviors/` is a deliverable, created the first time the `mro-behavior-docs`
skill runs.

## Install

```bash
cd /path/to/mr-opencode
mkdir -p /path/to/new-project/.opencode/{agents,commands,plugins,skills,scripts}
cp -r product/agents/.   /path/to/new-project/.opencode/agents/
cp -r product/commands/. /path/to/new-project/.opencode/commands/
cp -r product/plugins/.  /path/to/new-project/.opencode/plugins/
cp -r product/skills/.   /path/to/new-project/.opencode/skills/
cp -r product/scripts/.  /path/to/new-project/.opencode/scripts/
cp    product/configs/opencode.jsonc /path/to/new-project/opencode.jsonc
cp -r product/AGENTS.md product/.githooks product/.env.example \
      product/.gitignore /path/to/new-project/
cd /path/to/new-project
git init                              # required: undo/revert depends on Git
git config core.hooksPath .githooks   # enables the pre-commit secret scan
```

Then fill in the placeholders (next section). Nothing else has to be installed
for the workflow itself: it is plain Markdown, JSONC, and JavaScript. The helper
scripts use Node.js built-ins only, so they run wherever `node` exists.

`node .opencode/scripts/mro-doctor.mjs --init` fills both `AGENTS.md` and
`.opencode/mro-profile.json` interactively; `--write` accepts every suggestion
without prompting. `mro-doctor` never invents a value: an undetected field stays
a `<...>` token and the check keeps failing.

## Fill-in checklist

| Placeholder        | Where to fill it                          | Meaning                                   |
| ------------------ | ----------------------------------------- | ----------------------------------------- |
| `<STACK>`          | `AGENTS.md`, `mro-project-stack` skill        | framework and runtime, in one line        |
| `<LANGUAGE>`       | `AGENTS.md`                               | primary language                          |
| `<TEST_CMD>`       | `AGENTS.md`, agent `allow` rules          | the command that runs the suite           |
| `<TYPECHECK_CMD>`  | `AGENTS.md`, `mro-project-tools` plugin       | static check; `-` if none                 |
| `<LINT_CMD>`       | `AGENTS.md`, agent `allow` rules          | linter; `-` if none                       |
| `<BUILD_CMD>`      | `AGENTS.md`, agent `allow` rules          | build/compile command                     |
| `<MIGRATION_CMD>`  | `AGENTS.md`, `mro-project-tools` plugin       | migration status; `-` if none             |
| `<LOCKFILE>`       | `AGENTS.md`                               | dependency lock file to keep committed    |
| `<LANGUAGE_RULES>` | `AGENTS.md`                               | strictness, banned escape hatches, naming |
| `<MODEL_ID>`       | `configs/opencode.jsonc`, `agents/*.md` | model id from `opencode models`           |
| `<SCHEMA_PATH>`    | `mro-data-model` skill                        | the authoritative schema                  |
| `<PROVIDER_ID>`    | `configs/opencode.jsonc`, `.env`          | web search provider, optional             |

Rule enforced in `AGENTS.md`: while a `<...>` token remains, the agents stop and
ask instead of guessing a command. `node .opencode/scripts/mro-doctor.mjs` is the
machine check: it exits 0 only when every placeholder is filled and the profile
exists, and the Orchestrator runs it as a hard preflight. The `AGENTS.md` Project
Profile is the human-readable source; `.opencode/mro-profile.json` is what the
plugin tools read. Keep them consistent (the doctor writes both).

The shipped `providers.9router` block reads its credential from
`ROUTER_API_KEY`. Whether that key is exported, added to `.env` (see
`.env.example`), or replaced by another provider is the human's own
configuration; agents never ask for it.

Before a run, `node .opencode/scripts/mro-model-check.mjs` sends one minimal chat
request to the gateway when a credential is configured. Exit 0 means the model
answers; exit 1 means the gateway returned an error (including "insufficient
balance"); exit 2 means no credential is configured, so the check is skipped and
the run continues silently. There is no automatic model fallback: a failed
preflight stops the run so the human chooses, instead of a phase dying halfway
and corrupting the state file.

The plugin configuration is a file, not code:

```json
// .opencode/mro-profile.json (written by `mro-doctor --init`)
{
  "typecheckRunner": { "cmd": "pnpm", "args": ["exec", "tsc", "--noEmit"], "extensions": [".ts"] },
  "migrations": [{ "file": "prisma/schema.prisma", "label": "Prisma", "cmd": "pnpm", "args": ["exec", "prisma", "migrate", "status"] }]
}
```

The constants `MIGRATION_CANDIDATES` and `TYPECHECK` in
`plugins/mro-project-tools/index.js` remain as a fallback and for hand editing.
Until one of them is set, `db-status` and `check-file` answer "not configured" — an
honest gap, not a silent guess.

## Agents

| Agent             | Mode     | Model               | May write                 |
| ----------------- | -------- | ------------------- | ------------------------- |
| `mro-orchestrator`| primary  | `9router/deep`      | only `.opencode/plans/`   |
| `mro-architect`   | all      | `9router/deep`      | only `.opencode/plans/`   |
| `mro-implementer` | all      | `9router/deep`      | source code               |
| `mro-reviewer`    | subagent | `9router/nemo`      | only `.opencode/reviews/` |
| `mro-test-runner` | subagent | `9router/nemo`      | only `.opencode/reviews/` |

`mode: all` means the Architect and Implementer can be selected as primary agents
and launched as subagents by the Orchestrator. The Reviewer and Test Runner stay
subagents.

The Orchestrator is the project manager. It splits the request, hands each role
the paths and constraints it needs, waits for every report, and gates human
approval:

- it never edits source, only `.opencode/plans/<feature>.orchestrator.json`;
- it runs a hard preflight (`mro-doctor`, `mro-model-check`) before launching any
  child, and resumes from the state file after a restart or compaction;
- it may launch only the four role agents: `mro-architect`, `mro-implementer`,
  `mro-reviewer`, and `mro-test-runner`;
- it runs the Reviewer and Test Runner in parallel after implementation;
- the fix loop is conditional: the same implementer session gets the findings,
  and another round is allowed while CRITICAL decreases, up to three rounds. Flat
  or rising CRITICAL stops the run; CRITICAL must reach zero, while HIGH may be
  deferred only with the human's explicit agreement;
- it never runs `git push` or `sudo`.

Every phase transition rewrites `.opencode/plans/<feature>.orchestrator.json` and
appends one JSON line to `.opencode/plans/<feature>.log.jsonl`. The state file is
the durable source of truth: phase, plan hash, sessions, acceptance counts, changed
files, exit codes, review round, and severity history. `/mro-status` renders it, so
a human can see where the run stands without reading the transcript.

The Reviewer is **blind**: it gets the diff, the acceptance criteria, and
`AGENTS.md`, not the plan's design rationale. A separate model helps only if it
also judges from independent evidence.

Subagents get a fresh context, so each handoff carries the feature slug, plan
path, review path, diff scope, prior findings, and a return contract.

Shipped model values are `9router/deep` (orchestrator, architect, implementer, and
the `build` agent) and `9router/nemo` (reviewer, test-runner, title, summary,
compaction). They come from the local 9Router gateway configured under
`providers.9router`; `ROUTER_API_KEY` supplies the credential. Replace them with
any id from `opencode models`. Paid models look better on paper but can fail with
"Insufficient balance", which is exactly why the Orchestrator runs
`mro-model-check` before the first phase. Every agent model is a single `model:`
line.

Model failure has no silent fallback by design: a fallback would change output
quality without telling the human. The preflight stops the run instead, and the
human decides whether to switch models or top up the balance.

Session title, summary, and compaction are configured through
`agents.title.model` / `agents.summary.model` / `agents.compaction.model`. Do not
use `small_model`; it is deprecated in V2.

- The Architect must produce an **Acceptance Criteria** section (`- [ ]`
  bullets) and a **Documentation impact** section (README sections, config/env
  keys, behavior doc, draft changelog line) before writing a plan. A plan without
  them is incomplete.
- The Implementer follows a **Self-Correction Protocol** for failing commands
  (classify, minimal fix, re-run, stop after two different failures) and a
  **Definition of Done** (`check-acceptance` → typecheck → `secret-audit` →
  `mro-behavior-docs` → README update → review). Under an Orchestration handoff it
  stops before review and returns its report.
- Every role discovers and loads the project skills that match its task, not just
  the shipped `mro-*` ones. Skills and `AGENTS.md` override general assumptions; a
  conflict follows `AGENTS.md` and is reported.
- Acceptance criteria are machine-readable: each one carries a `verify:` command
  (or `manual:`), `[x]` requires an `evidence:` note, and `[~]` requires a
  `reason:`. `check-acceptance` reports the gap instead of trusting a tick.
- `README.md` is a deliverable: the Orchestrator checks it before review and the
  Reviewer flags stale documentation for user-facing changes.
- `CHANGELOG.md` is written only after the human's final approval, by the
  Implementer, so completed work leaves a trace. The Orchestrator verifies the
  entry before marking the work done.
- The Reviewer gets a different model *and* a blind brief: the diff, the acceptance
  criteria, and `AGENTS.md`, not the plan's rationale. Each checklist item must
  return PASS/FAIL/N/A. `mro-test-runner` only executes the suite and writes its
  log.
- CRITICAL must reach zero; HIGH findings are fixed or explicitly accepted as
  deferrals. The loop continues while CRITICAL decreases, at most three rounds.
- Every agent repeats `git push *` and `sudo *` as `deny` at the end of its own
  permission list, because agent rules are appended after project rules and a
  broad `shell: "*"` would otherwise re-open them. `policies` back this up.
- No test or typecheck command is pre-approved for any agent. The template does
  not know your runner; add the `allow` rules once you fill in `<TEST_CMD>` and
  friends. Examples are commented in each agent file.
- New sessions start in the Orchestrator (`default_agent`). Use `/agent` to pick
  the Architect for a manual plan, or `--agent build` for a plain session.

## Commands

| Command                | Agent        | Purpose                                                              |
| ---------------------- | ------------ | -------------------------------------------------------------------- |
| `/mro-orchestrate <text>`  | orchestrator | plan, approve, implement, review, and test with human gates          |
| `/mro-status`              | orchestrator | read the state file and report phase, remaining work, and blockers   |
| `/mro-plan-feature <text>` | architect    | write a plan to `.opencode/plans/`                                   |
| `/mro-run-review`          | reviewer     | review the diff, write `.opencode/reviews/current.md`                |
| `/mro-fix-tests [cmd]`     | implementer  | run the suite and fix failures without weakening tests               |
| `/mro-deliver`             | implementer  | status + README + `<TEST_CMD>` + reviewer + changelog after approval |

`/mro-orchestrate` is the one-shot entry point: it launches the Architect,
stops for plan approval, then launches the Implementer, checks the README, runs
the Reviewer and Test Runner, and adds the changelog entry after final approval.
The manual commands are unchanged; they are useful when you want to drive one role
at a time.

Commands are user-invoked. The Implementer cannot run them; it launches the
`mro-reviewer` subagent instead (see the Handoff Protocol in `AGENTS.md`). This is
why `/mro-deliver` tells the agent to launch `mro-reviewer` directly: an agent has no
tool that invokes a slash command.

`agent:` frontmatter is honored by the TUI. `opencode run "/cmd"` was observed
keeping the current agent, so `/mro-run-review` explicitly delegates to the
`mro-reviewer` subagent instead of relying on the frontmatter alone. The same
applies to `/mro-deliver`: outside the TUI it runs on the current agent, so start it
with `--agent implementer` if you script it.

`/mro-deliver` uses shell interpolation (``!`git status --short` `` and
``!`git diff --stat` ``), a V2 command feature: the output is pasted into the
prompt before the agent starts. Two limits matter:

- Interpolation runs through `processes.run` directly, so it does **not** pass
  through the permission rules. Keep injected commands read-only, and never put
  `<TEST_CMD>` in an interpolation block: that would bypass the ask/allow model
  and hardcode a runner into a stack-neutral template.
- If an injected command fails, the whole command fails before the agent starts
  (`Shell interpolation failed for ...`).

## Workflow

### Orchestrated (default)

```
1. Human: /mro-orchestrate "<feature>"
2. Orchestrator: hard preflight (`mro-doctor`, `mro-model-check`), inventory
   skills, read a prior state file when resuming, write the new state file
3. Orchestrator → Architect: plan + Acceptance Criteria (each with `verify:`) +
   Documentation impact
4. Orchestrator: validate the plan, present it, STOP
5. Human: approve the plan
6. Orchestrator → Implementer: approved plan + available skills; no reviewer launch
7. Implementer: code, check-file, typecheck, tests, check-acceptance, secret-audit,
   mro-behavior-docs, README update, return changed files and exit codes
8. Orchestrator: verify README and `mro-doctor --docs`, then → Reviewer + Test
   Runner in parallel
9. Orchestrator → same Implementer session: fix CRITICAL/HIGH and failures
10. Orchestrator → Test Runner, then Reviewer again; repeat while CRITICAL
    decreases, at most three rounds
11. Orchestrator: report evidence including README state, ask for final approval
12. Human: final approval
13. Orchestrator → Implementer: changelog-only handoff
14. Orchestrator: verify CHANGELOG.md entry, mark done
```

The Orchestrator owns the review and test gates. It never edits source, README,
or the changelog, and never pushes. CRITICAL findings must reach zero before final
approval; a flat or rising CRITICAL count stops the loop and goes to the human, and
HIGH findings are either fixed or explicitly accepted as deferrals. No work is
marked done before the changelog entry exists.

### Manual

```
1. Human: /mro-plan-feature "<feature>"
2. Architect: loads mro-project-stack → writes plan + Acceptance Criteria + Documentation impact
3. Human: approves the plan
4. Implementer: reads the plan, loads mro-project-stack (mro-data-model if needed), codes
5. Implementer: check-file on new/moved files, when configured
6. Implementer: <TYPECHECK_CMD>, then <TEST_CMD> → Self-Correction + plugin reminder
7. Implementer: check-acceptance → implement, test, or explicitly defer each item
8. Implementer: mro-behavior-docs → docs/behaviors/<feature>.md
9. Implementer: update README.md for user-facing changes
10. Implementer: launches the reviewer subagent (step 3 of the Handoff Protocol)
    with the diff and the acceptance criteria, not the design rationale
11. Reviewer: mro-code-review-checklist → PASS/FAIL/N/A per item → .opencode/reviews/
12. Implementer: fixes CRITICAL/HIGH findings, re-runs the suite and the reviewer;
    another round while CRITICAL decreases, at most three
13. Human: final approval
14. Implementer: adds the CHANGELOG.md entry
```

Once a feature is implemented, `/mro-deliver` is the shortcut for steps 6 and
9-12: it injects `git status`/`git diff --stat`, updates the README, runs
`<TEST_CMD>`, launches the reviewer, loops on CRITICAL/HIGH findings, and adds the
changelog entry after the human approves.

### Documentation deliverables

Every completed feature leaves three durable records:

| File | Written by | When | Purpose |
| --- | --- | --- | --- |
| `README.md` | Implementer | during implementation | install, run, config/env, usage, tests, limitations |
| `docs/contracts/<feature>.md` | Architect + Implementer | during plan + implementation | interface signatures, invariants, edge cases, `verify:` commands; the unit reviewers approve |
| `docs/behaviors/<feature>.md` | Implementer (`mro-behavior-docs`) | during implementation | per-feature behavior detail |
| `CHANGELOG.md` | Implementer | only after final human approval | dated record of what changed, with test evidence and artifact paths |

The Orchestrator cannot write any of them; it validates the README before review
and the changelog entry before marking the work done. The changelog format is a
`## <YYYY-MM-DD> — <feature>` section at the top, no invented version numbers.

A behavior doc is not write-once. It starts with two retention fields:

```yaml
last_verified: 2026-11-20
source_files: src/health.ts, src/routes.ts
```

`node .opencode/scripts/mro-doctor.mjs --docs` reports a doc as stale when one of
its `source_files` is newer than `last_verified`. The Orchestrator treats a stale
doc as a gap and the Reviewer as a HIGH finding. Refresh `last_verified` only after
the checks were actually re-run against the current code — otherwise the date is a
lie, which is worse than an obviously old doc.

### Project skills

Agents discover skills from `.opencode/skills/` (and the user's global skill
directory) and load every one that matches the task. The `mro-*` skills are a
starting point, not a limit. When a skill conflicts with `AGENTS.md`, `AGENTS.md`
wins and the conflict is reported. The Orchestrator passes the available skill
names in every subagent handoff, because subagents start with fresh context.

## Skills

| Skill                   | Load when                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `mro-project-stack`         | before designing or implementing anything                                           |
| `mro-data-model`            | the task touches queries, mutations, or schema                                      |
| `mro-behavior-docs`         | when a feature's acceptance criteria are verified and it is time to record behavior |
| `mro-code-review-checklist` | during review                                                                       |

## Contracts and review levels

The contract file `docs/contracts/<feature>.md` is mandatory for every plan.
It contains:

- interface signatures (input, output, error codes);
- invariants — what must never change, as a single enforceable sentence;
- explicit edge cases (null, empty, concurrent, timeout, boundary values),
  each with expected behavior and a machine-readable `verify:` command;
- `review_level:` — `minimal`, `reviewed`, or `full`, set by the Architect or
  the human at plan gate (never self-assigned by the agent).

Review levels drive the Orchestrator's risk triage and backpressure:

| Level | Criteria | Human review |
| ----- | -------- | ------------ |
| `minimal` | < 50 lines, no auth/db/new logic | None (automated only) |
| `reviewed` | new logic, API change, or > 200 lines | Focused on risky parts |
| `full` | auth, payments, migration, infra, contract change | Paired + real execution |

When 3+ features await human review, backpressure kicks in: no new
`reviewed`/`full` feature starts until capacity frees up. See `REVIEW_POLICY.md`
for the full block/never-block merge rules.

`mro-project-stack` and `mro-data-model` are placeholders. Fill them in for the project,
or leave the facts `unknown` and let the discovery procedure derive them from the
dependency manifest, lockfile, and schema. A fabricated stack is worse than an
explicit gap. The `AGENTS.md` Project Profile wins for commands if the two
disagree.

`mro-behavior-docs` writes `docs/behaviors/<feature>.md` with what users can do now,
how it behaves per acceptance criterion, what it explicitly does **not** do, the
files touched, and the commands used as evidence. Behavior docs are written by
the implementing agent, so the Reviewer should compare them against the diff.

State is loaded on demand inside skills, not pasted into every prompt. Do not
inline whole schemas or file trees into agent prompts.

## Plugins and tools

| Plugin            | File                                         | Behavior                                                                                                                                          |
| ----------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mro-protect-secrets` | `plugins/mro-protect-secrets/index.js` | blocks `write`/`edit`/`patch`/`shell`/`execute` input that matches a secret pattern (OpenAI-style `sk-`, GitHub, GitLab, AWS, Google, Slack, Stripe, npm, PyPI, private keys), including best-effort base64 decoding |
| `mro-test-feedback`   | `plugins/mro-test-feedback/index.js`   | after a failing test, typecheck, or lint command, appends a "fix before reporting" reminder to the tool result                                    |
| `mro-project-tools`   | `plugins/mro-project-tools/index.js`   | registers `db-status`, `check-file`, `check-acceptance`, `secret-audit`; reads `.opencode/mro-profile.json`                                      |
| `mro-redact`          | `plugins/mro-redact/index.ts`          | replaces secrets with stable tokens before the model sees them and restores them in tool input and shell commands; vault survives restart          |

Registered tools:

| Tool               | Input      | What it does                                                                            |
| ------------------ | ---------- | --------------------------------------------------------------------------------------- |
| `db-status`        | none       | runs the configured migration-status command; no database is assumed                    |
| `check-file`       | `file`     | runs the configured typecheck command and returns only diagnostics mentioning that file |
| `check-acceptance` | `planFile` | reports `[ ]` / `[x]` / `[~]` items with their `verify:`/`evidence:`/`reason:` fields, and flags a confirmed box with no evidence |
| `secret-audit`     | none       | scans the staged/unstaged diff and untracked files for secret patterns (base64 best-effort) |

`.opencode/tools/` is a V1 convention and is not read by V2; tools come from a
plugin. `db-status` runs a fixed read-only command and accepts no arguments, so
it cannot be steered into arbitrary shell input. Both `db-status` and `check-file`
read `.opencode/mro-profile.json` first and fall back to the `MIGRATION_CANDIDATES`
and `TYPECHECK` constants, which ship empty.

`check-file` does nothing until a typecheck runner is configured. It runs one
command and filters its output in JavaScript; the file path is data, never shell
text. Filtering is textual, so a diagnostic that omits the path cannot be matched,
and one that mentions the file only as context is still shown.

`check-acceptance` cannot detect test coverage. It *can* tell the three states
apart: `[ ]` pending, `[x]` confirmed (evidence required), `[~]` deferred (reason
required). It never runs the `verify:` commands — that stays under the normal
shell permission rules. Paths outside the project are refused.

`secret-audit` is the post-run check that the Implementer and Orchestrator call
before reporting. It scans `git diff` and untracked files, not history, and its
base64 decoding is best-effort. It is a safety net, not proof.

`mro-test-feedback` recognizes common runners and checkers out of the box. If this
project uses something else, extend `CHECK_COMMAND` in that file.

A non-zero shell exit arrives as `status: "completed"` with
`result.output.exitCode`, not `status: "error"` — keep that in mind when editing
the feedback hook.

## Type Checking & Diagnostics

`AGENTS.md` requires `<TYPECHECK_CMD>` and, when set, `<LINT_CMD>` before
completion. They are placeholders because every ecosystem names them differently.
The `mro-test-feedback` plugin appends a reminder whenever such a command exits
non-zero, so type errors surface inside the agent loop instead of at review time.
Fix type errors before running tests; a green test run on top of a type error
proves nothing.

### LSP

OpenCode v2.3.0 accepts `"lsp": true` in the config schema but does not implement
it. Measured on a project with a real language server available and a deliberate
type error:

- no language-server process was ever spawned;
- `edit` returned `Edited <file> (1 replacement)` with no diagnostics (V1
  appended diagnostics to edit results);
- there is no diagnostics tool in the V2 tool catalog, and the V2 docs index has
  no LSP page.

So the block stays commented out in `opencode.jsonc`; an enabled-but-dead key
would just look healthy. If a later build starts servers, uncomment it and add
"fix LSP diagnostics first" back to the rules. Until then the typecheck command
is the real feedback channel, which is also what OpenCode's own LSP docs
recommend for most projects.

## Compaction and stability

```jsonc
"compaction": { "auto": true, "keep": { "tokens": 24000 }, "buffer": "20%" }
```

`keep.tokens` raises the verbatim tail from 15k to 24k, and `buffer: "20%"`
starts compaction at 80% of the model window. Summaries use
`agents.compaction.model` instead of the session model. Compaction is still
lossy: raise `keep.tokens` further if exact API contracts keep getting
summarized away.

Manual compaction: `/compact`, or the `session.compact` keybind (`<leader>c`;
the leader defaults to `ctrl+x`). `/compact` was verified to be a real command
rather than a chat message. The API equivalent is
`opencode api post /api/session/<id>/compact --data '{}'`.

Three safeguards live in `AGENTS.md`:

1. **Plan mode** — the Architect must not call `edit`, `write`, or `patch` outside
   `.opencode/plans/`, and must stop rather than look for a way around it. This
   is backed by its `edit: deny` permissions.
2. **Session hygiene** — compact around 30 turns, or start a fresh session when
   the summary would carry stale state. Decisions belong in a plan or behavior
   doc, not in scrollback.
3. **Stuck loops** — two consecutive turns with no file edit and no command mean
   stop and report. The harness cannot enforce this; it exists so a meta-planning
   loop is visible instead of silently burning tokens.

## Configuration

`opencode.jsonc` is commented line by line. The short version:

| Key                                  | Value               | Why                                                 | Change it                                                         |
| ------------------------------------ | ------------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| `providers`                          | 9Router             | one local OpenAI-compatible gateway and two models  | add your own provider, or point `settings.baseURL` at your gateway |
| `model`                              | `9router/deep`      | an unpinned session can silently use a paid model   | any id from `opencode models`                                     |
| `default_agent`                      | `mro-orchestrator`  | work starts with a plan and a human gate            | `mro-architect` for the manual flow, `build` for a plain session  |
| `formatter`                          | `true`              | agent output matches project style                  | `false`, or configure per-language formatters                     |
| `snapshots`                          | `true`              | `/undo` and `/redo` work without a commit           | `false` only if you always commit first                           |
| `share`                              | `disabled`          | sessions contain code and can contain secrets       | `manual` to allow `/share`                                        |
| `watcher.ignore`                     | empty               | the template assumes no build system                | add this project's heavy directories                              |
| `tool_output`                        | 4000 lines / 100 KB | failing suites exceed the 2000/50 KB default        | lower both to save context                                        |
| `permissions`                        | see below           | least privilege for every tool                      | see "Permission model"                                            |
| `policies`                           | `sudo`, `git push`  | survives "Allow always" and agent-level allows      | add `shell:<command>` entries                                     |
| `agents.*.model`                     | `<MODEL_ID>`        | title/summary/compaction do not need a strong model | replace with your models; `small_model` is deprecated             |
| `compaction`                         | auto, 24k tail, 20% | keep API contracts and diffs readable               | raise/lower `keep.tokens`                                         |
| `websearch`                          | unset               | the template assumes no provider                    | add `{ "provider": "<PROVIDER_ID>" }` and its key                 |
| `experimental.todo`                  | `true`              | a todo list makes multi-step work visible           | remove if a release breaks it                                     |
| `experimental.background_compaction` | `true`              | summary is written before it is needed              | remove if a release breaks it                                     |
| `lsp`                                | commented out       | v2.3.0 accepts the key but starts nothing           | uncomment when a build supports LSP                               |

### Permission model

Rules are evaluated in this order, and the **last match wins**:

1. the built-in base policy, which allows everything and asks for `.env` reads;
2. the project rules in `opencode.jsonc`;
3. the rules in each agent file, appended last.

This is why an agent's broad `shell: "*"` rule would defeat the project rules, and
why `git push` and `sudo` are denied again at the end of every agent file and in
`policies`. `policies` run after permissions and saved approvals, can only deny,
and therefore cannot be undone by "Allow always".

What the project rules do:

| Rule                                                                               | Effect | Why                                                                   |
| ---------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------- |
| `shell: "*"`                                                                       | ask    | shell runs with the user's filesystem, process, and network authority |
| `git status/diff/log/show/rev-parse/branch`                                        | allow  | read-only, frequent, harmless                                         |
| `git push`, `sudo`                                                                 | deny   | publishing and privilege escalation are never part of this workflow   |
| `read *.env*`, `*.npmrc`, `*.netrc`, `*.git-credentials`, `*.pem`, `id_rsa*`       | deny   | secrets                                                               |
| `read *.env.example`                                                               | allow  | placeholders only; must come after the deny                           |
| `external_directory`                                                               | ask    | nothing outside the project without a human                           |
| `edit *.env*`, `.git/*`, `.githooks/*`                                             | deny   | secrets, history, the secret scan                                     |
| `edit AGENTS.md`, `opencode.jsonc`, `.opencode/{agents,plugins,skills,commands}/*` | deny   | the agent's own guardrails                                            |
| `edit *.env.example`                                                               | allow  | placeholders only                                                     |

Locked paths, in one list: `AGENTS.md`, `opencode.jsonc`, `.opencode/agents/`,
`.opencode/plugins/`, `.opencode/skills/`, `.opencode/commands/`, `.githooks/`,
`.git/`, every `.env*` file except `.env.example`. Humans edit these by hand. To
let an agent maintain one, delete its line from `permissions` (and, for push or
sudo, the matching `policies` entry).

Subagent launches use their own permission action: `action: subagent` with the
agent id as `resource`. The Orchestrator denies `subagent: "*"` and then allows
only `mro-architect`, `mro-implementer`, `mro-reviewer`, and `mro-test-runner`.
That is the allowlist that keeps it from spawning arbitrary helpers.

No runner is pre-approved. Add one `allow` rule per command the Implementer and
Test Runner should run without a prompt. In `opencode run` there is nobody to ask,
so an unlisted command is rejected unless you pass `--auto`.

Limits worth knowing:

- `read` rules do not stop `shell` from printing a file. That is exactly why
  shell stays on `ask`; `.env` protection is not absolute.
- A broad rule inside an agent file overrides project rules for that agent. If
  you add one, re-add the denies you still need after it.
- `check-file` and the other plugin tools are invoked through Code Mode
  (`execute`). The Architect, Reviewer, and Test Runner deny `execute`; the
  Implementer keeps it.

## Verify

The behavioural checks need a filled profile, because nothing is pre-approved:

```bash
node .opencode/scripts/mro-doctor.mjs          # exit 0 only when no placeholder/profile gap remains
node .opencode/scripts/mro-model-check.mjs     # one-token gateway preflight
opencode debug config      # opencode.jsonc discovered and parsed, providers.9router present
opencode debug agents      # orchestrator / architect / implementer / reviewer / test-runner
opencode plugin list       # mro-protect-secrets, mro-test-feedback, mro-project-tools, mro-redact
opencode run "/mro-orchestrate add a health endpoint"  # stops for plan approval
# after implementation: README.md is current; after final approval: CHANGELOG.md entry exists
opencode run "/mro-status"     # renders the state file, or says there is none
opencode run "/mro-run-review" # command expands and selects the reviewer
opencode run --agent implementer "/mro-deliver"  # status injected, then stops on <TEST_CMD>
opencode run --agent mro-orchestrator "edit src/app.py"  # permission.rejected
opencode run --agent mro-orchestrator "run: git push --dry-run"  # permission.rejected
opencode run --agent implementer "run: git push --dry-run"    # must be denied
opencode run --agent implementer "run: sudo true"             # must be denied
opencode run --agent implementer "append a line to AGENTS.md" # permission.rejected
opencode run --agent implementer "read .env.local"            # permission.rejected
opencode run --agent implementer "run: <TEST_CMD>"            # ask until an allow rule exists
opencode run "Load skill mro-code-review-checklist and reply OK"
opencode run "call the db-status tool and report the migration state"  # "not configured" by default
opencode run "write secret.txt with sk-proj-AAAABBBBCCCCDDDDEEEEFFFF"   # must be blocked
```

Template self-tests (no dependency, no project setup):

```bash
node --test product/tests/*.test.mjs
```

These tests cover the template's own logic: `check-acceptance` parsing and
refusals, `mro-protect-secrets` positive/negative samples including base64, and
`mro-doctor` detection plus profile writing against a temporary dummy project.
They do not run an agent session, so they prove the tools, not the prompt
behavior. Add an agent-level check when you change a prompt.

Pre-commit scan:

```bash
printf 'key = "AKIA1234567890ABCDEF"\n' > leak.txt
git add leak.txt
git commit -m test    # must fail with "pre-commit: potential secret"
rm leak.txt
```

## Worked example (Node + TypeScript + Prisma)

For illustration only. The template does not ship these values; replace them with
your stack's.

```md
# AGENTS.md → Project Profile

- Stack: `Next.js 15 (App Router)`
- Primary language: `TypeScript`
- Test command: `pnpm test`
- Typecheck command: `pnpm exec tsc --noEmit`
- Lint command: `pnpm lint`
- Build command: `pnpm build`
- Migration command: `pnpm exec prisma migrate status`
- Dependency manifest / lockfile: `pnpm-lock.yaml`
- Language rules: `strict mode; no any; explicit public types`
```

```yaml
# agents/mro-implementer.md  (and test-runner, for the test command)
- action: shell
  resource: "pnpm test *"
  effect: allow
- action: shell
  resource: "pnpm exec tsc --noEmit *"
  effect: allow
- action: shell
  resource: "pnpm lint *"
  effect: allow
- action: shell
  resource: "pnpm build *"
  effect: allow
```

```js
// plugins/mro-project-tools/index.js
const MIGRATION_CANDIDATES = [
  {
    file: "prisma/schema.prisma",
    label: "Prisma",
    cmd: "pnpm",
    args: ["exec", "prisma", "migrate", "status"],
  },
];
const TYPECHECK = {
  cmd: "pnpm",
  args: ["exec", "tsc", "--noEmit", "--pretty", "false"],
  extensions: [".ts", ".tsx", ".js", ".jsx"],
};
```

## Notes

- Permissions are appended, not replaced; see "Permission model" above for the
  ordering rules and why `git push`/`sudo` are repeated in every agent file.
- `permissions` (array of `action`/`resource`/`effect`) is the V2 shape.
  `permission:` maps and `bash:` keys are V1 and deprecated.
- No MCP servers are configured on purpose, to keep context small. Add one only
  when a task needs it, under `mcp.servers`.
- Web search is off until you set a provider and its key. `OPENCODE_ENABLE_EXA`
  is the V1 switch; do not use it in V2 config.
- Secret defence is pattern-based and best-effort. `plugins/mro-protect-secrets/`
  blocks tool calls; `.githooks/pre-commit` blocks the commit; the `secret-audit`
  tool checks the working tree after a run. Patterns cover the common providers,
  and a naive base64 blob is decoded and re-scanned. Split or obfuscated secrets,
  encrypted blobs, and binary files are still not caught. Code Mode (`execute`)
  and MCP tools are only partially covered, and `--no-verify` skips the hook.
  A clean scan is a signal, not a guarantee.
- `.env` files are denied to `read`/`edit`/`shell` by the permission rules, but
  `read` cannot intercept a `shell` command that cats the file. The only hard
  isolation is running the agent where the file is not mounted.
- The fix loop, the state file, and the acceptance verify fields are the strongest
  accuracy levers in this template: they make "done" falsifiable. If you remove
  one to simplify, expect more silent false completion.
