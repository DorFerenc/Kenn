# 2026-11-07 · step 0 · bootstrap

**Goal:** monorepo skeleton, root and per-package `CLAUDE.md`, `.claude/` agents,
skills, hooks and settings, `docs/` mirror, CI green on the empty skeleton. No app
code.

**Outcome:** done. `pnpm check` green on Node 24 (lint, typecheck, format, Vitest,
`kb:validate`, `docs:gen`, knip); ruff and pytest green on the watcher. 5 agents,
8 skills and 3 hooks written and individually exercised. 4 ADRs.

## Decisions

- TypeScript pinned to 6.0.3, not the latest 7.0.2 (ADR-0002)
- Supabase CLI v3 and its local-by-default conventions adopted now (ADR-0003)
- Next.js over SvelteKit, settled rather than deferred (ADR-0004)
- ADRs as the mechanism; hard rules change only through one (ADR-0001)
- `apps/web` declares its real dependencies so the lockfile proves the version
  matrix resolves; `knip.json` carries the not-yet-imported ones, to be removed
  step by step

## What went wrong

**1. The project's own version rule was wrong, and would have broken the build
system on day one.** "Pin the latest stable version of each tool" + latest
TypeScript (7.0.2) = no ESLint at all, because TypeScript 7 ships no compiler API
and `typescript-eslint@8.72.1` declares `typescript: ">=4.8.4 <6.1.0"`. Found by
reading `peerDependencies` from the registry, not by assuming the ecosystem had
kept up. **Fix:** rule amended to "the latest version the type and lint toolchain
supports"; ADR-0002.

**2. Guessed pnpm 12's config key twice and was wrong twice.** Tried
`onlyBuiltDependencies`, then `ignoredBuiltDependencies` — both silently ignored,
install kept failing with `ERR_PNPM_IGNORED_BUILDS`. pnpm 12 is a Rust binary and
the key is `allowBuilds`, a map of package → boolean. Running
`pnpm approve-builds '!pkg' -y` made the tool write its own config, which answered
the question in one command. **Fix:** when a tool rejects a config it also knows
how to write, let it write it instead of guessing the key name.

**3. Over-configured knip before seeing what it does unaided.** The first
`ignoreDependencies` list named `next`, `react` and `react-dom`; knip's own
framework plugins already resolve those and it reported each entry as redundant.
Also listed `ignoreBinaries: ["supabase"]`, also unnecessary. **Fix:** start with
the minimum config and let the tool's own output drive what gets added.

**4. `types: ["node"]` is not implied by a Node script.** `packages/kb`'s
validator failed typecheck with eleven errors (`node:fs`, `console`, `process`,
`import.meta`) until `@types/node` was added to that package and `types: ["node"]`
to its tsconfig. Obvious in hindsight; cost a cycle.

**5. Validated on the wrong runtime, nearly.** The container runs Node 22.23.4
while the project targets Node 24 LTS, and `.npmrc` has `engine-strict=true`.
Rather than relax the engine or claim green on 22, downloaded Node 24.22.2 and ran
everything on it. A "green" from the wrong runtime would have been worthless.

**6. Two different network paths to the same host.** `supabase.com` was outside
the environment's allowlist. After allowing it, WebFetch still failed with
`ENOTFOUND` while `curl` through the agent proxy returned 200. The fetch tool and
the shell do not share a resolver, so a blocked-looking host is worth one check
from the other path before giving up.

**7. The mermaid diagrams exist twice** — as `docs/diagrams/*.mmd` (what the plan
says is the source) and as fenced blocks in the documents (what GitHub renders).
Rather than pick one and lose something, `pnpm docs:gen` now compares them byte
for byte and fails on divergence. 14 embeddings checked, and the check was
verified by tampering with a file and confirming exit 1.

## Not done, and why

- **The `reviewer` agent was never run.** There was no application code to review,
  and the session's closing instructions did not include it. It and
  `security-reviewer` are therefore **unexercised definitions** — their first real
  run is step 1, and that run should be treated as a test of the agent as much as
  of the code.
- **The shopping-list CSV is still unusable.** The re-exported file is ASCII with
  2,148 literal `?` bytes and zero Hebrew characters, so no decoding recovers it
  (`cp1255` and `iso-8859-8` both produce nothing). Only 8 of 62 rows retain any
  Latin or numeric data. It needs a genuine Google Sheets → CSV download. Blocks
  step 8 only.
- **`docs-drift.yml`, `deploy.yml`, `watcher.yml`** deliberately not written: each
  needs something that does not exist yet, and a vacuously passing workflow reads
  as a gate it is not.

## Rule candidates

Per the promotion rules, a lesson becomes a rule only on its **second**
occurrence. All four below are first occurrences and stay here:

| Candidate                                                                   | Automatable?                              | Status                        |
| --------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------- |
| "Let a tool write its own config rather than guessing key names"            | no                                        | first occurrence — stays here |
| "Start tool configs minimal; let their output drive additions"              | no                                        | first occurrence — stays here |
| "Validate on the runtime CI uses, not the one that happens to be installed" | partly — `engine-strict=true` already set | first occurrence — stays here |
| "A host that looks network-blocked: try the other fetch path once"          | no                                        | first occurrence — stays here |

The TypeScript lesson is **not** a retro promotion — it became a hard rule through
ADR-0002, which is the only route by which hard rules may change.

## Skill changes proposed

None. The skills were written this session and have not been exercised enough to
know what they are missing. The first honest input will be step 1.

## Next

**Step 1** — Supabase project, auth with MFA, `household` + `member`, RLS and the
first pgTAP test, plus `deploy.yml` and `docs-drift.yml`.

Blocked on the Week 0 checklist: the Supabase account (Frankfurt region) and the
current week and ultrasound-corrected EDD, which date every window.
