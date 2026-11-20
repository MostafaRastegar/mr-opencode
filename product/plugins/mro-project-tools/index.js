// Registers four stack-neutral helper tools: db-status, check-file,
// check-acceptance, secret-audit.
// V2 has no `.opencode/tools/`; tools come from a plugin via ctx.tool.transform.
// No imports outside node: builtins, so the plugin loads in a bare project.
//
// Configuration comes from `.opencode/mro-profile.json` (written by
// `mro-doctor`), then falls back to the two constants below. Until one of them
// is set, the tools report "not configured" instead of guessing.
//
// The profile shape is:
//   {
//     "typecheckRunner": { "cmd": "pnpm", "args": ["exec","tsc","--noEmit"], "extensions": [".ts"] },
//     "migrations": [{ "file": "prisma/schema.prisma", "label": "Prisma", "cmd": "pnpm", "args": [...] }]
//   }
// `mro-doctor --write` fills it. Editing the constants by hand still works.

import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { extname, join, resolve, sep } from "node:path"

// db-status: one entry per migration tool this project uses. Each entry is
// detected by the presence of `file` and then run read-only.
// Examples (adapt and uncomment; add your own tool the same way):
//   { file: "prisma/schema.prisma", label: "Prisma", cmd: "npx", args: ["--no-install", "prisma", "migrate", "status"] }
//   { file: "alembic.ini", label: "Alembic", cmd: "alembic", args: ["current"] }
//   { file: "manage.py", label: "Django", cmd: "python3", args: ["manage.py", "showmigrations", "--plan"] }
const MIGRATION_CANDIDATES = []

// check-file: any command that prints `path:line: ...` diagnostics to stdout or
// stderr. `extensions` limits which files the command is worth running for;
// omit it to run for every file.
// Example (TypeScript):
//   { cmd: "npx", args: ["--no-install", "tsc", "--noEmit", "--pretty", "false"], extensions: [".ts", ".tsx", ".js", ".jsx"] }
const TYPECHECK = null

const PROFILE_FILE = ".opencode/mro-profile.json"

// Same families as mro-protect-secrets. Kept local so this plugin stays
// dependency-free; if you add a pattern there, add it here too.
const SECRET_PATTERNS = [
  [/sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/, "OpenAI-style key"],
  [/gh[pousr]_[A-Za-z0-9]{36,}/, "GitHub token"],
  [/github_pat_[A-Za-z0-9_]{40,}/, "GitHub fine-grained PAT"],
  [/glpat-[A-Za-z0-9_-]{20,}/, "GitLab PAT"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key"],
  [/AIza[0-9A-Za-z_-]{35}/, "Google API key"],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/, "Stripe key"],
  [/npm_[A-Za-z0-9]{36}/, "npm token"],
  [/pypi-[A-Za-z0-9_-]{50,}/, "PyPI token"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key"],
]

/** Return the first matching label in `text`, or null. */
export function findSecret(text) {
  if (typeof text !== "string" || text.length === 0) return null
  for (const [pattern, label] of SECRET_PATTERNS) {
    if (pattern.test(text)) return label
  }
  // Best-effort base64: decode long base64-ish runs and re-check the plaintext.
  for (const match of text.matchAll(/[A-Za-z0-9+/]{24,}={0,2}/g)) {
    let decoded
    try {
      decoded = Buffer.from(match[0], "base64").toString("utf8")
    } catch {
      continue
    }
    if (!decoded || decoded === match[0]) continue
    for (const [pattern, label] of SECRET_PATTERNS) {
      if (pattern.test(decoded)) return `base64-encoded ${label}`
    }
  }
  return null
}

/**
 * Parse acceptance-criteria bullets from a plan.
 *
 * Supported shape:
 *   - [ ] AC-1: When ... — verify: `pnpm test -k ac1` evidence: exit 0
 *   - [x] AC-2: ... — verify: `...` evidence: `...`
 *   - [~] AC-3: ... — reason: deferred by the human on 2026-11-20
 *
 * `[x]` means confirmed with evidence, `[~]` means deliberately deferred (a
 * reason is mandatory), `[ ]` means pending. Anything else is ignored.
 */
export function parseAcceptance(content) {
  const items = []
  const lines = String(content ?? "").split(/\r?\n/)
  lines.forEach((raw, index) => {
    const line = raw.trim()
    const match = /^- \[([ xX~])\]\s*(.*)$/.exec(line)
    if (!match) return

    const status = match[1] === " " ? "pending" : match[1] === "~" ? "deferred" : "confirmed"
    let body = match[2].trim()
    const idMatch = /^(AC-[A-Za-z0-9_.-]+|\d+)[:.)]\s*/.exec(body)
    const id = idMatch ? idMatch[1] : `line-${index + 1}`
    if (idMatch) body = body.slice(idMatch[0].length)

    const verifyMatch = /verify:\s*(?:`([^`]+)`|(.+?))(?=\s+(?:evidence|reason):|$)/i.exec(body)
    const evidenceMatch = /evidence:\s*(?:`([^`]+)`|(.+?))(?=\s+(?:verify|reason):|$)/i.exec(body)
    const reasonMatch = /reason:\s*(.+)$/i.exec(body)

    items.push({
      id,
      status,
      text: body
        .replace(/\s*(?:verify|evidence|reason):.*$/i, "")
        .trim(),
      verify: verifyMatch ? (verifyMatch[1] ?? verifyMatch[2]).trim() : null,
      evidence: evidenceMatch ? (evidenceMatch[1] ?? evidenceMatch[2]).trim() : null,
      reason: status === "deferred" ? (reasonMatch ? reasonMatch[1].trim() : null) : null,
      line: index + 1,
    })
  })
  return items
}

