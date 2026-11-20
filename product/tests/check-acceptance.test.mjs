import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, before, test } from "node:test"

import plugin, { parseAcceptance } from "../plugins/mro-project-tools/index.js"

let directory
let tools

async function loadTools(root) {
  const registered = {}
  await plugin.setup({
    location: { directory: root },
    tool: {
      transform: async (fn) => fn({ add: (tool) => { registered[tool.name] = tool } }),
    },
  })
  return registered
}

before(async () => {
  directory = await mkdtemp(join(tmpdir(), "mro-acceptance-"))
  tools = await loadTools(directory)
})

after(async () => {
  await rm(directory, { recursive: true, force: true })
})

test("parseAcceptance separates pending, confirmed with evidence, and deferred", () => {
  const items = parseAcceptance(
    [
      "- [ ] AC-1: When the user is logged out, /dashboard redirects. — verify: `pnpm test -k redirect`",
      "- [x] AC-2: Empty title returns 400. — verify: `pnpm test -k empty` evidence: exit 0",
      "- [~] AC-3: Email notification. — reason: deferred by human on 2026-11-20",
    ].join("\n"),
  )
  assert.equal(items.length, 3)
  assert.deepEqual(items.map((item) => item.status), ["pending", "confirmed", "deferred"])
  assert.equal(items[0].id, "AC-1")
  assert.equal(items[0].verify, "pnpm test -k redirect")
  assert.equal(items[1].evidence, "exit 0")
  assert.equal(items[2].reason, "deferred by human on 2026-11-20")
})

test("check-acceptance reports missing verify, missing evidence, and missing deferral reason", async () => {
  await writeFile(
    join(directory, "plan.md"),
    [
      "# Feature",
      "",
      "## Acceptance Criteria",
      "- [ ] AC-1: No verify command here",
      "- [x] AC-2: Ticked without proof — verify: manual: look at the UI",
      "- [~] AC-3: Deferred without a reason",
    ].join("\n"),
  )
  const result = await tools["check-acceptance"].execute({ planFile: "plan.md" })
  assert.match(result.content, /Total: 3 \| Confirmed: 1 \| Pending: 1 \| Deferred: 1/)
  assert.match(result.content, /MISSING verify:/)
  assert.match(result.content, /CONFIRMED WITHOUT evidence:/)
  assert.match(result.content, /DEFERRED WITHOUT reason:/)
})

test("check-acceptance refuses paths outside the project", async () => {
  const result = await tools["check-acceptance"].execute({ planFile: "../outside.md" })
  assert.match(result.content, /Refusing to read outside the project/)
})

test("check-acceptance reports no criteria instead of inventing them", async () => {
  await writeFile(join(directory, "empty.md"), "# Plan\n\nNo criteria.\n")
  const result = await tools["check-acceptance"].execute({ planFile: "empty.md" })
  assert.match(result.content, /No acceptance criteria found/)
})
