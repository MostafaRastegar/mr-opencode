---
description: "Delivery check: status, tests, and review in one pass"
agent: implementer
---

## Delivery Check

Current status:
!`git status --short`

Scope:
!`git diff --stat`

## Task

1. If the Project Profile in AGENTS.md still contains `<...>` placeholders, stop
   and ask the human. Do not guess a test command.
2. Flag any changed file that looks unrelated to the current feature.
3. Run `<TEST_CMD>`. On failure, follow the Self-Correction Protocol from
   AGENTS.md and do not proceed until the suite passes.
4. Launch the `reviewer` subagent with the current diff as its scope (step 3 of
   the Handoff Protocol in AGENTS.md). Do not try to invoke `/run-review`; agents
   cannot call commands.
5. Read `.opencode/reviews/current.md`. Fix every CRITICAL and HIGH finding,
   re-run `<TEST_CMD>` if the fix touched code, then launch the reviewer once
   more.
6. Report "DELIVERY READY" with a one-line summary, or the blocker that prevents
   it. Never run `git push`.
