---
description: "Find the root cause, get approval, make the minimal fix"
agent: mro-implementer
---

Bug: $ARGUMENTS

This is a bug hunt, not a delivery: no plan file, no subagent, no full test
suite, no new tests unless the human asks. Keep every step token-minimal.

0. GROUND YOURSELF IN THE PROJECT, ONCE. Read the Project Profile in
   `.opencode/AGENTS.md` and the skills table in `AGENTS.md`. Take from them:
   the test/typecheck commands, and at most ONE skill whose description matches
   the failing area. If the project declares no skill index, use the available
   skills list. Never guess a command or a skill name.

1. LOCATE (read-only). Start with grep, never whole trees; stop reading the
   moment one line explains the bug. Restart the dev server before trusting a
   repro.

2. EXPLAIN AND ASK. One short paragraph: symptom, root cause with `file:line`,
   the minimal fix you propose. Then STOP and wait for approval.
   No edit before approval. If the cause is not proven, say what single check
   would prove it and ask for that instead.

3. FIX (only after approval). Smallest diff that removes the cause. One change.
   No refactor, no threshold/assertion change, no cast or ignore to silence a
   type.

4. VERIFY. Run the project's typecheck command only if types changed. Name the
   exact manual check (click path, curl, or dev-server scene). Never claim
   "fixed": report the diff (`file:line`), why it removes the cause, and
   "needs manual verification: <exact steps>".

5. PREVENT AGAIN — only after the human confirms it works. Propose, do not
   apply: which doc or skill line is now wrong or missing. One bullet per file
   with the exact change. Apply only on approval.

Stop rules: two failed hypotheses -> stop, report both with evidence and the
decision you need. Never touch files outside the cause. Never `git push`.
