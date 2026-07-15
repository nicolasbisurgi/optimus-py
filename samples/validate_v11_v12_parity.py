#!/usr/bin/env python3
"""Manual pre-merge gate: prove OptimusPy behaves identically on TM1 v11 and v12.

This is NOT a unit test and is NOT run in CI — it needs two live TM1 instances
(one v11, one v12) reachable from the same ``config.ini``. It builds a *byte-for
byte identical* 8-dimension cube, loaded with the *same* seeded random data, on
both servers, then:

  1. Runs every OptimusPy mode (greedy, fast greedy, predefined, position,
     dimension, set) against both servers and compares the winning storage order
     each mode picks. Identical data must yield the same winner on both versions.
  2. Proves the ``cube_memory_used`` Unit->bytes conversion is correct (v11 reports
     ``B``, v12 reports ``KB``) by checking that the *original-order* RAM OptimusPy
     measured during those runs converts to near-equal bytes across versions — a
     wrong conversion would differ by ~1024x. It uses the run-time reading (settled
     cube), not the pre-run baseline sample, whose v12 gauge can lag right after the
     bulk load. The pre-run baseline is still captured for information only.
  3. Writes a JSON snapshot (``--snapshot``). Run this script on the *pre-change*
     commit against the v11 instance, keep the snapshot, then run it again on the
     post-change commit and diff the two snapshots to confirm v11 behaviour is
     frozen byte-for-byte.

Usage
-----
    # config.ini must contain a [v11srv] and a [v12srv] section (any names).
    python samples/validate_v11_v12_parity.py \
        --config config/config.ini \
        --v11 v11srv --v12 v12srv \
        --snapshot v11_after.json

    # frozen-behaviour check (run on each commit, then diff the snapshots):
    git stash && python samples/validate_v11_v12_parity.py --config ... \
        --v11 v11srv --only v11 --snapshot v11_before.json && git stash pop
    python samples/validate_v11_v12_parity.py --config ... \
        --v11 v11srv --only v11 --snapshot v11_after.json
    diff <(jq -S . v11_before.json) <(jq -S . v11_after.json)

Pass ``--cleanup`` to delete the generated cube + dimensions afterwards.
"""
import argparse
import csv
import glob
import json
import os
import sys
import time
from pathlib import Path

# Make the in-tree package importable when run from the repo root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from TM1py import TM1Service, Dimension, Hierarchy, Element, Cube  # noqa: E402

from optimuspy import core  # noqa: E402
from optimuspy.core import get_tm1_config  # noqa: E402
from optimuspy.metrics import (  # noqa: E402
    detect_is_v12, unit_to_bytes, CUBE_MEMORY_METRIC,
)

# Pre-run baseline sampling (informational only — the conversion proof uses the
# settled original-order RAM from the mode runs; see _settled_original_ram). Right
# after a bulk load cube_memory_used is still catching up, so poll until the value
# plateaus. NOTE: v12's gauge can stay at the near-empty skeleton for longer than
# this whole window (its refresh interval), so the pre-run v12 sample may under-
# report; that is why it is not the proof source.
_SETTLE_ATTEMPTS = 24
_SETTLE_WAIT_SECONDS = 10
_SETTLE_TOLERANCE = 0.01

# --- Fixture definition -----------------------------------------------------

CUBE = "OptimusPy_Parity_Test"
SEED = 20260605  # LCG seed — fixed so v11 and v12 receive byte-identical data
# 7 sparse dimensions of widely-varying size + 1 numeric measure dimension (last).
# Varied cardinality + the skewed fill below make storage dimension order actually
# affect RAM, so a genuine winner emerges (a uniform fill ties on every order).
DIM_SIZES = {
    f"{CUBE}_Dim1": 200,
    f"{CUBE}_Dim2": 160,
    f"{CUBE}_Dim3": 120,
    f"{CUBE}_Dim4": 80,
    f"{CUBE}_Dim5": 50,
    f"{CUBE}_Dim6": 25,
    f"{CUBE}_Dim7": 12,
}
MEASURE_DIM = f"{CUBE}_Measure"
MEASURES = ["Value", "Count", "Amount"]
FILL_CELLS = 300_000  # number of deterministic LCG-driven cell writes (server-side)


def _dimension_names():
    return list(DIM_SIZES.keys()) + [MEASURE_DIM]


