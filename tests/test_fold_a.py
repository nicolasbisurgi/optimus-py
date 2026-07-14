from optimuspy.execution_mode import ExecutionMode
from optimuspy.results import ExecutionContext
from optimuspy.executors import MainExecutor


def make_main_executor(dims, cardinality, *, fast=False, string_dims=None,
                       view_names=None, process_names=None, measure_only_numeric=True):
    ex = object.__new__(MainExecutor)
    ex.context = ExecutionContext()
    ex.mode = ExecutionMode.ITERATIONS
    ex.cube_name = "C"
    ex.view_names = view_names or []
    ex.process_names = process_names or []
    ex.include_process = bool(ex.process_names)
    ex.dimensions = list(dims)
    ex.cube_dim_number = len(dims)
    ex.executions = 1
    ex.measure_dimension_only_numeric = measure_only_numeric
    ex.fast = fast
    ex.dimensions_to_exclude = []
    ex.orders_to_ignore = []
    ex.dimension_position_rules = []
    ex.cancel_event = ex.checkpoint_manager = None
    ex.cardinality = dict(cardinality)
    ex.string_dims = set(string_dims or [])
    ex._resumed_results = []
    ex._original_order_result = None
    ex._initial_dimension_order = None
    return ex


def test_main_executor_stores_cardinality_and_string_dims():
    ex = make_main_executor(["A", "B"], {"A": 10, "B": 20}, string_dims=["B"])
    assert ex.cardinality == {"A": 10, "B": 20}
    assert ex.string_dims == {"B"}


def test_main_executor_constructor_accepts_cardinality_kwargs():
    ex = MainExecutor(
        tm1=None, cube_name="C", view_names=[], process_names=[],
        dimensions=["A", "B"], executions=1, measure_dimension_only_numeric=True,
        context=ExecutionContext(), cardinality={"A": 10, "B": 20}, string_dims=["B"])
    assert ex.cardinality == {"A": 10, "B": 20}
    assert ex.string_dims == {"B"}


def test_fold_a_pins_dominant_dim_to_back_with_one_reorder(scripted):
    # 4 sparse dims + numeric measure. Dim "Big" (50000) dominates all by >> τ.
    # measure_only_numeric=True keeps M fully in the swappable pool, so the true
    # back-most slot is index len(dims)-1 (not "just before" a fixed measure).
    dims = ["D1", "D2", "D3", "Big", "M"]
    card = {"D1": 100, "D2": 120, "D3": 150, "Big": 50000, "M": 3}
    ex = make_main_executor(dims, card, measure_only_numeric=True)
    log = []
    # RAM: reward putting Big at the back.
    def ram_of(o):
        return 100.0 - (10.0 if o.index("Big") >= 3 else 0.0)
    scripted(ex, ram_of, log)
    ex.context.set_initial_ram(100.0)

    ex._run_fold_a()
    # Back-most open position's frontier is just Big -> the very first (and only)
    # evaluated reorder at that position already places it in the back-most slot.
    assert log[0].index("Big") == len(dims) - 1
    # Big is never test-swapped into a front position (theory-condemned, pruned):
    assert all(o.index("Big") >= 2 for o in log)


def test_fold_a_measures_near_tied_cluster_in_full(scripted):
    dims = ["A", "B", "C", "M"]
    card = {"A": 180, "B": 205, "C": 240, "M": 3}  # A,B,C all within 4x -> nothing decided
    ex = make_main_executor(dims, card)
    log = []
    scripted(ex, lambda o: 100.0 - len(log) * 0.1, log)
    ex.context.set_initial_ram(100.0)
    ex._run_fold_a()
    # Undecided cluster -> at the first (back-most, target_position=len(dims)-1)
    # position, all of A,B,C are swept in as candidates.
    first_back_orders = log[:3]
    placed_last_nonmeasure = {o[len(dims) - 1] for o in first_back_orders}
    assert placed_last_nonmeasure == {"A", "B", "C"}


def test_fold_a_query_front_uses_looser_tau(scripted):
    # With views, a front (query-ranked) position prunes with tau_query (10x), not
    # tau_ram (4x). Sm/Md sit at a 6x ratio: decided under tau_ram, undecided under
    # tau_query. F1 and F2 are back-dominant fillers and M is tiny (front-dominant)
    # padding, so Sm and Md only get compared against EACH OTHER once they reach a
    # front position — the outside-in walk resolves F1 (back), M (front), and F2
    # (back) first, since a walk always visits the back position before the paired
    # front position at each round, so a 2-dim (Sm, Md, M-only) setup could never
    # let Sm and Md coexist as front candidates: the back visit resolves them first.
    dims = ["Sm", "Md", "F1", "F2", "M"]
    card = {"Sm": 50, "Md": 300, "F1": 5_000_000, "F2": 2000, "M": 3}
    ex = make_main_executor(dims, card, view_names=["V"])
    log = []
    scripted(ex, lambda o: 100.0, log, query_of=lambda o: 1.0 + o.index("Sm") * 0.01)
    ex.context.set_initial_ram(100.0)
    ex._run_fold_a()
    # By the last front (query-ranked, target_position=1) position, only Sm and Md
    # remain unplaced; tau_query (10x > 6x) keeps both as candidates instead of
    # deciding on Md alone the way tau_ram would.
    front_candidates = {o[1] for o in log[-2:]}
    assert front_candidates == {"Sm", "Md"}
