---
description: "Run the full workflow: plan, approve, implement, review, test"
agent: mro-orchestrator
---

Orchestrate this request end to end: $ARGUMENTS

Follow the Orchestrator phases and the handoff contract in your agent prompt.

1. Preflight (hard gate):
   - run `node .opencode/scripts/mro-doctor.mjs`; exit 1 means stop and list the
     gaps (placeholders, missing profile, stale behavior docs);
   - run `node .opencode/scripts/mro-model-check.mjs --model 9router/deep` (and
     `9router/nemo` when used); exit 1 stops the run, exit 2 means no credential
     is configured and the check is skipped silently — never ask for a key;
   - read an existing `.opencode/plans/<slug>.orchestrator.json` when resuming;
   - inventory the available project skills.
2. Plan: launch the `mro-architect` subagent with the available skills. Validate
   the plan file, its Acceptance Criteria (every item needs `verify:`), its
   `Contract` section, its `review_level:` field, and its Documentation impact.
   Write the JSON state file and the first log line.
3. Plan gate: present the goal, files, key decisions, acceptance-criteria count,
   verify coverage, contract path, `review_level`, documentation impact, and open
   questions. Stop for explicit human approval. The human confirms `review_level`;
   the agent must not self-assign it.
4. Risk triage: confirm `review_level` from diff size and changed paths
   (auth/db/payments/migration/infra → `full`; new logic/API change/>200 lines →
   `reviewed`; <50 lines and none of the above → `minimal`). Record it in the
   state file. `minimal` skips human review and goes straight to automated checks.
5. Backpressure: count features awaiting human review. If that count reaches 3,
   do not start a new `reviewed`/`full` feature; warn the human and wait for
   capacity.
6. Implement: launch `mro-implementer` with the approved plan and the skill list.
   Tell it to load every relevant project skill, update `README.md`, record
   `last_verified`/`source_files` in the behavior doc, run `secret-audit`, create
   `docs/contracts/<feature>.md`, run every contract `verify:` command, and not
   to launch `mro-reviewer` or write `CHANGELOG.md` yet.
7. Verify: check `README.md` and run `mro-doctor --docs` yourself. Then launch
   `mro-reviewer` and `mro-test-runner` in parallel. Give the reviewer the diff,
   the acceptance criteria, the contract file, and `AGENTS.md` — not the plan's
   rationale.
6. Fix: send CRITICAL/HIGH findings and failures back to the same implementer
   session. A further round is allowed while the CRITICAL count strictly
   decreases, up to three rounds. Flat or rising CRITICAL stops the run. HIGH may
   be deferred only with the human's explicit agreement. Record each round and
   severity count in the state file and log.
7. Done: report plan path, changed files, test command and exit code with log
   path, review path with severity counts and round history, README state,
   behavior doc path and `last_verified`, and ask for final approval.
8. Changelog: only after explicit final approval, have the same implementer add
   the `CHANGELOG.md` entry (changelog-only handoff), verify the entry, then mark
   the work done in the state file and log.

Do not edit source files, `README.md`, or `CHANGELOG.md` yourself, and never run
`git push` or `sudo`. Reply in the human's language.
