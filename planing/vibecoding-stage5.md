# Vibecoding Template — Stage 5: Acceptance Criteria, Behavior Docs, Acceptance Tool

## [Scope]

Steps 19–21 of the source plan. Step 22 (full-cycle simulation) is out of scope
by request.

## [Decisions]

- Acceptance criteria are a hard plan requirement and use `- [ ]` bullets so a
  tool can parse them.
- `check-acceptance` is a plugin tool in the existing `mro-project-tools` plugin, not
  a `.opencode/tools/` file (V1 only).
- The tool reports counts and unchecked items. It does **not** claim to detect
  test coverage: the source plan's description says "mark ones that have
  corresponding test coverage" but the implementation it shows cannot do that.
- Path input is resolved and confined to the project root; no traversal.
- Ticking a box requires evidence (test, command output, human confirmation).
- Behavior docs describe verified behavior; unverified criteria are labelled.

## [Deliverables]

1. `.opencode/agents/architectmro-architect.md` — mandatory Acceptance Criteria section
2. `.opencode/skills/mro-behavior-docs/SKILL.md`
3. `.opencode/agents/mro-implementer.md` — Definition of Done
4. `.opencode/plugins/mro-project-tools/index.js` — `check-acceptance`
5. `README.md` — skill and tool inventory

## [Known Limits]

- The tool sees only checkbox syntax; free-form criteria are invisible.
- It cannot tell a legitimately deferred item from an ignored one.
- Behavior docs are written by the implementing agent, so they can be optimistic;
  the Reviewer should compare them against the diff.

## [Verification]

```sh
opencode run "call check-acceptance for .opencode/plans/demo.md"   # counts + unchecked list
opencode run "call check-acceptance for ../../etc/passwd"          # refused
opencode run "load the mro-behavior-docs skill and reply with its first heading"
opencode debug agents                                             # architect prompt carries the requirement
```

## [Validation Findings]

- `check-acceptance` on a three-criterion plan returned
  `Total: 3 | Checked: 1 | Unchecked: 2` plus the two unchecked bullets.
- `../../etc/passwd` was refused; a missing file produced a read error, not a crash.
- `mro-behavior-docs` loads (skill ID from the directory name).
- Step 22 (end-to-end `/mro-plan-feature` → implement → doc → review simulation) was
  not run, per instruction.

