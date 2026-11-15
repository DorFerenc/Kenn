# 2026-11-15 · step 5a · the service layer, the first screens, and a real browser

**Goal:** roadmap step 5, minus everything that needs an account. Four tables
with RLS, the service layer that is the only thing allowed to touch Postgres,
email sign-in, the onboarding wizard, Today, the Checklist, realtime sync, and
Playwright arriving with tests that run.

**Outcome:** done. 350 unit tests (307 → 350), 76 pgTAP assertions (30 → 76),
21 Playwright tests where there were none, `pnpm check:twice` stable across 223
files. Step 5 is now 5a (done) and 5b (Google OAuth, real MFA, `deploy.yml`,
the production deploy, the PWA on both phones).

## The find of the session came from a browser, and nothing else could have found it

The onboarding wizard posted itself from step 3. The last step — health fund,
customs, firstborn — was never on screen, and the household was created with
those answers missing.

The mechanism is worth writing down in full, because it is invisible in review
and invisible to every unit test:

- The wizard renders `<button type="button">Next</button>` while
  `step < 4`, and `<button type="submit">Finish</button>` when `step === 4`.
  Both sit in the same position in the same flex row.
- React reconciles them as the _same element_: same tag, same position, so it
  mutates the existing DOM node's `type` attribute from `button` to `submit`
  rather than replacing the node.
- A click on Next runs the handler, `setStep` flushes synchronously (click is a
  discrete event), and the browser then applies **that same click's activation
  behaviour** to the node — which is now a submit button.

So the form submitted on a click whose target had been a plain button when it
was clicked. Distinct `key` props fix it, because React then unmounts one and
mounts the other.

What is general here: **a test that drives the DOM is not a slower unit test, it
is a different instrument.** Three sessions of unit tests, typechecking and
review had not touched this, and could not have.

## Four hours went on failures that were all the test harness

Nineteen of twenty-one tests failed at first, and not one of the failures was
the application. Each cause is worth naming because each is a trap that will be
walked into again:

1. **`next dev` compiles each route on first request**, which put several tests
   over a 30-second timeout while the app worked perfectly. Worse, it **blocks
   cross-origin requests to its own HMR endpoint**, and reaching it on
   `127.0.0.1` therefore left React unhydrated: Playwright ticked a radio, the
   DOM changed, and the component's state never did. The suite now runs against
   a production build, which is also what ships.
2. **The local stack's own rate limit.** `sign_in_sign_ups = 30` per five
   minutes per IP, and the suite creates about twenty accounts per run — so the
   second run inside five minutes failed, quietly, with a 429 that reached the
   UI as "something failed". Debugging a test suite is exactly the activity that
   runs it twice in five minutes.
3. **A fixture that carried on after its precondition failed.** When sign-up was
   being refused, every test failed on a missing radio button and not one of
   them mentioned auth. The fixture now waits for the whole redirect chain and
   throws with what the form said.
4. **Next.js keeps an empty `role="alert"` on every page** — its route
   announcer. An unscoped `getByRole('alert')` finds that, so the fixture's own
   error reporting said `the form says ""`.
5. **A test asserting one parent's Hebrew on the other parent's screen.** Parent
   A chose the feminine form in the wizard; parent B joined by invite and never
   walked it, so B reads `סמנו` where A reads `סמני`. The app was right, the
   test was wrong, and it hung for 270 seconds on a locator that would never
   resolve. It is now the assertion that this is per member.

**The lesson that cost the most:** three of these five produced a failure
message pointing at the wrong layer. A harness that fails loudly at its own
precondition would have turned four hours into forty minutes.

## Two of my own mistakes, both the same shape as last session's

- **A commit swallowed unrelated work, again.** Last session it was `git add -A`.
  This time the index still held a `git add` from a commit the hook had refused,
  so a one-file `chore:` commit carried fourteen files of schema with it. Caught
  by reading `git show --stat` after committing, and split. The rule
  "stage the paths the commit is about" is not enough: **the index has state
  from before, and a refused commit leaves it loaded.**
- **Four `python3` string replacements silently did nothing**, because the
  `PostToolUse` formatter had reflowed the anchor text between writing and
  editing. One of them mattered: the sign-in fixture never gained its assertion,
  and I spent a round of debugging on behaviour I believed I had changed. Every
  such edit now asserts the match; the two that failed loudly were the cheap
  ones.

