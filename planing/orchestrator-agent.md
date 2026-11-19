# Orchestrator agent plan

Goal: add a project-manager agent that owns the end-to-end workflow, delegates to
the existing role agents as subagents, collects their reports, and gates human
approval between plan and implementation.

## Design

- New `mro-orchestrator` primary agent (`mode: primary`, `model: 9router/deep`).
- `mro-architect` and `mro-implementer` become `mode: all` so the orchestrator can
  launch them as subagents while they remain selectable as primaries.
- Orchestrator permissions: no source edits, only `.opencode/plans/*`; launch only
  the four `mro-*` role agents; read-only git; no `execute`, `git push`, `sudo`.
- Subagents run with fresh context, so every handoff carries feature slug, plan
  path, review path, diff scope, prior findings, and return contract.
- Orchestrator owns review: the implementer is told not to launch the reviewer
  when it is running under an orchestration handoff.
- `mro-reviewer` and `mro-test-runner` run in parallel after implementation.
- Fix loop: send CRITICAL/HIGH findings back to the same implementer session, run
  tests, re-run the reviewer once, then stop and ask the human if issues remain.
- Durable state: `.opencode/plans/<slug>.orchestrator.md` (phase, artifacts,
  child session IDs, approval status) so approval across turns and compaction do
  not lose the workflow.
- Reviewer keeps `9router/nemo` for independence; orchestrator, architect,
  implementer, build use `9router/deep`; test-runner and background agents use
  `9router/nemo`.
- Add the `9router` provider in V2 shape under `providers` with
  `ROUTER_API_KEY`, `@opencode/ai/providers/openai-compatible`, and
  `http://localhost:20128/v1`.

## Phases

1. Preflight: check `AGENTS.md` placeholders, derive slug, load state if resuming.
2. Plan: architect subagent, validate plan and acceptance criteria, write state.
3. Plan gate: present summary and stop for explicit human approval.
4. Implement: implementer subagent with the approved plan; no review launch.
5. Verify: reviewer and test-runner in parallel.
6. Fix: same implementer session, then tests, then one re-review.
7. Done: evidence summary and final human approval.

## Files

- `product/agents/mro-orchestrator.md` (new)
- `product/agents/mro-architect.md`
- `product/agents/mro-implementer.md`
- `product/agents/mro-reviewer.md` (model only)
- `product/agents/mro-test-runner.md` (model, log write, return contract)
- `product/commands/mro-orchestrate.md` (new)
- `product/configs/opencode.jsonc` (provider, models, default agent)
- `product/AGENTS.md` (orchestrated and manual handoff protocols)
- `product/README.md` (agents, workflow, models)
- `example/` (same agents/config/AGENTS/command for a runnable demo)

## Follow-up: documentation, changelog, and skills

Added after the first test run:

- `README.md` at the project root is a deliverable: install, run, config/env,
  usage, tests, layout, limitations. The Implementer creates or updates it; the
  Orchestrator checks it before review; the Reviewer flags stale docs.
- `CHANGELOG.md` is written by the Implementer only after the human's final
  approval, as a dated section with test evidence and artifact paths. The
  Orchestrator verifies it before marking the work done.
- Every role discovers and loads the project skills that match its task, beyond
  the shipped `mro-*` skills. The Orchestrator inventories them and passes the
  list in every subagent handoff.
- Plans must include a **Documentation impact** section.

## Acceptance criteria

- [x] `opencode debug agents` lists `mro-orchestrator` and the four role agents.
- [x] `mro-architect` and `mro-implementer` have `mode: all`; reviewer and test-runner remain `subagent`.
- [x] The orchestrator cannot edit source files and can only launch the four role agents.
- [x] Plan/implement agent prompts return questions and blockers to the caller when running under an orchestration handoff.
- [x] The implementer does not launch a reviewer when the handoff says the orchestrator owns review.
- [x] `opencode debug config` parses the `9router` provider and `9router/deep` / `9router/nemo` model references.
- [x] `default_agent` is `mro-orchestrator`.
- [ ] Manual `/mro-plan-feature` and `/mro-deliver` were re-run end to end after the change.
- [x] The README documents both the orchestrated and manual workflows.
- [x] `example/` contains the same orchestrator workflow and still has valid project-specific permissions.
- [ ] A test feature run creates or updates `README.md` and completes only after the changelog entry.
- [ ] Every role reports the project skills it loaded.