def _build_dimensions(tm1: TM1Service):
    # Non-padded element names ('E0', 'E1', ...) so the server-side TI can rebuild
    # each name with a plain TRIM(STR(idx, 12, 0)) — no zero-pad logic needed.
    for dim_name, size in DIM_SIZES.items():
        elements = [Element(f"E{i}", "Numeric") for i in range(size)]
        hier = Hierarchy(dim_name, dim_name, elements=elements)
        tm1.dimensions.update_or_create(Dimension(dim_name, [hier]))
    # measure dimension: numeric measures only (keeps it last-position legal)
    elements = [Element(m, "Numeric") for m in MEASURES]
    hier = Hierarchy(MEASURE_DIM, MEASURE_DIM, elements=elements)
    tm1.dimensions.update_or_create(Dimension(MEASURE_DIM, [hier]))


def _build_cube(tm1: TM1Service):
    tm1.cubes.update_or_create(Cube(CUBE, _dimension_names()))


def _ti_fill_prolog():
    """Generate TI prolog that fills the cube with deterministic, skewed sparse data.

    Pushing 300k cells from the client tripped a v12 request-memory cap, so the fill
    runs server-side instead. A MINSTD LCG (integer math, identical on every IEEE
    double engine) makes v11 and v12 produce byte-identical data without RAND().
    A square-skew on each index concentrates density toward low elements so RAM
    genuinely depends on dimension order.
    """
    lines = [
        f"sCube = '{CUBE}';",
        f"nState = {SEED};",
        f"nCells = {FILL_CELLS};",
        "nM = 2147483647;",
        "nA = 48271;",
        "i = 1;",
        "WHILE( i <= nCells );",
    ]
    coords = []
    for k, size in enumerate(DIM_SIZES.values(), start=1):
        lines += [
            "  nState = MOD( nA * nState, nM );",
            f"  nR = MOD( nState, {size} );",
            f"  nIdx{k} = INT( nR * nR / {size} );",  # square-skew toward low indices
        ]
        coords.append(f"'E' | TRIM(STR(nIdx{k}, 12, 0))")
    lines += [
        "  nState = MOD( nA * nState, nM );",
        f"  nMeas = MOD( nState, {len(MEASURES)} );",
        "  IF( nMeas = 0 ); sMeas = 'Value'; ELSEIF( nMeas = 1 ); sMeas = 'Count'; ELSE; sMeas = 'Amount'; ENDIF;",
        "  nState = MOD( nA * nState, nM );",
        "  nVal = MOD( nState, 1000000 ) + 1;",
        f"  CellPutN( nVal, sCube, {', '.join(coords)}, sMeas );",
        "  i = i + 1;",
        "END;",
    ]
    return lines


def setup_instance(tm1: TM1Service):
    _build_dimensions(tm1)
    _build_cube(tm1)
    # Server-side fill (avoids the client->server request-memory cap on v12).
    tm1.processes.execute_ti_code(_ti_fill_prolog())


def teardown_instance(tm1: TM1Service):
    if tm1.cubes.exists(CUBE):
        tm1.cubes.delete(CUBE)
    for dim in _dimension_names():
        if tm1.dimensions.exists(dim):
            tm1.dimensions.delete(dim)


# --- Reads ------------------------------------------------------------------

def read_baseline(tm1: TM1Service, is_v12: bool) -> dict:
    """Read cube_memory_used once it plateaus; report raw value + Unit + bytes.

    This is a best-effort *pre-run informational* sample only. It is NOT the
    conversion-proof source: right after the fresh bulk load, v12's
    cube_memory_used gauge can sit at the near-empty cube skeleton for longer than
    any reasonable pre-run settle window (its sampled-gauge refresh interval), so
    this can report the skeleton size on v12. The conversion proof instead uses the
    original-order RAM OptimusPy measures *during* the mode runs, which is read on a
    settled cube on both versions (see _settled_original_ram / compare).
    """
    best = None
    raw = None
    for attempt in range(_SETTLE_ATTEMPTS):
        rows = tm1.metrics.by_cube(cube=CUBE)
        row = next((r for r in rows
                    if r.get("Metric") == CUBE_MEMORY_METRIC and r.get("Value") is not None), None)
        if row is not None:
            b = unit_to_bytes(row.get("Value"), row.get("Unit"))
            raw = row
            if best is not None and b <= best * (1 + _SETTLE_TOLERANCE):
                best = max(best, b)
                break
            best = b if best is None else max(best, b)
        if attempt < _SETTLE_ATTEMPTS - 1:
            time.sleep(_SETTLE_WAIT_SECONDS)
    return {
        "raw_value": None if raw is None else raw.get("Value"),
        "raw_unit": None if raw is None else raw.get("Unit"),
        "bytes": best,
    }


# --- Mode runs --------------------------------------------------------------

