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
| Commands | `commands/{mro-orchestrate,mro-plan-feature,mro-run-review,mro-fix-tests,mro-deliver}.md`          | user-invoked entry points                       |
| Plugins  | `plugins/{mro-protect-secrets,mro-test-feedback,mro-project-tools}/index.js`                  | secret blocking, failure feedback, custom tools |
| Memory   | `.opencode/plans/`, `.opencode/reviews/`, `docs/behaviors/`                            | plans, review reports, behavior docs            |
| Deliverables | `README.md`, `CHANGELOG.md`                                                        | product usage guide and completed-work history  |

`.opencode/plans/` and `.opencode/reviews/` are git-ignored scratch space.
`docs/behaviors/` is a deliverable, created the first time the `mro-behavior-docs`
skill runs.

## Install

```bash
cd /path/to/mr-opencode
mkdir -p /path/to/new-project/.opencode/{agents,commands,plugins,skills}
cp -r product/agents/.   /path/to/new-project/.opencode/agents/
cp -r product/commands/. /path/to/new-project/.opencode/commands/
cp -r product/plugins/.  /path/to/new-project/.opencode/plugins/
cp -r product/skills/.   /path/to/new-project/.opencode/skills/
cp    product/configs/opencode.jsonc /path/to/new-project/opencode.jsonc
cp -r product/AGENTS.md product/.githooks product/.env.example \
      product/.gitignore /path/to/new-project/
cd /path/to/new-project
git init                              # required: undo/revert depends on Git
git config core.hooksPath .githooks   # enables the pre-commit secret scan
```

Then fill in the placeholders (next section). Nothing else has to be installed
for the workflow itself: it is plain Markdown, JSONC, and JavaScript.

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
ask instead of guessing a command.

The shipped `providers.9router` block reads its credential from
`ROUTER_API_KEY`. Export it in the environment or add it to `.env` (see
`.env.example`), otherwise every `9router/*` model is unavailable.

The plugin configuration lives in code, not in config:

```js
// plugins/mro-project-tools/index.js
const MIGRATION_CANDIDATES = []; // add { file, label, cmd, args } entries
const TYPECHECK = null; // add { cmd, args, extensions }
```

Until those are set, `db-status` and `check-file` answer "not configured" — an
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

- it never edits source, only `.opencode/plans/<feature>.orchestrator.md`;
- it may launch only the four role agents: `mro-architect`, `mro-implementer`,
  `mro-reviewer`, and `mro-test-runner`;
- it runs the Reviewer and Test Runner in parallel after implementation;
- the fix loop sends findings back to the same implementer session, then re-runs
  tests and reviews once; remaining issues go to the human;
- it never runs `git push` or `sudo`.

Subagents get a fresh context, so each handoff carries the feature slug, plan
path, review path, diff scope, prior findings, and a return contract. The
Orchestrator also keeps a durable state file so multi-turn approvals and
compaction do not lose the phase.

Shipped model values are `9router/deep` (orchestrator, architect, implementer, and
the `build` agent) and `9router/nemo` (reviewer, test-runner, title, summary,
compaction). They come from the local 9Router gateway configured under
`providers.9router`; `ROUTER_API_KEY` supplies the credential. Replace them with
any id from `opencode models`. Paid models look better on paper but can fail with
"Insufficient balance". Every agent model is a single `model:` line.

Session title, summary, and compaction are configured through
`agents.title.model` / `agents.summary.model` / `agents.compaction.model`. Do not
use `small_model`; it is deprecated in V2.

- The Architect must produce an **Acceptance Criteria** section (`- [ ]`
  bullets) and a **Documentation impact** section (README sections, config/env
  keys, behavior doc, draft changelog line) before writing a plan. A plan without
  them is incomplete.
- The Implementer follows a **Self-Correction Protocol** for failing commands
  (classify, minimal fix, re-run, stop after two different failures) and a
  **Definition of Done** (`check-acceptance` → typecheck → `mro-behavior-docs` →
  README update → review). Under an Orchestration handoff it stops before review
  and returns its report.
- Every role discovers and loads the project skills that match its task, not just
  the shipped `mro-*` ones. Skills and `AGENTS.md` override general assumptions; a
  conflict follows `AGENTS.md` and is reported.
- `README.md` is a deliverable: the Orchestrator checks it before review and the
  Reviewer flags stale documentation for user-facing changes.
- `CHANGELOG.md` is written only after the human's final approval, by the
  Implementer, so completed work leaves a trace. The Orchestrator verifies the
  entry before marking the work done.
