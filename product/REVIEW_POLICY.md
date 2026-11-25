# Review Policy — mr-opencode

This policy defines what **must** block a change and what **must not** block it. It applies equally to human reviewers and agent-written code. The person who clicks merge is the owner of the change — even if an agent wrote it.

## Always block (non-negotiable)

| # | Rule | Why |
| - | ---- | --- |
| B1 | **Security defect** — injection, exposed secrets, unsafe deserialization, broken auth, broken access control. | Direct risk to users and data. |
| B2 | **Missing or meaningless test for risky logic.** No test, or a test that does not assert the acceptance criterion. | Risky logic without proof is unreviewable. |
| B3 | **Code the human merger cannot explain.** If the person merging cannot walk through what the code does, it cannot be owned. | Accountability requires understandability. |
| B4 | **New dependency nobody has reviewed.** Supply-chain risk. | Unknown code enters the codebase. |
| B5 | **Contract violation.** The implementation deviates from the plan's `Contract` section (or `docs/contracts/<feature>.md` when one exists) or any `verify:` command exits non-zero. | Breaks the spec the human approved. |
| B6 | **CI gaming.** Deleted tests, lowered coverage thresholds, `|| true` to mask failures, skipped type checks. | Invalidates the review signal itself. |
| B7 | **Placeholder left in `AGENTS.md` or `.opencode/mro-profile.json`.** `<TEST_CMD>`, `<STACK>`, etc. unresolved. | Workflow cannot run end-to-end. |

## Never block (personal preference, not policy)

| # | Rule | Who handles it instead |
| - | ---- | ---------------------- |
| N1 | **Style / formatting** not covered by the linter. | Linter config; update the linter rule, not the PR. |
| N2 | **"I would have written it elsewhere."** | Architectural discussion, separate issue — not a gate. |
| N3 | **Perfectionism / gold-plating.** The change improves overall codebase health. | Approve; file a follow-up for the rest. |
| N4 | **Naming preferences** that do not violate `<LANGUAGE_RULES>`. | Team convention, not a blocker. |

## Reviewer focus (large diffs)

When a diff is large (> 200 lines or `review_level: reviewed/full`), the human reviewer must not read line-by-line. Focus on:

1. **Critical paths** — auth, payments, migrations, infra, contract changes.
2. **Edge cases** — null, empty, concurrent, timeout, boundary values.
3. **Duplicate logic** — a new function that mirrors an existing one.
4. **Architecture drift** — importing from an unauthorized layer.

Everything else (syntax, style, type errors, simple tests) is delegated to the linter, typechecker, and test suite.

## Where this lives

This file is `REVIEW_POLICY.md` at the repository root. It is referenced from `AGENTS.md` and from `mro-reviewer.md`. Any change to this policy requires human approval because it redefines the merge gate.
