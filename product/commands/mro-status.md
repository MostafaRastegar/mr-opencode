---
description: "Show the current orchestration state and remaining work"
agent: mro-orchestrator
---

Report the state of the most recently updated
`.opencode/plans/*.orchestrator.json`. If there is none, say so and stop; do not
invent a workflow.

Read the file and the matching `.opencode/plans/<slug>.log.jsonl`, then report:

1. Feature, phase, and whether the plan is approved.
2. Plan path, plan hash, and acceptance counts (total / confirmed / pending /
   deferred). For pending or deferred items, quote the criterion id and reason.
3. Review round, severity history, and whether CRITICAL is zero.
4. Test command and the last recorded exit code, plus the test log path.
5. README state, changelog state, and behavior-doc path with `last_verified`.
6. The next action the human needs to take, or the blocker.

Read only: do not edit source, README, or CHANGELOG, and do not launch a subagent.
