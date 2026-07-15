import pytest

from optimuspy.core import ConfigLocation, DEFAULT_CONFIG_INI, resolve_config_path


def test_resolve_none_returns_writable_default():
    loc = resolve_config_path(None)
    assert loc == ConfigLocation(DEFAULT_CONFIG_INI, read_only=False)


def test_resolve_existing_path_is_read_only(tmp_path):
    cfg = tmp_path / "shared.ini"
    cfg.write_text("[tm1srv01]\naddress=localhost\n", encoding="utf-8")
    loc = resolve_config_path(str(cfg))
    assert loc.path == str(cfg)
    assert loc.read_only is True


def test_resolve_missing_path_raises(tmp_path):
    missing = tmp_path / "nope.ini"
    with pytest.raises(FileNotFoundError):
        resolve_config_path(str(missing))
