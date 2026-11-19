# Vibecoding Template — Stage 7: Config Hardening

## [Scope]

`opencode.jsonc` was the weakest file in the template: it carried the docs'
minimum example while the agents, plugins, and skills assumed a real governance
layer. This stage makes the config cover the workflow, and locks the guardrails.

## [Decisions]

- **Secure by default.** The Implementer's `shell: "*" allow` was removed. It was
  overriding the project's `shell: "*" ask`, so the main working agent could run
  any command (including `sudo` and `cat .env`) with no prompt. It now has an
  allowlist for test/typecheck/lint/git; everything else asks. In `opencode run`
  an `ask` is rejected unless `--auto` is passed.
- **Governance files are edit-locked:** `AGENTS.md`, `opencode.jsonc`,
  `.opencode/{agents,plugins,skills,commands}/*`, `.githooks/*`, `.git/*`, and
  `*.env*` (except `.env.example`). An agent must not be able to weaken its own
  rules or disable the pre-commit secret scan.
- **The Implementer lost `edit: "*" allow`.** The built-in base policy already
  allows edits, and agent rules are appended last; keeping a broad allow would
  have overridden every project-level edit deny.
- **`policies` duplicate the `sudo`/`git push` denies.** Policies are evaluated
  after saved approvals and agent rules and can only deny, so they survive
  "Allow always" and a future broad agent rule.
- **`share: "disabled"`** because sessions can contain secrets; **`snapshots`
  explicit** because undo/revert is a stated recovery path.
- **`default_agent: "architect"`** so a fresh session plans first; **`model`**
  pinned so an ad-hoc session cannot silently use a paid model.
- **`experimental.todo` + `background_compaction`** as agreed: multi-step work
  becomes visible, and compaction no longer pauses the session.
- **Level B extras:** `agents.build.model`, larger `tool_output` thresholds, and
  `execute: deny` for Architect/Reviewer/Test Runner (tools remain callable;
  Code Mode is what is removed).
- **Comments are English**, matching the rest of the template; every key has a
  "why" and a "change" note.

## [Deliverables]

1. `opencode.jsonc` — rewritten, commented per key
2. `.opencode/agents/mro-implementer.md` — no broad edit/shell allow, allowlist
3. `.opencode/agents/{architect,reviewer,test-runner}.md` — `execute` deny,
   final `sudo` deny
4. `AGENTS.md` — locked-files rule, shell-approval rule
5. `README.md` — Configuration reference, Permission model, locked paths, verify
   commands

## [Known Limits]

- `read` denies do not stop `shell cat`; shell stays on `ask` for that reason.
- A future broad rule inside an agent file overrides project denies; the README
  says to re-add the denies after it.
- `opencode run` cannot prompt, so every non-allowlisted command fails there
  unless `--auto` is passed. This is intentional for the current "secure" mode.
- The exact LSP/config quirks were measured on v2.3.0 only.

## [Verification]

```sh
opencode debug config                     # parses; all keys present
opencode debug agents                     # ordering + execute denies per agent
```

Behaviour, with the Implementer:

```sh
opencode run --agent implementer "append a line to AGENTS.md"  # permission.rejected
opencode run --agent implementer "read .env.local"             # permission.rejected
opencode run --agent implementer --auto "run: sudo true"       # permission.rejected
opencode run --agent implementer --auto "run: git push"        # permission.rejected
opencode run --agent implementer "run: ls -la"                 # ask → rejected (no --auto)
opencode run --agent implementer "run: npm test"               # executes (allowlisted)
opencode run --agent implementer "read /etc/hostname"          # external_directory ask
```

## [Validation Findings]

- Implementer edit of `AGENTS.md` → `{"type":"permission.rejected","message":"Permission denied: edit"}`.
- Implementer read of `.env.local` → `Permission denied: read`.
- Implementer write of `src/ok.ts` → `Created file successfully` (source stays editable).
- `sudo true` → denied; `git push` → denied. Both still denied under `--auto`,
  which proves the deny (not an unanswered prompt) is doing the work.
- `ls -la` without `--auto` → "cannot ask the user for permission ... rejected";
  with `--auto` it ran, confirming it is an `ask`, not a deny.
- `npm test` executed (allowlisted) and failed with ENOENT because the copy had
  no `package.json` — proof it reached the shell.
- Reading `/etc/hostname` hit `external_directory` and was rejected.
- `default_agent: mro-architect` is reflected in the session header; `build` resolves
  to `opencode/longcat-2.5-free`.
- **Limit:** the free-model quota was exhausted for the `opencode` provider, so
  behaviour tests used `9router/openrouter/nvidia/nemotron-3.5-super-vl:free`.
  Permissions are model-independent, but the reasoning quality of that model is
  low; the exact outputs above were checked, not trusted.
