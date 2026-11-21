#!/usr/bin/env node
/**
 * mro-model-check — one-token preflight against the configured gateway.
 *
 * Why this exists: a workflow that dies halfway because the provider says
 * "insufficient balance" corrupts the orchestration state. Checking first makes
 * that failure explicit and early.
 *
 * Usage:
 *   node .opencode/scripts/mro-model-check.mjs
 *   node .opencode/scripts/mro-model-check.mjs --model 9router/deep
 *   node .opencode/scripts/mro-model-check.mjs --base-url http://localhost:20128/v1
 *
 * Environment:
 *   ROUTER_API_KEY        credential (optional; unset skips the check)
 *   MRO_MODEL_BASE_URL    overrides the default gateway URL
 *   MRO_MODEL             overrides the default model
 *
 * Exit codes:
 *   0  the model answered
 *   1  the gateway answered with an error, or the request failed
 *   2  skipped (no credential configured)
 */

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};

const baseUrl = (argOf("--base-url", process.env.MRO_MODEL_BASE_URL ?? "http://localhost:20128/v1")).replace(/\/+$/, "");
const rawModel = argOf("--model", process.env.MRO_MODEL ?? "9router/deep");
const model = rawModel.includes("/") ? rawModel.slice(rawModel.indexOf("/") + 1) : rawModel;
const key = process.env.ROUTER_API_KEY;
const timeout = Number(argOf("--timeout", "15000"));

if (!key) {
  // No credential means the human has not configured this gateway yet. That is
  // their call, not a blocker: skip quietly instead of asking for a key.
  process.stdout.write("mro-model-check: skipped (no gateway credential configured).\n");
  process.exit(2);
}

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), Number.isFinite(timeout) ? timeout : 15000);

try {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with OK." }],
      max_tokens: 1,
      stream: false,
    }),
    signal: controller.signal,
  });
  const body = await response.text();
  if (!response.ok) {
    const hint = /insufficient|balance|quota|credit/i.test(body)
      ? " (provider reports insufficient balance/quota)"
      : "";
    process.stderr.write(
      `mro-model-check: ${model} failed with HTTP ${response.status}${hint}: ${body.slice(0, 500)}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`mro-model-check: ${model} answered (HTTP ${response.status}).\n`);
  process.exit(0);
} catch (error) {
  const reason = error?.name === "AbortError" ? `timed out after ${timeout}ms` : String(error?.message ?? error);
  process.stderr.write(`mro-model-check: ${model} unreachable: ${reason}\n`);
  process.exit(1);
} finally {
  clearTimeout(timer);
}