- The Reviewer gets a different model on purpose: independent review without the
  implementer's alignment bias. `mro-test-runner` only executes the suite and
  writes its log.
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
2. Orchestrator: preflight AGENTS.md, inventory skills, write state file
3. Orchestrator → Architect: plan + Acceptance Criteria + Documentation impact
4. Orchestrator: validate the plan, present it, STOP
5. Human: approve the plan
6. Orchestrator → Implementer: approved plan + available skills; no reviewer launch
7. Implementer: code, check-file, typecheck, tests, check-acceptance,
   mro-behavior-docs, README update, return changed files and exit codes
8. Orchestrator: verify README, then → Reviewer + Test Runner in parallel
9. Orchestrator → same Implementer session: fix CRITICAL/HIGH and failures
10. Orchestrator → Test Runner, then Reviewer once more
11. Orchestrator: report evidence including README state, ask for final approval
12. Human: final approval
13. Orchestrator → Implementer: changelog-only handoff
14. Orchestrator: verify CHANGELOG.md entry, mark done
```

The Orchestrator owns the review and test gates. It never edits source, README,
or the changelog, and never pushes. If findings remain after the single
re-review, it stops and asks the human instead of looping. No work is marked done
before the changelog entry exists.

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
11. Reviewer: mro-code-review-checklist → reviews the diff → .opencode/reviews/
12. Implementer: fixes CRITICAL/HIGH findings, re-runs the reviewer once
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
| `docs/behaviors/<feature>.md` | Implementer (`mro-behavior-docs`) | during implementation | per-feature behavior detail |
| `CHANGELOG.md` | Implementer | only after final human approval | dated record of what changed, with test evidence and artifact paths |

The Orchestrator cannot write any of them; it validates the README before review
and the changelog entry before marking the work done. The changelog format is a
`## <YYYY-MM-DD> — <feature>` section at the top, no invented version numbers.

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
| `mro-protect-secrets` | `plugins/mro-protect-secrets/index.js` | blocks `write`/`edit`/`patch`/`shell`/`execute` input that matches a secret pattern (OpenAI-style `sk-`, GitHub tokens, AWS `AKIA`, private keys) |
| `mro-test-feedback`   | `plugins/mro-test-feedback/index.js`   | after a failing test, typecheck, or lint command, appends a "fix before reporting" reminder to the tool result                                    |
| `mro-project-tools`   | `plugins/mro-project-tools/index.js`   | registers `db-status`, `check-file`, `check-acceptance`                                                                                           |
| `mro-redact`          | `plugins/mro-redact/index.ts`          | replaces secrets with stable tokens before the model sees them and restores them in tool input and shell commands; vault survives restart          |

Registered tools:

| Tool               | Input      | What it does                                                                            |
| ------------------ | ---------- | --------------------------------------------------------------------------------------- |
| `db-status`        | none       | runs the configured migration-status command; no database is assumed                    |
| `check-file`       | `file`     | runs the configured typecheck command and returns only diagnostics mentioning that file |
| `check-acceptance` | `planFile` | counts `- [ ]` / `- [x]` bullets and lists unchecked criteria                           |

`.opencode/tools/` is a V1 convention and is not read by V2; tools come from a
plugin. `db-status` runs a fixed read-only command and accepts no arguments, so
it cannot be steered into arbitrary shell input. `MIGRATION_CANDIDATES` is empty
by default; add one entry per migration tool, with a marker file and a read-only
status command.

`check-file` does nothing until `TYPECHECK` is set. It runs one command and
filters its output in JavaScript; the file path is data, never shell text.
Filtering is textual, so a diagnostic that omits the path cannot be matched, and
one that mentions the file only as context is still shown.

`check-acceptance` cannot detect test coverage, and it cannot tell a deliberate
deferral from an ignored item. Paths outside the project are refused. Never tick
a box without evidence: a passing test, verified command output, or human
confirmation.

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
opencode debug config      # opencode.jsonc discovered and parsed, providers.9router present
opencode debug agents      # orchestrator / architect / implementer / reviewer / test-runner
opencode plugin list       # mro-protect-secrets, mro-test-feedback, mro-project-tools
opencode run "/mro-orchestrate add a health endpoint"  # stops for plan approval
# after implementation: README.md is current; after final approval: CHANGELOG.md entry exists
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
  blocks tool calls; `.githooks/pre-commit` blocks the commit. Code Mode (`execute`)
  and MCP tools are only partially covered, and `--no-verify` skips the hook.
  Neither layer catches base64-encoded or split secrets.
