// Blocks tool calls whose input looks like a leaked credential.
// V2 plugin shape: default export with { id, setup }, hook via ctx.tool.hook.
// No imports on purpose: a local plugin resolves without a package.json.
//
// Known gaps (documented in README): split/obfuscated secrets and binary
// payloads are not detected. Base64 is decoded best-effort below.

export const PATTERNS = [
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

/**
 * Return the first matching label in `text`, or null.
 * Exported so the template's own tests can exercise it without a session.
 */
export function findSecret(text) {
  if (typeof text !== "string" || text.length === 0) return null
  for (const [pattern, label] of PATTERNS) {
    if (pattern.test(text)) return label
  }
  // Best-effort base64: decode long base64-ish runs and re-check the plaintext.
  // This catches a naive `base64 -w0 secret` paste; it does not catch splitting,
  // encryption, or a custom alphabet. That remains a documented gap.
  for (const match of text.matchAll(/[A-Za-z0-9+/]{24,}={0,2}/g)) {
    let decoded
    try {
      decoded = Buffer.from(match[0], "base64").toString("utf8")
    } catch {
      continue
    }
    if (!decoded || decoded === match[0]) continue
    for (const [pattern, label] of PATTERNS) {
      if (pattern.test(decoded)) return `base64-encoded ${label}`
    }
  }
  return null
}

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
  id: "mro-protect-secrets",
  async setup(ctx) {
    await ctx.tool.hook("execute.before", (event) => {
      if (!["write", "edit", "patch", "shell", "execute"].includes(event.tool)) return
      const text = textOf(event.input)
      if (!text) return
      const label = findSecret(text)
      if (label) {
        throw new Error(
          `[SECURITY] ${label} detected in ${event.tool}; blocked. ` +
            "Use an environment variable or a secret manager instead of a literal.",
        )
      }
    })
  },
}
