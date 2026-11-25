---
description: "Fill the generic mro template from this repository (run once per project)"
agent: mro-bootstrap
---

Bootstrap or refresh this project. Follow your agent prompt: derive every fact from
`AGENTS.md`, the manifest, the schema, and the source tree, then record only what
the repository proves:

- the Project Profile in `AGENTS.md` (or `.opencode/AGENTS.md`) — commands, stack and rules
- `.opencode/skills/mro-project-stack/SKILL.md`, `mro-data-model/SKILL.md` — facts and entities
- `.opencode/agents/mro-*.md` — the project's command allow-list, model/step pins
- the harness config (`opencode.jsonc` or `.opencode/opencode.json`) — provider, models, watcher ignores
- `.opencode/commands/*.md` — any remaining project token

Never change a role's mandate or any safety deny, and never touch `.opencode/plugins/`.

If the template is already filled, run **refresh mode**: update only the facts
that drifted from the repository and report one line per change. Do not add
prose or restructure.

Do not invent a value. Leave it as `unknown` and list it as a question. Finish
with `node .opencode/scripts/mro-doctor.mjs` at exit 0.
