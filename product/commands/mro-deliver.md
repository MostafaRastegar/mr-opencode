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

1. Run `node .opencode/scripts/mro-doctor.mjs`. If it reports gaps, stop and list
   them. Do not guess a test command or work around a missing profile.
2. Flag any changed file that looks unrelated to the current feature.
3. Update `README.md` for any change to behavior, config, env, commands, or
   dependencies. If no README change is needed, state why.
4. Update `docs/behaviors/<feature>.md` when a related source file changed, and
   refresh `last_verified` only if you actually re-ran the checks. Run
   `node .opencode/scripts/mro-doctor.mjs --docs`; a stale doc is a blocker.
5. Run `<TEST_CMD>`. On failure, follow the Self-Correction Protocol from
   `AGENTS.md` and do not proceed until the suite passes.
6. Run the `secret-audit` tool. A finding is a hard stop: remove the literal,
   report it, and do not commit it.
7. Launch the `mro-reviewer` subagent (step 3 of the Handoff Protocol in AGENTS.md)
   with an explicit file list taken from `git status`, including untracked files:
   `git diff` does not show them. Pass the acceptance criteria and ask it to write
   `.opencode/reviews/current.md`. It reviews blind: do not ask it to accept your
   rationale. Do not try to invoke `/mro-run-review`; agents cannot call commands.
8. Read `.opencode/reviews/current.md`. Fix every CRITICAL and HIGH finding,
   re-run `<TEST_CMD>` if the fix touched code, then launch the reviewer again.
   Continue while CRITICAL strictly decreases, up to three rounds; flat or rising
   CRITICAL stops the run. HIGH deferrals need the human's explicit agreement.
9. Report "DELIVERY READY" with a one-line summary, the README state, the behavior
   doc `last_verified`, and the test exit code, or the blocker that prevents it.
   Do not write `CHANGELOG.md` yet.
10. After the human approves the delivery, add the `CHANGELOG.md` entry per the
    project rules and report its path. Never run `git push`.
