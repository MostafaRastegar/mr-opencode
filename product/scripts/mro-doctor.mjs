#!/usr/bin/env node
/**
 * mro-doctor — find and fill the template's placeholders.
 *
 * Why this exists: the template is stack-neutral, so AGENTS.md ships with
 * `<TEST_CMD>`-style tokens and the project-tools plugin ships unconfigured.
 * Relying on the model to notice those gaps is not a safety property. This
 * script makes the gap machine-visible.
 *
 * Usage (from the project root):
 *   node .opencode/scripts/mro-doctor.mjs            # check, exit 1 on gaps
 *   node .opencode/scripts/mro-doctor.mjs --json     # same, machine readable
 *   node .opencode/scripts/mro-doctor.mjs --init     # suggest + confirm + write
 *   node .opencode/scripts/mro-doctor.mjs --write    # write suggestions, no prompt
 *   node .opencode/scripts/mro-doctor.mjs --docs     # also check behavior-doc freshness
 *
 * What it never does: run the project's test/typecheck/build commands, edit
 * source code, or invent a value. Undetected fields stay as `<...>` tokens (or
 * become `-` for the optional commands AGENTS.md marks optional).
 *
 * No dependencies: node: builtins only.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const PROFILE_REL = ".opencode/mro-profile.json";

const PROFILE_LABELS = {
  stack: ["Stack"],
  language: ["Primary language"],
  test: ["Test command"],
  typecheck: ["Typecheck command"],
  lint: ["Lint command"],
  build: ["Build command"],
  migration: ["Migration command"],
  lockfile: ["Dependency manifest / lockfile"],
  languageRules: ["Language rules"],
};

const EXEC_COMMANDS = new Set(["test", "typecheck", "lint", "build", "migration"]);

/** Split `pnpm exec tsc --noEmit` into { cmd, args } without a shell. */
export function splitCommand(command) {
  if (!command || command === "-") return null;
  const parts = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  const clean = parts.map((part) => part.replace(/^(["'])(.*)\1$/, "$2"));
  if (clean.length === 0) return null;
  return { cmd: clean[0], args: clean.slice(1) };
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function text(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function has(path) {
  return existsSync(path);
}

function detectNode(project) {
  const manifest = readJson(join(project, "package.json"));
  if (!manifest) return {};

  const deps = { ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) };
  const scripts = manifest.scripts ?? {};
  let pm = "npm";
  let lockfile = "package-lock.json";
  for (const candidate of [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lockb", "bun"],
    ["bun.lock", "bun"],
    ["package-lock.json", "npm"],
  ]) {
    if (has(join(project, candidate[0]))) {
      lockfile = candidate[0];
      pm = candidate[1];
      break;
    }
  }
  if (!has(join(project, lockfile))) lockfile = manifest.packageManager?.split("@")[0] ?? lockfile;

  const run = (name) => (scripts[name] ? `${pm} run ${name}` : null);
  const exec = (name, args) => `${pm} exec ${name}${args?.length ? " " + args.join(" ") : ""}`;
  const typescript = Boolean(deps.typescript) || has(join(project, "tsconfig.json"));

  const result = {
    language: typescript ? "TypeScript" : "JavaScript",
    test: scripts.test ? `${pm} test` : null,
    typecheck: run("typecheck") ??
      (typescript ? exec("tsc", ["--noEmit"]) : null),
    lint: run("lint") ??
      (has(join(project, "eslint.config.js")) || has(join(project, "eslint.config.mjs")) ||
        has(join(project, ".eslintrc")) || has(join(project, ".eslintrc.json")) ||
        has(join(project, ".eslintrc.cjs"))
        ? exec("eslint", ["."])
        : null),
    build: run("build"),
    lockfile,
  };

  const framework = [
    ["next", "Next.js"], ["react", "React"], ["vue", "Vue"], ["svelte", "Svelte"],
    ["@nestjs/core", "NestJS"], ["express", "Express"], ["fastify", "Fastify"],
  ].find(([name]) => deps[name]);
  result.stack = framework
    ? `${framework[1]}${typescript ? " + TypeScript" : " + JavaScript"} (Node)`
    : `${typescript ? "Node.js + TypeScript" : "Node.js + JavaScript"}`;

  if (typescript) result.languageRules = "strict mode; no any; explicit public types";
  else result.languageRules = "follow the existing style; no new dependencies without approval";

  if (result.typecheck) {
    result.typecheckRunner = {
      ...splitCommand(result.typecheck),
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
    };
  }

  if (has(join(project, "prisma/schema.prisma"))) {
    result.migration = exec("prisma", ["migrate", "status"]);
    result.migrations = [{
      file: "prisma/schema.prisma",
      label: "Prisma",
      ...splitCommand(result.migration),
    }];
  }
  return result;
}

function detectPython(project) {
  const pyproject = join(project, "pyproject.toml");
  const requirements = join(project, "requirements.txt");
  if (!has(pyproject) && !has(requirements) && !has(join(project, "setup.py"))) return {};
  const body = `${text(pyproject)}\n${text(requirements)}`.toLowerCase();
  const lockfile = ["uv.lock", "poetry.lock", "Pipfile.lock", "requirements.txt"]
    .find((name) => has(join(project, name))) ?? "requirements.txt";
  const result = {
    stack: "Python",
    language: "Python",
    test: "pytest",
    typecheck: body.includes("mypy") ? "mypy ." : null,
    lint: body.includes("ruff") ? "ruff check ." : null,
    build: null,
    lockfile,
    languageRules: "type hints on public functions; no bare except; follow existing style",
  };
  if (has(join(project, "alembic.ini"))) {
    result.migration = "alembic current";
    result.migrations = [{ file: "alembic.ini", label: "Alembic", ...splitCommand("alembic current") }];
  }
  return result;
}

function detectGo(project) {
  if (!has(join(project, "go.mod"))) return {};
  const result = {
    stack: "Go",
    language: "Go",
    test: "go test ./...",
    typecheck: "go vet ./...",
    lint: has(join(project, ".golangci.yml")) || has(join(project, ".golangci.yaml"))
      ? "golangci-lint run" : null,
    build: "go build ./...",
    lockfile: "go.sum",
    languageRules: "gofmt; return errors instead of panicking; no discarded errors",
  };
  return result;
}

function detectRust(project) {
  if (!has(join(project, "Cargo.toml"))) return {};
  return {
    stack: "Rust",
    language: "Rust",
    test: "cargo test",
    typecheck: "cargo check",
    lint: "cargo clippy -- -D warnings",
    build: "cargo build",
    lockfile: "Cargo.lock",
    languageRules: "no unwrap in library code without a comment; explicit error types",
  };
}

function detectMaven(project) {
  if (!has(join(project, "pom.xml"))) return {};
  return {
    stack: "Java + Maven",
    language: "Java",
    test: "mvn test",
    typecheck: null,
    lint: null,
    build: "mvn package",
    lockfile: "-",
    languageRules: "follow the project's existing package and naming conventions",
  };
}

function detectGradle(project) {
  if (!has(join(project, "build.gradle")) && !has(join(project, "build.gradle.kts"))) return {};
  return {
    stack: "Java/Kotlin + Gradle",
    language: has(join(project, "build.gradle.kts")) ? "Kotlin" : "Java",
    test: "./gradlew test",
    typecheck: null,
    lint: null,
    build: "./gradlew build",
    lockfile: "gradle.lockfile",
    languageRules: "follow the project's existing package and naming conventions",
  };
}

function detectPhp(project) {
  const manifest = readJson(join(project, "composer.json"));
  if (!manifest) return {};
  return {
    stack: "PHP + Composer",
    language: "PHP",
    test: manifest.scripts?.test ? "composer test" : "vendor/bin/phpunit",
    typecheck: null,
    lint: has(join(project, "phpcs.xml")) ? "vendor/bin/phpcs" : null,
    build: null,
    lockfile: "composer.lock",
    languageRules: "declare strict_types; follow PSR-12",
  };
}

function detectRuby(project) {
  if (!has(join(project, "Gemfile"))) return {};
  return {
    stack: "Ruby",
    language: "Ruby",
    test: "bundle exec rspec",
    typecheck: null,
    lint: has(join(project, ".rubocop.yml")) ? "bundle exec rubocop" : null,
    build: null,
    lockfile: "Gemfile.lock",
    languageRules: "follow the project's existing style; no global state",
  };
}

function detect(project) {
  const pieces = [
    detectNode(project),
    detectPython(project),
    detectGo(project),
    detectRust(project),
    detectMaven(project),
    detectGradle(project),
    detectPhp(project),
    detectRuby(project),
  ].filter((piece) => Object.keys(piece).length > 0);

  if (pieces.length === 0) return {};
  // First detector that found a manifest wins; later ones only fill gaps.
  const merged = {};
  for (const piece of pieces) {
    for (const [key, value] of Object.entries(piece)) {
      if (merged[key] === undefined || merged[key] === null) merged[key] = value;
    }
  }
  return merged;
}

function readProfile(project) {
  return readJson(join(project, PROFILE_REL));
}

const PROFILE_LINE = /^-\s*([^:]+):/;

/**
 * Placeholder tokens still present on Project Profile lines, with line numbers.
 * Both the root AGENTS.md and the generic template copy in .opencode/ are
 * checked: the template ships unfilled, and leaving it unfilled means every
 * session re-derives the stack by hand.
 */
function findPlaceholders(project) {
  const labels = new Set(Object.values(PROFILE_LABELS).flat());
  const found = [];
  for (const rel of ["AGENTS.md", ".opencode/AGENTS.md"]) {
    const file = join(project, rel);
    const body = text(file);
    if (!body) {
      if (rel === "AGENTS.md") found.push({ file: rel, line: 0, token: "<AGENTS.md missing>", text: "" });
      continue;
    }
    body.split(/\r?\n/).forEach((line, index) => {
      const label = PROFILE_LINE.exec(line)?.[1]?.trim();
      // Only the profile's own `- <Label>: ...` lines are authoritative. Other
      // mentions of a token elsewhere in the file are prose, not an unfilled field.
      if (!label || !labels.has(label)) return;
      for (const token of line.match(/<[A-Z][A-Z0-9_]*>/g) ?? []) {
        found.push({ file: rel, line: index + 1, token, text: line.trim() });
      }
    });
  }
  return found;
}

function behaviorDocs(project) {
  const dir = join(project, "docs", "behaviors");
  if (!has(dir)) return { missing: !has(dir), stale: [], invalid: [] };
  const stale = [];
  const invalid = [];
  for (const name of readdirSync(dir).filter((entry) => entry.endsWith(".md"))) {
    const file = join(dir, name);
    const body = text(file);
    const verified = /^last_verified:\s*(\d{4}-\d{2}-\d{2})\s*$/m.exec(body)?.[1];
    const sources = /^source_files:\s*(.+)$/m.exec(body)?.[1]
      ?.split(",").map((entry) => entry.trim()).filter(Boolean) ?? [];
    if (!verified) {
      invalid.push({ file: relative(project, file), reason: "missing last_verified: YYYY-MM-DD" });
      continue;
    }
    const verifiedAt = Date.parse(`${verified}T23:59:59Z`);
    for (const source of sources) {
      const full = join(project, source);
      if (!has(full)) continue;
      let mtime;
      try {
        mtime = statSync(full).mtimeMs;
      } catch {
        continue;
      }
      if (mtime > verifiedAt) stale.push({ file: relative(project, file), source, last_verified: verified });
    }
  }
  return { missing: false, stale, invalid };
}

/**
 * Drift between the recorded project facts and the repository.
 *
 * Why: a project starts small and grows. The stack skill and the data-model
 * skill are correct on the day they are written and silently wrong a month
 * later. Detect that mechanically instead of trusting every session to notice.
 *
 * Two checks, both cheap and both tolerant of free prose:
 * - a dependency named in the stack skill with a version that disagrees with
 *   package.json;
 * - an entity the schema defines (Prisma today) missing from the data-model
 *   skill.
 */
function skillDrift(project) {
  const drift = [];
  const packageFile = join(project, "package.json");
  const stackFile = join(project, ".opencode", "skills", "mro-project-stack", "SKILL.md");
  const dataFile = join(project, ".opencode", "skills", "mro-data-model", "SKILL.md");

  const manifest = text(packageFile);
  const stack = text(stackFile);
  if (manifest && stack) {
    let parsed;
    try {
      parsed = JSON.parse(manifest);
    } catch {
      parsed = null;
    }
    const dependencies = { ...(parsed?.dependencies ?? {}), ...(parsed?.devDependencies ?? {}) };
    for (const [name, version] of Object.entries(dependencies)) {
      if (typeof version !== "string" || !/^\d+\.\d+\.\d+/.test(version)) continue;
      // Scoped names would reduce to a generic word ("client", "core"), which
      // matches prose all over a skill and reports false drift. Best-effort means
      // false negatives, never false alarms.
      if (name.startsWith("@")) continue;
      const base = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (base.length < 3) continue;
      const match = new RegExp(`\\b${base}[.\\w-]*\\s+(\\d+\\.\\d+\\.\\d+)`, "i").exec(stack);
      if (match && match[1] !== version) {
        drift.push({
          file: ".opencode/skills/mro-project-stack/SKILL.md",
          fact: name,
          recorded: match[1],
          actual: version,
        });
      }
    }
  }

  const schemaFile = join(project, "prisma", "schema.prisma");
  const schema = text(schemaFile);
  const data = text(dataFile);
  if (schema && data) {
    for (const match of schema.matchAll(/^model\s+(\w+)\s*\{/gm)) {
      const model = match[1];
      if (new RegExp(`\\b${model}\\b`).test(data)) continue;
      drift.push({
        file: ".opencode/skills/mro-data-model/SKILL.md",
        fact: `model ${model}`,
        recorded: "missing",
        actual: "present in prisma/schema.prisma",
      });
    }
  }
  return drift;
}

function gapsFor(project, detected, profile, placeholders, docs, drift) {
  const gaps = [];
  for (const placeholder of placeholders)
    gaps.push(`${placeholder.file}:${placeholder.line} still has ${placeholder.token}`);
  if (!profile) gaps.push(`${PROFILE_REL} is missing; db-status/check-file stay "not configured"`);
  const effective = { ...detected, ...(profile ?? {}) };
  if (!effective.test || effective.test === "-") gaps.push("test command is unknown");
  if (!effective.lockfile) gaps.push("lockfile is unknown (use `-` only if the project has none)");
  if (docs.stale.length) {
    for (const item of docs.stale) gaps.push(`${item.file} is older than ${item.source}`);
  }
  if (docs.invalid.length) {
    for (const item of docs.invalid) gaps.push(`${item.file}: ${item.reason}`);
  }
  for (const item of drift) {
    gaps.push(
      `${item.file} records ${item.fact} = ${item.recorded}, repository says ${item.actual} — run /mro-bootstrap in refresh mode`,
    );
  }
  return gaps;
}

function report(project, { json, docs: checkDocs }) {
  const detected = detect(project);
  const profile = readProfile(project);
  const placeholders = findPlaceholders(project);
  const docs = checkDocs ? behaviorDocs(project) : { missing: false, stale: [], invalid: [] };
  const drift = skillDrift(project);
  const gaps = gapsFor(project, detected, profile, placeholders, docs, drift);
  const effective = { ...detected, ...(profile ?? {}) };
  const tools = {
    "db-status": Boolean(effective.migrations?.length),
    "check-file": Boolean(effective.typecheckRunner),
  };

  const result = {
    ok: gaps.length === 0,
    root: project,
    profilePath: PROFILE_REL,
    profileExists: Boolean(profile),
    detected,
    profile,
    effective,
    placeholders,
    drift,
    tools,
    docs,
    gaps,
  };

  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  }

  const lines = [`mro-doctor: ${project}`, ""];
  for (const key of Object.keys(PROFILE_LABELS)) {
    const value = effective[key];
    lines.push(`  ${key.padEnd(13)} ${value === undefined || value === null ? "(unknown)" : value}`);
  }
  lines.push("");
  lines.push(`  profile       ${profile ? PROFILE_REL : `${PROFILE_REL} (missing)`}`);
  lines.push(`  db-status     ${tools["db-status"] ? "configured" : "not configured"}`);
  lines.push(`  check-file    ${tools["check-file"] ? "configured" : "not configured"}`);
  lines.push(`  skills        ${drift.length === 0 ? "match the repository" : `${drift.length} fact(s) out of date`}`);
  if (checkDocs) {
    lines.push(`  behavior docs ${docs.missing ? "docs/behaviors/ missing" : `${docs.stale.length} stale, ${docs.invalid.length} invalid`}`);
  }
  lines.push("");
  if (gaps.length === 0) {
    lines.push("OK: no placeholders remain.");
  } else {
    lines.push(`GAPS (${gaps.length}):`);
    for (const gap of gaps) lines.push(`  - ${gap}`);
    lines.push("");
    lines.push("Run with --init to confirm suggestions, or --write to accept them.");
  }
  process.stdout.write(`${lines.join("\n")}\n`);
  return result;
}

function writeProfile(project, values) {
  const profile = {
    generatedBy: "mro-doctor",
    note: "Generated by mro-doctor. Edit AGENTS.md and this file together; AGENTS.md wins for commands.",
    stack: values.stack ?? null,
    language: values.language ?? null,
    test: values.test ?? null,
    typecheck: values.typecheck ?? null,
    lint: values.lint ?? null,
    build: values.build ?? null,
    migration: values.migration ?? null,
    lockfile: values.lockfile ?? null,
    languageRules: values.languageRules ?? null,
    typecheckRunner: values.typecheckRunner ?? null,
    migrations: values.migrations ?? [],
  };
  const target = join(project, PROFILE_REL);
  const previous = readProfile(project);
  mkdirSync(join(project, ".opencode"), { recursive: true });
  writeFileSync(target, `${JSON.stringify(profile, null, 2)}\n`);
  return { target, previous };
}

function updateAgents(project, values) {
  const file = join(project, "AGENTS.md");
  const body = text(file);
  if (!body) return false;
  let next = body;
  for (const [key, labels] of Object.entries(PROFILE_LABELS)) {
    let value = values[key];
    if ((value === undefined || value === null) && ["typecheck", "lint", "migration"].includes(key)) value = "-";
    if (value === undefined || value === null) continue;
    for (const label of labels) {
      const pattern = new RegExp(`^(- ${label}: ).*$`, "m");
      next = next.replace(pattern, `$1\`${value}\``);
    }
  }
  if (next === body) return false;
  writeFileSync(file, next);
  return true;
}

async function init(project, values) {
  const entries = Object.keys(PROFILE_LABELS);
  const accepted = {};
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    for (const key of entries) {
      const suggested = values[key];
      if (suggested === undefined || suggested === null) continue;
      const answer = await rl.question(`${key} [${suggested}]: `);
      accepted[key] = answer.trim() || suggested;
    }
  } finally {
    rl.close();
  }
  const merged = { ...values, ...accepted };
  const changed = updateAgents(project, merged);
  writeProfile(project, merged);
  process.stdout.write(
    `mro-doctor: ${changed ? "updated AGENTS.md" : "AGENTS.md unchanged"}; wrote ${PROFILE_REL}\n`,
  );
}

const argv = process.argv.slice(2);
const json = argv.includes("--json");
const checkDocs = argv.includes("--docs");
const wantWrite = argv.includes("--write") || argv.includes("--yes");
const wantInit = argv.includes("--init");
const rootIndex = argv.indexOf("--root");
const project = resolve(rootIndex >= 0 ? argv[rootIndex + 1] : process.cwd());

if (!existsSync(join(project, "AGENTS.md"))) {
  process.stderr.write(`mro-doctor: no AGENTS.md in ${project}\n`);
  process.exit(2);
}

const detected = detect(project);
if (wantInit) {
  await init(project, detected);
} else if (wantWrite) {
  const changed = updateAgents(project, detected);
  writeProfile(project, detected);
  process.stdout.write(
    `mro-doctor: ${changed ? "updated AGENTS.md" : "AGENTS.md unchanged"}; wrote ${PROFILE_REL}\n`,
  );
}

const result = report(project, { json, docs: checkDocs });
process.exit(result.ok ? 0 : 1);
