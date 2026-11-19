# Vibecoding Template — Stage 8: Stack-Neutral Rewrite

## [Scope]

The template was written for one stack (TypeScript + Next.js + Prisma + npm).
A template that ships one project's commands is worse than a template that ships
none: an agent in a Python or Go repo would run `npm test`, get an error, and try
to work around it. This stage replaces every stack assumption with an explicit
placeholder, and makes the config *stop* instead of guess.

## [Decisions]

- **Strict placeholders (user choice).** A `Project Profile` block at the top of
  `AGENTS.md` holds `<STACK>`, `<LANGUAGE>`, `<TEST_CMD>`, `<TYPECHECK_CMD>`,
  `<LINT_CMD>`, `<BUILD_CMD>`, `<MIGRATION_CMD>`, `<LOCKFILE>`,
  `<LANGUAGE_RULES>`. The gate rule: while any `<...>` token remains, agents stop
  and ask the human. The template is therefore deliberately non-functional until
  filled in — an explicit gap instead of a wrong command.
- **Shell allowlist option "الف" (user choice).** Agents get no pre-approved
  runner. Only read-only git is active; per-stack sample rules are commented out
  in each agent file, so uncommenting is the whole setup step. Everything else
  stays `shell: "*" ask`.
- **Models stay executable values.** `<MODEL_ID>` in `permissions`-style
  placeholders would break `opencode debug agents` and every run. The shipped
  ids (`opencode/longcat-2.5-free`, `opencode/hy4-flash-free`) are documented as
  machine defaults, unrelated to the stack, replaceable via `opencode models`.
- **Plugin tools report "not configured".** `MIGRATION_CANDIDATES = []` and
  `TYPECHECK = null`. `db-status` and `check-file` answer with what to configure
  instead of running a guessed command. Two examples stay as comments.
- **`check-imports` renamed to `check-file`.** The old name assumed a JS import
  graph; the tool actually runs a typecheck and filters its output for one path.
- **`watcher.ignore` emptied.** `node_modules`, `.next`, `.venv`, `target` were
  one project's directories. The examples moved into the comment.
- **`websearch` removed.** A provider id without a credential fails at runtime;
  unset makes the first search ask. `.env.example` now uses `<PROVIDER>_API_KEY`
  and `<SECRET_NAME>` instead of a real provider name.
- **README rewritten placeholder-first**, with a separate, clearly labelled
  "Worked example (Node + TypeScript + Prisma)" section so the shape stays
  obvious without becoming the default.

## [Changes]

- `AGENTS.md`: Project Profile block + gate rule; language-neutral standards,
  testing, typecheck, git rules; `<LOCKFILE>` replaces the four-file list.
- `.opencode/agents/mro-implementer.md`: 28 allow rules → git read-only only; one
  commented `<TEST_CMD>`-style example; `check-file` wording conditional.
- `.opencode/agents/test-runnermro-test-runner.md`: test allowlist removed, example commented;
  `execute: deny`, deny-on-push/sudo kept.
- `.opencode/plugins/mro-project-tools/index.js`: `MIGRATION_CANDIDATES = []`,
  `TYPECHECK = null`, "not configured" paths, tool renamed `check-file`.
- `.opencode/skills/mro-project-stack/SKILL.md`: generic discovery order, profile
  precedence note.
- `.opencode/skills/mro-data-model/SKILL.md`: `<SCHEMA_PATH>`, `<ENTITY>`.
- `.opencode/skills/mro-code-review-checklist/SKILL.md`: language-neutral checklist.
- `.opencode/skills/mro-behavior-docs/SKILL.md`: typecheck reference, no tool name.
- `opencode.jsonc`: watcher emptied with examples, websearch removed, LSP comment
  kept as a measured fact.
- `.env.example`: placeholders only.
- `README.md`: fill-in checklist, placeholder table, permission model, worked
  example.

## [Validation]

Run inside `product/templates/vibecoding/`:

- `opencode debug config` — JSONC parsed, project document at
  `opencode.jsonc`, `default_agent: mro-architect`, empty `watcher.ignore`.
- `opencode debug agents` — architect / implementer / reviewer / test-runner all
  built with the permission list intact (YAML comments did not break parsing).
- `opencode plugin list` — `mro-project-tools`, `mro-protect-secrets`, `mro-test-feedback`.
- `node --check` + dynamic `import()` of the plugin — syntax and load OK.
- `db-status` via Code Mode → "db-status is not configured for this project...".
- `check-file src/ok.ts` via Code Mode → "check-file is not configured...".
- Gate rule: asked the Implementer "what is the test command? run it" → it
  reported `<TEST_CMD>` unfilled and stopped instead of guessing.
- `grep -rniE "typescript|prisma|npm test|tsc|pytest|next\.js|node_modules|\.venv"`
  → only comments/examples (agent files, plugin comments, config comments), the
  generic runner regex in `mro-test-feedback`, and the README worked example.

## [Open issues]

- Permission re-checks (`git push --dry-run`, `AGENTS.md` append) could not be
  repeated this round: the `opencode` free-model quota and the 9router fallback
  both returned quota/403 errors. The permission lists are unchanged from
  stage 7, where all six cases were verified.
- `check-file` is textual: it cannot match a diagnostic that omits the path.
- `MIGRATION_CANDIDATES`/`TYPECHECK` live in code, not config, so a fork must
  edit a plugin file — accepted, because V2 has no `tools` config surface.
