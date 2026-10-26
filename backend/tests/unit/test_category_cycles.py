"""Deterministic cycle breaking for source category data (OR-019)."""

from structlog.testing import capture_logs

from backend.app.services.categories import break_cycles


def test_acyclic_parents_are_unchanged() -> None:
    parents: dict[int, int | None] = {1: None, 2: 1, 3: 2, 4: None}
    assert break_cycles(parents) == parents


def test_two_node_cycle_is_cut_at_the_lowest_id() -> None:
    with capture_logs() as logs:
        fixed = break_cycles({5: 9, 9: 5, 10: 9})
    assert fixed == {5: None, 9: 5, 10: 9}
    assert logs == [
        {
            "event": "category_cycle_detected",
            "category_ids": [5, 9],
            "cut_at": 5,
            "log_level": "warning",
        }
    ]


def test_self_parent_is_a_cycle() -> None:
    assert break_cycles({3: 3}) == {3: None}


def test_every_cycle_is_cut_once() -> None:
    parents: dict[int, int | None] = {1: 2, 2: 3, 3: 1, 4: 5, 5: 4, 6: 1}
    with capture_logs() as logs:
        fixed = break_cycles(parents)
    assert fixed == {1: None, 2: 3, 3: 1, 4: None, 5: 4, 6: 1}
    assert [entry["cut_at"] for entry in logs] == [1, 4]


def test_input_map_is_not_modified() -> None:
    parents: dict[int, int | None] = {1: 2, 2: 1}
    break_cycles(parents)
    assert parents == {1: 2, 2: 1}
