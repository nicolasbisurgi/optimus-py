"""
OptimusPy Workflow UI — Lightweight local web interface for the scan → optimize → set pipeline.

Usage:
    python ui.py                                    # localhost:8765, default config.ini
    python ui.py --port 9000                        # custom port
    python ui.py --config config/production.ini     # custom config.ini
"""

import argparse
import json
import logging
import queue
import re
import sys
import threading
import time
import uuid
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, unquote

from TM1py import TM1Service

from optimuspy.core import (
    get_tm1_config, validate_cube_config,
    main as run_optimuspy, _scan_to_data_light, APP_NAME, get_logfile_path, RESULT_PATH,
    set_current_directory, _collect_dimension_metadata, _compute_suggested_order,
    resolve_config_path
)
from optimuspy.executors import OptimizationCancelled
from optimuspy.metrics import detect_is_v12

DEFAULT_PORT = 8765
DEFAULT_CONFIG_INI = "config/config.ini"

# Global state
_config_ini_path = DEFAULT_CONFIG_INI
_config_read_only = False


def _resolve_static_dir() -> Path:
    """Resolve the static/ directory — works for pip install and PyInstaller frozen exe."""
    return Path(__file__).parent / "static"


def _create_tm1_connection(instance_name: str, password: str = None):
    config = get_tm1_config(_config_ini_path)
    tm1_args = dict(config[instance_name])
    tm1_args['session_context'] = APP_NAME
    if password:
        tm1_args['password'] = password
        tm1_args['decode_b64'] = False
    return TM1Service(**tm1_args)


# ---------------------------------------------------------------------------
# Job Manager — tracks background optimize/set jobs with SSE progress
# ---------------------------------------------------------------------------

class JobLogHandler(logging.Handler):
    """Routes log records to a job's progress queue for SSE streaming."""

    def __init__(self, progress_queue: queue.Queue):
        super().__init__()
        self.progress_queue = progress_queue

    def emit(self, record):
        try:
            self.progress_queue.put({
                "event": "log",
                "data": {
                    "timestamp": time.strftime("%H:%M:%S"),
                    "level": record.levelname,
                    "message": record.getMessage()
                }
            })
        except Exception:
            pass