MODE_CONFIGS = {
    "greedy": {"executions": 1, "output": "csv"},
    "greedy_fast": {"executions": 1, "output": "csv", "fast": True},
    "predefined": {"executions": 1, "output": "csv", "predefined_orders": "PREDEFINED"},
    "position_last": {"executions": 1, "output": "csv", "optimize_position": "last"},
    "dimension": {"executions": 1, "output": "csv", "optimize_dimension": f"{CUBE}_Dim3"},
    "set": {"executions": 1, "output": "csv", "predefined_orders": "PREDEFINED"},
}


def _cube_config(instance: str, overrides: dict) -> dict:
    base = {"instance": instance, "cube": CUBE, "views": [], "processes": []}
    cfg = {**base, **overrides}
    if cfg.get("predefined_orders") == "PREDEFINED":
        # one swapped order; reversing the sparse dims is a legal, distinct order
        sparse = list(DIM_SIZES.keys())
        cfg["predefined_orders"] = [list(reversed(sparse)) + [MEASURE_DIM]]
    return cfg


def _latest_csv(instance: str) -> str:
    pattern = str(core.RESULT_PATH / instance / f"{instance}_{CUBE}_*.csv")
    files = glob.glob(pattern)
    return max(files, key=os.path.getmtime) if files else None


def _parse_result_csv(path: str) -> dict:
    """Extract winner order + RAM bytes and the original-order baseline bytes."""
    n_dims = len(_dimension_names())
    best = None
    original_ram = None
    with open(path, newline="") as f:
        # Result CSVs begin with '# ...' comment lines and a blank line before
        # the real 'ID,Mode,...' header; drop those so DictReader sees the header.
        data_lines = [ln for ln in f if ln.strip() and not ln.lstrip().startswith("#")]
    for row in csv.DictReader(data_lines):
        order = [row[f"Dimension{i}"] for i in range(1, n_dims + 1)]
        if (row.get("Mode") or "").upper().startswith("ORIGINAL"):
            original_ram = float(row["RAM"])
        if (row.get("Is Best") or "").strip().lower() == "true":
            best = {"order": order, "ram_bytes": float(row["RAM"])}
    return {"best": best, "original_ram_bytes": original_ram}


def run_modes(instance: str, config_ini: str, password: str) -> dict:
    results = {}
    for mode_label, overrides in MODE_CONFIGS.items():
        tm1_mode = "set" if mode_label == "set" else "optimize"
        cube_config = _cube_config(instance, overrides)
        ok = core.main(tm1_mode, cube_config, config_ini, password=password, no_resume=True)
        csv_path = _latest_csv(instance)
        parsed = _parse_result_csv(csv_path) if (ok and csv_path) else None
        results[mode_label] = {"ok": bool(ok), "result": parsed}
        print(f"    [{instance}] {mode_label}: ok={bool(ok)}")
    return results


# --- Orchestration ----------------------------------------------------------

def process_instance(name: str, config_ini: str, password: str, do_setup: bool) -> dict:
    cfg = get_tm1_config(config_ini)
    tm1_args = dict(cfg[name])
    tm1_args["session_context"] = "optimuspy-parity"
    if password:
        tm1_args["password"] = password
        tm1_args["decode_b64"] = False

    with TM1Service(**tm1_args) as tm1:
        is_v12 = detect_is_v12(tm1)
        version = tm1.server.get_product_version()
        print(f"  {name}: TM1 {version} ({'v12' if is_v12 else 'v11'})")
        if do_setup:
            print(f"  {name}: building fixture cube '{CUBE}'...")
            setup_instance(tm1)
        baseline = read_baseline(tm1, is_v12)
        print(f"  {name}: cube_memory_used raw={baseline['raw_value']} "
              f"{baseline['raw_unit']} -> {baseline['bytes']:.0f} bytes")
    # mode runs open their own connections via core.main
    modes = run_modes(name, config_ini, password)
    return {"version": str(version), "is_v12": is_v12,
            "baseline": baseline, "modes": modes}


def _settled_original_ram(snapshot: dict):
    """The original-order RAM OptimusPy measured during the mode runs, in bytes.

    Every optimize mode reads the same original order first (OriginalOrderExecutor),
    parsed back as ``original_ram_bytes``. That read happens well after the load, on
    a settled cube, via the product's own version-aware read path — so it is the
    reliable cross-version conversion-proof value, unlike the pre-run read_baseline
    whose v12 sample can still be the pre-climb skeleton. Returns the first
    available mode's value (they all read the identical original order).
    """
    for mode in MODE_CONFIGS:
        res = (snapshot.get("modes", {}).get(mode) or {}).get("result") or {}
        val = res.get("original_ram_bytes")
        if val:
            return val
    return None


