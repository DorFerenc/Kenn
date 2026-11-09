# Decision log

One entry per session, **newest first**. Each session ends with three lists:
decided, open, next. A decision with a real trade-off also gets an ADR in
[`docs/adr/`](adr/); this file is the short form and links to it.

Entries dated before 2026-11-07 were migrated from the decision log in the
planning document's "Plan" tab. That table continues in
[`plan.md`](plan.md#decision-log) as a historical record; **this file is the live
log from step 0 onward.**

---

## 2026-11-09 · fixes, privacy and the README

Everything the steps 1/3/4 retro recorded as wrong is now fixed, and each fix is
a tool rather than a sentence. Learning file:
[`learnings/2026-11-09-fixes-and-privacy.md`](learnings/2026-11-09-fixes-and-privacy.md).

### Decided

- **A commit cannot land red.** `.githooks/pre-commit` runs `pnpm check` and
  refuses the commit when it fails, or when the gate regenerated files that are
  not staged. Installed by `pnpm install` via `prepare`; `SKIP_CHECK=1` bypasses
  it for a deliberate work-in-progress commit.
- **Shell redirection no longer dodges the hooks.** A `PostToolUse(Bash)` hook
  formats whatever changed and re-runs `migration-guard.sh` on any touched
  migration. Both migrations last session were written with a heredoc and the
  guard never ran on either — a hook covering only some ways of writing a file
  is worse than none, because it is believed.
- **`pnpm check:twice` is in CI.** It runs the gate twice and compares a
  `git hash-object` of every tracked file. Hashes rather than
  `git diff --exit-code`, so it works with uncommitted work in progress.
- **No private data in the repository — hard rule 11.** Two real first names
  appeared in 7 files (sequence-diagram actors, prose, a pgTAP fixture email,
  and a hardcoded `owner/repo`). All replaced with roles; the branch-protection
  script now derives the repository from the git remote; the planning byline is
  gone. No secrets, key material or `.env` files were found.
- **The privacy guard carries no denylist of names**, because a denylist would
  commit the names it exists to exclude. `scripts/check-private.mjs` checks key
  material by shape, email addresses outside the reserved `.test` fixture
  domains, and **whoever is configured in this clone's git identity, read at
  runtime**. Verified by planting a JWT, a real-looking address and the
  configured name. Runs in CI.
- **The README now explains how to run the project**: prerequisites with
  versions, first run, the database commands, every script, the watcher, the four
  structural rules, how to contribute, and the privacy posture.

### Open

- **`core.hooksPath` is only set when `pnpm install` has work to do.** An
  existing clone needs `pnpm hooks:install` once. A fresh clone is fine.
- **Branch protection still is not applied.** `./scripts/setup-branch-protection.sh`
  must run from a machine that is not a cloud session; its required-check list
  now includes `Migrations and RLS`.
- Everything else from the entry below, unchanged: **steps 5 and 6 cannot be
  completed** without the Supabase, Vercel and Anthropic accounts; steps 7 and 8b
  need `me.health.gov.il`, `btl.gov.il` and `kolzchut.org.il` on the environment
  allowlist; the current week and EDD; the second parent's role.

### Next

**Step 2** — i18n skeleton and design tokens. It needs nothing external, which
makes it the only Release 1 step that can start immediately.

---

## 2026-11-09 · steps 1, 3 and 4

Asked for steps 1–8, all of Release 1, in one session. Delivered steps 3 and 4
complete and step 1's schema half, which is the plan's own documented fallback
cut. Learning file:
[`learnings/2026-11-09-steps-1-3-4.md`](learnings/2026-11-09-steps-1-3-4.md).

88 tests green: 30 pgTAP assertions against a real Postgres, 59 engine tests
under `TZ=America/Los_Angeles`, plus the schema and generator tests.

### Decided

- **The RLS pattern is established and tested.** `is_member()` is
  `security definer` with a pinned `search_path`, without which the policy on
  `member` recurses through itself. Every later household table copies this.
- **Two bootstrap holes are closed by functions, not by widening a policy.**
  `create_household()` exists because `with check (is_member(id))` makes the
  first insert impossible; `accept_invite()` exists because the invitee is not
  yet a member and cannot see the row. Both are `security definer`, and
  `accept_invite` checks expiry, revocation and reuse **in the database**, so an
  app bug cannot widen the window. Only the SHA-256 hash of an invite token is
  stored.
- **CI runs the pgTAP tests** in a third job, and fails if `types.ts` differs
  from a fresh `pnpm db:types`. Without that job the rule "a new household table
  without its test fails CI" was unenforced. Added to the required checks.
- **The KB schema enforces the rules rather than documenting them.** A
  discriminated union on `kind` with five refinements, including the ADR-0005
  safety veto: `necessity: unsafe` needs a named authority from a closed enum
  **and** a source, so `safety_authority: 'a-facebook-group'` is rejected by the
  type. 20 tests assert the rejections, not just the acceptances.
- **21 pregnancy items**, every critical window from the research blueprint: NT
  at 77–97 days, late anatomy at 133–181, glucose at 168–202, Tdap at 189–258,
  GBS at 252–265. MoH pages cited directly where the MoH is the authority.
- **One item ships as a draft on purpose.** `preg.rsv-maternal-vaccine` carries a
  US window while Israeli policy differs, so it is `status: draft`, does not
  publish and generates no task. Drafting was the honest option.
- **The engine has no clock and no `Date` with a time.** `today` is a parameter;
  all arithmetic is ISO strings through `Date.UTC`. CI runs the suite under US
  Pacific. `date-fns` was declared then removed — a general date library makes
  reaching for a timed `Date` easy, which is the one bug this package cannot
  afford, and the stack table now says so.
- **Dating precedence:** an ultrasound-corrected EDD beats a remembered LMP; an
  IVF transfer beats both.
- **An `applies_if` condition the profile cannot answer does not match.** Showing
  an anti-D item to someone whose Rh is unknown trains them to ignore the list.
- **A draft KB item never becomes a task.**
- **The ER diagram and the KB catalogue are generated** and verified by
  `pnpm docs:gen`, which is in `check` and in CI. Both were written because the
  gate _refused to pass_ once their sources had content — the step 0 investment
  paying off on step 1 work.

### Open

- **Steps 5 and 6 cannot be completed at all** until the Supabase (Frankfurt),
  Vercel and Anthropic accounts exist. Production deploy, realtime sync, Web Push
  and pg_cron have nothing to run against. **This is the single blocker on the
  rest of Release 1.**
- **Step 1 stays unticked** for the same reason: the hosted project, Google OAuth
  and real MFA enrolment need the account, and `deploy.yml` needs Vercel.
- **Steps 7 and 8b need three hosts on the environment allowlist**:
  `me.health.gov.il`, `btl.gov.il`, `kolzchut.org.il`. Safety-centre and
  catalogue content cannot cite pages it cannot read.
- **Step 2 needs nothing external** and is the natural next session.
- **A Bash heredoc bypasses the `PostToolUse` hooks**, so both migrations this
  session were written without `migration-guard.sh` ever running. A hook that
  covers only some ways of writing a file gives false confidence; needs a
  `PostToolUse(Bash)` hook or a pre-commit check.
- **`check` should run twice in CI.** A generator that is not idempotent passes
  once and fails next time; that happened here and only a second local run caught
  it.
- Unchanged: the current week and EDD; the second parent's role; the branch-protection
  script still needs running from a machine that is not a cloud session.

### Next

**Step 2** — i18n skeleton (Hebrew and English, RTL and LTR, gender forms) and
the design-system tokens. Then Release 1 resumes at step 5 once the accounts
exist.

---

## 2026-11-09 · Things re-scoped, and the repo gated

Product change plus repo governance. Still no application code.

### Decided

- **Things is recommendation-first, not CSV-first.** A family gets a curated
  catalogue filtered to their profile and ticks what they want. CSV import is a
  convenience for people who already keep a spreadsheet. Design:
  [`plans/recommended-lists.md`](plans/recommended-lists.md).
- **The catalogue is KB content** (`kind: thing`, under
  `packages/kb/content/things/`): versioned in git, both locales, sources
  required, `review_by` required, changed only by a merged PR. A recommendation
  to buy something is guidance.
  [ADR-0005](adr/0005-recommendation-catalogue-in-kb-with-safety-veto.md)
- **Safety vetoes popularity — now hard rule 11 in `CLAUDE.md`.** Four real
  family lists were used as the seed corpus. Between them they mark a cot bumper
  (`נחשוש`) as **mandatory**, a head guard (`מגן ראש`) as medium priority, and a
  side-sleeping positioning pillow as available at a grandparent's. The MoH's
  room-preparation page directs that the cot hold a fitted sheet and a blanket
  only — no pillows, toys, dolls, `נחשוש`, `מגן ראש` or `מגן מיטה` — and the AAP
  has advised against positioners since 2011, with the US banning bumpers and
  inclined sleepers outright in 2022. **A catalogue merged by popularity would
  recommend a cot bumper as mandatory.** So `necessity: unsafe` requires a named
  authority and a source, a zod refinement fails CI without one, and no
  popularity signal can raise it.
- **Community lists are provenance, never sources.** A family spreadsheet or a
  forum list goes in `lists` with the tier it assigned; only an authority goes in
  `sources`. This is what stops a spreadsheet becoming a citation.
- **Necessity is three axes**, because one field loses the answer: how necessary,
  when it is needed, and how it is acquired. The real lists are full of "comes in
  the birth package", "we got it as a gift" and "take from mum".
- **Decision hints** reuse the existing `applies_if` mechanism: baby room, home
  size and floor and lift, budget, season at birth (derived from the EDD, never
  asked), car, feeding intent, family who can lend, firstborn, customs.
- **Live updates: three source classes.**
  [ADR-0006](adr/0006-source-policy-for-live-recommendation-updates.md).
  **A, authoritative** (MoH, Beterem, recalls, CPSC, EU Safety Gate, Bituach
  Leumi) — watched weekly, may set a safety verdict. **B, editorial** (parenting
  portals, health-fund guides) — watched weekly, may only propose. **C, retailers
  and parent forums — read by a human, never scraped**, for three reasons:
  retailer terms and `robots.txt` forbid it, a weekly diff against a shop is
  almost all price churn that would bury the Class A changes, and forum content
  is anecdotal and demonstrably recommends unsafe products. **This narrows the
  original ask**, which named baby shops and mother forums as live sources.
- **Step 8 splits into 8a** (mechanism: schema, profile hints, filtering, picker,
  budget) **and 8b** (content: seed the catalogue, safety overrides first, then
  the importer and the registry). Numbered 8a/8b so steps 9–17 keep their
  numbers.
- **`main` is gated.** A GitHub ruleset requires a PR and both CI jobs, blocks
  force pushes and deletion, and requires thread resolution — with **zero
  required approvals for now**, so a PR can be merged by whoever opened it once
  CI is green. Configured by `scripts/setup-branch-protection.sh`, in git rather
  than remembered from a settings page; `--approvals 1` flips it when code review
  starts. Plus `.github/pull_request_template.md` with conditional checklists and
  `.github/dependabot.yml`, which ignores major TypeScript upgrades per ADR-0002.

### Open

- **Three repository settings a script cannot reach**, worth turning on: secret
  scanning with push protection, Dependabot alerts, auto-delete head branches.
- **`scripts/setup-branch-protection.sh` has not been run — it cannot be, from
  here.** It was tried: a Claude Code cloud session reaches GitHub through a
  proxy that permits content reads and writes but refuses the administration API,
  so a ruleset cannot be created from inside one even with an admin token
  (`HTTP 403: Write access to this GitHub API path is not permitted through this
proxy`). The script now detects that and prints what to do. **Run it once from
  your own machine**, or set the same rules by hand in Settings → Rules →
  Rulesets. Until then `main` is unprotected.
- **Which editorial sources are Class B**, by name, with their URLs. Needed
  before step 13, not before 8a.
- **The birth-grant wording.** Israel's `מענק לידה` is money (₪2,103 for a first
  child from 01.01.2026), not a box of goods; the "birth package" the lists refer
  to is a commercial or health-fund starter kit whose contents vary. What the
  catalogue says about `how_acquired: starter_kit` needs a source before it ships.
