---
description: "Review current changes with the reviewer agent"
agent: mro-reviewer
---

Review the current working tree, following your agent prompt.

1. Run `git status` and `git diff`; read untracked files directly.
2. Apply the `mro-code-review-checklist` skill. Every item gets PASS / FAIL /
   N/A, never a bare "reviewed".
3. Review blind: judge the diff against the plan's Acceptance Criteria, not its
   design rationale. Missing criteria is a HIGH finding.
4. A `[x]` criterion needs a recorded command and exit code; a tick without
   evidence is FAIL. Do not re-run the commands.
5. Write findings to `.opencode/reviews/current.md`, each with `file:line`.
6. Reply with a one-paragraph summary, the verdict, and counts per severity.

Do not modify any file outside `.opencode/reviews/`.
