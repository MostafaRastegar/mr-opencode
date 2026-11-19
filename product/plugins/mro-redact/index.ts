/**
 * @kkchengg/opencode-redact
 *
 * Two-way secret redaction for OpenCode v2.
 *
 * Outbound (protected): API keys, tokens, passwords and other secrets are
 * replaced with stable placeholders like `[REDACTED:aws-access-key:0000a1b2c3d4]`
 * before anything is sent to the model.
 *
 * Inbound (rehydrated): just before a tool runs, placeholders in the tool input
 * are swapped back to the real secret, so commands that need the value still
 * work. The model itself never sees the real secret.
 *
 * The plugin is intentionally dependency-free and self-contained: it exports a
 * plain `{ id, setup }` object, which is exactly what the OpenCode v2 loader
 * accepts. It does not need `@opencode/plugin` at runtime.
 *
 * Notes / limits:
 * - The vault is persisted to `~/.local/share/opencode/redact-vault.json`
 *   (override with `MRO_REDACT_VAULT`) after every new secret and reloaded in
 *   `setup`, so placeholders already in history survive a service restart.
 *   The file holds real secrets in plaintext and is written with mode 0600.
 * - Two OpenCode instances sharing the file use last-writer-wins. They can
 *   lose each other's newly added tokens, not corrupt the file (atomic rename).
 * - Redaction is applied to the outgoing request only; persisted local history
 *   and unrelated configuration are not modified.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

interface Rule {
  name: string;
  re: RegExp;
  /** 1-based capture group holding the secret; defaults to the whole match. */
  group?: number;
}

