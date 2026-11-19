---
name: mro-data-model
description: "Data model and query rules. Load when designing queries, mutations, or schema changes."
---

# Data Model

Authoritative source: `<SCHEMA_PATH>` (fill in — the schema file, ORM model
directory, or migrations folder for this project). Read it before writing any
query.

## Entities

- `<ENTITY>` — fill in each entity, its owner, and its lifecycle flags
  (soft delete, status, tenancy).

## Rules

- Read the schema first; never invent a field or a relation.
- Select only the columns you need; avoid N+1 by batching or joining when the
  data layer supports it.
- Soft-delete: if the entity has a delete flag, filter it in every query that
  lists or fetches.
- Mutations: check ownership and authorization before update or delete.
- Schema changes: add a migration; never edit an applied one.
- Unknown behavior is a question for the human, not a guess.
