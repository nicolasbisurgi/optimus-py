import types

import pytest

from optimuspy.execution_mode import ExecutionMode
from optimuspy.results import ExecutionContext, PermutationResult


def install_scripted_evaluator(executor, ram_of, evaluated_log, query_of=None):
    """Replace executor._evaluate_permutation with a TM1-free scripted version.

    ram_of:    Callable[[tuple[str, ...]], float] -> target RAM bytes for an order.
    query_of:  optional Callable[[tuple[str, ...]], float] -> composite query time.
    evaluated_log: list; each evaluated permutation (list of names) is appended.
    """
    view = executor.view_names[0] if executor.view_names else "__scripted__"

    def _scripted(self, permutation, retrieve_ram=False,
                  is_original_order=False, total_permutations=None):
        order = list(permutation)
        evaluated_log.append(order)
        target = ram_of(tuple(order))
        qtv = {view: [query_of(tuple(order))]} if query_of else {}
        if is_original_order or self.context.current_ram is None:
            return PermutationResult(
                self.context, self.mode, self.cube_name, self.view_names,
                self.process_names, order, qtv, None,
                ram_usage=target, ram_percentage_change=None, reorder_duration=0.0)
        pct = (target / self.context.current_ram - 1.0) * 100.0
        return PermutationResult(
            self.context, self.mode, self.cube_name, self.view_names,
            self.process_names, order, qtv, None,
            ram_usage=None, ram_percentage_change=pct, reorder_duration=0.0)

    executor._evaluate_permutation = types.MethodType(_scripted, executor)


@pytest.fixture
def scripted():
    return install_scripted_evaluator
