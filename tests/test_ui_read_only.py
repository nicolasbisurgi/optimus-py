import json
import urllib.error
import urllib.request

import pytest

ORIGINAL_INI = (
    "[tm1srv01]\n"
    "address=localhost\n"
    "port=8001\n"
    "user=admin\n"
    "password=secret\n"
    "ssl=True\n"
)


def _request(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        with e:
            return e.code, json.loads(e.read().decode())


def test_instances_endpoint_reports_read_only(ui_server):
    base, _ = ui_server(ORIGINAL_INI, read_only=True)
    status, payload = _request("GET", f"{base}/api/instances")
    assert status == 200
    assert payload["read_only"] is True
    assert "tm1srv01" in payload["instances"]


@pytest.mark.parametrize("method,path,body", [
    ("POST", "/api/instances", {"name": "new", "params": {}}),
    ("POST", "/api/instance/tm1srv01", {"params": {"port": "9999"}}),
    ("DELETE", "/api/instance/tm1srv01", None),
    ("DELETE", "/api/instance/tm1srv01/field/port", None),
])
def test_write_endpoints_blocked_when_read_only(ui_server, method, path, body):
    base, cfg = ui_server(ORIGINAL_INI, read_only=True)
    status, payload = _request(method, f"{base}{path}", body)
    assert status == 403
    assert "read-only" in payload["error"].lower()
    assert cfg.read_text(encoding="utf-8") == ORIGINAL_INI  # file untouched