const run = (cmd, args, cwd, timeout = 60_000) =>
  new Promise((resolve) => {
    execFile(cmd, args, { cwd, timeout, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ code: error?.code ?? 0, stdout, stderr })
    })
  })

async function loadProfile(directory) {
  try {
    const raw = await readFile(join(directory, PROFILE_FILE), "utf8")
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

/** Merge the profile over the in-code defaults. Profile wins. */
export function resolveConfig(profile = {}) {
  const migrations = Array.isArray(profile.migrations)
    ? profile.migrations.filter(
        (entry) => entry && typeof entry.file === "string" && typeof entry.cmd === "string" && Array.isArray(entry.args),
      )
    : []
  const typecheck =
    profile.typecheckRunner && typeof profile.typecheckRunner.cmd === "string"
      ? profile.typecheckRunner
      : TYPECHECK
  return {
    migrations: migrations.length > 0 ? migrations : MIGRATION_CANDIDATES,
    typecheck,
    configuredFromProfile: {
      migrations: migrations.length > 0,
      typecheck: Boolean(profile.typecheckRunner),
    },
  }
}

export default {
  id: "mro-project-tools",
  async setup(ctx) {
    const directory = ctx.location.directory
    const profile = await loadProfile(directory)
    const config = resolveConfig(profile)

    await ctx.tool.transform((editor) => {
      editor.add({
        name: "db-status",
        description:
          "Report the project's database migration status using the configured migration command. Read-only.",
        input: { type: "object", properties: {}, required: [], additionalProperties: false },
        options: { codemode: true },
        execute: async () => {
          if (config.migrations.length === 0) {
            return {
              content:
                "db-status is not configured for this project. " +
                "Run `node .opencode/scripts/mro-doctor.mjs --init`, or add your migration tool to " +
                "MIGRATION_CANDIDATES in .opencode/plugins/mro-project-tools/index.js.",
            }
          }

          const found = config.migrations.filter((candidate) => existsSync(join(directory, candidate.file)))
          if (found.length === 0) {
            return {
              content:
                "None of the configured migration markers exists in this project: " +
                config.migrations.map((candidate) => candidate.file).join(", ") +
                ". Check the paths in MIGRATION_CANDIDATES.",
            }
          }

          const sections = []
          for (const candidate of found) {
            const { code, stdout, stderr } = await run(candidate.cmd, candidate.args, directory)
            sections.push(
              `## ${candidate.label} (${candidate.cmd} ${candidate.args.join(" ")})\nexit=${code}\n${(stdout || stderr).trim() || "(no output)"}`,
            )
          }
          return { content: sections.join("\n\n") }
        },
      })

      editor.add({
        name: "check-file",
        description:
          "Run the configured typecheck/import command and return only the diagnostics that mention one file. Use after creating, moving, or renaming a file. Read-only.",
        input: {
          type: "object",
          properties: { file: { type: "string", description: "Project-relative path, for example src/app.ts" } },
          required: ["file"],
          additionalProperties: false,
        },
        options: { codemode: true },
        execute: async (input) => {
          const file = String(input.file ?? "").replace(/^\.\//, "")
          if (!file) return { content: "check-file needs a file path." }

          if (!config.typecheck) {
            return {
              content:
                "check-file is not configured for this project. " +
                "Run `node .opencode/scripts/mro-doctor.mjs --init` to write .opencode/mro-profile.json, " +
                "or set TYPECHECK in .opencode/plugins/mro-project-tools/index.js.",
            }
          }

          const ext = extname(file)
          if (config.typecheck.extensions && !config.typecheck.extensions.includes(ext)) {
            return {
              content: `${file} has extension "${ext || "(none)"}", which TYPECHECK.extensions does not cover. Nothing to check.`,
            }
          }

          const { code, stdout, stderr } = await run(config.typecheck.cmd, config.typecheck.args, directory)
          const lines = `${stdout}\n${stderr}`
            .split("\n")
            .filter((line) => line.includes(file))
            .slice(0, 40)

          if (lines.length === 0) {
            return {
              content:
                code === 0
                  ? `No diagnostics reported for ${file}.`
                  : `The typecheck command exited ${code} but reported no line mentioning ${file}. The error is elsewhere.`,
            }
          }
          return { content: `Diagnostics mentioning ${file}:\n${lines.join("\n")}` }
        },
      })

      editor.add({
        name: "check-acceptance",
        description:
          "Parse acceptance criteria from a plan: confirmed `[x]`, pending `[ ]`, deferred `[~]`, and the `verify:`/`evidence:` fields. Read-only; it never executes the verify commands.",
        input: {
          type: "object",
          properties: {
            planFile: {
              type: "string",
              description: "Project-relative plan path, for example .opencode/plans/feature-x.md",
            },
          },
          required: ["planFile"],
          additionalProperties: false,
        },
        options: { codemode: true },
        execute: async (input) => {
          const planFile = String(input.planFile ?? "").replace(/^\.\//, "")
          if (!planFile) return { content: "check-acceptance needs a plan path." }

          const root = resolve(directory)
          const target = resolve(root, planFile)
          if (target !== root && !target.startsWith(root + sep)) {
            return { content: `Refusing to read outside the project: ${planFile}` }
          }

          let content
          try {
            content = await readFile(target, "utf8")
          } catch {
            return { content: `Could not read ${planFile}. Check the path.` }
          }

          const items = parseAcceptance(content)
          if (items.length === 0) {
            return {
              content:
                "No acceptance criteria found. The plan should use '- [ ]' bullets under an Acceptance Criteria heading.",
            }
          }

          const pending = items.filter((item) => item.status === "pending")
          const confirmed = items.filter((item) => item.status === "confirmed")
          const deferred = items.filter((item) => item.status === "deferred")
          const missingVerify = items.filter((item) => item.status !== "deferred" && !item.verify)
          const noEvidence = confirmed.filter((item) => !item.evidence)
          const badDeferral = deferred.filter((item) => !item.reason)

          const section = (title, list, format) =>
            list.length === 0 ? [] : ["", `${title}:`, ...list.map(format)]

          const output = [
            `Total: ${items.length} | Confirmed: ${confirmed.length} | Pending: ${pending.length} | Deferred: ${deferred.length}`,
            ...section("PENDING (implement, test, or defer with a reason)", pending, (item) =>
              `- ${item.id} line ${item.line}: ${item.text}`),
            ...section("CONFIRMED", confirmed, (item) =>
              `- ${item.id} line ${item.line}: ${item.evidence ? `evidence: ${item.evidence}` : "NO EVIDENCE RECORDED"}`),
            ...section("DEFERRED", deferred, (item) =>
              `- ${item.id} line ${item.line}: ${item.reason ?? "NO REASON RECORDED"}`),
            ...section("MISSING verify: (add a command, or 'manual: <what to check>')", missingVerify, (item) =>
              `- ${item.id} line ${item.line}`),
            ...section("CONFIRMED WITHOUT evidence: (a tick without proof is not acceptance)", noEvidence, (item) =>
              `- ${item.id} line ${item.line}`),
            ...section("DEFERRED WITHOUT reason:", badDeferral, (item) => `- ${item.id} line ${item.line}`),
            "",
            "Do not tick a box without evidence: a passing test, verified command output, or human confirmation.",
            "check-acceptance never runs the verify commands; run them through the normal shell permission rules.",
            "A deferral is `- [~] ... — reason: ...`, not an unchecked box.",
          ]

          return { content: output.join("\n") }
        },
      })

      editor.add({
        name: "secret-audit",
        description:
          "Scan the working tree (staged/unstaged diff plus untracked files) for secret patterns, including base64-encoded ones. Read-only; use after a run and before committing.",
        input: { type: "object", properties: {}, required: [], additionalProperties: false },
        options: { codemode: true },
        execute: async () => {
          const findings = []
          const diff = await run("git", ["diff", "--no-ext-diff", "--unified=0", "--", "."], directory)
          let path = "(unknown)"
          let line = 0
          for (const raw of diff.stdout.split("\n")) {
            if (raw.startsWith("+++ b/")) {
              path = raw.slice(6)
              continue
            }
            const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw)
            if (hunk) {
              line = Number(hunk[1])
              continue
            }
            if (raw.startsWith("+") && !raw.startsWith("+++")) {
              const label = findSecret(raw.slice(1))
              if (label) findings.push(`${path}:${line} — ${label}`)
              line += 1
            } else if (!raw.startsWith("-") && !raw.startsWith("\\")) {
              line += 1
            }
          }

          const untracked = await run(
            "git",
            ["ls-files", "--others", "--exclude-standard", "--", "."],
            directory,
          )
          for (const name of untracked.stdout.split("\n").map((entry) => entry.trim()).filter(Boolean)) {
            let body
            try {
              body = await readFile(join(directory, name), "utf8")
            } catch {
              continue
            }
            if (body.length > 1024 * 1024) continue
            body.split("\n").forEach((entry, index) => {
              const label = findSecret(entry)
              if (label) findings.push(`${name}:${index + 1} — ${label}`)
            })
          }

          if (findings.length === 0) {
            return {
              content:
                "No secret patterns found in the working tree. This is pattern-based: base64 is decoded best-effort, " +
                "but split/obfuscated secrets and binary files are not covered.",
            }
          }
          return {
            content:
              `Potential secrets in the working tree (${findings.length}):\n` +
              findings.slice(0, 50).join("\n") +
              "\nRemove the literal, replace it with an environment variable, and rotate the credential.",
          }
        },
      })
    })
  },
}
