---
description: "Run the full workflow: plan, approve, implement, review, test"
agent: mro-orchestrator
---

Orchestrate this request end to end: $ARGUMENTS

Follow the Orchestrator phases and the handoff contract in your agent prompt.

1. Preflight: check `AGENTS.md` for `<...>` placeholders and inventory the
   available project skills. If any placeholder remains, stop and list it; do not
   guess a stack or a test command.
2. Plan: launch the `mro-architect` subagent with the available skills. Validate
   the plan file, its Acceptance Criteria, and its Documentation impact, then
   write `.opencode/plans/<slug>.orchestrator.md`.
3. Plan gate: present the goal, files, key decisions, acceptance-criteria count,
   documentation impact, and open questions. Stop for explicit human approval.
4. Implement: launch `mro-implementer` with the approved plan and the skill list.
   Tell it to load every relevant project skill, update `README.md`, and not to
   launch `mro-reviewer` or write `CHANGELOG.md` yet.
5. Verify: check `README.md` yourself, then launch `mro-reviewer` and
   `mro-test-runner` in parallel.
6. Fix: send CRITICAL/HIGH findings and failures back to the same implementer
   session, re-run tests, and re-review once. If problems remain, stop and ask
   the human.
7. Done: report plan path, changed files, test command and exit code with log
   path, review path with severity counts, README state, behavior doc path, and
   ask for final approval.
8. Changelog: only after explicit final approval, have the same implementer add
   the `CHANGELOG.md` entry (changelog-only handoff), verify the entry, then mark
   the work done.

Do not edit source files, `README.md`, or `CHANGELOG.md` yourself, and never run
`git push` or `sudo`. Reply in the human's language.
