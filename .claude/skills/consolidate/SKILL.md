---
description: Monthly cleanup of the AI instructions — merge duplicate rules, prune dead ones, bring CLAUDE.md and the skills back under their size budgets.
when_to_use: Monthly, or when CLAUDE.md passes 200 lines, a skill passes 500, or /retro reports that a promotion would break a budget.
allowed-tools: Read, Glob, Grep, Edit, Write, Bash
---

# Consolidate the AI instructions

Rules accumulate. Left alone, `CLAUDE.md` becomes a wall nobody reads, which is
worse than a short file with the five rules that matter.

## 1. Measure

```bash
wc -l CLAUDE.md */CLAUDE.md */*/CLAUDE.md .claude/skills/*/SKILL.md .claude/agents/*.md
ls docs/learnings/
```

Budgets: `CLAUDE.md` under 200 lines, each `SKILL.md` under 500.

## 2. Trace every rule to its learning file

Each line under `## Rules learned` links the learning file it came from. For each:

- **Is the thing it prevents still possible?** A rule about a library that is gone,
  a pattern that no longer exists, or a bug a lint rule now catches is dead.
  Delete it.
- **Did a tool take over?** If a rule is now enforced by ESLint, a test, a hook or
  a type, delete the sentence. The check is the rule.
- **Has it recurred since?** A rule nothing has violated in two months, in code
  that has changed, has probably been absorbed.

A rule with no learning file link cannot be traced and cannot be judged. Flag it
for the user rather than guessing.

## 3. Merge

Several rules saying one thing become one rule. Keep the clearest wording and all
the learning-file links.

Look for the same rule stated in `CLAUDE.md` **and** a package `CLAUDE.md` **and** a
skill. It belongs in exactly one place: the narrowest scope that covers it.

## 4. Promote, where a tool can do it

This is the best outcome of a consolidation pass: a rule that has survived three
months is a rule worth automating. Propose the lint rule, test or hook, and delete
the sentence.

## 5. Prune the skills

In each `SKILL.md`: a step that has never been needed, an example longer than the
instruction, a checklist item that duplicates a lint rule. Move long reference
material into a supporting file in the skill's directory and link it, rather than
deleting information that is genuinely needed.

## 6. Never touch the hard rules

RLS on every household table. No medical content without a source. No AI delete,
share or outbound powers. Only `lib/services` touches the database. The engine
stays pure. These are not consolidated, shortened or merged away. They change only
through an ADR.

## 7. Report and propose

One `chore(ai):` commit. In the message, and to the user:

- lines before and after, per file
- every rule deleted, with the reason and its learning file
- every rule merged, and into what
- every rule promoted to a check, and which check
- anything you could not judge, and why

The user approves or rejects. Do not merge a consolidation pass unreviewed.