- The two `inventory_item` gaps from the follow-up entry below: a sourcing note,
  and a required flag separate from `status`. ADR-0005 settles the second as part
  of `necessity`; the first is still open.
- Unchanged: the current week and EDD, and the Supabase, Vercel and Anthropic
  accounts, still block step 1. the second parent's role.

### Next

**Step 1**, unchanged. Things 8a/8b remain in Release 1 after it.

---

## 2026-11-09 · step 0 follow-up

Two items that step 0 left open are now closed. No code changed.

### Decided

- **`main` is the default branch.** CI's `push: branches: [main]` trigger and
  future PR bases now point at the right place.
- **The shopping-list CSV is usable.** The re-export is UTF-8 with BOM, 61 items
  in 9 consistent columns, Hebrew intact (2,113 Hebrew characters, and the only
  5 remaining `?` are the two header names `חובה?` and `נקנה?` plus three inside
  URLs). **Step 8 is unblocked.**
- **The file stays out of the repository.** It is household data, and
  `docs/architecture.md` puts household data in Postgres behind RLS, not in git —
  `seed.sql` is fake-household-only for exactly this reason, since it loads into
  every preview environment. Its _structure_ is recorded in
  [`plans/things-csv-import.md`](plans/things-csv-import.md) so step 8 can build
  the importer without the data: the column contract, the value vocabularies, the
  tracking parameters to strip and the one (`variant`) that must be kept, the
  check that refuses a destroyed export, and the test fixtures to carry.

