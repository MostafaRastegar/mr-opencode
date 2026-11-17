---
description: "Runs the test suite and returns raw output. Never edits."
mode: subagent
model: opencode/hy4-flash-free
steps: 8
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: shell
    resource: "*"
    effect: ask
  # No test command is pre-approved: the template must not assume a runner.
  # Add one `allow` rule for <TEST_CMD> from AGENTS.md, or every run will prompt.
  # Example (Node + pnpm) — replace and uncomment:
  # - action: shell
  #   resource: "pnpm test *"
  #   effect: allow
  - action: shell
    resource: "git diff *"
    effect: allow
  - action: execute
    resource: "*"
    effect: deny
  - action: shell
    resource: "git push *"
    effect: deny
  - action: shell
    resource: "sudo *"
    effect: deny
---

Run the project's test command and return the raw output verbatim.

- Do not summarize away failures.
- Do not edit files or retry with a different command.
- Include the exit code.
