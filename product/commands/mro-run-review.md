---
description: "Review current changes with the reviewer agent"
agent: mro-reviewer
---

Launch the `mro-reviewer` subagent and give it this scope:

1. Run `git status` and `git diff`; read untracked files directly.
2. Apply the mro-code-review-checklist skill to every modified file. Every item
   gets PASS / FAIL / N/A, never a bare "reviewed".
3. Review blind: judge the diff against the plan's Acceptance Criteria, not the
   plan's design rationale. If no criteria are available, report that as a HIGH
   finding.
4. For every `[x]` criterion, require a command and result; a tick without
   evidence is FAIL.
5. Check `docs/behaviors/<feature>.md`: it must exist, list `source_files`, and
   have a `last_verified` date not older than the diff.
6. Write findings to `.opencode/reviews/current.md`, ordered by severity, each with `file:line`.
7. Reply with a one-paragraph summary, the overall verdict, and the count per severity.

The reviewer must not modify any file outside `.opencode/reviews/`. Report its summary back to me.
