// Registers three stack-neutral helper tools: db-status, check-file, check-acceptance.
// V2 has no `.opencode/tools/`; tools come from a plugin via ctx.tool.transform.
// No imports outside node: builtins, so the plugin loads in a bare project.
//
// The template assumes NO language, runner, or database. Fill in the two
// configuration blocks below for the project; until then the tools report
// "not configured" instead of guessing.

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

const run = (cmd, args, cwd) =>
  new Promise((resolve) => {
    execFile(cmd, args, { cwd, timeout: 60_000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ code: error?.code ?? 0, stdout, stderr })
    })
  })

export default {
  id: "project-tools",
  async setup(ctx) {
    const directory = ctx.location.directory

    await ctx.tool.transform((editor) => {
      editor.add({
        name: "db-status",
        description:
          "Report the project's database migration status using the configured migration command. Read-only.",
        input: { type: "object", properties: {}, required: [], additionalProperties: false },
        options: { codemode: true },
        execute: async () => {
          if (MIGRATION_CANDIDATES.length === 0) {
            return {
              content:
                "db-status is not configured for this project. " +
                "Add your migration tool to MIGRATION_CANDIDATES in .opencode/plugins/project-tools/index.js.",
            }
          }

          const found = MIGRATION_CANDIDATES.filter((candidate) => existsSync(join(directory, candidate.file)))
          if (found.length === 0) {
            return {
              content:
                "None of the configured migration markers exists in this project: " +
                MIGRATION_CANDIDATES.map((candidate) => candidate.file).join(", ") +
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

          if (!TYPECHECK) {
            return {
              content:
                "check-file is not configured for this project. " +
                "Set TYPECHECK in .opencode/plugins/project-tools/index.js to your typecheck command, or drop the tool from the workflow.",
            }
          }

          const ext = extname(file)
          if (TYPECHECK.extensions && !TYPECHECK.extensions.includes(ext)) {
            return {
              content: `${file} has extension "${ext || "(none)"}", which TYPECHECK.extensions does not cover. Nothing to check.`,
            }
          }

          const { code, stdout, stderr } = await run(TYPECHECK.cmd, TYPECHECK.args, directory)
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
          "Report checked and unchecked acceptance criteria from a plan file (`- [ ]` / `- [x]` lines). Read-only.",
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

          const lines = content
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => /^- \[[ xX]\]/.test(line))

          if (lines.length === 0) {
            return { content: "No acceptance criteria found. The plan should use '- [ ]' bullets under an Acceptance Criteria heading." }
          }

          const unchecked = lines.filter((line) => /^- \[ \]/.test(line))
          const checked = lines.filter((line) => /^- \[[xX]\]/.test(line))

          return {
            content: [
              `Total: ${lines.length} | Checked: ${checked.length} | Unchecked: ${unchecked.length}`,
              "",
              unchecked.length ? "Unchecked:\n" + unchecked.join("\n") : "All criteria are checked.",
              "",
              "Do not tick a box without evidence: a passing test, a verified command output, or a human confirmation.",
              "For each unchecked item: implement it, add a test that proves it, or ask the human to defer it explicitly.",
            ].join("\n"),
          }
        },
      })
    })
  },
}
