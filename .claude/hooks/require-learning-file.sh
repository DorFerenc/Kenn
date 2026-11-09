#!/usr/bin/env bash
# Stop — do not end a session that changed code without writing the retro.
#
# The self-improving loop in docs/architecture.md only works if every session
# ends written down, and that is the step easiest to skip. Honours
# stop_hook_active so it cannot loop; Claude Code also caps consecutive
# stop-hook continuations at eight.
set -uo pipefail

payload=$(cat)

active=$(
  printf '%s' "$payload" | node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      try {
        const j = JSON.parse(s);
        process.stdout.write(j && j.stop_hook_active ? "1" : "");
      } catch {
        process.stdout.write("");
      }
    });
  ' 2>/dev/null
)

# Already continuing because of this hook: let the session end.
[ -n "$active" ] && exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

today=$(date +%F)

code_globs=( '*.ts' '*.tsx' '*.sql' '*.py' '*.mjs' '*.json' '*.yaml' '*.yml' )

dirty=$(git status --porcelain -- "${code_globs[@]}" 2>/dev/null | head -1)
committed=$(
  git log --since="${today} 00:00" --name-only --pretty=format: -- "${code_globs[@]}" 2>/dev/null \
    | grep -v '^$' | head -1
)

# Nothing changed today: a question-only session needs no learning file.
if [ -z "$dirty" ] && [ -z "$committed" ]; then
  exit 0
fi

if ls docs/learnings/ 2>/dev/null | grep -q "^${today}"; then
  exit 0
fi

reason=$(
  printf '%s' \
    "Code changed in this session but docs/learnings/ has no file dated ${today}. " \
    "The self-improving loop depends on every session ending written down. " \
    "Run /retro to write docs/learnings/${today}-step-<n>-<topic>.md, then conclude " \
    "with decided / open / next in docs/decisions.md."
)

node -e '
  process.stdout.write(
    JSON.stringify({ decision: "block", reason: process.argv[1] })
  );
' "$reason"

exit 0
