---
name: project-stack
description: "Project tech stack and conventions. Load before designing or implementing any feature."
---

# Project Stack

This file is a placeholder. Fill it in once, then keep it current. Do not invent
a stack: if a value is unknown, leave it as `unknown` and say so.

## Recorded facts

- Framework: unknown
- Language: unknown
- Database / ORM: unknown
- Styling / UI: unknown
- Auth: unknown
- Package manager: unknown

## Discovery (use when a fact above is `unknown`)

Read, in this order, and derive only what the files prove:

1. `package.json` / `pyproject.toml` / `go.mod` — runtime, framework, scripts.
2. `tsconfig.json` / strictness settings, or the language's type checker config.
3. Lockfile presence — the real package manager (`pnpm-lock.yaml`, `package-lock.json`, `uv.lock`, `poetry.lock`).
4. `docker-compose.yml`, `.env.example` — services, database, external APIs.
5. Schema or migration directory — the data layer.

Report the derived stack in one short block before designing. If two files
disagree, stop and ask.

## Conventions (fill in for this project)

- New modules live in: unknown
- Server-side code lives in: unknown
- Naming: unknown
- Forbidden patterns: unknown
