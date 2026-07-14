from optimuspy import tau
from optimuspy.checkpoint import CheckpointManager, CHECKPOINT_VERSION


def test_checkpoint_version_is_two():
    assert CHECKPOINT_VERSION == 2


def test_fingerprint_changes_with_tau():
    cfg = {"cube": "C", "fast": False}
    a = CheckpointManager.compute_config_fingerprint(cfg, extra={"tau_ram": 4.0})
    b = CheckpointManager.compute_config_fingerprint(cfg, extra={"tau_ram": 5.0})
    assert a != b


def test_fingerprint_changes_with_fold():
    thorough = CheckpointManager.compute_config_fingerprint({"cube": "C", "fast": False})
    fast = CheckpointManager.compute_config_fingerprint({"cube": "C", "fast": True})
    assert thorough != fast


def test_fingerprint_stable_for_same_inputs():
    cfg = {"cube": "C", "fast": False}
    extra = {"tau_ram": tau.TAU_RAM, "tau_query": tau.TAU_QUERY}
    assert (CheckpointManager.compute_config_fingerprint(cfg, extra)
            == CheckpointManager.compute_config_fingerprint(cfg, extra))
