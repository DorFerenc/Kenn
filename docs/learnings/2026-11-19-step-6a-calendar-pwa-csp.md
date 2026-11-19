# 2026-11-19 · step 6a · the calendar feed, an installable app, and a CSP

**Goal:** roadmap step 6, split this session into 6a (everything that needs no
scheduler) and 6b (push, the Sunday digest and the job that sends them). 6a:
Serwist without webpack, an installable and offline-aware app, a nonce-based
Content-Security-Policy, and the private ICS calendar feed — the first read in
Kenn made without a signed-in user.

**Outcome:** done. 402 unit tests (from 364), 125 pgTAP assertions (from 94),
29 Playwright tests (from 24), `pnpm check` green. The session also merged
step 5a (pull request 13) and folded seven Dependabot PRs into one (pull
request 15). Built and green at 395 / 115 / 29 before review; the two reviews
then found one High and six Medium, all fixed, and nothing Critical.

## The named risk was already gone, and only the package source said so

Step 6's risk — "Serwist integrates through a webpack plugin and Next.js 16
fails the build on a custom webpack config" — had been carried in the roadmap,
`apps/web/CLAUDE.md` and ADR-0004 since step 0. `@serwist/turbopack` exists, in
the very version already pinned, and builds the worker with esbuild inside a
Route Handler at `next build`. The docs site was unreachable from the build
environment; the package ships its `src/`, and twenty minutes reading
`index.ts`, `lib/build.ts` and `index.worker.ts` answered more than the docs
would have — including the one thing that mattered most:

**The library's recommended cache would have stored the checklist.**
`defaultCache` from `@serwist/turbopack/worker` caches HTML and RSC payloads
with `NetworkFirst`, which in this app means every household page, on the
phone, at rest. The provider's `cacheOnNavigation` (on by default) asks the
worker to cache every page the visitor opens. Both are sensible for a blog and
wrong for health data. The worker now precaches build assets and two offline
pages and nothing else, and `e2e/pwa.spec.ts` asserts — after a signed-in
session with the worker in control — that no household path is in any cache.
**A default is a decision someone else made for a different app.**

## pnpm's strictness surfaced twice, both times correctly

- `@serwist/turbopack` imports `esbuild` at runtime as an optional peer. Under
  pnpm's strict linking it was not resolvable from `apps/web`, and the build
  failed in "Collecting page data" with `ERR_MODULE_NOT_FOUND`. Declaring
  `esbuild` as a direct devDependency, at the version already in the lockfile,
  is the honest fix — the package does need it.
- `withSerwist()` adds `esbuild` to `serverExternalPackages`; without it the
  bundler tried to inline a native binary.

## The gates that caught me

- **knip refused the first commit** because the service worker was an
  unreferenced file, and then because the calendar service's exports had no
  caller yet. Both were true; the second meant the database commit could not
  land until the screen that uses it existed. Committing pieces still works —
  the gate runs on the working tree — but a piece is only committable once the
  whole tree is coherent.
- **The migration guard demanded `with check`** on a table that has only a
  `for select` policy, because it greps for the phrase whenever a policy
  exists. A read-only policy has nothing for `with check` to check. Rather than
  change the guard (refused by the permission classifier, correctly — a build
  session should not loosen its own gate), the migration gained restrictive
  `false` policies for insert, update and delete. They are not decoration: a
  later `grant all` is the most common way a privilege comes back, and these
  still refuse it. The guard's blind spot is recorded as a rule candidate
  below.
- **The colour scan** would have refused a hex `theme_color` in
  `manifest.ts`, so the manifest reads `--color-accent` and `--color-surface`
  out of `tokens.css` at build time. The same applies to the icon generator.
  The scan was right: the manifest is exactly where a second copy of the
  palette would quietly drift.
- **The prerender allowlist** failed on the manifest and the worker the moment
  they existed, which is what an allowlist is for. Each entry now says why it
  is safe to prerender.

## Two of my own test mistakes, both cheap because they failed loudly

- **Ticking on Today and looking for Undo.** Today drops a done item from its
  list, so the Undo button is never there. The existing checklist test ticks on
  the Checklist for exactly this reason; I did not read it first.
- **Counting feed events straight after a tick.** The tick is optimistic on
  screen; the `task_state` row lands a moment later. `expect.poll` on the feed
  turned a race into an assertion. The first failure looked like the feed
  ignoring decisions, which would have been a real bug — polling is what told
  the two apart.

And one that was the UI's, not the test's: "צרי קישור ליומן" contains "צרי
קישור", so the invite tests' locator matched two buttons. `exact: true` fixed
the tests; the two labels are distinct enough for a person.

## Environment

The worker process restarted three times and stopped Docker each time, taking two background review agents with it once; usage limits
paused the session twice. Nothing was lost because every finished piece had
been committed and pushed before the pause. **Push at every green commit** is
worth more in a container that can disappear than any amount of care inside
one turn.

## The reviews: three tests that passed for the wrong reason

