# tests/test_tau.py
from optimuspy import tau


def test_constants_have_expected_initial_values():
    assert tau.TAU_RAM == 4.0
    assert tau.TAU_QUERY == 10.0
    assert tau.FOLD_B_MAX_PASSES == 2


def test_decides_after_true_when_ratio_at_or_above_tau():
    assert tau.decides_after(400, 100, 4.0) is True   # exactly 4x
    assert tau.decides_after(500, 100, 4.0) is True


def test_decides_after_false_within_tolerance():
    assert tau.decides_after(399, 100, 4.0) is False
    assert tau.decides_after(100, 100, 4.0) is False


def test_decides_after_handles_zero_cardinality_smaller():
    # An empty dim is dominated by any populated dim.
    assert tau.decides_after(1, 0, 4.0) is True
    assert tau.decides_after(0, 0, 4.0) is False


def test_back_frontier_is_dims_within_tau_of_the_maximum():
    # 50k dominates all others by >> 4x -> only it is on the back frontier (pinning).
    unplaced = [("A", 180), ("B", 205), ("C", 50000)]
    assert tau.back_frontier(unplaced, 4.0) == ["C"]


def test_back_frontier_keeps_near_tied_maxima_together():
    unplaced = [("A", 180), ("B", 205), ("C", 400)]  # 400/180=2.2, 400/205=1.95 < 4
    assert tau.back_frontier(unplaced, 4.0) == ["A", "B", "C"]


def test_front_frontier_is_dims_within_tau_of_the_minimum():
    unplaced = [("A", 180), ("B", 205), ("C", 50000)]  # A,B within 4x of min(180); C dominates min
    assert tau.front_frontier(unplaced, 4.0) == ["A", "B"]


def test_frontiers_preserve_input_order():
    unplaced = [("Z", 100), ("Y", 120), ("X", 110)]
    assert tau.back_frontier(unplaced, 4.0) == ["Z", "Y", "X"]
    assert tau.front_frontier(unplaced, 4.0) == ["Z", "Y", "X"]


def test_ranking_back_half_is_always_ram():
    # mid=3; positions 4,5,6 are back -> ram regardless of views/processes.
    assert tau.ranking_for_position(4, 3, has_views=True, has_processes=True) == "ram"


def test_ranking_front_half_prefers_query_then_process_then_ram():
    assert tau.ranking_for_position(1, 3, has_views=True, has_processes=True) == "query"
    assert tau.ranking_for_position(1, 3, has_views=False, has_processes=True) == "process"
    assert tau.ranking_for_position(1, 3, has_views=False, has_processes=False) == "ram"


def test_tau_for_position_keys_to_metric():
    assert tau.tau_for_position("ram") == tau.TAU_RAM
    assert tau.tau_for_position("query") == tau.TAU_QUERY
    assert tau.tau_for_position("process") is None  # never prune process positions


def test_fold_a_candidates_back_uses_back_frontier():
    unplaced = [("A", 180), ("B", 205), ("C", 50000)]
    assert tau.fold_a_candidates(unplaced, is_back=True, tau=4.0) == ["C"]


def test_fold_a_candidates_front_uses_front_frontier():
    unplaced = [("A", 180), ("B", 205), ("C", 50000)]
    assert tau.fold_a_candidates(unplaced, is_back=False, tau=4.0) == ["A", "B"]


def test_fold_a_candidates_none_tau_returns_all_unplaced_in_order():
    unplaced = [("A", 180), ("B", 205), ("C", 50000)]
    assert tau.fold_a_candidates(unplaced, is_back=False, tau=None) == ["A", "B", "C"]
