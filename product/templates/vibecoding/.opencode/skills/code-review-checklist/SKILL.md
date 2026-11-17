---
name: code-review-checklist
description: "Project review checklist covering security, type safety, and testing."
---

# Code Review Checklist

Stack-specific rules live in the `project-stack` skill; this list stays
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
- [ ] Language-specific rules from `project-stack` are honored.

## Testing

- [ ] New functions have corresponding tests.
- [ ] Edge cases (empty, null, error paths) are covered.
- [ ] Tests are deterministic; external services are mocked.

## Project Rules

- [ ] Changes comply with AGENTS.md, including its Project Profile.
- [ ] The behavior doc matches what the diff actually does.
