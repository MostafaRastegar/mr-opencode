// Blocks tool calls whose input looks like a leaked credential.
// V2 plugin shape: default export with { id, setup }, hook via ctx.tool.hook.
// No imports on purpose: a local plugin resolves without a package.json.

const PATTERNS = [
  [/sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/, "OpenAI-style key"],
  [/gh[pousr]_[A-Za-z0-9]{36,}/, "GitHub token"],
  [/github_pat_[A-Za-z0-9_]{40,}/, "GitHub fine-grained PAT"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key"],
]

// Shape verified on v2.3.0:
//   write -> { path, content }
//   edit  -> { path, oldString, newString }
//   shell -> { command }
//   execute (Code Mode) -> { code }
const textOf = (input) => {
  if (!input || typeof input !== "object") return ""
  return [input.content, input.newString, input.oldString, input.command, input.code]
    .filter((value) => typeof value === "string")
    .join("\n")
}

export default {
  id: "protect-secrets",
  async setup(ctx) {
    await ctx.tool.hook("execute.before", (event) => {
      if (!["write", "edit", "patch", "shell", "execute"].includes(event.tool)) return
      const text = textOf(event.input)
      if (!text) return
      for (const [pattern, label] of PATTERNS) {
        if (pattern.test(text)) {
          throw new Error(
            `[SECURITY] ${label} detected in ${event.tool}; blocked. ` +
              "Use an environment variable or a secret manager instead of a literal.",
          )
        }
      }
    })
  },
}
