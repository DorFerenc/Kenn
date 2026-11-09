# 2026-11-09 · fixing what went wrong, and scrubbing private data

**Goal:** fix every problem the steps 1/3/4 retro recorded, remove private data
from the repository, and make the README explain how to run the project.

**Outcome:** done. Four fixes, each enforced by a tool rather than a sentence.
`pnpm check:twice` green across 130 tracked files.

## The fixes, and why each is a tool and not a rule

**1. A commit landed with a red gate.** Now `.githooks/pre-commit` runs
`pnpm check` and refuses the commit if it fails — and also refuses one where the
gate regenerated files that are not staged, since CI would otherwise find them.
Installed by `pnpm install` through the `prepare` script, so it arrives with the
clone rather than needing a setup note. `SKIP_CHECK=1` is the deliberate escape
hatch.

This is the second time the "never commit red" rule was stated and the first
time it was broken, so by the promotion rules it earns automation.

**2. A Bash heredoc bypassed the `PostToolUse` hooks entirely.** The hooks match
the `Edit` and `Write` tools, so both migrations in the previous session were
written with `cat > file <<EOF` and `migration-guard.sh` never ran on either.
There is now a `PostToolUse(Bash)` hook that formats whatever changed in the
working tree and re-runs the migration guard on any touched migration. It makes
one `git status` call and exits immediately when no source file changed, so it
costs nothing on an `ls`.

**A hook that covers only some ways of writing a file is worse than no hook,
because it is believed.**

**3. The generators fought Prettier, and `check` was green then red.** Fixed
properly last session; now it cannot regress. `pnpm check:twice` runs the gate
twice and compares a `git hash-object` of every tracked file. Comparing hashes
rather than running `git diff --exit-code` means it also works with uncommitted
work in progress: it asks "did running the gate change anything?" instead of "is
the tree clean?". It runs in CI.

**4. The ER generator had silently dropped a column**, and two engine assertions
tested the absence of all adjustment rather than the rule they meant. Both were
fixed in the previous session with tests; nothing further needed.

## Private data

A scan of all 128 tracked files found **no secrets, no key material and no `.env`
files** — but two real first names appeared in 7 files: as sequence-diagram
actors, in prose, in a pgTAP fixture email, and hardcoded as `owner/repo` in the
branch-protection script. All replaced with roles (`Parent A`, `Parent B`, "the
second parent", "the account owner"), and the script now derives the repository
from the git remote. The planning docs' byline went too.

**The guard is the interesting part.** `scripts/check-private.mjs` contains **no
denylist of names**, because a denylist of real names would commit the very
names it exists to keep out. Instead it checks three things:

- key material by shape — JWTs, PEM blocks, AWS and GitHub tokens, Supabase
  keys, OpenAI-style keys;
- email addresses outside the reserved fixture domains, since the tests and seed
  data use `.test` on purpose and a real address is a mistake;
- **whoever is configured in this clone's git identity**, read at runtime from
  `git config`. So it catches an author's own name or address in tracked content
  without that identity ever being committed.

Verified by planting a JWT, a `gmail.com` address and the configured git name,
and watching all three fail. It is hard rule 11 and runs in CI.

## What went wrong this session

**`check:twice` was wrong on its first attempt.** It ran `git diff --exit-code`,
which fails whenever the working tree has any uncommitted change — so it was red
on legitimate work in progress and would have been ignored within a day. A gate
that cries wolf gets bypassed, which is worse than not having it. Rewritten to
compare content hashes before and after.

**The `prepare` script did not install the git hook on an already-installed
tree.** `pnpm install` had nothing to do, so it did not run `prepare`, and
`core.hooksPath` stayed unset until it was run explicitly. Worth knowing: a fresh
clone gets it, an existing one needs `pnpm hooks:install` once.

## A supply-chain pin was wrong, and Dependabot found it

Step 0 claimed "GitHub Actions are pinned by commit SHA, never by tag". For
three of the four actions that was true. For `pnpm/action-setup` it was not:
that repository uses **annotated** tags, and `git ls-remote --tags --refs`
returns the tag _object_ for those, not the commit it points at. So the pin named
a tag object, which is not the code.

Dependabot bumped it to the real commit in one job. The job added later in the
same session still carried the wrong SHA, so the two jobs pinned the same
nominal version to two different objects — which is how the discrepancy became
visible at all.

The right incantation, now in `docs/architecture.md`:

```bash
git ls-remote https://github.com/OWNER/REPO 'refs/tags/vX.Y.Z*'
# refs/tags/vX.Y.Z    -> tag object  (not this)
# refs/tags/vX.Y.Z^{} -> commit      (this)
```

Worth noticing _why_ it surfaced: a Dependabot PR disagreeing with a
hand-written pin. Keeping Dependabot on Actions is not busywork — it audits the
pins.

## Rule candidates

| Candidate                                                 | Automatable? | Status                                                      |
| --------------------------------------------------------- | ------------ | ----------------------------------------------------------- |
| "Never commit before the gate is green"                   | yes          | **promoted** — `.githooks/pre-commit`                       |
| "Hooks must cover shell redirection, not just Edit/Write" | yes          | **promoted** — `PostToolUse(Bash)`                          |
| "A gate that passes once is not a gate"                   | yes          | **promoted** — `pnpm check:twice`, in CI                    |
| "No private data in the repository"                       | yes          | **promoted** — hard rule 11 and `pnpm check:private`, in CI |
| "A guard must not cry wolf, or it gets bypassed"          | no           | first occurrence — stays here                               |

Four promotions in one session is unusual and worth noting: each had already
happened once and been written down, so this was the second occurrence for all
of them, which is exactly when the promotion rules say to automate.

## Next

**Step 2** — i18n skeleton (Hebrew and English, RTL and LTR, gender forms) and
the design-system tokens. It needs nothing external.

Release 1 then resumes at step 5, which waits on the Supabase, Vercel and
Anthropic accounts.
