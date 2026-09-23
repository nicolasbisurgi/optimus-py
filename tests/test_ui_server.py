"""The UI's HTTP layer, exercised through a real server on a free port.

Nothing here reaches TM1: the tests use endpoints that only touch config.ini and
the results folder, or jobs whose work is a stand-in function.
"""
import json
import urllib.error
import urllib.request

import pytest

INI = (
    "[prod]\n"
    "address=10.0.0.1\n"
    "port=12354\n"
    "user=admin\n"
    "password=s3cret\n"
    "api_key=k3y\n"
    "ssl=True\n"
)


def request(method, url, body=None, headers=None):
    """Send one request; returns (status, headers, body text) for any status."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, dict(resp.headers), resp.read().decode()
    except urllib.error.HTTPError as e:
        with e:
            return e.code, dict(e.headers), e.read().decode()


def _port(base):
    return base.rsplit(":", 1)[1]


def test_a_request_from_another_origin_is_refused(ui_server):
    base, _ = ui_server(INI)
    status, headers, _ = request("GET", f"{base}/api/instance/prod",
                                 headers={"Origin": "https://evil.example"})
    assert status == 403
    assert "Access-Control-Allow-Origin" not in headers


def test_a_request_for_another_host_is_refused(ui_server):
    # A DNS-rebinding page reaches 127.0.0.1 under its own host name.
    base, _ = ui_server(INI)
    status, _, _ = request("GET", f"{base}/api/instances",
                           headers={"Host": f"attacker.example:{_port(base)}"})
    assert status == 403


@pytest.mark.parametrize("name", ["127.0.0.1", "localhost"])
def test_the_page_itself_is_answered_under_either_loopback_name(ui_server, name):
    base, _ = ui_server(INI)
    own = f"{name}:{_port(base)}"
    # DELETE of a config that does not exist: reaching the handler means a 404.
    status, headers, _ = request("DELETE", f"{base}/api/config/none.json",
                                 headers={"Host": own, "Origin": f"http://{own}"})
    assert status == 404
    assert "Access-Control-Allow-Origin" not in headers


def test_a_cross_origin_preflight_is_refused(ui_server):
    base, _ = ui_server(INI)
    status, headers, _ = request("OPTIONS", f"{base}/api/instance/prod", headers={
        "Origin": "https://evil.example",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })
    assert status == 403
    assert "Access-Control-Allow-Methods" not in headers


def test_stored_secrets_are_never_sent_to_the_page(ui_server):
    base, _ = ui_server(INI)
    status, _, text = request("GET", f"{base}/api/instance/prod")
    params = json.loads(text)["params"]
    assert status == 200
    assert params["address"] == "10.0.0.1"
    assert "password" not in params
    assert "api_key" not in params


def test_saving_an_instance_without_its_secrets_keeps_them(ui_server):
    base, ini = ui_server(INI)
    status, _, _ = request("POST", f"{base}/api/instance/prod", body={"params": {"port": "9999"}})
    text = ini.read_text(encoding="utf-8")
    assert status == 200
    assert "port = 9999" in text
    assert "password = s3cret" in text
    assert "api_key = k3y" in text
