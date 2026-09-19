"""Offline tests for the order frame. No TM1, no fake — the module is pure."""
from optimuspy.order_frame import (
    OrderFrame,
    REASON_IGNORED_ORDER,
    REASON_LOCKED_SLOT,
    REASON_NOT_A_PERMUTATION,
    REASON_POSITION_RULE,
)

STORAGE = ["Year", "Region", "Product", "Account", "Measure"]


def frame(**kwargs):
    locked = kwargs.pop("last_slot_locked", False)
    return OrderFrame(STORAGE, locked, **kwargs)


# --- the locked slot -------------------------------------------------------

def test_no_lock_means_every_permutation_is_admissible():
    f = frame(last_slot_locked=False)
    moved = ["Measure", "Year", "Region", "Product", "Account"]
    assert f.admits(moved).admissible
    assert f.locked_dimension is None
    assert f.locked_position is None


def test_lock_admits_any_order_that_keeps_the_locked_dim_last():
    f = frame(last_slot_locked=True)
    assert f.admits(["Region", "Year", "Account", "Product", "Measure"]).admissible


def test_lock_refuses_an_order_that_moves_the_locked_dim():
    f = frame(last_slot_locked=True)
    verdict = f.admits(["Measure", "Year", "Region", "Product", "Account"])
    assert not verdict.admissible
    assert verdict.code == REASON_LOCKED_SLOT
    # The reason must name the dimension and where the order would put it —
    # it is the only channel a TI process calling set mode has.
    assert "Measure" in verdict.reason
    assert "position 0" in verdict.reason


def test_lock_keys_off_the_storage_last_dim_not_a_string_dim_elsewhere():
    # A dimension is shared across cubes, so one that is NOT storage-last may
    # still carry string elements. The lock ignores it: only the last slot binds.
    f = OrderFrame(["Year", "Notes", "Region", "Measure"], last_slot_locked=False)
    assert f.admits(["Notes", "Year", "Region", "Measure"]).admissible
    assert f.locked_dimension is None


def test_locked_position_is_the_last_index():
    assert frame(last_slot_locked=True).locked_position == len(STORAGE) - 1


# --- candidate sanity ------------------------------------------------------

def test_an_order_with_an_unknown_dimension_is_refused():
    f = frame()
    verdict = f.admits(["Year", "Region", "Product", "Account", "Typo"])
    assert not verdict.admissible
    assert verdict.code == REASON_NOT_A_PERMUTATION


def test_an_order_missing_a_dimension_is_refused():
    f = frame()
    verdict = f.admits(["Year", "Region", "Product", "Account"])
    assert not verdict.admissible
    assert verdict.code == REASON_NOT_A_PERMUTATION


def test_a_duplicated_dimension_is_refused():
    f = frame()
    verdict = f.admits(["Year", "Year", "Product", "Account", "Measure"])
    assert not verdict.admissible
    assert verdict.code == REASON_NOT_A_PERMUTATION


# --- user preferences (greedy-only) ---------------------------------------

def test_preferences_are_absent_unless_supplied():
    # A non-greedy caller supplies none, so an ignored order or a position rule
    # belonging to some other run can never affect it.
    f = OrderFrame(STORAGE, True)
    assert f.orders_to_ignore == []
    assert f.position_rules == []
    assert f.dimensions_to_exclude == []


def test_an_ignored_order_is_refused():
    ignored = ["Region", "Year", "Product", "Account", "Measure"]
    f = frame(orders_to_ignore=[ignored])
    verdict = f.admits(ignored)
    assert not verdict.admissible
    assert verdict.code == REASON_IGNORED_ORDER


def test_an_order_not_in_orders_to_ignore_is_admitted():
    f = frame(orders_to_ignore=[["Region", "Year", "Product", "Account", "Measure"]])
    assert f.admits(["Year", "Region", "Product", "Account", "Measure"]).admissible


def test_the_lock_outranks_a_user_preference_in_the_reported_reason():
    # Both apply; the server constraint is the one the caller must be told about.
    moved = ["Measure", "Year", "Region", "Product", "Account"]
    f = frame(last_slot_locked=True, orders_to_ignore=[moved])
    assert f.admits(moved).code == REASON_LOCKED_SLOT


def test_position_rule_predicate_is_preserved_verbatim():
    # Documents CURRENT behaviour, defect included: the rule is reported as
    # unsatisfied when the dimension IS at the configured position, and the
    # integer branch is 1-based. Both are corrected in their own commit, which
    # rewrites this test.
    f = frame(position_rules=[{"dimension": "Year", "position": "first"}])
    verdict = f.admits(["Year", "Region", "Product", "Account", "Measure"])
    assert not verdict.admissible
    assert verdict.code == REASON_POSITION_RULE
    assert f.admits(["Region", "Year", "Product", "Account", "Measure"]).admissible


# --- the shape of the search space ----------------------------------------

def test_movable_dimensions_drops_the_locked_dim():
    f = frame(last_slot_locked=True)
    assert f.movable_dimensions() == ["Year", "Region", "Product", "Account"]


def test_movable_dimensions_drops_excluded_dims():
    f = frame(dimensions_to_exclude=["Region"])
    assert f.movable_dimensions() == ["Year", "Product", "Account", "Measure"]


def test_movable_dimensions_drops_both():
    f = frame(last_slot_locked=True, dimensions_to_exclude=["Region"])
    assert f.movable_dimensions() == ["Year", "Product", "Account"]


def test_reserved_positions_covers_excluded_slots_and_the_locked_slot():
    f = frame(last_slot_locked=True, dimensions_to_exclude=["Region"])
    assert f.reserved_positions() == {1, 4}


def test_reserved_positions_is_empty_with_no_lock_and_no_exclusions():
    assert frame().reserved_positions() == set()


# --- purity ----------------------------------------------------------------

def test_frame_holds_no_tm1_handle():
    # The frame is constructed from data alone; it must stay offline-testable.
    f = frame(last_slot_locked=True)
    assert not any(hasattr(f, attr) for attr in ("tm1", "cube_name"))


def test_frame_copies_its_inputs():
    order = list(STORAGE)
    excluded = ["Region"]
    f = OrderFrame(order, True, dimensions_to_exclude=excluded)
    order.append("Mutated")
    excluded.append("Product")
    assert f.storage_order == STORAGE
    assert f.movable_dimensions() == ["Year", "Product", "Account"]
