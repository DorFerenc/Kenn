# 2026-11-15 · step 5a · the service layer, the first screens, and a real browser

**Goal:** roadmap step 5, minus everything that needs an account. Four tables
with RLS, the service layer that is the only thing allowed to touch Postgres,
email sign-in, the onboarding wizard, Today, the Checklist, realtime sync, and
Playwright arriving with tests that run.

**Outcome:** done, and then substantially hardened by the two reviews. 364 unit
tests (from 307), 94 pgTAP assertions (from 30), 24 Playwright tests where there
were none, `pnpm check:twice` stable.
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

## The reviews found more than the build did, and in one direction

Both agents found the same class of thing, and it is not the class I was looking
for: **a guarantee that is true of `apps/web` and false of the database.**

The security review's central observation is one sentence and invalidates
several of mine: the publishable key is public by design and
`[api] schemas = ["public"]` exposes every table through PostgREST, so a
signed-in member holds a general-purpose SQL client against their own
household. One `curl` is as much a request path as a server action. Every policy
I wrote was `for all`, which is correct about _which household_ and silent about
_which operation_. Verified against the local stack before fixing anything:

- `DELETE /rest/v1/household?id=eq.<mine>` succeeded, and the cascade took every
  `audit_log` row with it. "Append-only", asserted in a pgTAP file and written
  into an ADR, was a property of the service layer. **A cascade is not subject
  to the referencing table's RLS**, so four assertions about `update` and
  `delete` on `audit_log` could not see it.
- `DELETE /rest/v1/task_state?...` erased a decision ADR-0008 calls "structural
  rather than conventional".
- `DELETE /rest/v1/member?user_id=eq.<the other parent>` evicted the other
  parent from their own pregnancy, silently and permanently.

My pgTAP files asked "can household A reach household B?" eight times and never
once asked "what can a member do to their own household?". That is the whole
finding, and it is Rules-learned #1 again: ask what the gate cannot see.

The code review's Critical came from driving the app rather than reading it:
nothing stops a person being a member of two households, and five reads assumed
one. A parent who onboarded their own household and then accepted a partner's
invite saw the partner's pregnancy on Today, their own record unreachable, and
three members listed in a two-person household. **My first fix was wrong in a
way worth recording**: I added `order('created_at')` to the household query,
which is deterministic and picks the _partner's_ household, because a partner's
household can easily be the older one. The reviewer caught that too. The real
fix was to resolve the membership and scope every read by its household id.

Two more worth keeping:

- **A gate I wrote this same session was already decoration.**
  `check-prerender.mjs` enumerated six household segment names, so step 8a's
  `things` and step 11's `coach` would have been invisible to it while it
  reported "none of them a household route". It is now an allowlist of what
  _may_ be prerendered, which fails on a new route until someone declares it
  public.
- **The fake Supabase client ignored `.eq()`**, so a query with the household
  filter and one without were indistinguishable to every unit test. That is
  precisely why the Critical had to be found in a browser. A fake that does not
  honour the filters the real client applies cannot test the thing most worth
  testing.

And one finding that was neither a bug nor a test error but an omission nobody
would have noticed for months: `preg.anti-d` is the only `applies_if` condition
in the entire KB — critical, guideline-level, for Rh-negative women — and the
wizard never asked. The unit test proved the engine honours an answer no screen
could give.

## Rule candidates

| Candidate                                                                  | Automatable?            | Status                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "A test fixture fails at its own precondition, never three locators later" | partly                  | first occurrence — proposed as a line in `review-code`                                                                                                                                                                          |
| "A string replacement asserts its anchor matched"                          | yes, for my own tooling | first occurrence — stays here; the formatter reflows anchors, so prefer line-anchored edits                                                                                                                                     |
| "Check `git diff --cached` before committing; the index has history"       | yes                     | **second occurrence** (step 2 was `git add -A`) — earns a hook: refuse a commit staging paths outside the message's scope is too clever, so propose a `pre-commit` listing of staged paths instead                              |
| "Ask what a gate cannot see"                                               | no                      | **third occurrence** (step 2's colour scan, this step's i18n scan, and `check-prerender`) — promoted to CLAUDE.md and `/review-code`, with the mechanical form: a gate that enumerates what it protects derives the enumeration |
| "A guarantee is only as strong as the layer that enforces it"              | partly                  | first occurrence — three claims in my own ADR and comments were true of `apps/web` and false of Postgres; `/review-code` gains it                                                                                               |
| "A fake that ignores a filter cannot test scoping"                         | yes                     | first occurrence — fixed in `fake-db.ts`, and a test smell in `/review-code`                                                                                                                                                    |
| "A comment asserting a property the code does not implement is a finding"  | no                      | first occurrence, twice in one step (`aria-current` "comes from next-intl"; "one household per person in v1")                                                                                                                   |
| "A browser-driven test is a different instrument, not a slower unit test"  | no                      | first occurrence — proposed for `implement-step` phase 4                                                                                                                                                                        |

## Next

**Step 5b**, which needs the Supabase, Vercel and Anthropic accounts: Google
OAuth, real TOTP enrolment, `deploy.yml`, the production deploy and the PWA on
both phones. Everything else in Release 1 — step 6's reminders, step 7's safety
centre, step 8a's Things mechanism — runs locally and is unblocked.
