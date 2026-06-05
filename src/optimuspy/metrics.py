"""Version-agnostic per-cube RAM source backed by TM1py's MetricService.

OptimusPy reads a cube's memory (the ``cube_memory_used`` metric) from
``tm1.metrics`` (TM1py >= 2.3.0) on both TM1 v11 and v12, replacing the
v11-only ``}StatsByCube`` control-cube MDX lookups.

MetricService normalises metric *names* across versions but **not** their
units: ``cube_memory_used`` is reported in ``B`` on v11 and ``KB`` on v12.
Every value is converted to bytes at this read boundary so all downstream
``/ 1024 ** 3`` GB math is unchanged. An unknown unit fails loud — the raw
number is never passed through, because a silent unit change would corrupt
every RAM comparison OptimusPy makes.
"""
import logging
import time
from contextlib import contextmanager, suppress

# Canonical MetricService metric name for a cube's total memory (both versions).
CUBE_MEMORY_METRIC = "cube_memory_used"

# MetricService 'Unit' tag -> multiplier to bytes. Do not "simplify" this to a
# hardcoded x1024: the whole point of reading Unit is to stay correct when the
# server reports a different unit (B on v11, KB on v12, and so on).
_UNIT_TO_BYTES = {
    "B": 1,
    "KB": 1024,
    "MB": 1024 ** 2,
}

# v11 read-retry loop: the Performance Monitor samples on an interval, so the
# metric can be empty for a short window right after activation. v11 behaviour is
# frozen — this retry-on-empty is unchanged from the }StatsByCube era.
_V11_RETRY_ATTEMPTS = 4
_V11_RETRY_WAIT_SECONDS = 15

# v12 stabilization: cube_memory_used is a sampled gauge that lags right after a
# data change — it can report a too-small value before catching up. We can't know
# the cube's true size in advance, so we poll until the value plateaus (a re-read
# no longer materially larger than the largest seen). On a settled, resident cube
# the second read confirms the first and this returns immediately; only just after
# a bulk load does it wait. The winner is derived from %-deltas and is correct
# regardless, so if it never fully settles we return the largest sample seen.
_V12_STABILIZE_ATTEMPTS = 6
_V12_STABILIZE_WAIT_SECONDS = 10
_V12_STABILIZE_TOLERANCE = 0.01  # 1% — a read within this of the max is "plateaued"


def detect_is_v12(tm1) -> bool:
    """Return True if the connected TM1 server is v12+.

    Parse this once per connection and thread the boolean down; it gates the
    Performance Monitor lifecycle and the read-retry behaviour.
    """
    version = tm1.server.get_product_version()
    major = int(str(version).split(".")[0])
    return major >= 12


def unit_to_bytes(value, unit) -> float:
    """Convert a MetricService memory value to bytes using its reported Unit.

    Fails loud on an unknown unit — never passes the raw number through.
    """
    try:
        multiplier = _UNIT_TO_BYTES[unit]
    except KeyError:
        raise RuntimeError(
            f"Unknown Unit '{unit}' for {CUBE_MEMORY_METRIC}; "
            f"expected one of {sorted(_UNIT_TO_BYTES)}. Refusing to pass the "
            f"value through unconverted.")
    return float(value) * multiplier


def cube_memory_used_bytes(rows) -> float:
    """Pick the cube_memory_used row from a single-cube ``by_cube()`` result, in bytes.

    Returns None if the metric is absent or has no value, so the caller can
    decide whether that is a hard error (v12) or retry-worthy (v11).
    """
    for row in rows:
        if row.get("Metric") != CUBE_MEMORY_METRIC:
            continue
        value = row.get("Value")
        if value is None:
            return None
        return unit_to_bytes(value, row.get("Unit"))
    return None


def memory_by_cube_bytes(rows) -> dict:
    """Pivot unfiltered ``by_cube()`` rows to ``{cube_name: bytes}`` for cube_memory_used.

    ``by_cube()`` already excludes ``}``-control cubes and the synthetic
    ``Cubes Total`` row on both versions, so no manual filtering is needed.
    """
    result = {}
    for row in rows:
        if row.get("Metric") != CUBE_MEMORY_METRIC:
            continue
        value = row.get("Value")
        if value is None:
            continue
        cube = row.get("CubeName")
        if not cube:
            continue
        result[cube] = unit_to_bytes(value, row.get("Unit"))
    return result


def read_cube_memory_bytes(tm1, cube_name: str, is_v12: bool) -> float:
    """Read one cube's RAM baseline in bytes via MetricService.

    v11: retry the read (the Performance Monitor populates on an interval), then
    fail with the historical "Performance Monitor must be activated" message.
    v12: an absent metric is a hard error, but a present value is read until it
    plateaus — the gauge can lag right after a data change (see the stabilization
    note above), so we wait for it to settle rather than trust the first sample.
    """
    if is_v12:
        best = None
        for attempt in range(_V12_STABILIZE_ATTEMPTS):
            rows = tm1.metrics.by_cube(cube=cube_name)
            ram = cube_memory_used_bytes(rows)
            if ram is None:
                raise RuntimeError(
                    f"No {CUBE_MEMORY_METRIC} reported for cube '{cube_name}' — "
                    f"metric unavailable or cube not yet populated.")
            # Plateaued: this read is not materially larger than the largest seen.
            if best is not None and ram <= best * (1 + _V12_STABILIZE_TOLERANCE):
                return max(best, ram)
            best = ram if best is None else max(best, ram)
            if attempt < _V12_STABILIZE_ATTEMPTS - 1:
                logging.info("v12 cube_memory_used still rising; waiting for it to settle")
                time.sleep(_V12_STABILIZE_WAIT_SECONDS)
        return best

    for attempt in range(_V11_RETRY_ATTEMPTS):
        rows = tm1.metrics.by_cube(cube=cube_name)
        ram = cube_memory_used_bytes(rows)
        if ram:
            return ram

        logging.info("Failed to retrieve RAM consumption. Waiting 15s before retry")
        if attempt < _V11_RETRY_ATTEMPTS - 1:
            time.sleep(_V11_RETRY_WAIT_SECONDS)

    raise RuntimeError("Performance Monitor must be activated")


@contextmanager
def ram_source_ready(tm1, is_v12: bool):
    """Ensure cube_memory_used is readable for the duration of the block.

    v11: capture the Performance Monitor's prior state, activate it if it was
    off, and restore the prior state on exit (via the v11-only ``tm1.metrics``
    lifecycle methods).
    v12: no-op — the metric is always available and those lifecycle methods
    raise on v12.
    """
    prior_state = None
    if not is_v12:
        prior_state = tm1.metrics.get_performance_monitor_state()
        if not prior_state:
            tm1.metrics.start_performance_monitor()
    try:
        yield
    finally:
        if not is_v12 and prior_state is not None and not prior_state:
            with suppress(Exception):
                tm1.metrics.stop_performance_monitor()
