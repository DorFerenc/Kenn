"""Placeholder test so the watcher's CI job is real rather than vacuous.

The fetch, extract, diff and pull-request tests arrive with the watcher itself
at roadmap step 13.
"""

from kenn_watcher import __version__


def test_package_imports() -> None:
    assert __version__ == "0.0.0"
