---
name: mro-code-review-checklist
description: "Project review checklist covering security, type safety, and testing."
---

# Code Review Checklist

Stack-specific rules live in the `mro-project-stack` skill; this list stays
language-neutral. Replace any item that does not apply, and add the ones your
stack needs.

## Security

- [ ] No hardcoded secrets, API keys, or passwords.
- [ ] No injection vectors: database, shell, template, or deserialization.
      Untrusted input is validated and parameterized, not string-concatenated.
- [ ] Authorization is checked on every mutation, not only in the UI.
- [ ] Error messages do not leak internal paths, queries, or stack traces.

## Type & API Safety

- [ ] The project's typecheck command passes (`<TYPECHECK_CMD>` in AGENTS.md).
- [ ] No diagnostic is suppressed with a cast, ignore comment, or disabled rule
      without an adjacent explanation.
- [ ] Public functions and modules expose explicit types.
- [ ] Language-specific rules from `mro-project-stack` are honored.

## Testing

- [ ] New functions have corresponding tests.
- [ ] Edge cases (empty, null, error paths) are covered.
- [ ] Tests are deterministic; external services are mocked.

## Acceptance Evidence

- [ ] Every `[x]` criterion has an `evidence:` field naming the command and
      result. A tick with no evidence is FAIL.
- [ ] Every non-deferred criterion had a `verify:` field, and the command was
      actually run (or the `manual:` check was actually performed).
- [ ] Deferred (`[~]`) criteria have a reason and the human's explicit agreement.

## Verdicts

Give every checklist item an explicit **PASS**, **FAIL**, or **N/A**. A FAIL names
`file:line` and the smallest fix. "Reviewed" without a verdict is not a review.

## Project Rules

- [ ] Changes comply with AGENTS.md, including its Project Profile.
- [ ] The behavior doc matches what the diff actually does, lists the touched files
      under `source_files`, and has a current `last_verified` date.
- [ ] `README.md` is updated and accurate for any user-facing behavior, config,
      env, command, or dependency change. Its commands and paths were verified.
- [ ] The relevant project skills (including user-added ones) were applied; a
      conflict with AGENTS.md was reported rather than silently resolved.
- [ ] `CHANGELOG.md` was not edited before final approval.
