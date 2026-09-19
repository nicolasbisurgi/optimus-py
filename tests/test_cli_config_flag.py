import sys

import pytest

from optimuspy.cli import main


def test_cli_missing_config_exits_1(monkeypatch, tmp_path, capsys):
    missing = tmp_path / "nope.ini"
    monkeypatch.setattr(
        sys, "argv",
        ["optimuspy", "scan", "--instance", "tm1srv01", "--config", str(missing)],
    )
    with pytest.raises(SystemExit) as exc:
        main()
    assert exc.value.code == 1
    assert "not found" in capsys.readouterr().out.lower()


def _write_config_ini(tmp_path):
    ini = tmp_path / "config.ini"
    ini.write_text("[tm1srv01]\naddress=localhost\nport=8001\nuser=admin\npassword=apple\nssl=True\n")
    return ini


def _run_cli(monkeypatch, tmp_path, cube_config):
    import json

    cube_json = tmp_path / "cube.json"
    cube_json.write_text(json.dumps(cube_config))
    monkeypatch.setattr(
        sys, "argv",
        ["optimuspy", "optimize", str(cube_json),
         "--config", str(_write_config_ini(tmp_path))],
    )
    return main()


def test_tier1_config_error_prints_the_message_without_a_traceback(
        monkeypatch, tmp_path, capsys):
    # A malformed predefined order is a config error. The operator — often a TI
    # process reading only stdout — gets the message and exit 1, not a stack
    # trace. Offline: validate_cube_config runs before any TM1 connection.
    code = _run_cli(monkeypatch, tmp_path, {
        "instance": "tm1srv01", "cube": "Sales", "executions": 1, "output": "csv",
        "predefined_orders": [["Time", "Time", "Region"]],
    })

    out = capsys.readouterr().out
    assert code == 1
    # One line, the whole report: the banner precedes it, nothing follows it.
    assert out.rstrip().splitlines()[-1].startswith("ERROR: ")
    assert "repeats" in out
    assert "Traceback" not in out


def test_a_tier1_failure_raised_inside_the_run_is_caught_too(
        monkeypatch, tmp_path, capsys):
    # _validate_predefined_orders needs the cube's real dimension list, so it
    # raises from inside run_optimize rather than from validate_cube_config.
    # Both must reach the operator the same way.
    def _raises(**kwargs):
        raise ValueError("'predefined_orders[0]' names 'Prodcut', which is not a "
                         "dimension of cube 'Sales'")

    monkeypatch.setattr("optimuspy.cli.run_optimize", _raises)
    code = _run_cli(monkeypatch, tmp_path, {
        "instance": "tm1srv01", "cube": "Sales", "executions": 1, "output": "csv",
        "predefined_orders": [["Prodcut"]],
    })

    out = capsys.readouterr().out
    assert code == 1
    assert "Prodcut" in out
    assert "Traceback" not in out
