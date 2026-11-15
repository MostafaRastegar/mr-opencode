# Review Command

Runs a structured code review on the current working tree changes.

## Usage

Invoke with `@review` or via the command palette.

## Behavior

1. Load the `code-reviewer` agent.
2. Execute `git diff` and summarize changes.
3. Produce findings ordered by severity.
