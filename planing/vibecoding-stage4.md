# Vibecoding Template — Stage 4: Stack Awareness, Self-Correction, Import Coherence

## [Scope]

Steps 15–17 of the source plan. Product quality only; no CI/CD, no MCP.

## [Decisions]

- Stack skills ship as **placeholders with a discovery procedure**, not as a
  fabricated Next.js/Prisma stack. A generic template that asserts a stack the
  project does not have makes agents confidently wrong.
- `check-imports` is added to the existing `project-tools` plugin (V2 has no
  `.opencode/tools/`). It runs `tsc --noEmit` with `execFile` and filters results
  in JavaScript, so the file argument never reaches a shell (the source plan's
  `grep ${args.file}` is an injection vector).
- The Self-Correction Protocol must not contradict `/fix-tests` ("never weaken
  tests"). A test may change only when the plan changes expected behavior.
- Skills are loaded on demand, not pasted into every prompt.

## [Deliverables]

1. `.opencode/skills/project-stack/SKILL.md`
2. `.opencode/skills/data-model/SKILL.md`
3. `.opencode/agents/implementer.md` — skill loading + Self-Correction Protocol
4. `.opencode/agents/architect.md` — skill loading
5. `.opencode/plugins/project-tools/index.js` — `check-imports` tool
6. `README.md` — skills and tools inventory

## [Known Limits]

- `check-imports` needs a local `tsc` (`node_modules/.bin/tsc`) and a
  `tsconfig.json`; otherwise it returns a clear "not available" message.
- `tsc --noEmit` reports project-wide errors; the tool filters to one file, so an
  error caused by another file may not surface.
- Skill content is only as good as the project's own fill-in; unknown values
  must stay explicit.

## [Verification]

```sh
opencode run "load the project-stack skill and list what is still unknown"
opencode run "call check-imports for src/app.ts"
opencode run "create src/a.ts importing ./missing, then call check-imports"
opencode debug agents   # implementer prompt contains the protocol
```

## [Validation Findings]

- `project-stack` loads and reports `unknown` instead of inventing a framework.
- `check-imports` ran against a stub `tsc`, filtered a two-file error list down to
  the requested file, and returned a clear message with no `tsconfig.json`.
- `opencode plugin list` shows the same three plugins; `project-tools` now
  registers both `db-status` and `check-imports`.
- A real `tsc` could not be installed here (no package registry access), so the
  error-filtering test used a stub binary. The filter and the "tsc missing" path
  are both exercised; the real compiler's exit codes are untested.
- `opencode debug skill` does not exist; skills are verified by loading one.

