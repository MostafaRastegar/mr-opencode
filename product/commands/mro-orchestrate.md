---
description: "Run the full workflow: plan, approve, implement, review, test"
agent: mro-orchestrator
---

Orchestrate this request end to end: $ARGUMENTS

Follow the phases, handoff block, state file, and stop rules in your agent
prompt; do not restate them here. The single addition for this run:

- Stop at the plan gate and at the UI demo gate. Everything else runs without a
  human pause unless a child reports a blocker or a decision.

Never edit source, `README.md`, or `CHANGELOG.md` yourself, and never run
`git push` or `sudo`. Reply in the human's language.
