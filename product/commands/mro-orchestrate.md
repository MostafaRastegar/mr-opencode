---
description: "Run the full workflow: plan, approve, implement, review, test"
agent: mro-orchestrator
---

Orchestrate this request end to end: $ARGUMENTS

Pick the effort level before anything else: an explicit `quick:`, `standard:`, or
`full:` as the first word of the arguments wins; otherwise classify the request
per your Effort levels section and state the level in one line.

Follow the phases, handoff block, state file, and stop rules in your agent
prompt; do not restate them here. The additions for this run:

- At `quick`, the only gate is the diagnosis approval: no plan file, no state or
  log, no reviewer, no test runner, no documentation tail.
- At `standard` and `full`, stop at the plan gate and at the UI demo gate.
  Everything else runs without a human pause unless a child reports a blocker or
  a decision.
- If the human says stop, interrupt every running child first, then report.

Never edit source, `README.md`, or `CHANGELOG.md` yourself, and never run
`git push` or `sudo`. Reply in the human's language.
