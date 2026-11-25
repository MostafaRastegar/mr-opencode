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

Scope is the current working tree. No plan file is required.

1. Run `node .opencode/scripts/mro-doctor.mjs`. If it reports gaps, stop and list them.
2. Flag any changed file that looks unrelated to the current feature.
3. Update `README.md` only if behavior, config, env, commands, or dependencies
   changed. Otherwise state why no change is needed.
4. Run `<TEST_CMD>` once. Fix failures per the Self-Correction Protocol; do not
   weaken a test.
5. Run the `secret-audit` tool. A finding is a hard stop.
6. Launch `mro-reviewer` with the file list from `git status` (including
   untracked files) and the acceptance criteria. It writes
   `.opencode/reviews/current.md`.
7. Fix every CRITICAL and HIGH, then review again: at most two rounds, and only
   while CRITICAL decreases. HIGH deferrals need the human's agreement.
8. Run `node .opencode/scripts/mro-doctor.mjs`. If it reports drift, launch
   `mro-bootstrap` in refresh mode and re-run the doctor until it exits 0. The
   project grows: a stack version or an entity recorded in a skill must still
   match the repository.
9. Report "DELIVERY READY" with a one-line summary, README state, the test exit
   code, and any refreshed facts, or the blocker. Do not write `CHANGELOG.md`
   before the human approves the delivery. Never run `git push`.
