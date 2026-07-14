from optimuspy.results import ExecutionContext


def test_scripted_evaluator_reproduces_ram_through_the_percent_chain(scripted):
    # Build a bare object with just the attributes the scripted evaluator touches.
    import types
    from optimuspy.execution_mode import ExecutionMode

    class Dummy:
        pass

    d = Dummy()
    d.context = ExecutionContext()
    d.mode = ExecutionMode.ITERATIONS
    d.cube_name = "C"
    d.view_names = []
    d.process_names = []

    ram = {("A", "B"): 100.0, ("B", "A"): 80.0}
    log = []
    scripted(d, lambda o: ram[o], log)

    first = d._evaluate_permutation(["A", "B"], is_original_order=True)
    second = d._evaluate_permutation(["B", "A"])
    assert first.ram_usage == 100.0
    assert round(second.ram_usage, 6) == 80.0          # derived via % chain
    assert log == [["A", "B"], ["B", "A"]]


from optimuspy.execution_mode import ExecutionMode
from optimuspy.results import ExecutionContext
from optimuspy.executors import OptipyzerExecutor


def _bare_executor(view_names=None, process_names=None):
    ex = object.__new__(OptipyzerExecutor)
    ex.context = ExecutionContext()
    ex.mode = ExecutionMode.ITERATIONS
    ex.cube_name = "C"
    ex.view_names = view_names or []
    ex.process_names = process_names or []
    ex.cancel_event = None
    ex.checkpoint_manager = None
    return ex


def test_sweep_into_position_evaluates_each_candidate_by_swapping(scripted):
    ex = _bare_executor()
    order = ["A", "B", "C", "M"]
    ram = {tuple(order): 100.0}
    # swapping D into last non-measure position 2:
    ram[("A", "C", "B", "M")] = 90.0   # B->C swap
    ram[("A", "B", "C", "M")] = 100.0
    log = []
    scripted(ex, lambda o: ram.get(o, 100.0), log)
    ex.context.set_initial_ram(100.0)

    results = ex._sweep_into_position(order, target_position=1, candidate_dims=["B", "C"],
                                      total_permutations=2)
    assert [r.dimension_order for r in results] == [["A", "B", "C", "M"], ["A", "C", "B", "M"]]


def test_sweep_into_position_honours_skip_candidate(scripted):
    ex = _bare_executor()
    order = ["A", "B", "C", "M"]
    log = []
    scripted(ex, lambda o: 100.0, log)
    ex.context.set_initial_ram(100.0)
    ex._sweep_into_position(order, 3, ["A", "B", "C"], total_permutations=3,
                            skip_candidate=lambda dim, pos: dim == "B")
    assert ["A", "B", "C", "M"] not in [o for o in log if o[3] == "B"]  # B never placed last


def test_pick_best_ram(scripted):
    ex = _bare_executor()
    log = []
    ram = {("A", "B"): 100.0, ("B", "A"): 70.0}
    scripted(ex, lambda o: ram[o], log)
    ex.context.set_initial_ram(100.0)
    r1 = ex._evaluate_permutation(["A", "B"], is_original_order=True)
    r2 = ex._evaluate_permutation(["B", "A"])
    assert ex._pick_best([r1, r2], "ram").dimension_order == ["B", "A"]
