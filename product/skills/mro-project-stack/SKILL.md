---
name: mro-project-stack
description: "Project tech stack and conventions. Load before designing or implementing any feature."
---

# Project Stack

This file is a placeholder. Fill it in once, then keep it current. Do not invent
a stack: if a value is unknown, leave it as `unknown` and say so.

`node .opencode/scripts/mro-doctor.mjs` derives these facts from the manifest on
demand; use it as a starting point, then confirm the result by reading the files.

## Recorded facts

- Framework: unknown
- Language: unknown
- Database / ORM: unknown
- Styling / UI: unknown
- Auth: unknown
- Package manager: unknown

Report the derived stack in one short block before designing. If two files
disagree, stop and ask. Keep this file consistent with the Project Profile in
`AGENTS.md`; if they disagree, the profile wins for commands.

## Discovery (use when a fact above is `unknown`)

Read, in this order, and derive only what the files prove:

1. The dependency manifest for this ecosystem (for example `package.json`,
   `pyproject.toml`, or `go.mod`) — runtime, framework, scripts.
2. The language's typechecker or strictness config, if one exists.
3. The lockfile or dependency lock — the real package manager.
4. Container and environment files — services, database, external APIs.
5. Schema or migration directory — the data layer.

## Conventions (fill in for this project)

- New modules live in: unknown
- Server-side code lives in: unknown
- Naming: unknown
- Forbidden patterns: unknown
