---
description: Challenge the change for code nothing uses and for duplication worth collapsing into one function. Deletes what is dead, merges what is repeated, and leaves alone what only looks similar.
when_to_use: Before opening a PR, or when the user says a change feels repetitive, asks whether there is dead code, asks to simplify or tidy, or asks why there are three functions that do nearly the same thing. Also run as part of phase 5 of implement-step when the diff added more than it needed to.
allowed-tools: Read, Glob, Grep, Bash, Edit
---

# Prune the change

The cheapest code to maintain is the code that is not there. This skill removes
what nothing uses and collapses what is written twice — and, just as
importantly, refuses to merge two things that only look alike.

**The bar is one deletion or one merge that a reviewer would thank you for, not
a diff that touches everything.** Leaving the code as it is, with a reason, is a
valid outcome and is the right one more often than it feels.

## 1. Let the tools speak first

They are not opinions, and they are already in the gate.

```
pnpm knip
```

Dead exports, unused files, unused dependencies. **Delete, do not ignore.** An
entry added to `knip.json` is a promise to come back, and nobody comes back. The
one legitimate use of `ignoreDependencies` is a dependency declared early on
purpose so the lockfile pins the version matrix — and `apps/web/CLAUDE.md`
already says each entry comes off with the step that starts using it.

```
pnpm lint
```

`no-unused-vars` is an error here, so anything it reports is genuinely unused.

```
git diff --stat
```

A file that grew by more than it should have is where to look next.

## 2. Find the duplication that matters

Read the diff and ask, in this order:

1. **Does this already exist?** Search before writing a helper. The usual finds:
   a date helper that `@kenn/engine` already exports, a locale or gender-form
   question `@kenn/ui` already answers, a validation `packages/kb`'s zod schema
   already performs, a query a service function already wraps.
2. **Is this the same shape three times?** Three branches that differ only in a
   colour, a key or a string are a table with three rows and one function that
   reads it. Two are usually fine; three is a table.
3. **Is this knowledge in two places?** The dangerous duplication is not
   repeated lines, it is a **fact** stated twice — a colour in a token file and
   in a component, a locale list in the app and in the UI package, a rule in
   `CLAUDE.md` and in a test. One of them will be updated and the other will
   not. Collapse to one, and make the other read from it.
4. **Does the comment say what the code says?** Delete the comment. Keep the
   ones that say _why_, especially the ones recording something that was learned
   the hard way.

## 3. Know when not to merge

Merging two things that merely resemble each other is worse than the
duplication, because the next change has to un-merge them first. **Leave them
apart when:**

- They answer to different owners. A rule that follows the Ministry of Health
  and a rule that follows a family's preference will diverge, whatever they
  look like today.
- One is a test fixture. Tests are allowed to repeat themselves; a test that
  shares a helper with the code it tests can pass for the wrong reason.
- The merged version needs a boolean parameter to choose between the two
  behaviours. That parameter is the two functions, wearing a coat.
- They are in `packages/engine` or `packages/kb` and merging would pull in an
  import those packages are not allowed to have.
- The duplication is three short lines and the shared version would be five.

## 4. Prefer deleting to abstracting

In order of preference:

1. **Delete it.** Nothing uses it; git remembers it.
2. **Inline it.** A function called once, with a name that restates its body, is
   a redirection, not an abstraction.
3. **Make it data.** A `Record` or a `const` array read by one function beats
   several near-identical functions, and it is what a reviewer can check at a
   glance.
4. **Extract a function**, last, and only with a name that says what it means
   rather than what it does.

## 5. Keep the behaviour identical

A prune that changes behaviour is a refactor with no test to catch it.

```
pnpm check
```

```
TZ=America/Los_Angeles pnpm test
```

Run both **before and after**, and compare the test counts. A test that
disappeared is a behaviour that is no longer checked — restore it or say so.
If the diff touched `packages/engine`, the non-UTC run is not optional.

## 6. Report, do not just act

End with three short lists:

- **Deleted** — what, and what proved it was dead.
- **Merged** — what became one thing, and the fact that was stated twice.
- **Left alone** — what looked duplicated and is not, with the reason. This list
  is the valuable one: it stops the next session making the same suggestion.

Commit the prune **separately** from the feature it followed. A deletion mixed
into a feature commit is invisible in review, and a revert of one should not
take the other with it.
