---
description: "Draft an implementation plan for a feature"
agent: mro-architect
---

Create an implementation plan for: $ARGUMENTS

Write it to `.opencode/plans/<kebab-case-feature>.md` and stop there. Do not edit source code.

Discover and load every project skill that applies before planning.

Finish the plan with:

- **Acceptance Criteria**, one `- [ ]` bullet per observable outcome. Every
  criterion needs a `verify:` field: a command in backticks, or
  `manual: <exact thing to inspect>`. Use `[~]` only with a `reason:`.
- **Documentation impact**: README sections, config/env keys, behavior doc
  (`last_verified` + `source_files`), and a draft changelog line.
- files to change, tests to write, and open questions for the human.
