---
name: code-review-checklist
description: "Project review checklist covering security, type safety, and testing."
---

# Code Review Checklist

## Security

- [ ] No hardcoded secrets, API keys, or passwords.
- [ ] No SQL/command injection vectors. Parameterized queries only.
- [ ] User input is validated before use.

## Type Safety

- [ ] No `any` types.
- [ ] No `@ts-ignore` / `@ts-expect-error` without an adjacent explanation.
- [ ] All exported functions have explicit return types.

## Testing

- [ ] New functions have corresponding unit tests.
- [ ] Edge cases (null, empty, error paths) are covered.
- [ ] Tests are deterministic (external services mocked).

## Project Rules

- [ ] Changes comply with AGENTS.md.
