# Vibecoding project template

Project-local OpenCode setup for the Architect → Implementer → Reviewer workflow:
from an idea to verified, documented behavior. Product work only — no CI/CD, no
GitHub Actions, no MCP servers.

The template is **stack-neutral on purpose**. Nothing here assumes a language,
package manager, test runner, database, or framework. Every such value is a
`<PLACEHOLDER>` that must be filled in for the project before the workflow runs
end to end. See [Fill-in checklist](#fill-in-checklist).

This directory is **not** synced by `opc-sync`; copy it into a project by hand.

## What's in here

| Layer | Files | Purpose |
| --- | --- | --- |
| Config | `opencode.jsonc`, `AGENTS.md`, `.gitignore`, `.githooks/pre-commit` | governance, standards, secret scan |
| Agents | `.opencode/agents/{architect,implementer,reviewer,test-runner}.md` | role, model, and permission separation |
| Skills | `.opencode/skills/{project-stack,data-model,behavior-docs,code-review-checklist}/SKILL.md` | on-demand knowledge, no permanent context cost |
| Commands | `.opencode/commands/{plan-feature,run-review,fix-tests,deliver}.md` | user-invoked entry points |
| Plugins | `.opencode/plugins/{protect-secrets,test-feedback,project-tools}/index.js` | secret blocking, failure feedback, custom tools |
| Memory | `.opencode/plans/`, `.opencode/reviews/`, `docs/behaviors/` | plans, review reports, behavior docs |

`.opencode/plans/` and `.opencode/reviews/` are git-ignored scratch space.
`docs/behaviors/` is a deliverable, created the first time the `behavior-docs`
skill runs.

## Install

```bash
cp -r product/templates/vibecoding/. /path/to/new-project/
cd /path/to/new-project
git init                              # required: undo/revert depends on Git
git config core.hooksPath .githooks   # enables the pre-commit secret scan
```

Then fill in the placeholders (next section). Nothing else has to be installed
for the workflow itself: it is plain Markdown, JSONC, and JavaScript.

## Fill-in checklist

| Placeholder | Where to fill it | Meaning |
| --- | --- | --- |
| `<STACK>` | `AGENTS.md`, `project-stack` skill | framework and runtime, in one line |
| `<LANGUAGE>` | `AGENTS.md` | primary language |
| `<TEST_CMD>` | `AGENTS.md`, agent `allow` rules | the command that runs the suite |
| `<TYPECHECK_CMD>` | `AGENTS.md`, `project-tools` plugin | static check; `-` if none |
| `<LINT_CMD>` | `AGENTS.md`, agent `allow` rules | linter; `-` if none |
| `<BUILD_CMD>` | `AGENTS.md`, agent `allow` rules | build/compile command |
| `<MIGRATION_CMD>` | `AGENTS.md`, `project-tools` plugin | migration status; `-` if none |
| `<LOCKFILE>` | `AGENTS.md` | dependency lock file to keep committed |
| `<LANGUAGE_RULES>` | `AGENTS.md` | strictness, banned escape hatches, naming |
| `<MODEL_ID>` | `opencode.jsonc`, `.opencode/agents/*.md` | model id from `opencode models` |
| `<SCHEMA_PATH>` | `data-model` skill | the authoritative schema |
| `<PROVIDER_ID>` | `opencode.jsonc`, `.env` | web search provider, optional |

Rule enforced in `AGENTS.md`: while a `<...>` token remains, the agents stop and
ask instead of guessing a command.

The plugin configuration lives in code, not in config:

```js
// .opencode/plugins/project-tools/index.js
const MIGRATION_CANDIDATES = []   // add { file, label, cmd, args } entries
const TYPECHECK = null            // add { cmd, args, extensions }
```

Until those are set, `db-status` and `check-file` answer "not configured" — an
honest gap, not a silent guess.

## Agents

| Agent | Mode | Model | May write |
| --- | --- | --- | --- |
| `architect` | primary | `<MODEL_ID>` | only `.opencode/plans/` |
| `implementer` | primary | `<MODEL_ID>` | source code |
| `reviewer` | subagent | `<MODEL_ID>` | only `.opencode/reviews/` |
| `test-runner` | subagent | `<MODEL_ID>` | nothing |

Shipped model values are `opencode/longcat-2.5-free` (architect, implementer, and
the `build` agent) and `opencode/hy4-flash-free` (reviewer, test-runner, title,
summary, compaction). They are machine defaults picked because they run without
credits; they are not a stack requirement. Replace them with any id from
`opencode models`. Paid models (`opencode/claude-fable-5-2`,
`opencode/gemini-4-hydrogen`) look better on paper but failed here with
"Insufficient balance". Every agent model is a single `model:` line.

Session title, summary, and compaction are configured through
`agents.title.model` / `agents.summary.model` / `agents.compaction.model`. Do not
use `small_model`; it is deprecated in V2.

- The Architect must produce an **Acceptance Criteria** section (`- [ ]`
  bullets) before writing a plan. A plan without it is incomplete.
- The Implementer follows a **Self-Correction Protocol** for failing commands
  (classify, minimal fix, re-run, stop after two different failures) and a
  **Definition of Done** (`check-acceptance` → typecheck → `behavior-docs` →
  review).
- The Reviewer gets a different model on purpose: independent review without the
  implementer's alignment bias. `test-runner` only executes the suite, so a small
  model is enough.
- Every agent repeats `git push *` and `sudo *` as `deny` at the end of its own
  permission list, because agent rules are appended after project rules and a
  broad `shell: "*"` would otherwise re-open them. `policies` back this up.
- No test or typecheck command is pre-approved for any agent. The template does
  not know your runner; add the `allow` rules once you fill in `<TEST_CMD>` and
  friends. Examples are commented in each agent file.
- New sessions start in the Architect (`default_agent`). Use `--agent build` or
  `/agent` to reach a plain session.

## Commands

| Command | Agent | Purpose |
| --- | --- | --- |
| `/plan-feature <text>` | architect | write a plan to `.opencode/plans/` |
| `/run-review` | reviewer | review the diff, write `.opencode/reviews/current.md` |
| `/fix-tests [cmd]` | implementer | run the suite and fix failures without weakening tests |
| `/deliver` | implementer | status + `<TEST_CMD>` + reviewer, loop until CRITICAL/HIGH are fixed |

Commands are user-invoked. The Implementer cannot run them; it launches the
`reviewer` subagent instead (see the Handoff Protocol in `AGENTS.md`). This is
why `/deliver` tells the agent to launch `reviewer` directly: an agent has no
tool that invokes a slash command.

`agent:` frontmatter is honored by the TUI. `opencode run "/cmd"` was observed
keeping the current agent, so `/run-review` explicitly delegates to the
`reviewer` subagent instead of relying on the frontmatter alone. The same
applies to `/deliver`: outside the TUI it runs on the current agent, so start it
with `--agent implementer` if you script it.

`/deliver` uses shell interpolation (``!`git status --short` `` and
``!`git diff --stat` ``), a V2 command feature: the output is pasted into the
prompt before the agent starts. Two limits matter:

- Interpolation runs through `processes.run` directly, so it does **not** pass
  through the permission rules. Keep injected commands read-only, and never put
  `<TEST_CMD>` in an interpolation block: that would bypass the ask/allow model
  and hardcode a runner into a stack-neutral template.
- If an injected command fails, the whole command fails before the agent starts
  (`Shell interpolation failed for ...`).

## Workflow

```
1. Human: /plan-feature "<feature>"
2. Architect: loads project-stack → writes plan + Acceptance Criteria
3. Human: approves the plan
4. Implementer: reads the plan, loads project-stack (data-model if needed), codes
5. Implementer: check-file on new/moved files, when configured
6. Implementer: <TYPECHECK_CMD>, then <TEST_CMD> → Self-Correction + plugin reminder
7. Implementer: check-acceptance → implement, test, or explicitly defer each item
8. Implementer: behavior-docs → docs/behaviors/<feature>.md
9. Implementer: launches the reviewer subagent (step 3 of the Handoff Protocol)
10. Reviewer: code-review-checklist → reviews the diff → .opencode/reviews/
11. Implementer: fixes CRITICAL/HIGH findings, re-runs the reviewer once
12. Human: final approval
```

Once a feature is implemented, `/deliver` is the shortcut for steps 6 and 9-11:
it injects `git status`/`git diff --stat`, runs `<TEST_CMD>`, launches the
reviewer, and loops on CRITICAL/HIGH findings.

## Skills

| Skill | Load when |
| --- | --- |
| `project-stack` | before designing or implementing anything |
| `data-model` | the task touches queries, mutations, or schema |
| `behavior-docs` | when a feature's acceptance criteria are verified and it is time to record behavior |
| `code-review-checklist` | during review |

`project-stack` and `data-model` are placeholders. Fill them in for the project,
or leave the facts `unknown` and let the discovery procedure derive them from the
dependency manifest, lockfile, and schema. A fabricated stack is worse than an
explicit gap. The `AGENTS.md` Project Profile wins for commands if the two
disagree.

`behavior-docs` writes `docs/behaviors/<feature>.md` with what users can do now,
how it behaves per acceptance criterion, what it explicitly does **not** do, the
files touched, and the commands used as evidence. Behavior docs are written by
the implementing agent, so the Reviewer should compare them against the diff.

State is loaded on demand inside skills, not pasted into every prompt. Do not
inline whole schemas or file trees into agent prompts.

## Plugins and tools

| Plugin | File | Behavior |
| --- | --- | --- |
| `protect-secrets` | `.opencode/plugins/protect-secrets/index.js` | blocks `write`/`edit`/`patch`/`shell`/`execute` input that matches a secret pattern (OpenAI-style `sk-`, GitHub tokens, AWS `AKIA`, private keys) |
| `test-feedback` | `.opencode/plugins/test-feedback/index.js` | after a failing test, typecheck, or lint command, appends a "fix before reporting" reminder to the tool result |
| `project-tools` | `.opencode/plugins/project-tools/index.js` | registers `db-status`, `check-file`, `check-acceptance` |

Registered tools:

| Tool | Input | What it does |
| --- | --- | --- |
| `db-status` | none | runs the configured migration-status command; no database is assumed |
| `check-file` | `file` | runs the configured typecheck command and returns only diagnostics mentioning that file |
| `check-acceptance` | `planFile` | counts `- [ ]` / `- [x]` bullets and lists unchecked criteria |

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

`test-feedback` recognizes common runners and checkers out of the box. If this
project uses something else, extend `CHECK_COMMAND` in that file.

A non-zero shell exit arrives as `status: "completed"` with
`result.output.exitCode`, not `status: "error"` — keep that in mind when editing
the feedback hook.

## Type Checking & Diagnostics

`AGENTS.md` requires `<TYPECHECK_CMD>` and, when set, `<LINT_CMD>` before
completion. They are placeholders because every ecosystem names them differently.
The `test-feedback` plugin appends a reminder whenever such a command exits
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

| Key | Value | Why | Change it |
| --- | --- | --- | --- |
| `model` | `<MODEL_ID>` | an unpinned session can silently use a paid model | any id from `opencode models` |
| `default_agent` | `architect` | work starts with a plan, per the Handoff Protocol | `build` for a plain session, `implementer` to go straight to code |
| `formatter` | `true` | agent output matches project style | `false`, or configure per-language formatters |
| `snapshots` | `true` | `/undo` and `/redo` work without a commit | `false` only if you always commit first |
| `share` | `disabled` | sessions contain code and can contain secrets | `manual` to allow `/share` |
| `watcher.ignore` | empty | the template assumes no build system | add this project's heavy directories |
| `tool_output` | 4000 lines / 100 KB | failing suites exceed the 2000/50 KB default | lower both to save context |
| `permissions` | see below | least privilege for every tool | see "Permission model" |
| `policies` | `sudo`, `git push` | survives "Allow always" and agent-level allows | add `shell:<command>` entries |
| `agents.*.model` | `<MODEL_ID>` | title/summary/compaction do not need a strong model | replace with your models; `small_model` is deprecated |
| `compaction` | auto, 24k tail, 20% | keep API contracts and diffs readable | raise/lower `keep.tokens` |
| `websearch` | unset | the template assumes no provider | add `{ "provider": "<PROVIDER_ID>" }` and its key |
| `experimental.todo` | `true` | a todo list makes multi-step work visible | remove if a release breaks it |
| `experimental.background_compaction` | `true` | summary is written before it is needed | remove if a release breaks it |
| `lsp` | commented out | v2.3.0 accepts the key but starts nothing | uncomment when a build supports LSP |

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

| Rule | Effect | Why |
| --- | --- | --- |
| `shell: "*"` | ask | shell runs with the user's filesystem, process, and network authority |
| `git status/diff/log/show/rev-parse/branch` | allow | read-only, frequent, harmless |
| `git push`, `sudo` | deny | publishing and privilege escalation are never part of this workflow |
| `read *.env*`, `*.npmrc`, `*.netrc`, `*.git-credentials`, `*.pem`, `id_rsa*` | deny | secrets |
| `read *.env.example` | allow | placeholders only; must come after the deny |
| `external_directory` | ask | nothing outside the project without a human |
| `edit *.env*`, `.git/*`, `.githooks/*` | deny | secrets, history, the secret scan |
| `edit AGENTS.md`, `opencode.jsonc`, `.opencode/{agents,plugins,skills,commands}/*` | deny | the agent's own guardrails |
| `edit *.env.example` | allow | placeholders only |

Locked paths, in one list: `AGENTS.md`, `opencode.jsonc`, `.opencode/agents/`,
`.opencode/plugins/`, `.opencode/skills/`, `.opencode/commands/`, `.githooks/`,
`.git/`, every `.env*` file except `.env.example`. Humans edit these by hand. To
let an agent maintain one, delete its line from `permissions` (and, for push or
sudo, the matching `policies` entry).

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
opencode debug config      # opencode.jsonc discovered and parsed
opencode debug agents      # architect / implementer / reviewer / test-runner
opencode plugin list       # protect-secrets, test-feedback, project-tools
opencode run "/run-review" # command expands and selects the reviewer
opencode run --agent implementer "/deliver"  # status injected, then stops on <TEST_CMD>
opencode run --agent implementer "run: git push --dry-run"    # must be denied
opencode run --agent implementer "run: sudo true"             # must be denied
opencode run --agent implementer "append a line to AGENTS.md" # permission.rejected
opencode run --agent implementer "read .env.local"            # permission.rejected
opencode run --agent implementer "run: <TEST_CMD>"            # ask until an allow rule exists
opencode run "Load skill code-review-checklist and reply OK"
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
# .opencode/agents/implementer.md  (and test-runner, for the test command)
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
// .opencode/plugins/project-tools/index.js
const MIGRATION_CANDIDATES = [
  { file: "prisma/schema.prisma", label: "Prisma", cmd: "pnpm",
    args: ["exec", "prisma", "migrate", "status"] },
]
const TYPECHECK = {
  cmd: "pnpm",
  args: ["exec", "tsc", "--noEmit", "--pretty", "false"],
  extensions: [".ts", ".tsx", ".js", ".jsx"],
}
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
- Secret defence is pattern-based and best-effort. `.opencode/plugins/protect-secrets/`
  blocks tool calls; `.githooks/pre-commit` blocks the commit. Code Mode (`execute`)
  and MCP tools are only partially covered, and `--no-verify` skips the hook.
  Neither layer catches base64-encoded or split secrets.
