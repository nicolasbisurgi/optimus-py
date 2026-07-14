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
