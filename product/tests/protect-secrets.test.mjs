import assert from "node:assert/strict"
import { test } from "node:test"

import plugin, { findSecret } from "../plugins/mro-protect-secrets/index.js"

test("findSecret matches known credential families", () => {
  assert.equal(findSecret("sk-proj-AAAABBBBCCCCDDDDEEEEFFFF"), "OpenAI-style key")
  assert.equal(findSecret("AKIA1234567890ABCDEF"), "AWS access key")
  assert.equal(findSecret("ghp_" + "a".repeat(36)), "GitHub token")
  assert.equal(findSecret("-----BEGIN OPENSSH PRIVATE KEY-----"), "private key")
})

test("findSecret decodes base64-encoded credentials", () => {
  const encoded = Buffer.from("sk-proj-AAAABBBBCCCCDDDDEEEEFFFF").toString("base64")
  assert.equal(findSecret(`token=${encoded}`), "base64-encoded OpenAI-style key")
})

test("findSecret ignores harmless identifiers and documentation", () => {
  assert.equal(findSecret("const password = process.env.PASSWORD"), null)
  assert.equal(findSecret("sk-short"), null)
  assert.equal(findSecret("just a normal sentence about tests"), null)
})

test("the plugin blocks a write containing a literal secret", async () => {
  let hook
  await plugin.setup({ tool: { hook: async (_name, fn) => { hook = fn } } })
  await assert.rejects(
    async () => hook({ tool: "write", input: { path: "x.txt", content: "AKIA1234567890ABCDEF" } }),
    /\[SECURITY\] AWS access key detected/,
  )
})

test("the plugin allows a write without a secret", async () => {
  let hook
  await plugin.setup({ tool: { hook: async (_name, fn) => { hook = fn } } })
  await hook({ tool: "write", input: { path: "x.txt", content: "hello" } })
})
