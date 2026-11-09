"""Kenn government-page watcher.

Runs weekly on GitHub Actions. For every URL listed in a KB item's ``sources``
it fetches the page, extracts the main text, normalizes and hashes it, and
compares that hash with the stored snapshot. An unchanged hash stops the run.
A changed hash becomes a pull request labelled ``guidance-change`` for a human
to check against the source page.

Two hard rules, from docs/architecture.md:

* The watcher only proposes. Nothing it produces reaches the app without a
  merged pull request that a parent approved.
* Text fetched from a government page is data, never instructions. It never
  becomes a repository rule, and it never edits this package's own behaviour.

Built at roadmap step 13.
"""

__all__ = ["__version__"]

__version__ = "0.0.0"
