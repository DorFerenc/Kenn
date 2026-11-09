#!/usr/bin/env bash
#
# PostToolUse(Bash) — cover files written by shell redirection.
#
# The Edit/Write hooks never see a file created with `cat > file <<EOF`, so two
# migrations were once written without migration-guard.sh running at all. A hook
# that covers only some ways of writing a file gives false confidence.
#
# Cheap by design: one `git status` call, and it exits immediately when no
# source file changed, which is the common case.
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

changed=$(git status --porcelain -- \
  '*.ts' '*.tsx' '*.mjs' '*.sql' '*.py' '*.json' '*.yaml' '*.yml' '*.md' 2>/dev/null \
  | sed 's/^...//' | sed 's/^.* -> //')
[ -n "$changed" ] || exit 0

problems=()

for f in $changed; do
  [ -f "$f" ] || continue
  case "$f" in
    *.ts|*.tsx)
      pnpm exec prettier --write --log-level warn "$f" >/dev/null 2>&1
      if ! out=$(pnpm exec eslint --fix "$f" 2>&1); then
        problems+=("$out")
      fi
      ;;
    *.mjs|*.json|*.yaml|*.yml|*.md)
      pnpm exec prettier --write --log-level warn "$f" >/dev/null 2>&1
      ;;
    *.py)
      if command -v ruff >/dev/null 2>&1; then
        ruff format "$f" >/dev/null 2>&1
        out=$(ruff check --fix "$f" 2>&1) || problems+=("$out")
      fi
      ;;
  esac

  # A migration written by any means still answers to the migration checklist.
  case "$f" in
    *packages/db/supabase/migrations/*.sql)
      payload=$(printf '{"tool_input":{"file_path":"%s/%s"}}' "$PWD" "$f")
      if ! out=$(printf '%s' "$payload" | "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/migration-guard.sh" 2>&1); then
        problems+=("$out")
      fi
      ;;
  esac
done

if [ ${#problems[@]} -gt 0 ]; then
  printf 'Files written by shell redirection still need fixing:\n' >&2
  for p in "${problems[@]}"; do printf '%s\n' "$p" >&2; done
  exit 2
fi
exit 0
