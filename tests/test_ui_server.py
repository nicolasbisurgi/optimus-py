"""The UI's HTTP layer, exercised through a real server on a free port.

Nothing here reaches TM1: the tests use endpoints that only touch config.ini and
the results folder, or jobs whose work is a stand-in function.
"""
import json
import logging
import threading
import time
import urllib.error
import urllib.request

import pytest

from optimuspy import ui
from optimuspy.executors import OptimizationCancelled

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


# --- jobs --------------------------------------------------------------------

def wait_done(job, timeout=5):
    deadline = time.time() + timeout
    while job.status == "running":
        assert time.time() < deadline, "job did not finish"
        time.sleep(0.01)


def _kinds(job):
    events, _ = job.events_after(0, timeout=0)
    return [e["event"] for e in events if e["event"] != "log"]


def test_a_job_ends_with_one_final_event_carrying_its_status():
    jobs = ui.JobManager()

    def work(job):
        job.emit("progress", {"step": 1})
        return "completed", {"success": True}

    job = jobs.get(jobs.start("optimize", "Sales", "prod", work))
    wait_done(job)
    events, done = job.events_after(0, timeout=0)
    assert done
    assert _kinds(job) == ["progress", "complete"]
    assert events[-1]["data"] == {"success": True, "status": "completed"}


def test_reading_the_log_does_not_consume_it():
    jobs = ui.JobManager()
    job = jobs.get(jobs.start("optimize", "Sales", "prod", lambda job: ("completed", {})))
    wait_done(job)
    first, _ = job.events_after(0, timeout=0)
    second, _ = job.events_after(0, timeout=0)
    tail, done = job.events_after(len(first) - 1, timeout=0)
    assert first == second
    assert done and tail == first[-1:]


def test_a_raised_cancel_ends_the_job_as_cancelled():
    jobs = ui.JobManager()

    def work(job):
        raise OptimizationCancelled()

    job = jobs.get(jobs.start("optimize", "Sales", "prod", work))
    wait_done(job)
    assert job.status == "cancelled"
    assert _kinds(job)[-1] == "cancelled"


def test_an_error_ends_the_job_as_failed_with_its_message():
    jobs = ui.JobManager()

    def work(job):
        raise RuntimeError("boom")

    job = jobs.get(jobs.start("optimize", "Sales", "prod", work))
    wait_done(job)
    events, _ = job.events_after(0, timeout=0)
    assert job.status == "failed" and job.error == "boom"
    assert events[-1] == {"event": "error_event", "data": {"error": "boom", "status": "failed"}}


def test_only_one_job_runs_at_a_time():
    jobs = ui.JobManager()
    gate = threading.Event()

    def slow(job):
        gate.wait(5)
        return "completed", {}

    first = jobs.get(jobs.start("optimize", "A", "prod", slow))
    with pytest.raises(RuntimeError):
        jobs.start("optimize", "B", "prod", lambda job: ("completed", {}))
    gate.set()
    wait_done(first)
    jobs.start("optimize", "B", "prod", lambda job: ("completed", {}))  # free again


class _Monitoring:
    def __init__(self):
        self.cancelled = []

    def get_active_session_threads(self):
        return [{"ID": 7}]

    def cancel_thread(self, thread_id):
        self.cancelled.append(thread_id)


class _Service:
    def __init__(self):
        self.monitoring = _Monitoring()


def test_stop_aborts_server_threads_only_for_work_that_published_its_service():
    jobs = ui.JobManager()
    published, unpublished = _Service(), _Service()

    def benchmark(job):  # single-cube Optimize: a query in flight is safe to abort
        job.tm1_holder["tm1"] = published
        job.cancel_event.wait(5)
        return "cancelled", {}

    job = jobs.get(jobs.start("optimize", "Sales", "prod", benchmark))
    while "tm1" not in job.tm1_holder:
        time.sleep(0.01)
    assert jobs.cancel(job.job_id)
    wait_done(job)
    assert published.monitoring.cancelled == [7]

    def rebuild(job):  # a storage reorder in flight must be left to finish
        job.cancel_event.wait(5)
        return "cancelled", {}

    job = jobs.get(jobs.start("optimize-db", "plan", "prod", rebuild))
    assert jobs.cancel(job.job_id)
    wait_done(job)
    assert unpublished.monitoring.cancelled == []
    assert job.status == "cancelled"


