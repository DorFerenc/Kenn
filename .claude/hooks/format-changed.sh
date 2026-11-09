#!/usr/bin/env bash
# PostToolUse(Edit|Write) — format and lint the one file that changed.
#
# Reads the hook payload on stdin and takes tool_input.file_path, which Claude
# Code documents as always absolute. Formats TypeScript with Prettier, then runs
# ESLint --fix. If ESLint leaves an error it cannot fix, exit 2 so the message
# goes back to Claude instead of being discovered later in CI.
set -uo pipefail

payload=$(cat)

file=$(
  printf '%s' "$payload" | node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      try {
        const j = JSON.parse(s);
        process.stdout.write((j && j.tool_input && j.tool_input.file_path) || "");
      } catch {
        process.stdout.write("");
      }
    });
  ' 2>/dev/null
)

[ -n "$file" ] || exit 0
[ -f "$file" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

case "$file" in
  *.ts|*.tsx|*.mts|*.cts)
    pnpm exec prettier --write --log-level warn "$file" >/dev/null 2>&1
    if ! out=$(pnpm exec eslint --fix "$file" 2>&1); then
      printf 'ESLint could not fix everything in %s:\n%s\n' "$file" "$out" >&2
      exit 2
    fi
    ;;
  *.json|*.md|*.yaml|*.yml|*.mjs|*.css)
    pnpm exec prettier --write --log-level warn "$file" >/dev/null 2>&1
    ;;
  *.py)
    if command -v ruff >/dev/null 2>&1; then
      ruff format "$file" >/dev/null 2>&1
      if ! out=$(ruff check --fix "$file" 2>&1); then
        printf 'Ruff could not fix everything in %s:\n%s\n' "$file" "$out" >&2
        exit 2
      fi
    fi
    ;;
esac

exit 0
