# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OptimusPy is a CLI tool that finds the ideal dimension order for IBM TM1/Planning Analytics cubes by benchmarking different dimension permutations against query speed, RAM usage, and optional TI process execution time. It connects to TM1 via the REST API using TM1py.

## Running

```bash
# Install as editable package (recommended for development)
pip install -e .

# Run via console script (after pip install)
optimuspy optimize samples/optimize.json
optimuspy set samples/set_order.json
optimuspy scan --instance tm1srv01

# Run as Python module
python -m optimuspy optimize samples/optimize.json

# Run as script (backward compat, no pip install needed)
python optimuspy.py optimize samples/optimize.json

# Web UI
python -m optimuspy.ui
python ui.py  # backward compat

# With custom config.ini path and password override
optimuspy optimize cubes/sales.json --config config/production.ini -p "mypass"
```

There are no tests in this project. The tool requires a live TM1 server to execute.

### CLI

```
optimuspy <mode> <cube_config.json> [--config CONFIG_INI] [-p PASSWORD]
```

- `mode` — `optimize` (benchmark orders), `set` (apply a specific order), or `scan` (discover candidates)
- `cube_config.json` — JSON file with cube-specific settings (see `samples/`)
- `--config` — path to TM1 connection config.ini (default: `config/config.ini`)
- `-p` — TM1 password override

### JSON Config

Each cube gets its own JSON config file. See `samples/` for examples. Key fields:

- `instance` — TM1 instance name (must match a section in config.ini)
- `cube` — cube name to optimize
- `views` — list of view names to benchmark (optional, multi-view supported). Omit for RAM-only optimization
- `processes` — list of TI process names to benchmark (optional, multi-process supported)
- `predefined_orders` — list of dimension orders to test; if set, skips the greedy algorithm
- `orders_to_ignore` — list of dimension orders to skip (ignored when `predefined_orders` is set)
- `dimensions_to_exclude` — dimensions to keep fixed during the greedy algorithm

## Build

The GitHub Actions workflow (`.github/workflows/build.yml`) builds Windows and Linux executables on push to master:
- Installs the package via `pip install -e .` then PyInstaller
- Uses `optimuspy.spec` which references `__main__.py` as entry point and `src/` as pathex
- Publishes executables to GitHub Releases automatically

To build locally: `pip install -e . && pip install pyinstaller && pyinstaller optimuspy.spec`

## Architecture

The project uses a `src/optimuspy/` package layout (matching rushti's structure):

```
src/optimuspy/
├── __init__.py        # Version + public API re-exports
├── cli.py             # CLI entry point (console_scripts target)
├── core.py            # Business logic: main(), _scan_to_data(), config helpers
├── executors.py       # Benchmarking: greedy, predefined, position, dimension executors
├── results.py         # ExecutionContext, PermutationResult, OptimusResult + output
├── execution_mode.py  # ExecutionMode enum
├── checkpoint.py      # CheckpointManager for resume support
├── ui.py              # Web UI server (HTTP + SSE)
└── images/            # UI assets (logo.png, logo.svg)
```

Root-level shims (`optimuspy.py`, `ui.py`) provide backward compatibility for `python optimuspy.py` usage. `__main__.py` is the PyInstaller entry point.

- **`cli.py`** — CLI entry point. Parses args (mode + JSON config), dispatches to `core.main()` or `core._execute_scan_mode()`. Only calls `set_current_directory()` for frozen exe.
- **`core.py`** — Business logic. `main()` orchestrates benchmarking: captures original order, runs permutations via executors, determines best result, optionally updates the cube, writes output (CSV/XLSX/HTML). `_scan_to_data()` returns structured scan results with dimension intelligence.
- **`executors.py`** — Core benchmarking logic. `OptipyzerExecutor` base class handles query timing, process timing, RAM retrieval, and cache clearing. Subclasses: `OriginalOrderExecutor`, `MainExecutor` (greedy), `PredefinedOrderExecutor`, `PositionOptimizerExecutor`, `DimensionOptimizerExecutor`.
- **`results.py`** — `ExecutionContext` tracks mutable state. `PermutationResult` stores timing/RAM data with composite metrics. `OptimusResult` aggregates results and outputs CSV/XLSX/PNG/HTML.
- **`execution_mode.py`** — `ExecutionMode` enum (`ORIGINAL_ORDER`, `ITERATIONS`, `RESULT`).
- **`ui.py`** — Lightweight local web interface for the scan→optimize→set workflow. HTTP server on `127.0.0.1:8765`, single-page HTML app with REST API, SSE streaming for live progress.

## Key Patterns

- **Package imports**: All internal imports use absolute package paths: `from optimuspy.results import ...`
- **TM1 connection**: Configured via `config/config.ini` sections (INI format). Each section is a TM1 instance. Connection params are passed directly to `TM1Service(**config[instance_name])`.
- **VMM/VMT handling**: Before benchmarking, VMM/VMT values are set to 1,000,000 to prevent memory-based optimizations from interfering, then restored in a `finally` block.
- **ExecutionContext**: Tracks `counter`, `current_ram`, and `original_ram` as instance state passed through the executor pipeline.
- **Composite metrics**: `composite_query_time()` and `composite_process_time()` compute median-of-medians across all views/processes.
- **Predefined vs greedy**: If `predefined_orders` is set, `PredefinedOrderExecutor` tests only those orders. Otherwise, `MainExecutor` runs the greedy outside-in algorithm.
- **String element constraint**: Dimensions with string elements cannot be swapped to the last (measure) position in TM1.
- **Output files** go to `results/` directory, named with pattern `{cube}_{timestamp}`.
- **CWD handling**: `set_current_directory()` only runs for PyInstaller-frozen exe. For pip/script usage, paths resolve relative to user's CWD.