### Open

- **Two gaps in the `inventory_item` model**, found in the real list and needing a
  decision before step 8: a **sourcing note** ("where to look" — 4 rows use the
  link column for this, not for a URL), and a **required flag** separate from
  `status`, because `חובה?` and `נקנה?` are independent axes and collapsing them
  makes "optional, not bought" indistinguishable from "mandatory, not bought".
- Everything else from the step 0 entry below, unchanged. The current week and
  EDD, and the Supabase, Vercel and Anthropic accounts, still block step 1.

### Next

Unchanged: **step 1**. PR #1 is open, green and awaiting review.

---

## 2026-11-07 · step 0 · bootstrap

Learning file: [`learnings/2026-11-07-step-0-bootstrap.md`](learnings/2026-11-07-step-0-bootstrap.md)

### Decided

- **Scaffold exists and CI is green on it.** pnpm workspace with `apps/web`
  (placeholder), `packages/engine`, `kb`, `db`, `ui`, and `services/watcher`.
  `pnpm check` runs lint, typecheck, format, Vitest, `kb:validate`, `docs:gen` and
  knip; ruff and pytest cover the watcher. Verified on Node 24, the version CI
  uses.
- **TypeScript 6.0.3, not the latest 7.0.2** — TypeScript 7 ships no compiler API,
  so `typescript-eslint` cannot load it and "latest" would mean no linter at all.
  The project rule is now "the latest version the type and lint toolchain
  supports". [ADR-0002](adr/0002-pin-typescript-6-for-lint-support.md)
