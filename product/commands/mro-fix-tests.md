---
description: "Run the test suite and fix failures"
agent: mro-implementer
---

Run the project's test command ($1, default from AGENTS.md) and fix every failure.

- Never change assertions to make a test pass.
- Never skip, delete, or mark a failing test as expected.
- Stop and ask the human when a failure needs a product decision.
- Report the final test result and any failure you could not fix.