const RULES: Rule[] = [
  // Cloud
  {
    name: "aws-access-key",
    re: /\b(?:AKIA|ASIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ABIA|ACCA)[A-Z0-9]{16}\b/g,
  },
  { name: "gcp-api-key", re: /\bAIza[0-9A-Za-z_\-]{35}\b/g },
  // Code hosting
  { name: "github-pat", re: /\bgh[pousr]_[A-Za-z0-9]{20,255}\b/g },
  { name: "github-fine-grained", re: /\bgithub_pat_[A-Za-z0-9_]{20,255}\b/g },
  { name: "gitlab-pat", re: /\bglpat-[A-Za-z0-9_\-]{20,}\b/g },
  // Model providers
  { name: "openai-key", re: /\bsk-(?:proj-)?[A-Za-z0-9_\-]{20,}\b/g },
  { name: "anthropic-key", re: /\bsk-ant-[A-Za-z0-9_\-]{20,}\b/g },
  // Other services
  { name: "slack-token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { name: "stripe-key", re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  { name: "npm-token", re: /\bnpm_[A-Za-z0-9]{36}\b/g },
  { name: "pypi-token", re: /\bpypi-[A-Za-z0-9_\-]{50,}\b/g },
  // Structured secrets
  {
    name: "jwt",
    re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
  {
    name: "private-key",
    re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g,
  },
  // Generic `password = "..."` / `api_key: ...` assignments (value only).
  // The key may be quoted or an ENV-style name (`DB_PASSWORD=...`), and the
  // value may be quoted. Ambiguous values are filtered by isLikelyCredential.
  {
    name: "credential",
    re: /(["']?)([A-Za-z0-9_.-]*(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)[A-Za-z0-9_.-]*)\1\s*[:=]\s*(["']?)([^\s"',;]{6,})\3/gi,
    group: 4,
  },
];

/**
 * The generic rule is heuristic, so reject values that are plainly code rather
 * than secrets: type names/identifiers (`string`, `prompt`), member access
 * (`process.env.TOKEN`), and expressions (`foo()`, `${x}`). This keeps source
 * code from being tokenized and from polluting the vault.
 */
function isLikelyCredential(value: string): boolean {
  if (/[()[\]{}]|\$\{/.test(value)) return false;
  if (/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/.test(value)) return false;
  if (/^[A-Za-z_$][\w$]*$/.test(value) && !/\d/.test(value) && value.length < 20)
    return false;
  return true;
}

// ---------------------------------------------------------------------------
// Vault: placeholder token -> original secret
// ---------------------------------------------------------------------------

interface VaultEntry {
  secret: string;
  createdAt: number;
}

const MAX_VAULT = 4096;
const VAULT_FILE =
  process.env.MRO_REDACT_VAULT ??
  join(homedir(), ".local", "share", "opencode", "redact-vault.json");
const vault = new Map<string, VaultEntry>();

/** Rebuild the in-memory vault from disk. Missing or corrupt file means empty. */
function loadVault(): void {
  vault.clear();
  let raw: string;
  try {
    raw = readFileSync(VAULT_FILE, "utf8");
  } catch (error: any) {
    if (error?.code !== "ENOENT") {
      console.warn(`[mro-redact] could not read vault ${VAULT_FILE}:`, error);
    }
    return;
  }
  try {
    const entries = JSON.parse(raw) as unknown;
    if (!Array.isArray(entries)) return;
    let dropped = false;
    for (const item of entries) {
      if (!Array.isArray(item) || item.length < 2) continue;
      const [token, entry] = item as [unknown, any];
      if (typeof token !== "string" || typeof entry?.secret !== "string") continue;
      // Drop entries captured by the old, noisy generic rule so they stop
      // tokenizing harmless identifiers and rehydrating junk.
      if (
        token.startsWith("[REDACTED:credential:") &&
        !isLikelyCredential(entry.secret)
      ) {
        dropped = true;
        continue;
      }
      vault.set(token, {
        secret: entry.secret,
        createdAt: Number(entry.createdAt) || Date.now(),
      });
    }
    if (dropped) saveVault();
  } catch (error) {
    console.warn(`[mro-redact] ignoring corrupt vault ${VAULT_FILE}:`, error);
  }
}

/** Atomic write: temp file with 0600, then rename over the vault. */
function saveVault(): void {
  try {
    mkdirSync(dirname(VAULT_FILE), { recursive: true, mode: 0o700 });
    const temp = `${VAULT_FILE}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify([...vault]), { mode: 0o600 });
    renameSync(temp, VAULT_FILE);
  } catch (error) {
    console.warn(`[mro-redact] could not persist vault ${VAULT_FILE}:`, error);
  }
}

/** Stable, short, non-cryptographic fingerprint so a secret maps to one token. */
function fingerprint(secret: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < secret.length; i++) {
    h ^= secret.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(12, "0");
}

function remember(rule: string, secret: string): string {
  const token = `[REDACTED:${rule}:${fingerprint(secret)}]`;
  if (!vault.has(token)) {
    while (vault.size >= MAX_VAULT) {
      const oldest = vault.keys().next().value;
      if (oldest === undefined) break;
      vault.delete(oldest);
    }
    vault.set(token, { secret, createdAt: Date.now() });
    saveVault();
  }
  return token;
}

const TOKEN_RE = /\[REDACTED:[a-z0-9-]+:[0-9a-f]{12}\]/g;

/**
 * Replace secrets with tokens. Every rule scans the original text, so no rule
 * can match inside another rule's token. Ranges already covered by a token
 * (a secret re-sent on a later turn) are reserved so the generic assignment
 * rule cannot match inside `...access-key:<hash>]`.`.
 */
function redactString(text: string): string {
  if (!text) return text;

  const reserved: Array<[number, number]> = [];
  TOKEN_RE.lastIndex = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    const start = match.index ?? 0;
    reserved.push([start, start + match[0].length]);
  }
  const overlaps = (start: number, end: number) =>
    reserved.some(([a, b]) => start < b && end > a);

  const edits: Array<{ start: number; end: number; token: string }> = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    for (const match of text.matchAll(rule.re)) {
      const whole = match[0];
      const base = match.index ?? 0;
      const secret = rule.group ? match[rule.group] : whole;
      if (typeof secret !== "string" || secret.length === 0) continue;
      if (rule.name === "credential" && !isLikelyCredential(secret)) continue;
      const at = rule.group ? whole.indexOf(secret) : 0;
      if (at < 0) continue;
      const start = base + at;
      const end = start + secret.length;
      if (overlaps(start, end)) continue;
      reserved.push([start, end]);
      edits.push({ start, end, token: remember(rule.name, secret) });
    }
  }

  if (edits.length === 0) return text;
  edits.sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const edit of edits) {
    out += text.slice(cursor, edit.start) + edit.token;
    cursor = edit.end;
  }
  return out + text.slice(cursor);
}

function rehydrateString(text: string): string {
  if (!text.includes("[REDACTED:")) return text;
  return text.replace(TOKEN_RE, (token) => vault.get(token)?.secret ?? token);
}

// ---------------------------------------------------------------------------
// Deep string walking (mutates in place)
// ---------------------------------------------------------------------------

const MAX_STRING = 200_000;
const MAX_DEPTH = 32;
const overflowWarned = new WeakSet<object>();

/** Skip large binary-ish blobs (base64, image data) so we never corrupt them. */
function isOpaque(value: string): boolean {
  if (value.length > MAX_STRING) return true;
  if (value.startsWith("data:")) return true;
  if (
    value.length > 4096 &&
    !value.includes(" ") &&
    /^[A-Za-z0-9+/=\s]+$/.test(value)
  )
    return true;
  return false;
}

function walkStrings(
  value: unknown,
  fn: (s: string) => string,
  skipOpaque: boolean,
  seen = new WeakSet<object>(),
  depth = 0,
  path = "",
): void {
  if (value === null || typeof value !== "object") return;
  if (depth > MAX_DEPTH) {
    if (!overflowWarned.has(value)) {
      overflowWarned.add(value);
      console.warn(
        `[mro-redact] MAX_DEPTH ${MAX_DEPTH} reached at ${path || "(root)"}; ` +
          "strings below this level are not redacted",
      );
    }
    return;
  }
  if (seen.has(value)) return;
  seen.add(value);

  const apply = (input: string): string | undefined => {
    if (skipOpaque && isOpaque(input)) return undefined;
    const next = fn(input);
    return next === input ? undefined : next;
  };

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (typeof item === "string") {
        const next = apply(item);
        if (next !== undefined) {
          try {
            value[i] = next;
          } catch {
            // Frozen or read-only entry: leave it untouched.
          }
        }
      } else {
        walkStrings(item, fn, skipOpaque, seen, depth + 1, path ? `${path}[${i}]` : `[${i}]`);
      }
    }
    return;
  }

  for (const key of Object.keys(value as Record<string, unknown>)) {
    const item = (value as Record<string, unknown>)[key];
    if (typeof item === "string") {
      const next = apply(item);
      if (next !== undefined) {
        try {
          (value as Record<string, unknown>)[key] = next;
        } catch {
          // Frozen or read-only field: leave it untouched.
        }
      }
    } else {
      walkStrings(item, fn, skipOpaque, seen, depth + 1, path ? `${path}.${key}` : key);
    }
  }
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string")
    return isOpaque(value) ? value : redactString(value);
  walkStrings(value, redactString, true);
  return value;
}

