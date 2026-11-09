# .claude — Kenn's AI build system

Versioned and reviewed like code. Nothing here changes except through a PR the
user approves; see the `retro` and `consolidate` skills.

| Path                  | What it is                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `settings.json`       | Hooks and permission guardrails. Committed.                                                                                                |
| `settings.local.json` | Personal overrides. Git-ignored, never committed.                                                                                          |
| `agents/`             | `planner`, `reviewer`, `security-reviewer`, `doc-keeper`, `kb-curator`                                                                     |
| `skills/`             | `/plan-feature`, `/implement-step`, `/review-code`, `/prune`, `/write-migration`, `/add-kb-item`, `/update-docs`, `/retro`, `/consolidate` |
| `hooks/`              | Shell hooks invoked by `settings.json`                                                                                                     |

## Hooks

| Hook                       | Event                      | Does                                                                                                                                                                                                                                                            |
| -------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format-changed.sh`        | `PostToolUse(Edit\|Write)` | Prettier, then `eslint --fix`, on the one file that changed. Exits 2 with the message when ESLint leaves an error it cannot fix, so it is raised now rather than in CI. Also formats Python with ruff when it is installed.                                     |
| `migration-guard.sh`       | `PostToolUse(Edit\|Write)` | On a file under `packages/db/supabase/migrations/`: checks that a new table enables RLS, has a policy with `with check`, that a `security definer` function pins `search_path`, and that a pgTAP test mentions each new table. Exits 2 listing what is missing. |
| `after-bash.sh`            | `PostToolUse(Bash)`        | Covers files written by shell redirection, which the Edit/Write hooks never see. Formats whatever changed and re-runs the migration guard on any touched migration. Exits immediately when no source file changed.                                              |
| `require-learning-file.sh` | `Stop`                     | Blocks ending a session that changed code when `docs/learnings/` has no file for today. Honours `stop_hook_active`, so it cannot loop.                                                                                                                          |

## Guardrails are not a security boundary

The `deny` rules stop accidents. Claude Code's own documentation is explicit that
a `Bash` deny rule covers the invocation normally produced and is not a boundary
around the program: `Bash(git push --force *)` does not stop
`git -C . push --force`, and a `Read` deny rule does not stop `grep -r` or a
script that opens the file itself.

The real controls are row-level security, scoped and expiring tokens, MFA, and
secrets that never leave Vercel, Supabase and GitHub. See `docs/plan.md`,
section "Security".

## Changing any of this

A rule is added only after the same mistake has happened twice, and only where a
lint rule, a test or a hook cannot do the job instead. Changes land in their own
`chore(ai):` commit for the user to accept or reject — self-editing instructions
without review drift fast, and can be poisoned by content the AI read.

Budgets: root `CLAUDE.md` under 200 lines, each `SKILL.md` under 500.
`/consolidate` enforces them monthly.

## Git hooks are separate from these

`.githooks/pre-commit` is a **git** hook, not a Claude Code hook, installed by
`pnpm install` via the `prepare` script. It refuses a commit when `pnpm check` is
red, or when the gate regenerated files that are not staged. It exists because a
commit once landed red and had to be amended, and remembering to run the gate is
exactly what a tool should do instead of a person.
