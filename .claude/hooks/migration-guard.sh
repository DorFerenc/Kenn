#!/usr/bin/env bash
# PostToolUse(Edit|Write) — a migration never ships alone.
#
# When a file under packages/db/supabase/migrations/ changes, check that the
# change also brings RLS, a pgTAP test and regenerated types. Exits 2 with the
# list of what is missing, so Claude is told now rather than by CI.
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

case "$file" in
  *packages/db/supabase/migrations/*.sql) ;;
  *) exit 0 ;;
esac

[ -f "$file" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

missing=()

# 1. A new table needs RLS and a policy with both using and with check.
if grep -Eiq 'create[[:space:]]+table' "$file"; then
  grep -Eiq 'enable[[:space:]]+row[[:space:]]+level[[:space:]]+security' "$file" \
    || missing+=("RLS is not enabled in this migration (alter table ... enable row level security)")
  grep -Eiq 'create[[:space:]]+policy' "$file" \
    || missing+=("no policy created — RLS enabled without a policy denies everything")
  if grep -Eiq 'create[[:space:]]+policy' "$file"; then
    grep -Eiq 'with[[:space:]]+check' "$file" \
      || missing+=("policy has no 'with check' — 'using' alone lets a member write into another household")
  fi
fi

# 2. A security definer function must pin search_path.
if grep -Eiq 'security[[:space:]]+definer' "$file" \
   && ! grep -Eiq 'set[[:space:]]+search_path' "$file"; then
  missing+=("security definer function without 'set search_path = public' — that is a privilege-escalation path")
fi

# 3. A new table needs a pgTAP test somewhere in the tree.
if grep -Eiq 'create[[:space:]]+table' "$file"; then
  tables=$(grep -Eio 'create[[:space:]]+table[[:space:]]+(if[[:space:]]+not[[:space:]]+exists[[:space:]]+)?[a-z0-9_."]+' "$file" \
    | awk '{print $NF}' | tr -d '"' | sed 's/^public\.//')
  for t in $tables; do
    if ! grep -rqi "$t" packages/db/supabase/tests/ 2>/dev/null; then
      missing+=("no pgTAP test mentions '$t' — add packages/db/supabase/tests/$t.sql in this same change")
    fi
  done
fi

if [ ${#missing[@]} -gt 0 ]; then
  {
    printf 'Migration checklist not met for %s:\n' "${file#"$PWD/"}"
    for m in "${missing[@]}"; do printf '  - %s\n' "$m"; done
    printf '\nSee packages/db/CLAUDE.md and the write-migration skill.\n'
    printf 'Also run: pnpm db:types (types.ts is generated) and pnpm db:test.\n'
  } >&2
  exit 2
fi

printf 'Migration looks structurally complete. Still run: pnpm db:types && pnpm db:test\n' >&2
exit 0