class JobManager:
    """Manages background optimize/set jobs."""

    def __init__(self):
        self._lock = threading.Lock()
        self._jobs = {}
        self._active_job_id = None

    def start_job(self, mode: str, cube_config: dict, password: str = None) -> str:
        with self._lock:
            if self._active_job_id and self._jobs[self._active_job_id]["status"] == "running":
                raise RuntimeError("A job is already running")

            job_id = str(uuid.uuid4())[:8]
            progress_q = queue.Queue()

            cancel_event = threading.Event()
            tm1_holder = {}  # populated by core.main() with {"tm1": TM1Service}
            job = {
                "job_id": job_id,
                "status": "running",
                "mode": mode,
                "cube_name": cube_config.get("cube", "unknown"),
                "instance": cube_config.get("instance", "unknown"),
                "progress_queue": progress_q,
                "cancel_event": cancel_event,
                "tm1_holder": tm1_holder,
                "started_at": time.time(),
                "completed_at": None,
                "result_files": [],
                "error": None,
                "final_event": None,
            }
            self._jobs[job_id] = job
            self._active_job_id = job_id

            thread = threading.Thread(
                target=self._run_job,
                args=(job_id, mode, cube_config, password),
                daemon=True
            )
            thread.start()
            return job_id

    def _run_job(self, job_id: str, mode: str, cube_config: dict, password: str):
        job = self._jobs[job_id]
        handler = JobLogHandler(job["progress_queue"])
        handler.setLevel(logging.INFO)
        root_logger = logging.getLogger()
        root_logger.addHandler(handler)

        try:
            success = run_optimuspy(
                mode=mode,
                cube_config=cube_config,
                config_ini_path=_config_ini_path,
                password=password,
                cancel_event=job["cancel_event"],
                tm1_holder=job["tm1_holder"],
            )

            # Find result files (search both top-level legacy files and instance subdirs)
            cube_name = cube_config.get("cube", "")
            instance_name = cube_config.get("instance", "")
            result_files = []
            if RESULT_PATH.exists():
                candidates = [f for f in RESULT_PATH.rglob("*") if f.is_file()]
                for f in sorted(candidates, key=lambda x: x.stat().st_mtime, reverse=True):
                    if f.name.startswith("checkpoint"):
                        continue
                    # Match new format (<instance>_<cube>_<ts>) or legacy (<cube>_<ts>)
                    if f.name.startswith(f"{instance_name}_{cube_name}_") or f.name.startswith(f"{cube_name}_"):
                        rel = f.relative_to(RESULT_PATH).as_posix()
                        result_files.append(rel)
                        if len(result_files) >= 4:
                            break

            final_event = {
                "event": "complete",
                "data": {"success": success, "result_files": result_files}
            }

            with self._lock:
                job["status"] = "completed" if success else "failed"
                job["result_files"] = result_files
                job["final_event"] = final_event

            job["progress_queue"].put(final_event)
        except OptimizationCancelled:
            logging.info("Optimization cancelled by user")
            final_event = {
                "event": "cancelled",
                "data": {"message": "Optimization cancelled by user"}
            }
            with self._lock:
                job["status"] = "cancelled"
                job["final_event"] = final_event

            job["progress_queue"].put(final_event)
        except Exception as e:
            final_event = {
                "event": "error_event",
                "data": {"error": str(e)}
            }
            with self._lock:
                job["status"] = "failed"
                job["error"] = str(e)
                job["final_event"] = final_event

            job["progress_queue"].put(final_event)
        finally:
            with self._lock:
                job["completed_at"] = time.time()
            job["progress_queue"].put(None)  # Sentinel
            root_logger.removeHandler(handler)
            with self._lock:
                if self._active_job_id == job_id:
                    self._active_job_id = None

    def start_transfer_job(self, instance: str, orders: dict, password: str = None) -> str:
        with self._lock:
            if self._active_job_id and self._jobs[self._active_job_id]["status"] == "running":
                raise RuntimeError("A job is already running")

            job_id = str(uuid.uuid4())[:8]
            progress_q = queue.Queue()
            job = {
                "job_id": job_id,
                "status": "running",
                "mode": "transfer",
                "cube_name": f"{len(orders)} cubes",
                "instance": instance,
                "progress_queue": progress_q,
                "cancel_event": threading.Event(),
                "tm1_holder": {},
                "started_at": time.time(),
                "completed_at": None,
                "result_files": [],
                "error": None,
                "final_event": None,
            }
            self._jobs[job_id] = job
            self._active_job_id = job_id

            thread = threading.Thread(
                target=self._run_transfer_job,
                args=(job_id, instance, orders, password),
                daemon=True,
            )
            thread.start()
            return job_id

    def _run_transfer_job(self, job_id: str, instance: str, orders: dict, password: str):
        job = self._jobs[job_id]
        handler = JobLogHandler(job["progress_queue"])
        handler.setLevel(logging.INFO)
        root_logger = logging.getLogger()
        root_logger.addHandler(handler)

        results = []
        try:
            with _create_tm1_connection(instance, password) as tm1:
                total = len(orders)
                for idx, (cube_name, dim_order) in enumerate(orders.items(), 1):
                    job["progress_queue"].put({
                        "event": "applying",
                        "data": {"cube": cube_name, "index": idx, "total": total}
                    })
                    try:
                        tm1.cubes.update_storage_dimension_order(cube_name, dim_order)
                        results.append({"cube": cube_name, "success": True})
                        logging.info(f"Applied dimension order to '{cube_name}' ({idx}/{total})")
                    except Exception as e:
                        results.append({"cube": cube_name, "success": False, "error": str(e)})
                        logging.error(f"Failed to apply order to '{cube_name}': {e}")

                    job["progress_queue"].put({
                        "event": "applied",
                        "data": results[-1]
                    })

            final_event = {
                "event": "complete",
                "data": {"results": results}
            }
            with self._lock:
                job["status"] = "completed"
                job["final_event"] = final_event
            job["progress_queue"].put(final_event)

        except Exception as e:
            final_event = {
                "event": "error_event",
                "data": {"error": str(e)}
            }
            with self._lock:
                job["status"] = "failed"
                job["error"] = str(e)
                job["final_event"] = final_event
            job["progress_queue"].put(final_event)

        finally:
            with self._lock:
                job["completed_at"] = time.time()
            job["progress_queue"].put(None)  # Sentinel
            root_logger.removeHandler(handler)
            with self._lock:
                if self._active_job_id == job_id:
                    self._active_job_id = None

    def cancel_job(self, job_id: str) -> bool:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job or job["status"] != "running":
                return False
            job["cancel_event"].set()
            tm1_holder = job.get("tm1_holder", {})

        # Cancel active TM1 threads outside the lock (network call)
        tm1 = tm1_holder.get("tm1")
        if tm1:
            try:
                threads = tm1.monitoring.get_active_session_threads()
                for t in threads:
                    try:
                        tm1.monitoring.cancel_thread(t["ID"])
                    except Exception:
                        pass
            except Exception:
                pass
        return True

    def get_job(self, job_id: str) -> dict:
        return self._jobs.get(job_id)

    def list_jobs(self) -> list:
        with self._lock:
            jobs = []
            for j in self._jobs.values():
                jobs.append({
                    "job_id": j["job_id"],
                    "status": j["status"],
                    "mode": j["mode"],
                    "cube_name": j["cube_name"],
                    "instance": j["instance"],
                    "started_at": j["started_at"],
                    "completed_at": j["completed_at"],
                    "result_files": j["result_files"],
                    "error": j["error"],
                })
            return sorted(jobs, key=lambda x: x["started_at"], reverse=True)


