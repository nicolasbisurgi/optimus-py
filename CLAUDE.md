# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OptimusPy is a CLI tool that finds the ideal dimension order for IBM TM1/Planning Analytics cubes by benchmarking different dimension permutations against query speed, RAM usage, and optional TI process execution time. It connects to TM1 via the REST API using TM1py.

## Running

```bash
# Install dependencies
pip install -r requirements.txt

# Optimize mode — benchmark dimension orders using greedy algorithm
python optimuspy.py optimize samples/optimize.json

# Optimize mode — test only predefined orders
python optimuspy.py optimize samples/optimize_predefined.json

# Set mode — apply a specific dimension order directly
python optimuspy.py set samples/set_order.json

# With custom config.ini path and password override
python optimuspy.py optimize cubes/sales.json --config config/production.ini -p "mypass"
```

There are no tests in this project. The tool requires a live TM1 server to execute.

### CLI

```
python optimuspy.py <mode> <cube_config.json> [--config CONFIG_INI] [-p PASSWORD]
```

- `mode` — `optimize` (benchmark orders) or `set` (apply a specific order)
- `cube_config.json` — JSON file with cube-specific settings (see `samples/`)
- `--config` — path to TM1 connection config.ini (default: `config/config.ini`)
- `-p` — TM1 password override

### JSON Config

Each cube gets its own JSON config file. See `samples/` for examples. Key fields:

- `instance` — TM1 instance name (must match a section in config.ini)
- `cube` — cube name to optimize
- `views` — list of view names to benchmark (multi-view supported)
- `processes` — list of TI process names to benchmark (optional, multi-process supported)
- `predefined_orders` — list of dimension orders to test; if set, skips the greedy algorithm
- `orders_to_ignore` — list of dimension orders to skip (ignored when `predefined_orders` is set)
- `dimensions_to_exclude` — dimensions to keep fixed during the greedy algorithm

## Build

The GitHub Actions workflow (`.github/workflows/build.yml`) builds a Windows executable on push to master:
- Uses PyInstaller with `optimuspy.spec`
- Publishes the `.exe` to GitHub Releases automatically
- The spec file bundles `execution_mode.py`, `executors.py`, and `results.py` as data files with hidden imports

To build locally: `pyinstaller optimuspy.spec`

## Architecture

The project is a flat 4-file Python application (no package structure):

- **`optimuspy.py`** — Entry point. Parses CLI args (mode + JSON config path), loads and validates JSON config, reads `config/config.ini` for TM1 connection params. `_execute_set_mode` applies a dimension order directly. `_execute_optimize_mode` orchestrates benchmarking: captures original order, runs permutations via executors, determines best result, optionally updates the cube, and writes output (CSV/XLSX/PNG).
- **`executors.py`** — Core benchmarking logic. `OptipyzerExecutor` is the base class that handles query timing across multiple views, process timing across multiple processes, RAM retrieval, and cache clearing. `OriginalOrderExecutor` benchmarks the current dimension order. `MainExecutor` implements the greedy permutation strategy with `orders_to_ignore` filtering. `PredefinedOrderExecutor` benchmarks a provided list of dimension orders.
- **`results.py`** — `ExecutionContext` tracks mutable state (counter, RAM) across permutation evaluations. `PermutationResult` stores timing/RAM data for a single permutation with composite metrics (median-of-medians across views/processes). `OptimusResult` aggregates results, determines best via progressive threshold matching (1%, 2.5%, 5% of range), and outputs CSV/XLSX/PNG.
- **`execution_mode.py`** — `ExecutionMode` enum (`ORIGINAL_ORDER`, `ITERATIONS`, `RESULT`) with a `label` property for display strings.

## Key Patterns

- **TM1 connection**: Configured via `config/config.ini` sections (INI format). Each section is a TM1 instance. Connection params are passed directly to `TM1Service(**config[instance_name])`.
- **VMM/VMT handling**: Before benchmarking, VMM/VMT values are set to 1,000,000 to prevent memory-based optimizations from interfering, then restored in a `finally` block.
- **ExecutionContext**: Tracks `counter`, `current_ram`, and `original_ram` as instance state passed through the executor pipeline. Replaces the old class-level mutable state on `PermutationResult`.
- **Composite metrics**: `composite_query_time()` and `composite_process_time()` compute median-of-medians across all views/processes. Used by `MainExecutor` for greedy selection and `OptimusResult.determine_best_result()` for threshold matching.
- **Predefined vs greedy**: If `predefined_orders` is set in JSON config, `PredefinedOrderExecutor` tests only those orders. Otherwise, `MainExecutor` runs the greedy outside-in algorithm. `orders_to_ignore` is only used by `MainExecutor` (ignored when `predefined_orders` is set).
- **String element constraint**: Dimensions with string elements cannot be swapped to the last (measure) position in TM1.
- **Output files** go to `results/` directory, named with pattern `{cube}_{timestamp}`.
- **Frozen exe detection**: `set_current_directory()` handles both script and PyInstaller-frozen exe contexts for working directory resolution.
