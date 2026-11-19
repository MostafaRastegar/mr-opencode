// Appends a fix-required reminder to any failing check run (tests, typecheck,
// lint). V2: ctx.tool.hook("execute.after"); a non-zero shell exit is status
// "completed" with result.output.exitCode set, not status "error".

const CHECK_COMMAND =
  /(^|[;&|]\s*)((npx|bunx|pnpm\s+exec|yarn\s+exec|poetry\s+run|uv\s+run|timeout\s+\S+)\s+)?(npm\s+(run\s+)?(test|typecheck|lint)|pnpm\s+(test|typecheck|lint)|yarn\s+(test|typecheck|lint)|bun\s+(test|run\s+(typecheck|lint))|pytest|python3?\s+-m\s+(pytest|unittest)|go\s+(test|vet)|cargo\s+(test|check|clippy)|mvn\s+test|gradlew?\s+test|dotnet\s+test|jest|vitest|phpunit|rspec|mix\s+test|make\s+(test|check)|tsc|eslint|pyright|mypy|ruff\s+check|golangci-lint)(\s|$)/

const exitCodeOf = (event) => {
  const value = event.result?.output?.exitCode ?? event.result?.metadata?.exit
  return typeof value === "number" ? value : undefined
}

export default {
  id: "mro-test-feedback",
  async setup(ctx) {
    await ctx.tool.hook("execute.after", (event) => {
      if (event.tool !== "shell") return
      if (event.status !== "completed") return

      const command = String(event.input?.command ?? "")
      if (!CHECK_COMMAND.test(command)) return

      const exit = exitCodeOf(event)
      if (exit === undefined || exit === 0) return

      event.result.content.push({
        type: "text",
        text:
          `[CHECK FEEDBACK] The check command exited with code ${exit}. ` +
          "Per the Handoff Protocol in AGENTS.md, fix every failure before reporting completion. " +
          "Do not weaken, skip, or delete tests, and do not silence the checker with `any`, " +
          "an ignore comment, or a disabled rule.",
      })
    })
  },
}