## The gates earned their keep, and one of them was lying

- `migration-guard.sh` refused the first migration until its pgTAP file existed
  — four times, once per table.
- `check:private` refused `.env.example` because its placeholder was written in
  the shape of a real publishable key — the `sb_publishable_` prefix and enough
  characters after it to match. It was right twice: once about the file, and
  again about this learning file, which quoted the placeholder and was refused
  in turn. The pattern cannot know the difference, and a placeholder that looks
  like a key is exactly how a key gets committed.
- `knip` found eight dead exports after the dust settled — inferred zod types
  nothing imports yet, a `signedInUserId` the app never calls, two internal
  helpers exported out of habit. Deleted, not ignored.
- **The i18n coverage gate was quietly covering less than it claimed.** It
  matched `useTranslations('ns')` and skipped any file using more than one
  namespace. Every server page uses `getTranslations('ns')`, which it did not
  match at all, and the onboarding wizard binds three namespaces, so it was
  skipped whole: 25 of its keys were unchecked while the gate reported itself
  clean. It now resolves keys per binding, and sees 86 keys across 14 files.
  **Same failure as step 2's colour scan: ask what a gate cannot see, not what
  it rejects.**
- **The pre-commit hook made a multi-commit change impossible.** It ran the gate
  and then refused if `git diff` was non-empty — which is true of every
  partially staged change, so only an all-or-nothing commit could land. That is
  the opposite of what the implement-step skill asks for. It now snapshots
  `git diff` before the gate and compares afterwards, so it refuses only when
  running the gate itself changed something.

## Decisions taken

- **No stored window dates** (ADR-0008). There is no `task_instance` table.
  `task_state` holds a decision per (household, item); the engine derives every
  window at read time. A corrected EDD therefore moves every window at once, and
  no stored row can contradict the engine.
- **`audit_log` is append-only** (ADR-0008): select and insert policies, no
  update or delete policy. Its pgTAP file asserts a member cannot rewrite their
  _own_ history, because that failure is silent — an UPDATE with no matching
  policy reports zero rows rather than raising.
- **The KB is compiled into a committed JSON module** by `pnpm kb:build`, since
  a bundler cannot follow a `readdirSync` of a package directory. `items.ts`
  parses it through the zod schema rather than casting, so a half-written
  artefact is a startup failure rather than wrong guidance on a screen.
- **`@supabase/ssr` joins the import boundary.** It is how a session reaches a
  cookie store, so a component importing it would hold a database client without
  going near the package hard rule 1 names.
- **One module reads the clock** (`apps/web/lib/today.ts`), asserted by a scan
  with the violation planted. The engine's refusal to read a clock only helps if
  the app does not scatter `new Date()` either.
- **Playwright is pinned to 1.63.0, not 1.65.0**, to match the Chromium this
  build environment ships. The same reasoning as ADR-0002: the latest version
  the toolchain supports, where the toolchain includes the machine.

## Rule candidates

| Candidate                                                                  | Automatable?            | Status                                                                                                                                                                                             |
| -------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "A test fixture fails at its own precondition, never three locators later" | partly                  | first occurrence — proposed as a line in `review-code`                                                                                                                                             |
| "A string replacement asserts its anchor matched"                          | yes, for my own tooling | first occurrence — stays here; the formatter reflows anchors, so prefer line-anchored edits                                                                                                        |
| "Check `git diff --cached` before committing; the index has history"       | yes                     | **second occurrence** (step 2 was `git add -A`) — earns a hook: refuse a commit staging paths outside the message's scope is too clever, so propose a `pre-commit` listing of staged paths instead |
| "Ask what a gate cannot see"                                               | no                      | **second occurrence** (step 2's colour scan) — promote to `review-code`                                                                                                                            |
| "A browser-driven test is a different instrument, not a slower unit test"  | no                      | first occurrence — proposed for `implement-step` phase 4                                                                                                                                           |

## Next

**Step 5b**, which needs the Supabase, Vercel and Anthropic accounts: Google
OAuth, real TOTP enrolment, `deploy.yml`, the production deploy and the PWA on
both phones. Everything else in Release 1 — step 6's reminders, step 7's safety
centre, step 8a's Things mechanism — runs locally and is unblocked.
