"""The cross-version gate: v11 and v12 must agree, mode for mode.

Builds a byte-identical 8-dimension cube with the same seeded data on both
instances, runs every OptimusPy mode against each, and compares the winning
storage order each mode picked. Identical data on identical dimensions must
produce an identical winner; a divergence means a version difference has reached
the search, not the server.

It also proves the Unit->bytes conversion end to end: the original-order RAM
both runs measured must agree within tolerance. v11 reports B and v12 reports
KB, so a conversion error shows up as a factor of about 1024 rather than as
anything subtle.

Needs BOTH instances, and takes minutes:

    pytest -m live --v11 tm1srv01 --v12 tm1srv02

Run it before a merge that touches the search, the metrics read or the executors.
"""
import pytest

from tests.conftest import sample_module

pytestmark = pytest.mark.live


@pytest.fixture(scope="module")
def instances(request):
    v11 = request.config.getoption("--v11")
    v12 = request.config.getoption("--v12")
    if not (v11 and v12):
        pytest.skip("the parity gate needs both --v11 and --v12")
    return v11, v12


def test_both_versions_pick_the_same_winner_in_every_mode(instances, tm1_config_path):
    parity = sample_module("validate_v11_v12_parity")
    v11_name, v12_name = instances

    snapshot = {
        "v11": parity.process_instance(v11_name, tm1_config_path, None, do_setup=True),
        "v12": parity.process_instance(v12_name, tm1_config_path, None, do_setup=True),
    }
    try:
        # compare() prints a per-mode table and returns the verdict; the printed
        # detail is what makes a failure actionable, so it is not re-derived here.
        assert parity.compare(snapshot["v11"], snapshot["v12"])
    finally:
        for name in (v11_name, v12_name):
            _teardown(parity, tm1_config_path, name)


def _teardown(parity, config_ini, instance):
    from TM1py import TM1Service

    args = dict(parity.get_tm1_config(config_ini)[instance])
    args["session_context"] = "optimuspy-parity"
    with TM1Service(**args) as tm1:
        parity.teardown_instance(tm1)
