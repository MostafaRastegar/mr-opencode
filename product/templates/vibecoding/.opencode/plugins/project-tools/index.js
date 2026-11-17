// Registers a `db-status` tool: reports the project's migration state.
// V2 has no `.opencode/tools/`; tools come from a plugin via ctx.tool.transform.
// No imports outside node: builtins, so the plugin loads in a bare project.

import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { join, resolve, sep } from "node:path"

const CANDIDATES = [
  { file: "prisma/schema.prisma", label: "Prisma", cmd: "npx", args: ["--no-install", "prisma", "migrate", "status"] },
  { file: "alembic.ini", label: "Alembic", cmd: "alembic", args: ["current"] },
  { file: "manage.py", label: "Django", cmd: "python3", args: ["manage.py", "showmigrations", "--plan"] },
]

const run = (cmd, args, cwd) =>
  new Promise((resolve) => {
    execFile(cmd, args, { cwd, timeout: 60_000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ code: error?.code ?? 0, stdout, stderr })
    })
  })

const localTsc = (directory) => {
  const binary = join(directory, "node_modules", ".bin", "tsc")
  return existsSync(binary) ? binary : null
}


export default {
  id: "project-tools",
  async setup(ctx) {
    const directory = ctx.location.directory

    await ctx.tool.transform((editor) => {
      editor.add({
        name: "db-status",
        description:
          "Report the project's database migration status. Detects Prisma, Alembic, and Django. Read-only.",
        input: { type: "object", properties: {}, required: [], additionalProperties: false },
        options: { codemode: true },
        execute: async () => {
          const found = CANDIDATES.filter((candidate) => existsSync(join(directory, candidate.file)))
          if (found.length === 0) {
            return {
              content:
                "No supported migration tool detected in this project. " +
                "Looked for: prisma/schema.prisma, alembic.ini, manage.py. " +
                "Extend CANDIDATES in .opencode/plugins/project-tools/index.js for this stack.",
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
        name: "check-imports",
        description:
          "Report TypeScript errors that mention a given file. Use after creating, moving, or renaming a file. Read-only.",
        input: {
          type: "object",
          properties: { file: { type: "string", description: "Project-relative path, for example src/app.ts" } },
          required: ["file"],
          additionalProperties: false,
        },
        options: { codemode: true },
        execute: async (input) => {
          const file = String(input.file ?? "").replace(/^\.\//, "")
          if (!file) return { content: "check-imports needs a file path." }

          if (!existsSync(join(directory, "tsconfig.json"))) {
            return { content: `No tsconfig.json in ${directory}; check-imports is TypeScript-only.` }
          }

          const tsc = localTsc(directory)
          if (!tsc) {
            return { content: "No local tsc found. Run the project's install step first (tsc lives in node_modules/.bin)." }
          }

          const { code, stdout, stderr } = await run(tsc, ["--noEmit", "--pretty", "false"], directory)
          const lines = `${stdout}\n${stderr}`
            .split("\n")
            .filter((line) => line.includes(file))
            .slice(0, 40)

          if (lines.length === 0) {
            return {
              content:
                code === 0
                  ? `No TypeScript errors reported for ${file}.`
                  : `tsc exited ${code} but reported no error line mentioning ${file}. The error is elsewhere.`,
            }
          }
          return { content: `TypeScript errors mentioning ${file}:\n${lines.join("\n")}` }
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
