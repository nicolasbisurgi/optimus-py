"""Shared test plumbing.

The suite is split in two. **Offline** tests — the default run — make no
connection and use no fake TM1: they exercise the frame, the sweep arithmetic
and the result chain directly. **Live** tests carry `@pytest.mark.live` and are
deselected unless asked for:

    pytest -m live --instance tm1srv01     # v11
    pytest -m live --instance tm1srv02     # v12

They connect with a real `TM1Service`; there is deliberately no fake to fall
back on, so a live test that cannot reach its server skips rather than passing
against a simulation.
"""
import types

import pytest

from optimuspy.execution_mode import ExecutionMode
from optimuspy.results import ExecutionContext, PermutationResult


# --- live suite plumbing ---------------------------------------------------

def pytest_addoption(parser):
    parser.addoption(
        "--instance", action="store", default=None,
        help="config.ini section a live test connects to, e.g. tm1srv01 (v11) or tm1srv02 (v12)")
    parser.addoption(
        "--tm1-config", action="store", default="config/config.ini",
        help="path to the config.ini holding the --instance section")


@pytest.fixture(scope="session")
def live_instance(request):
    """The instance name a live test connects to, or a skip when none was named."""
    instance = request.config.getoption("--instance")
    if not instance:
        pytest.skip("live test needs --instance (e.g. --instance tm1srv01)")
    return instance


@pytest.fixture(scope="session")
def tm1_config_path(request):
    return request.config.getoption("--tm1-config")


@pytest.fixture(scope="session")
def tm1_connection_args(live_instance, tm1_config_path):
    """Connection kwargs for `live_instance`, straight out of the real config.ini."""
    from optimuspy.core import get_tm1_config

    config = get_tm1_config(tm1_config_path)
    if not config.has_section(live_instance):
        pytest.skip(f"no [{live_instance}] section in {tm1_config_path}")
    args = dict(config[live_instance])
    args["session_context"] = "optimuspy-tests"
    return args


@pytest.fixture(scope="session")
def tm1(tm1_connection_args):
    """A real TM1Service. No fake stands in for this — the test skips instead."""
    from TM1py import TM1Service

    try:
        service = TM1Service(**tm1_connection_args)
    except Exception as e:  # unreachable host, bad credentials, TLS…
        pytest.skip(f"cannot reach TM1: {e}")
    with service:
        yield service


@pytest.fixture(scope="session")
def is_v12(tm1):
    from optimuspy.metrics import detect_is_v12

    return detect_is_v12(tm1)


# --- offline plumbing ------------------------------------------------------

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
