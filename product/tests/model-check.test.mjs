import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

const here = dirname(fileURLToPath(import.meta.url))
const script = resolve(here, "../scripts/mro-model-check.mjs")

test("missing credential skips the check without asking for a key", () => {
  const env = { ...process.env }
  delete env.ROUTER_API_KEY
  const result = spawnSync(process.execPath, [script], { env, encoding: "utf8", timeout: 20000 })
  assert.equal(result.status, 2)
  assert.match(result.stdout, /skipped/)
  assert.doesNotMatch(result.stdout, /Set it|enter|ROUTER_API_KEY/i)
})