def compare(v11: dict, v12: dict) -> bool:
    print("\n=== PARITY REPORT ===")
    ok = True

    # Conversion proof uses the settled original-order RAM the product measured
    # during the runs (both versions), NOT the pre-run baseline sample (v12's gauge
    # can lag behind the fresh load). If the Unit->bytes conversion were wrong, v11
    # (B) and v12 (KB) would differ by ~1024x rather than by identical-data noise.
    o11, o12 = _settled_original_ram(v11), _settled_original_ram(v12)
    print(f"\nRAM (Unit->bytes conversion proof — original-order RAM as measured during the runs):")
    if o11 and o12:
        delta = abs(o11 - o12)
        tol = max(o11, o12) * 0.001  # 0.1% — identical data should be near-identical
        conv_ok = delta <= tol
        ok &= conv_ok
        print(f"  v11 -> {o11:.0f} bytes")
        print(f"  v12 -> {o12:.0f} bytes")
        print(f"  delta {delta:.0f} bytes ({'PASS' if conv_ok else 'FAIL'}; tol {tol:.0f})")
    else:
        ok = False
        print("  FAIL (no original-order RAM captured on one version)")
    print(f"  [pre-run baseline sample, informational — v12 may lag right after load] "
          f"v11: {v11['baseline']['raw_value']} {v11['baseline']['raw_unit']}; "
          f"v12: {v12['baseline']['raw_value']} {v12['baseline']['raw_unit']}")

    print(f"\nMode winner parity:")
    for mode in MODE_CONFIGS:
        m11 = v11["modes"].get(mode) or {}
        m12 = v12["modes"].get(mode) or {}
        r11, r12 = m11.get("result"), m12.get("result")
        if not m11.get("ok") or not m12.get("ok") or not r11 or not r12:
            print(f"  {mode}: FAIL (mode errored or produced no result on one version)")
            ok = False
            continue
        b11, b12 = r11.get("best"), r12.get("best")
        if b11 is None and b12 is None:
            # Neither version found an order that beats the original. For an
            # identical cube that is itself parity — both agree there is no
            # RAM-improving order — not a failure.
            print(f"  {mode}: PASS (no improving order on either version)")
            continue
        if not b11 or not b12:
            print(f"  {mode}: FAIL (a winner emerged on one version only)")
            ok = False
            continue
        same = b11["order"] == b12["order"]
        ok &= same
        print(f"  {mode}: {'PASS' if same else 'FAIL'}")
        if not same:
            print(f"    v11 -> {b11['order']}")
            print(f"    v12 -> {b12['order']}")

    print(f"\nOVERALL: {'PASS' if ok else 'FAIL'}")
    return ok


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default="config/config.ini",
                    help="path to config.ini (default: config/config.ini)")
    ap.add_argument("--v11", help="config.ini section name for the v11 instance")
    ap.add_argument("--v12", help="config.ini section name for the v12 instance")
    ap.add_argument("--password", default=None, help="password override for both")
    ap.add_argument("--only", choices=["v11", "v12"], default=None,
                    help="run against a single instance (for the before/after-change diff)")
    ap.add_argument("--no-setup", action="store_true",
                    help="skip cube/data creation (reuse an existing fixture)")
    ap.add_argument("--cleanup", action="store_true",
                    help="delete the fixture cube + dimensions when done")
    ap.add_argument("--snapshot", default=None, help="write results JSON to this path")
    args = ap.parse_args()

    snapshot = {}
    do_setup = not args.no_setup

    if args.only != "v12" and args.v11:
        print("v11 instance:")
        snapshot["v11"] = process_instance(args.v11, args.config, args.password, do_setup)
    if args.only != "v11" and args.v12:
        print("v12 instance:")
        snapshot["v12"] = process_instance(args.v12, args.config, args.password, do_setup)

    passed = True
    if "v11" in snapshot and "v12" in snapshot:
        passed = compare(snapshot["v11"], snapshot["v12"])

    if args.snapshot:
        Path(args.snapshot).write_text(json.dumps(snapshot, indent=2, sort_keys=True))
        print(f"\nSnapshot written to {args.snapshot}")

    if args.cleanup:
        for key, name in (("v11", args.v11), ("v12", args.v12)):
            if key in snapshot and name:
                cfg = get_tm1_config(args.config)
                tm1_args = dict(cfg[name])
                tm1_args["session_context"] = "optimuspy-parity"
                if args.password:
                    tm1_args["password"] = args.password
                    tm1_args["decode_b64"] = False
                with TM1Service(**tm1_args) as tm1:
                    teardown_instance(tm1)
                    print(f"Cleaned up fixture on {name}")

    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