- **Supabase CLI v3, with its conventions written down now** — local by default,
  `--remote` for hosted, `--yes` for unattended, `[local_smtp]` not `[inbucket]`,
  `pg-delta` as the diff engine. The new defaults make it impossible for a build
  session to push to production by accident.
  [ADR-0003](adr/0003-supabase-cli-v3-conventions.md)
- **Next.js over SvelteKit**, settled rather than left open. The deciding factor is
  the MCP route sharing the app's auth and service layer, then Radix for RTL.
  [ADR-0004](adr/0004-nextjs-over-sveltekit.md)
- **ADRs are the only route by which a hard rule changes** — never a `/retro`.
  [ADR-0001](adr/0001-record-architecture-decisions.md)
- **`apps/web` declares its real dependencies** so the lockfile proves the whole
  version matrix resolves together from the first commit. The not-yet-imported
  ones are listed in `knip.json` and come off as each step uses them.
- **Supply-chain settings are explicit, not inherited**: `minimumReleaseAge: 1440`
  (nothing published in the last 24 hours is installable — this is why knip is
  pinned at 6.44.1, not 6.44.2), `allowBuilds` denying all three install-time
  build scripts, and GitHub Actions pinned by commit SHA.
- **`pnpm docs:gen` is a real gate, not a placeholder.** It verifies all 14
  diagram embeddings match their `.mmd` source byte for byte, and fails if a
  generator's source gains content while the generator is still unwritten.
