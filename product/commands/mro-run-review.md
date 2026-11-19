---
description: "Review current changes with the reviewer agent"
agent: mro-reviewer
---

Launch the `mro-reviewer` subagent and give it this scope:

1. Run `git status` and `git diff`; read untracked files directly.
2. Apply the mro-code-review-checklist skill to every modified file.
3. Write findings to `.opencode/reviews/current.md`, ordered by severity, each with `file:line`.
4. Reply with a one-paragraph summary and the count per severity.

The reviewer must not modify any file outside `.opencode/reviews/`. Report its summary back to me.
