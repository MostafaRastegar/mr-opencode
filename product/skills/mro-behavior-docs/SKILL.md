---
name: mro-behavior-docs
description: "Record what a feature now does, in observable terms. Load when finishing a feature."
---

# Behavior Documentation

After the acceptance criteria are verified, write `docs/behaviors/<feature-name>.md`.
Describe behavior that exists, not behavior you intend. If something is not
verified, say so.

Start the file with the two retention fields. `mro-doctor --docs` and the Reviewer
both use them:

```yaml
last_verified: <YYYY-MM-DD>
source_files: <comma-separated paths this document describes>
```

`last_verified` may be refreshed only after the checks were re-run against the
current code. When a `source_files` entry changes, update the document in the same
change; a newer source file makes the doc stale.

## What users can do now

One short paragraph, plain language, no code and no file names.

## How it behaves

- One line per acceptance criterion from the plan: "When [trigger], [observed outcome]."
- Then the edge cases you actually handled: empty state, error state, permission denied.

## What it does NOT do

List the out-of-scope items from the plan. This stops the next agent from
"filling gaps" that were deliberately left open.

## Files touched

Every file created or modified. The Reviewer uses this to scope its check.

## Verification

The commands you ran and their result: the test suite, the typecheck (`<TYPECHECK_CMD>`
in AGENTS.md), `check-file` if configured, and any manual check. If a criterion
was verified only by reading code, say that instead of claiming a test.

## README

A behavior doc is detail, not a start-here guide. When the feature changes
user-facing behavior, config, env, commands, or dependencies, also update the
project-root `README.md`: run/install instructions, configuration keys, a usage
example, and known limitations. Link the README to this behavior doc instead of
duplicating it. Do not write `CHANGELOG.md` here; it is written only after the
human's final approval.