The security review's central finding is the same shape as step 5a's, one
layer down. **`anon` could execute every function in `public`.** Supabase's
base schema grants execute on new functions to `anon` _by name_ in its default
privileges, and every migration in this repository — mine and four earlier
ones — wrote `revoke all ... from public`, which removes the PUBLIC grant and
leaves the named one standing. Verified with `has_function_privilege()` against
the local stack before touching anything: true for `create_household`,
`accept_invite`, `create_calendar_feed` and `revoke_calendar_feed`. Nothing was
reachable, because each body refuses a null `auth.uid()` — but **the pgTAP
test "anon cannot mint a feed" passed on that `if`, not on a privilege**, so it
would have stayed green with the grant in place. It now asserts privileges.

The code review found two more of the same kind in my own tests:

- **"Gives the same tasks as the screens"** asserted a count and that anti-D
  was absent. It never compared the feed with the Checklist, and the fixture
  used only LMP dating, so swapping the `edd` and `transfer_date` branches
  passed every test. Rewritten per dating method; the swap, planted by hand,
  now fails two cases.
- **"Keeps a reopened item"** ran the default fixture under a new name.

All three are a test whose name claims a property its assertion does not
exercise. That is Rules learned #1 again — ask what a gate cannot see — and it
has a mechanical form worth writing into `/review-code`: **plant the bug the
test is named after, and watch it fail.** I did that for the parity test only
after the reviewer pointed out the others.

The other findings worth keeping:

- **`calendar_feed_inputs()` said more than the calendar needs.** I wrote it
  for the route, but it is reachable over PostgREST by anyone holding a token,
  so its _result_ is what a leaked token grants — household id, every decision
  and its state, all three dating columns. Now: a per-feed salt, the one date
  the dating method uses, the ids of decided items, and a key set pinned in
  pgTAP. **A function granted to `anon` is an API, whatever route it was
  written for.**
- **The route swallowed every error without a log** — so the zod parse I wrote
  "to fail loudly" would have failed silently, as a permanent 503 for every
  subscriber. A comment promising loudness is not loudness.
- **One tap after making a link revoked it.** The button above the fresh link
  re-rendered as "create a new link". Nothing in a unit test or a reading of
  the code shows this; the reviewer imagined a person.
- **Apple strips alerts from a subscribed calendar by default**, so the help
  text promised reminders the default setup will not show. The copy now says
  to untick "Remove alerts". Not verified on a device from here.

Left open, each with its step: the AI-actor claim that would let
`create_calendar_feed` refuse an MCP client in SQL (step 9, with the
pre-existing hole that `audit_log` accepts a member-written `actor_kind =
'mcp'` row); the proxy matcher skipping any path with a dot, which a future
`/checklist/preg.nt-scan` route would hit; and rate limits on feed creation and
the route.

## Decisions taken

- **ADR-0009** — a read without a session is one `SECURITY DEFINER` function
  per purpose, callable by `anon`, taking the raw token and returning the
  minimum. Never the service-role key. `calendar_feed` is also the first table
  written only through functions that audit in the same transaction — the
  shape step 9 retrofits onto the rest.
- **Full event titles** in the feed, with the privacy warning shown before the
  link exists. The user chose this over generic titles.
- **An own RFC 5545 writer** (130 lines, 15 tests) rather than the `ics`
  package, which brings a runtime schema validator for one event shape.
- **`style-src 'unsafe-inline'`** is accepted and named in `lib/csp.ts`;
  `script-src` has no `'unsafe-inline'`, and the e2e suite asserts zero CSP
  violations across every screen with a tick that needs hydration.
- **One combined dependency PR** instead of seven: five of them rewrite
  `pnpm-lock.yaml`, so merging them one at a time conflicts after each merge.

## Rule candidates

| Candidate                                                                                            | Automatable? | Status                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Plant the bug a test is named after, and watch it fail"                                             | partly       | **third occurrence of the family** (step 2's colour scan, step 5a's i18n scan and fake client, now three tests here) — proposed as a line in `/review-code` |
| "Revoke function execute from `anon` by name, and assert privileges with `has_function_privilege()`" | yes          | first occurrence, but `packages/db/CLAUDE.md` teaches the pattern every migration copies, so it is corrected there now; the schema default is fixed in SQL  |
| "A function granted to `anon` is an API: its result is what a leaked token grants"                   | partly       | first occurrence — the key set is pinned in pgTAP; stays here                                                                                               |
| "A library default is a decision made for a different app"                                           | partly       | first occurrence — stays here                                                                                                                               |
| "The migration guard's `with check` rule should apply only when a policy can write"                  | yes          | first occurrence — for the account owner: a session should not loosen its own gate, and the permission classifier refused the edit                          |
| "Read the existing test for a flow before writing a new one that drives it"                          | no           | first occurrence                                                                                                                                            |
| "Push at every green commit"                                                                         | partly       | first occurrence — the worker restarted three times this session                                                                                            |

## Next

**Step 6b** (Web Push, the daily push, the Sunday digest, and the job) once its
open decision is made — or **5b** the moment the Supabase and Vercel accounts
exist.
