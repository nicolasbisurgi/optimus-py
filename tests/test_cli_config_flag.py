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