def read_stream(url, headers=None):
    """A finished job's stream, as (id, event, data) triples, heartbeats dropped."""
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=10) as resp:
        text = resp.read().decode()
    events = []
    for block in text.strip().split("\n\n"):
        fields = dict(line.split(": ", 1) for line in block.splitlines() if not line.startswith(":"))
        if "event" in fields:
            events.append((int(fields["id"]), fields["event"], json.loads(fields["data"])))
    return events


def test_a_stream_replays_the_log_and_resumes_after_the_last_event_seen(ui_server, monkeypatch):
    base, _ = ui_server(INI)
    jobs = ui.JobManager()
    monkeypatch.setattr(ui, "job_manager", jobs)

    def work(job):
        for i in range(3):
            job.emit("progress", {"i": i})
        return "completed", {}

    job = jobs.get(jobs.start("transfer", "3 cubes", "prod", work))
    wait_done(job)
    url = f"{base}/api/job/{job.job_id}/stream"
    full = read_stream(url)
    assert [e[1] for e in full if e[1] != "log"] == ["progress", "progress", "progress", "complete"]
    assert [e[0] for e in full] == list(range(1, len(full) + 1))
    assert read_stream(url, headers={"Last-Event-ID": "2"})[0][0] == 3
    assert read_stream(url + "?after=2")[0][0] == 3


# --- concurrency ---------------------------------------------------------------

def _hold_until_cancelled(job):
    job.cancel_event.wait(10)
    return "cancelled", {}


def test_stop_reaches_a_job_while_its_stream_is_open(ui_server, monkeypatch):
    base, _ = ui_server(INI)
    jobs = ui.JobManager()
    monkeypatch.setattr(ui, "job_manager", jobs)
    job_id = jobs.start("optimize-db", "plan", "prod", _hold_until_cancelled)
    stream = urllib.request.urlopen(f"{base}/api/job/{job_id}/stream", timeout=10)
    try:
        started = time.time()
        status, _, _ = request("POST", f"{base}/api/job/{job_id}/cancel")
        assert status == 200
        assert time.time() - started < 2
        assert "event: complete" in stream.read().decode()
    finally:
        stream.close()


def test_two_open_streams_each_receive_the_whole_log(ui_server, monkeypatch):
    base, _ = ui_server(INI)
    jobs = ui.JobManager()
    monkeypatch.setattr(ui, "job_manager", jobs)
    gate = threading.Event()

    def work(job):
        gate.wait(10)
        job.emit("progress", {"cube": "Sales"})
        return "completed", {}

    job_id = jobs.start("transfer", "1 cubes", "prod", work)
    url = f"{base}/api/job/{job_id}/stream"
    first = urllib.request.urlopen(url, timeout=10)
    second = urllib.request.urlopen(url, timeout=10)
    gate.set()
    for stream in (first, second):
        with stream:
            text = stream.read().decode()
        assert "event: progress" in text
        assert "event: complete" in text


def test_a_request_that_logs_during_a_job_stays_out_of_the_job_log(ui_server, monkeypatch, caplog):
    caplog.set_level(logging.INFO)
    base, _ = ui_server(INI)
    jobs = ui.JobManager()
    monkeypatch.setattr(ui, "job_manager", jobs)
    gate = threading.Event()

    def work(job):
        logging.info("from the job")
        gate.wait(10)
        return "completed", {}

    def noisy_validate(config, mode):
        logging.info("from a request")
        raise ValueError("not valid")

    monkeypatch.setattr(ui, "validate_cube_config", noisy_validate)
    job = jobs.get(jobs.start("optimize", "Sales", "prod", work))
    request("POST", f"{base}/api/validate", body={"config": {"cube": "Sales"}})
    gate.set()
    wait_done(job)
    events, _ = job.events_after(0, timeout=0)
    messages = [e["data"]["message"] for e in events if e["event"] == "log"]
    assert "from the job" in messages
    assert "from a request" not in messages
