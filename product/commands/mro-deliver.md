---
description: "Delivery check: status, tests, and review in one pass"
agent: mro-implementer
---

## Delivery Check

Current status:
!`git status --short`

Scope:
!`git diff --stat`

## Task

Scope is the current working tree. Do not look for or require a plan file.

1. If the Project Profile in AGENTS.md still contains `<...>` placeholders, stop
   and ask the human. Do not guess a test command.
2. Flag any changed file that looks unrelated to the current feature.
3. Update `README.md` for any change to behavior, config, env, commands, or
   dependencies. If no README change is needed, state why.
4. Run `<TEST_CMD>`. On failure, follow the Self-Correction Protocol from
   AGENTS.md and do not proceed until the suite passes.
5. Launch the `mro-reviewer` subagent (step 3 of the Handoff Protocol in AGENTS.md)
   with an explicit file list taken from `git status`, including untracked files:
   `git diff` does not show them. Ask it to write `.opencode/reviews/current.md`.
   Do not try to invoke `/mro-run-review`; agents cannot call commands.
6. Read `.opencode/reviews/current.md`. Fix every CRITICAL and HIGH finding,
   re-run `<TEST_CMD>` if the fix touched code, then launch the reviewer once
   more.
7. Report "DELIVERY READY" with a one-line summary, the README state, and the
   test exit code, or the blocker that prevents it. Do not write `CHANGELOG.md`
   yet.
8. After the human approves the delivery, add the `CHANGELOG.md` entry per the
   project rules and report its path. Never run `git push`.