function rehydrateValue(value: unknown): unknown {
  if (typeof value === "string") return rehydrateString(value);
  walkStrings(value, rehydrateString, false);
  return value;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default {
  id: "opencode-redact",
  async setup(ctx: any) {
    // 0. Rebuild the vault from disk so tokens in persisted history can still
    //    be rehydrated after a service restart.
    loadVault();

    // 1. Redact the user's prompt at admission.
    await ctx.session.hook("prompt", (event: any) => {
      if (typeof event.prompt?.text === "string") {
        event.prompt.text = redactValue(event.prompt.text) as string;
      }
    });

    // 2. Redact the assembled request (system, messages, tool definitions)
    //    right before it is sent to the model.
    await ctx.session.hook("context", (event: any) => {
      try {
        redactValue(event.system);
        redactValue(event.messages);
        redactValue(event.tools);
      } catch {
        // Redaction must never break a request.
      }
    });

    // 3. Rehydrate placeholders in tool input just before execution, so the
    //    real secret is used locally without ever reaching the model. V2's
    //    `execute.before` hook documents replacing `event.input`, so the
    //    rehydrated value is what the tool runs with.
    if (ctx.tool && typeof ctx.tool.hook === "function") {
      await ctx.tool.hook("execute.before", (event: any) => {
        try {
          event.input = rehydrateValue(event.input);
        } catch {
          // Rehydration must never break a tool call.
        }
      });
    }
  },
};