# Singleton
job_manager = JobManager()


# ---------------------------------------------------------------------------
# HTTP Request Handler
# ---------------------------------------------------------------------------

class OptimusPyHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        # Suppress default HTTP logging to avoid cluttering the console
        pass

    def _send_json(self, status: int, data: dict):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)


    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length))

    # ---- Routing ----

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path

        # Static file serving
        if path == "/":
            return self._serve_static_file("index.html")
        elif path.startswith("/static/"):
            return self._serve_static_file(path[len("/static/"):])
        elif path.startswith("/images/"):
            return self._serve_image_file(path[len("/images/"):])
        # API endpoints
        elif path == "/api/instances":
            return self._handle_instances()
        elif path.startswith("/api/instance/"):
            instance_name = unquote(path[len("/api/instance/"):])
            return self._handle_get_instance(instance_name)
        elif path == "/api/configs":
            return self._handle_list_configs()
        elif path == "/api/saved-cubes":
            return self._handle_list_saved_cubes()
        elif path == "/api/status":
            return self._handle_status()
        elif path == "/api/results":
            return self._handle_list_results()
        elif path.startswith("/api/result/"):
            return self._handle_serve_result(path[len("/api/result/"):])
        elif path == "/api/jobs":
            return self._handle_list_jobs()
        elif path.startswith("/api/job/") and path.endswith("/stream"):
            job_id = path[len("/api/job/"):-len("/stream")]
            return self._handle_job_stream(job_id)
        elif path.startswith("/api/job/"):
            job_id = path[len("/api/job/"):]
            return self._handle_get_job(job_id)
        else:
            self._send_json(404, {"error": "Not found"})

    def do_POST(self):
        path = urlparse(self.path).path

        try:
            body = self._read_body()
        except Exception as e:
            return self._send_json(400, {"error": f"Invalid JSON: {e}"})

        if path == "/api/connect":
            return self._handle_connect(body)
        elif path == "/api/scan":
            return self._handle_scan(body)
        elif path == "/api/cubes":
            return self._handle_cubes(body)
        elif path == "/api/views":
            return self._handle_views(body)
        elif path == "/api/processes":
            return self._handle_processes(body)
        elif path == "/api/dimensions":
            return self._handle_dimensions(body)
        elif path == "/api/config":
            return self._handle_save_config(body)
        elif path == "/api/validate":
            return self._handle_validate(body)
        elif path == "/api/job/start":
            return self._handle_start_job(body)
        elif path == "/api/process_parameters":
            return self._handle_process_parameters(body)
        elif path == "/api/cube_intelligence":
            return self._handle_cube_intelligence(body)
        elif path.startswith("/api/job/") and path.endswith("/cancel"):
            job_id = path.split("/")[3]
            return self._handle_cancel_job(job_id)
        elif path == "/api/instances":
            return self._handle_create_instance(body)
        elif path.startswith("/api/instance/"):
            instance_name = unquote(path[len("/api/instance/"):])
            return self._handle_update_instance(instance_name, body)
        elif path == "/api/transfer/scan":
            return self._handle_transfer_scan(body)
        elif path == "/api/transfer/target-orders":
            return self._handle_transfer_target_orders(body)
        elif path == "/api/transfer/apply":
            return self._handle_transfer_apply(body)
        elif path == "/api/transfer/export":
            return self._handle_transfer_export(body)
        else:
            self._send_json(404, {"error": "Not found"})

    def do_DELETE(self):
        path = urlparse(self.path).path
        if path.startswith("/api/config/"):
            filename = unquote(path[len("/api/config/"):])
            return self._handle_delete_config(filename)
        elif path.startswith("/api/instance/") and "/field/" in path:
            # DELETE /api/instance/<name>/field/<key>
            parts = path[len("/api/instance/"):].split("/field/", 1)
            instance_name = unquote(parts[0])
            field_key = unquote(parts[1])
            return self._handle_delete_instance_field(instance_name, field_key)
        elif path.startswith("/api/instance/"):
            instance_name = unquote(path[len("/api/instance/"):])
            return self._handle_delete_instance(instance_name)
        else:
            self._send_json(404, {"error": "Not found"})

    # ---- Static File Serving ----

    def _serve_static_file(self, filename: str):
        static_dir = _resolve_static_dir()
        # Sanitize: resolve and ensure the file is under static_dir
        try:
            requested = (static_dir / filename).resolve()
            if not str(requested).startswith(str(static_dir.resolve())):
                return self._send_json(403, {"error": "Forbidden"})
        except (ValueError, OSError):
            return self._send_json(400, {"error": "Invalid path"})

        if not requested.exists() or not requested.is_file():
            return self._send_json(404, {"error": "Not found"})

        content_types = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".ico": "image/x-icon",
            ".json": "application/json",
        }
        ct = content_types.get(requested.suffix.lower(), "application/octet-stream")

        with open(requested, "rb") as f:
            data = f.read()

        self.send_response(200)
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    def _serve_image_file(self, filename: str):
        images_dir = Path(__file__).parent / "images"
        try:
            requested = (images_dir / filename).resolve()
            if not str(requested).startswith(str(images_dir.resolve())):
                return self._send_json(403, {"error": "Forbidden"})
        except (ValueError, OSError):
            return self._send_json(400, {"error": "Invalid path"})

        if not requested.exists() or not requested.is_file():
            return self._send_json(404, {"error": "Not found"})

        content_types = {
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".ico": "image/x-icon",
        }
        ct = content_types.get(requested.suffix.lower(), "application/octet-stream")

        with open(requested, "rb") as f:
            data = f.read()

        self.send_response(200)
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "public, max-age=86400")
        self.end_headers()
        self.wfile.write(data)

    # ---- API Handlers ----

    def _handle_instances(self):
        try:
            config = get_tm1_config(_config_ini_path)
            instances = [s for s in config.sections()]
            self._send_json(200, {
                "instances": instances,
                "config_path": _config_ini_path,
                "read_only": _config_read_only,
            })
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_get_instance(self, instance_name: str):
        try:
            config = get_tm1_config(_config_ini_path)
            if instance_name not in config:
                return self._send_json(404, {"error": f"Instance '{instance_name}' not found"})
            params = dict(config[instance_name])
            self._send_json(200, {"instance": instance_name, "params": params})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_update_instance(self, instance_name: str, body: dict):
        if _config_read_only:
            return self._send_json(403, {"error":
                "This config.ini is managed externally and is read-only in OptimusPy."})
        try:
            config = get_tm1_config(_config_ini_path)
            if instance_name not in config:
                return self._send_json(404, {"error": f"Instance '{instance_name}' not found"})
            params = body.get("params", {})
            for key, value in params.items():
                config[instance_name][key] = str(value)
            with open(_config_ini_path, "w", encoding="utf-8") as f:
                config.write(f)
            self._send_json(200, {"success": True})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_create_instance(self, body: dict):
        if _config_read_only:
            return self._send_json(403, {"error":
                "This config.ini is managed externally and is read-only in OptimusPy."})
        name = body.get("name", "").strip()
        if not name:
            return self._send_json(400, {"error": "Missing 'name'"})
        if "]" in name:
            return self._send_json(400, {"error": "Instance name must not contain ']'"})
        try:
            config = get_tm1_config(_config_ini_path)
            if name in config:
                return self._send_json(409, {"error": f"Instance '{name}' already exists"})
            config.add_section(name)
            params = body.get("params", {})
            for key, value in params.items():
                config[name][key] = str(value)
            with open(_config_ini_path, "w", encoding="utf-8") as f:
                config.write(f)
            self._send_json(200, {"success": True})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_delete_instance(self, instance_name: str):
        if _config_read_only:
            return self._send_json(403, {"error":
                "This config.ini is managed externally and is read-only in OptimusPy."})
        try:
            config = get_tm1_config(_config_ini_path)
            if instance_name not in config:
                return self._send_json(404, {"error": f"Instance '{instance_name}' not found"})
            config.remove_section(instance_name)
            with open(_config_ini_path, "w", encoding="utf-8") as f:
                config.write(f)
            self._send_json(200, {"success": True})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_delete_instance_field(self, instance_name: str, field_key: str):
        if _config_read_only:
            return self._send_json(403, {"error":
                "This config.ini is managed externally and is read-only in OptimusPy."})
        try:
            config = get_tm1_config(_config_ini_path)
            if instance_name not in config:
                return self._send_json(404, {"error": f"Instance '{instance_name}' not found"})
            if field_key not in config[instance_name]:
                return self._send_json(404, {"error": f"Field '{field_key}' not found"})
            config.remove_option(instance_name, field_key)
            with open(_config_ini_path, "w", encoding="utf-8") as f:
                config.write(f)
            self._send_json(200, {"success": True})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_connect(self, body: dict):
        instance = body.get("instance")
        password = body.get("password")
        if not instance:
            return self._send_json(400, {"error": "Missing 'instance'"})
        try:
            with _create_tm1_connection(instance, password) as tm1:
                server_name = tm1.server.get_server_name()
                cubes = tm1.cubes.get_all_names()
                self._send_json(200, {
                    "success": True,
                    "server_name": server_name,
                    "cube_count": len(cubes),
                })
        except Exception as e:
            self._send_json(502, {"error": f"Connection failed: {e}"})

    def _handle_scan(self, body: dict):
        instance = body.get("instance")
        password = body.get("password")
        ram_percent = body.get("ram_percent", 60)
        include_optimized = body.get("include_optimized", False)
        if not instance:
            return self._send_json(400, {"error": "Missing 'instance'"})
        try:
            with _create_tm1_connection(instance, password) as tm1:
                is_v12 = detect_is_v12(tm1)
                data = _scan_to_data_light(tm1, instance, ram_percent, include_optimized, is_v12=is_v12)
                self._send_json(200, data)
        except Exception as e:
            self._send_json(500, {"error": f"Scan failed: {e}"})

    def _handle_cubes(self, body: dict):
        instance = body.get("instance")
        password = body.get("password")
        if not instance:
            return self._send_json(400, {"error": "Missing 'instance'"})
        try:
            with _create_tm1_connection(instance, password) as tm1:
                cubes = tm1.cubes.get_all_names()
                # Filter out control cubes
                cubes = [c for c in cubes if not c.startswith("}")]
                self._send_json(200, {"cubes": sorted(cubes)})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_views(self, body: dict):
        instance = body.get("instance")
        password = body.get("password")
        cube = body.get("cube")
        if not instance or not cube:
            return self._send_json(400, {"error": "Missing 'instance' or 'cube'"})
        try:
            with _create_tm1_connection(instance, password) as tm1:
                private_views, public_views = tm1.views.get_all_names(cube_name=cube)
                self._send_json(200, {"views": sorted(public_views)})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_processes(self, body: dict):
        instance = body.get("instance")
        password = body.get("password")
        if not instance:
            return self._send_json(400, {"error": "Missing 'instance'"})
        try:
            with _create_tm1_connection(instance, password) as tm1:
                processes = tm1.processes.get_all_names()
                # Filter out control processes
                processes = [p for p in processes if not p.startswith("}")]
                self._send_json(200, {"processes": sorted(processes)})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_process_parameters(self, body: dict):
        instance = body.get("instance")
        password = body.get("password")
        process_name = body.get("process_name")
        if not instance or not process_name:
            return self._send_json(400, {"error": "Missing 'instance' or 'process_name'"})
        try:
            with _create_tm1_connection(instance, password) as tm1:
                process = tm1.processes.get(process_name)
                params = [
                    {"name": p["Name"], "prompt": p.get("Prompt", ""),
                     "value": p.get("Value", ""), "type": p.get("Type", "String")}
                    for p in process.parameters
                ]
                self._send_json(200, {"process_name": process_name, "parameters": params})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_dimensions(self, body: dict):
        instance = body.get("instance")
        password = body.get("password")
        cube = body.get("cube")
        if not instance or not cube:
            return self._send_json(400, {"error": "Missing 'instance' or 'cube'"})
        try:
            with _create_tm1_connection(instance, password) as tm1:
                dims = tm1.cubes.get_dimension_names(cube_name=cube)
                self._send_json(200, {"dimensions": list(dims)})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_cube_intelligence(self, body: dict):
        instance = body.get("instance")
        password = body.get("password")
        cube = body.get("cube")
        if not instance or not cube:
            return self._send_json(400, {"error": "Missing 'instance' or 'cube'"})
        try:
            with _create_tm1_connection(instance, password) as tm1:
                visible_order = tm1.cubes.get_dimension_names(cube_name=cube)
                storage_order = tm1.cubes.get_storage_dimension_order(cube_name=cube)
                dimensions_metadata = _collect_dimension_metadata(tm1, visible_order)
                suggested = _compute_suggested_order(dimensions_metadata)
            self._send_json(200, {
                "cube": cube,
                "storage_order": list(storage_order),
                "dimensions_metadata": dimensions_metadata,
                "suggested_order": suggested,
            })
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_list_configs(self):
        configs = []
        for d in ["configs", "samples"]:
            p = Path(d)
            if p.exists():
                for f in sorted(p.glob("*.json")):
                    try:
                        data = json.loads(f.read_text())
                        configs.append({
                            "path": str(f),
                            "filename": f.name,
                            "cube": data.get("cube", ""),
                            "instance": data.get("instance", ""),
                        })
                    except Exception:
                        pass
        self._send_json(200, {"configs": configs})

    def _handle_save_config(self, body: dict):
        config_data = body.get("config")
        filename = body.get("filename")
        if not config_data or not filename:
            return self._send_json(400, {"error": "Missing 'config' or 'filename'"})

        # Sanitize filename
        safe_name = "".join(c for c in filename if c.isalnum() or c in "._-")
        if not safe_name.endswith(".json"):
            safe_name += ".json"

        configs_dir = Path("configs")
        configs_dir.mkdir(exist_ok=True)
        config_path = configs_dir / safe_name

        with open(config_path, "w") as f:
            json.dump(config_data, f, indent=2)

        self._send_json(200, {"path": str(config_path), "filename": safe_name})

    def _handle_delete_config(self, filename: str):
        safe_name = "".join(c for c in filename if c.isalnum() or c in "._-")
        config_path = Path("configs") / safe_name
        if not config_path.exists():
            return self._send_json(404, {"error": "Config not found"})
        try:
            config_path.unlink()
            self._send_json(200, {"success": True})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_list_saved_cubes(self):
        configs = []
        configs_dir = Path("configs")
        if configs_dir.exists():
            for f in sorted(configs_dir.glob("*.json")):
                try:
                    data = json.loads(f.read_text())
                    configs.append({
                        "filename": f.name,
                        "cube": data.get("cube", ""),
                        "instance": data.get("instance", ""),
                        "mode": "predefined" if data.get("predefined_orders") else "greedy",
                        "views": data.get("views", []),
                        "executions": data.get("executions", 5),
                        "last_modified": f.stat().st_mtime,
                    })
                except Exception:
                    pass
        self._send_json(200, {"saved_cubes": configs})

    def _handle_status(self):
        jobs = job_manager.list_jobs()
        active_jobs = [j for j in jobs if j["status"] == "running"]
        self._send_json(200, {
            "active_job": active_jobs[0] if active_jobs else None,
            "total_jobs": len(jobs),
        })

    def _handle_validate(self, body: dict):
        config = body.get("config")
        mode = body.get("mode", "optimize")
        if not config:
            return self._send_json(400, {"error": "Missing 'config'"})
        try:
            validate_cube_config(config, mode)
            self._send_json(200, {"valid": True})
        except ValueError as e:
            self._send_json(200, {"valid": False, "error": str(e)})

    def _handle_start_job(self, body: dict):
        mode = body.get("mode", "optimize")
        cube_config = body.get("cube_config")
        password = body.get("password")
        if not cube_config:
            return self._send_json(400, {"error": "Missing 'cube_config'"})
        try:
            job_id = job_manager.start_job(mode, cube_config, password)
            self._send_json(200, {"job_id": job_id, "status": "running"})
        except RuntimeError as e:
            self._send_json(409, {"error": str(e)})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_cancel_job(self, job_id: str):
        success = job_manager.cancel_job(job_id)
        if success:
            self._send_json(200, {"status": "cancelling"})
        else:
            self._send_json(404, {"error": "Job not found or not running"})

    def _handle_get_job(self, job_id: str):
        job = job_manager.get_job(job_id)
        if not job:
            return self._send_json(404, {"error": "Job not found"})
        self._send_json(200, {
            "job_id": job["job_id"],
            "status": job["status"],
            "mode": job["mode"],
            "cube_name": job["cube_name"],
            "instance": job["instance"],
            "started_at": job["started_at"],
            "completed_at": job["completed_at"],
            "result_files": job["result_files"],
            "error": job["error"],
        })

    def _handle_job_stream(self, job_id: str):
        job = job_manager.get_job(job_id)
        if not job:
            return self._send_json(404, {"error": "Job not found"})

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        # If the job already finished, send the final event immediately
        final_event = job.get("final_event")
        if final_event:
            try:
                self.wfile.write(f"event: {final_event['event']}\n".encode())
                self.wfile.write(f"data: {json.dumps(final_event['data'])}\n\n".encode())
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
            return

        q = job["progress_queue"]
        while True:
            try:
                msg = q.get(timeout=30)
                if msg is None:
                    break
                self.wfile.write(f"event: {msg['event']}\n".encode())
                self.wfile.write(f"data: {json.dumps(msg['data'])}\n\n".encode())
                self.wfile.flush()
            except queue.Empty:
                # Heartbeat
                try:
                    self.wfile.write(b": heartbeat\n\n")
                    self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError):
                    break
            except (BrokenPipeError, ConnectionResetError):
                break

    def _handle_transfer_scan(self, body: dict):
        instance = body.get("instance")
        password = body.get("password")
        ram_percent = body.get("ram_percent", 60)
        if not instance:
            return self._send_json(400, {"error": "Missing 'instance'"})
        try:
            with _create_tm1_connection(instance, password) as tm1:
                is_v12 = detect_is_v12(tm1)
                data = _scan_to_data_light(tm1, instance, ram_percent, include_optimized=True, is_v12=is_v12)
                self._send_json(200, data)
        except Exception as e:
            self._send_json(500, {"error": f"Scan failed: {e}"})

    def _handle_transfer_target_orders(self, body: dict):
        instance = body.get("instance")
        password = body.get("password")
        cubes = body.get("cubes", [])
        if not instance:
            return self._send_json(400, {"error": "Missing 'instance'"})
        if not cubes:
            return self._send_json(400, {"error": "Missing 'cubes'"})
        try:
            with _create_tm1_connection(instance, password) as tm1:
                orders = {}
                missing = []
                for cube_name in cubes:
                    if not tm1.cubes.exists(cube_name):
                        missing.append(cube_name)
                        continue
                    storage_order = tm1.cubes.get_storage_dimension_order(cube_name=cube_name)
                    orders[cube_name] = list(storage_order)
                self._send_json(200, {"orders": orders, "missing": missing})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_transfer_apply(self, body: dict):
        instance = body.get("instance")
        password = body.get("password")
        orders = body.get("orders", {})
        if not instance:
            return self._send_json(400, {"error": "Missing 'instance'"})
        if not orders:
            return self._send_json(400, {"error": "Missing 'orders'"})
        try:
            job_id = job_manager.start_transfer_job(instance, orders, password)
            self._send_json(200, {"job_id": job_id, "status": "running"})
        except RuntimeError as e:
            self._send_json(409, {"error": str(e)})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_transfer_export(self, body: dict):
        instance = body.get("instance", "")
        orders = body.get("orders", {})
        if not orders:
            return self._send_json(400, {"error": "Missing 'orders'"})
        try:
            export_dir = Path("exports")
            export_dir.mkdir(exist_ok=True)
            files = []
            for cube_name, dim_order in orders.items():
                safe_name = "".join(c for c in cube_name if c.isalnum() or c in "._-")
                safe_name = safe_name.strip() or "cube"
                config_data = {
                    "instance": instance,
                    "cube": cube_name,
                    "predefined_orders": [dim_order],
                    "executions": 1,
                    "output": "csv",
                }
                file_path = export_dir / f"{safe_name}.json"
                with open(file_path, "w") as f:
                    json.dump(config_data, f, indent=2)
                files.append(str(file_path))
            self._send_json(200, {"files": files})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _handle_list_results(self):
        results = []
        ts_pattern = re.compile(r'_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$')
        if RESULT_PATH.exists():
            files = [f for f in RESULT_PATH.rglob("*") if f.is_file()]
            for f in sorted(files, key=lambda x: x.stat().st_mtime, reverse=True):
                if f.name.startswith("checkpoint"):
                    continue
                # Instance is the immediate parent dir (or "" for legacy top-level files)
                parent = f.parent
                instance = parent.name if parent != RESULT_PATH else ""
                # Extract cube name: strip instance prefix (if present) and trailing timestamp
                stem = f.stem
                if instance and stem.startswith(f"{instance}_"):
                    stem = stem[len(instance) + 1:]
                m = ts_pattern.search(stem)
                cube_name = stem[:m.start()] if m else stem
                rel = f.relative_to(RESULT_PATH).as_posix()
                results.append({
                    "filename": rel,
                    "cube": cube_name,
                    "instance": instance,
                    "size": f.stat().st_size,
                    "modified": f.stat().st_mtime,
                    "type": f.suffix[1:],
                })
        self._send_json(200, {"results": results})

    def _handle_list_jobs(self):
        self._send_json(200, {"jobs": job_manager.list_jobs()})

    def _handle_serve_result(self, filename: str):
        # Sanitize: only serve from results/, decode URL-encoded names (e.g. spaces).
        # Support one level of subdirectory (results/<instance>/<file>) while blocking
        # path traversal.
        decoded = unquote(filename)
        rel = Path(decoded)
        if rel.is_absolute() or any(part in ("..", "") for part in rel.parts):
            return self._send_json(400, {"error": "Invalid path"})
        if len(rel.parts) > 2:
            return self._send_json(400, {"error": "Invalid path"})

        root = Path(RESULT_PATH).resolve()
        safe = (root / rel).resolve()
        try:
            safe.relative_to(root)
        except ValueError:
            return self._send_json(400, {"error": "Invalid path"})

        if not safe.exists() or not safe.is_file():
            return self._send_json(404, {"error": "File not found"})

        content_types = {
            ".html": "text/html",
            ".csv": "text/csv",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".png": "image/png",
        }
        ct = content_types.get(safe.suffix, "application/octet-stream")

        with open(safe, "rb") as f:
            data = f.read()

        self.send_response(200)
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)




# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    global _config_ini_path, _config_read_only

    parser = argparse.ArgumentParser(description="OptimusPy Workflow UI")
    parser.add_argument('--port', type=int, default=DEFAULT_PORT,
                        help=f"Port to listen on (default: {DEFAULT_PORT})")
    parser.add_argument('--config', dest='config_ini', default=None,
                        help=f"Path to TM1 connection config.ini (default: {DEFAULT_CONFIG_INI})")
    args = parser.parse_args()

    try:
        location = resolve_config_path(args.config_ini)
    except FileNotFoundError as e:
        print(f"ERROR: config.ini not found: {e}")
        sys.exit(1)
    _config_ini_path = location.path
    _config_read_only = location.read_only

    # Only change CWD for frozen exe — pip/script users expect CWD-relative paths
    if getattr(sys, 'frozen', False):
        set_current_directory()

    # Configure logging: write to <install dir>/logs/optimuspy.log and echo to the console
    log_path = get_logfile_path()
    logging.basicConfig(
        format="%(asctime)s - optimuspy-ui - %(levelname)s - %(message)s",
        level=logging.INFO,
        handlers=[
            logging.FileHandler(log_path, encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
    )

    server = HTTPServer(('127.0.0.1', args.port), OptimusPyHandler)
    url = f"http://127.0.0.1:{args.port}"

    print("\n  OptimusPy Workflow UI")
    print(f"  {'─' * 40}")
    print(f"  URL:        {url}")
    print(f"  Config:     {_config_ini_path}{' (read-only)' if _config_read_only else ''}")
    print(f"  Log:        {log_path}")
    print("  Press Ctrl+C to stop\n")

    # Auto-open browser
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Shutting down...")
        server.shutdown()


if __name__ == "__main__":
    main()