- **`docs/plan.md` and `docs/architecture.md` are now the source of truth**; the
  planning document is a historical record. Corrections made at step 0 are listed
  in `architecture.md` → "Changes from the planning document".
- **Three workflows deliberately deferred.** `docs-drift.yml` (step 1),
  `deploy.yml` (step 1) and `watcher.yml` (step 13) each need something that does
  not exist yet; a workflow that can only pass vacuously reads as a gate it is
  not.
- **Guardrails are documented as guardrails.** The `deny` rules in
  `.claude/settings.json` stop accidents, not attackers — Claude Code's own docs
  are explicit that a `Bash` deny rule is not a boundary around the program. Said
  plainly in `CLAUDE.md` and `.claude/README.md` so nobody mistakes them for
  protection.

### Open

- **The current week and the ultrasound-corrected EDD.** This dates every window
  and decides how much of steps 1–6 fits before the next test. **Blocks step 1.**
  Put the next test window in a shared note today regardless — the app is not on
  the critical path.
- **Supabase account** (Frankfurt region), Vercel, and the Anthropic Console with
  a monthly spend cap. **Blocks step 1.**
- **Which OAuth 2.1 authorization server for MCP.** The plan's fallback — "your
  auth provider's, if it supports MCP clients" — probably does not apply:
  Supabase Auth is an identity provider for Kenn's own users, not an authorization
  server with dynamic client registration, which the MCP authorization spec
  requires. Do not hand-write it. **Needed by step 9.**
- **Serwist on Next.js 16.** Serwist integrates through a webpack plugin and
  Next.js 16 fails the build on a custom webpack config. `@serwist/next@9.5.13`
  claims `next >=14` but that is untested here. **Risk on step 6**; fallback is a
  hand-written service worker for the offline emergency card.
- **the second parent's role**: co-builder, or content and UX review?
- Unchanged from before: store medical documents at all; whether to open it to
  other families; monthly budget ceiling; the name checks (trademark, stores,
  domain); the first five test families; which pediatrician and midwife review the
  KB; Israel-only or country packs from day one.

### Next

**Step 1** — Supabase project, auth with MFA, `household` + `member`, RLS and the
first pgTAP test; plus `deploy.yml` and `docs-drift.yml`, which need a schema to
be meaningful.

The `reviewer` and `security-reviewer` agents were written this session but never
run — there was no application code to review. Step 1 is their first real
exercise, and that run tests the agent definitions as much as the code.

---

## 2026-11-06 · planning review

**Decided:** Step 0 bootstrap added before step 1; the build order became the
roadmap with gates A–C; KB items carry `locales` and `applies_if`; `invite` and
`push_subscription` tables added; use a maintained OAuth server for MCP, never
hand-written; a session prompt template for every build session.

**Open:** as below.

**Next:** the Week 0 checklist, then step 0 in a new chat.

---

## 2026-11-06 · initial plan

**Decided:** the name Kenn. Next.js + Supabase, TypeScript monorepo, Python
watcher. KB in git, human-approved. No end-to-end encryption in v1. Hebrew and
English at launch. The safety centre as fixed, reviewed content. AI instructions,
agents and skills live in the repo and improve only through approved retros.

**Open:** current week and EDD; Next.js vs SvelteKit; the second parent's role; trademark
check.

**Next:** step 1 — scaffold the repo, auth and RLS.
