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
