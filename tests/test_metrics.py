"""metrics.py — the half that needs no server.

metrics.py is the RAM truth source for both TM1 versions and had no tests at
all. Its row-reading functions are pure: they take what ``MetricService.by_cube``
returned and convert it. A unit the module does not know must fail loud, because
passing a raw number through unconverted corrupts every RAM comparison
OptimusPy makes and does so silently — the number still looks plausible.

The rest of the module — which unit each server actually reports, the v11 retry
and the v12 plateau — needs a real instance and lives in test_live_metrics.py.

Offline, no fake.
"""
import pytest

from optimuspy.metrics import (
    CUBE_MEMORY_METRIC, cube_memory_used_bytes, memory_by_cube_bytes, unit_to_bytes)


def _row(cube, value, unit, metric=CUBE_MEMORY_METRIC):
    return {"CubeName": cube, "Metric": metric, "Value": value, "Unit": unit}


@pytest.mark.parametrize("value, unit, expected", [
    (1, "B", 1.0),
    (1, "KB", 1024.0),
    (1, "MB", 1024.0 ** 2),
    ("2048", "KB", 2048 * 1024.0),   # MetricService can report the value as text
    (0, "B", 0.0),
])
def test_a_known_unit_converts_to_bytes(value, unit, expected):
    assert unit_to_bytes(value, unit) == expected


@pytest.mark.parametrize("unit", ["GB", "b", "", None, "bytes"])
def test_an_unknown_unit_refuses_rather_than_guessing(unit):
    # v11 reports B and v12 reports KB, so a unit nobody wrote code for means the
    # server changed under us. Guessing x1024 would be wrong by 1024x in one
    # direction and right by accident in the other.
    with pytest.raises(RuntimeError) as excinfo:
        unit_to_bytes(1, unit)
    message = str(excinfo.value)
    assert CUBE_MEMORY_METRIC in message
    assert "B" in message and "KB" in message   # names what it does accept


def test_the_cube_memory_row_is_picked_out_of_the_others():
    rows = [_row("Sales", 5, "B", metric="cube_cell_count"),
            _row("Sales", 3, "KB"),
            _row("Sales", 9, "B", metric="cube_view_count")]
    assert cube_memory_used_bytes(rows) == 3 * 1024.0


def test_an_absent_metric_reads_as_none_not_zero():
    # None is "ask again" (v11 retries, v12 raises); 0.0 would be a cube that
    # genuinely occupies nothing, and the % chain would divide by it.
    assert cube_memory_used_bytes([_row("Sales", 5, "B", metric="cube_cell_count")]) is None
    assert cube_memory_used_bytes([]) is None


def test_a_present_metric_with_no_value_reads_as_none():
    assert cube_memory_used_bytes([_row("Sales", None, "B")]) is None


def test_by_cube_rows_pivot_to_bytes_per_cube():
    rows = [_row("Sales", 2, "KB"),
            _row("Sales", 40, "B", metric="cube_cell_count"),
            _row("Budget", 1, "MB")]
    assert memory_by_cube_bytes(rows) == {"Sales": 2 * 1024.0, "Budget": 1024.0 ** 2}


def test_the_pivot_drops_rows_it_cannot_place():
    rows = [_row("Sales", None, "KB"), _row(None, 2, "KB"), _row("", 2, "KB")]
    assert memory_by_cube_bytes(rows) == {}


def test_the_pivot_still_refuses_an_unknown_unit():
    # The per-cube pivot feeds the Optimize DB planner. Skipping a row it cannot
    # convert would quietly drop a cube from the plan instead of reporting why.
    with pytest.raises(RuntimeError):
        memory_by_cube_bytes([_row("Sales", 2, "GB")])
