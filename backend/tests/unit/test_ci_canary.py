"""DELIBERATE CI FAILURE (OR-008 check). This commit is reverted immediately."""

import os  # unused import: ruff F401


def test_ci_must_go_red() -> None:
    count: int = "not an int"  # mypy: incompatible assignment
    assert count == 0
