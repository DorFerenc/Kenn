# 2026-11-09 · step 2 · i18n skeleton and design tokens

**Goal:** roadmap step 2 — Hebrew and English with RTL and LTR and Hebrew gender
forms, the design-system tokens, and the i18n coverage generator wired into
`pnpm docs:gen`. Plus, asked in the same session: consolidate the documentation,
make the project easier to start, prove nothing private is in the repository,
and add a skill that challenges redundant code.

**Outcome:** done. 88 tests → 206, `pnpm check:twice` stable across 156 files,
and `apps/web` renders for the first time.

## The gates earned their keep again, and in a new way

Step 0 wrote `docs:gen` so that an un-wired generator **fails** once its source
gains content. The first non-empty `messages/he.json` therefore turned the gate
red and the generator had to be written rather than deferred. That is the third
step in a row where a step-0 gate forced work that would otherwise have slipped,
and it is worth noticing that the mechanism is always the same: _make the
absence of a thing fail, not warn_.

knip did the same at a smaller scale. Taking four dependencies off
`ignoreDependencies` immediately surfaced four exports nothing imported —
`redirect`, `usePathname`, `useRouter` and `getPathname`, re-exported out of
habit because every next-intl example re-exports them. Deleted rather than
ignored.

## Three things that can only be learned by running the thing

All three built cleanly and failed later, which is the expensive kind.

1. **`useTranslations` cannot be called in an async component**, and every page
   is async now that Next.js 16 made `params` a promise. The build compiled and
   then failed during prerender. Pages use `getTranslations`.
2. **`NextIntlClientProvider` is not optional**, even with no `'use client'`
   file in the app. next-intl's own `<Link>` is a Client Component that reads
   the locale from context. Leaving the provider out — which I did deliberately,
   reasoning that an unused provider is dead code — built cleanly and 500'd at
   render with "No intl context found". **The reasoning was sound and the
   conclusion was wrong, because "nothing in the app is a Client Component" was
   false the moment a library component was used.** A dependency's internals are
   part of the app.
3. **`next dev` writes an `AGENTS.md` into the app** and re-creates it when
   deleted. A tool that writes AI instructions into a repository whose AI
   instructions are the reviewed, committed artefact is a small supply-chain
   problem, not a convenience. `agentRules: false`.

## The privacy guard was green because it was looking for no one

The most useful finding of the session, and it came from asking the dull
question "does this actually run here?".

`check:private` catches an author's own name by reading the git identity
configured in the clone. It was verified last session by planting the configured
name and watching it fail. But in a Claude Code cloud session the configured
identity is `Claude <noreply@anthropic.com>`, which the guard correctly ignores
as a bot — so the check did nothing at all **in the environment where most of
the writing now happens**. It reported "nothing private found" every time, which
was true and meaningless.

Identities now come from `git log` as well, so the guard works in any clone with
history, including CI. Verified by planting the repository owner's real name and
GitHub handle and watching both fail. Four patterns were added from the
project's own minimisation rule: Israeli mobile numbers, Israeli IBANs, a
filesystem path naming a user, and a hosted Supabase project reference.

**The lesson generalises past this guard: a check must be verified in the
environment it runs in, not only in the one it was written in.** A test that
passes because its subject is absent looks exactly like a test that passes.

## Documentation had started to contradict itself

3,800 lines for a project with no screens. The problem was not length, it was
that several facts had two homes and the second copy had rotted:

- `docs/plan.md` carried a second roadmap, and an "Open decisions" list still
  asking "Next.js or SvelteKit?" — settled by ADR-0004 three sessions earlier.
- Its decision log's newest row still called the shopping-list CSV
  unrecoverable, which a later entry had already corrected.
- `docs/architecture.md` listed the hooks a second time, claiming the migration
  hook regenerates types (it does not) and not knowing `after-bash.sh` exists —
  a hook added last session precisely because hook coverage had been believed
  and was wrong.

Each was replaced by a pointer to the one real home. **A second copy of a fact
is not redundancy, it is a future contradiction**, and the ones that rot are
exactly the ones nobody reads — which is why nobody notices.

## Design decisions worth keeping

- **Hex, not oklch.** Hex lets the contrast gate be thirty auditable lines
  instead of a colour-space conversion that is itself a correctness risk. A
  gate simpler than the thing it guards is a gate you trust.
- **Semantic tokens alias base colours and never add one.** The task window's
  three states _are_ neutral/success/danger; an evidence badge _is_ one of the
  text colours. Four more literals would be four more things to keep accessible,
  and the contrast test proved the aliases resolve by failing through them.
- **The 8-pt grid is arithmetic, not review.** One `--spacing: 0.5rem` that
  Tailwind multiplies makes every spacing utility an 8-pt multiple by
  construction.
- **One function owns the gender argument.** next-intl 4 removed
  `defaultTranslationValues`, so the alternative was the same argument at every
  call site and one site eventually forgetting it.

## What I got wrong

- **I committed the `.claude/` changes inside a `docs:` commit** by reaching for
  `git add -A`. `.claude/README.md` requires AI-instruction changes to land in
  their own `chore(ai):` commit so they can be accepted or rejected separately.
  Caught immediately and split into three, but `git add -A` is how a rule like
  that gets broken, every time.
- **I planned to generate a `docs/design-tokens.md`** and dropped it mid-build:
  it would have duplicated the token parser between the generator and the test,
  to restate a file that is already a commented reference. Worth recording as a
  plan item that should not have been in the plan.
- **I decided against `NextIntlClientProvider` on a correct principle and a
  false premise.** See above.

## Rule candidates

| Candidate                                                 | Automatable? | Status                                                                                                                            |
| --------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| "A guard must be verified in the environment it runs in"  | partly       | first occurrence — the fix is in `check-private.mjs`; the rule stays here                                                         |
| "Never `git add -A`; stage the paths the commit is about" | yes          | first occurrence — stays here. If it happens again, a pre-commit check that refuses a commit mixing `.claude/` with anything else |
| "A second copy of a fact is a future contradiction"       | no           | first occurrence — `/prune` now carries it as a checklist item                                                                    |
| "An export re-exported out of habit is dead code"         | yes          | already automated — knip caught all four                                                                                          |

## Next

**Step 5** — onboarding, Today and Checklist — is the next unticked step, and it
is blocked on the Supabase, Vercel and Anthropic accounts. Nothing in Release 1
can proceed without them now that step 2 is done.
