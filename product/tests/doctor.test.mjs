import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { after, before, test } from "node:test"

const here = dirname(fileURLToPath(import.meta.url))
const script = resolve(here, "../scripts/mro-doctor.mjs")
let directory

const AGENTS = [
  "# Project Rules",
  "",
  "- Stack: `<STACK>`",
  "- Primary language: `<LANGUAGE>`",
  "- Test command: `<TEST_CMD>`",
  "- Typecheck command: `<TYPECHECK_CMD>` (use `-` if the project has none)",
  "- Lint command: `<LINT_CMD>` (use `-` if the project has none)",
  "- Build command: `<BUILD_CMD>`",
  "- Migration command: `<MIGRATION_CMD>` (use `-` if the project has none)",
  "- Dependency manifest / lockfile: `<LOCKFILE>`",
  "- Language rules: `<LANGUAGE_RULES>` (strictness, banned escape hatches, naming)",
  "",
].join("\n")

before(async () => {
  directory = await mkdtemp(join(tmpdir(), "mro-doctor-"))
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({
      scripts: { test: "vitest run", build: "tsc -p ." },
      devDependencies: { typescript: "^5.0.0" },
    }),
  )
  await writeFile(join(directory, "pnpm-lock.yaml"), "lockfileVersion: 9\n")
  await writeFile(join(directory, "tsconfig.json"), "{}")
  await writeFile(join(directory, "AGENTS.md"), AGENTS)
})

after(async () => {
  await rm(directory, { recursive: true, force: true })
})

const run = (args) =>
  execFileSync(process.execPath, [script, ...args, "--root", directory], { encoding: "utf8" })

test("detects a Node + TypeScript project and reports the remaining placeholders", () => {
  let stdout
  try {
    stdout = run(["--json"])
  } catch (error) {
    stdout = error.stdout
  }
  const report = JSON.parse(stdout)
  assert.equal(report.detected.test, "pnpm test")
  assert.match(report.detected.typecheck, /tsc --noEmit/)
  assert.equal(report.detected.lockfile, "pnpm-lock.yaml")
  assert.equal(report.detected.language, "TypeScript")
  assert.equal(report.ok, false)
  assert.ok(report.placeholders.some((entry) => entry.token === "<TEST_CMD>"))
})

test("--write fills AGENTS.md and writes the profile the plugin reads", async () => {
  run(["--write"])
  const agents = await readFile(join(directory, "AGENTS.md"), "utf8")
  assert.match(agents, /- Test command: `pnpm test`/)
  assert.match(agents, /- Migration command: `-`/)
  const profile = JSON.parse(await readFile(join(directory, ".opencode/mro-profile.json"), "utf8"))
  assert.equal(profile.test, "pnpm test")
  assert.equal(profile.typecheckRunner.cmd, "pnpm")
})
