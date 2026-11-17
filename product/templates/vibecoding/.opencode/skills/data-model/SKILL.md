---
name: data-model
description: "Data model and query rules. Load when designing queries, mutations, or schema changes."
---

# Data Model

Authoritative source: `unknown` (fill in — for example `prisma/schema.prisma`,
`models.py`, or a migrations directory). Read it before writing any query.

## Entities

- unknown — fill in the entities, their owner, and their lifecycle flags.

## Rules

- Read the schema first; never invent a field.
- Select only the columns you need; avoid N+1 by batching or joining.
- Soft-delete: if the entity has a `deletedAt`/`is_deleted` flag, filter it in
  every query that lists or fetches.
- Mutations: check ownership/authorization before update or delete.
- Schema changes: add a migration, never edit an applied one.
- Unknown behavior is a question for the human, not a guess.
