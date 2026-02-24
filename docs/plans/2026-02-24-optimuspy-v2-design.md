# OptimusPy v2.0 Design

## Overview

OptimusPy v2.0 replaces the CLI-arg-driven interface with a JSON config per cube, adds two run modes (`optimize` and `set`), supports predefined/ignored dimension orders, and enables multiple views and TI processes per iteration. No backward compatibility with v1 CLI args.

## CLI

```
python optimuspy.py <mode> <path-to-config.json> [--config CONFIG_INI] [-p PASSWORD]
```

- `mode` — positional, required: `optimize` or `set`
- `path-to-config.json` — positional, required: path to the cube JSON config
- `--config` — optional, defaults to `config/config.ini`
- `-p` / `--password` — optional, overrides password from config.ini

## JSON Config Schema

```json
{
  "instance": "tm1srv01",
  "cube": "Sales",
  "views": ["View1", "View2"],
  "processes": ["load.csv.file"],
  "executions": 10,
  "fast": false,
  "output": "xlsx",
  "update": false,
  "dimensions_to_exclude": ["Version"],
  "predefined_orders": [
    ["Dim1", "Dim2", "Dim3", "Dim4"]
  ],
  "orders_to_ignore": [
    ["Dim4", "Dim3", "Dim2", "Dim1"]
  ]
}
```

TM1 connection stays in `config/config.ini` (moved from project root). JSON references `instance` name; config.ini provides connection params.

## Run Modes

### `optimize`

Benchmarks dimension orders against query speed, RAM, and optional TI process time.

- If `predefined_orders` is set: tests only those orders (via `PredefinedOrderExecutor`). `orders_to_ignore` is ignored.
- If only `orders_to_ignore` is set: runs the greedy swap algorithm (`MainExecutor`) but skips any permutation matching the ignore list.
- If neither is set: runs the greedy swap algorithm as before.

### `set`

Applies `predefined_orders[0]` directly to the cube via TM1 API. No benchmarking. Logs before/after RAM for traceability. Requires `predefined_orders` with exactly one entry.

## Architecture Changes

### ExecutionContext (new)

Replaces `PermutationResult` class-level mutable state (`counter`, `current_ram`, `original_ram`). Passed through the executor pipeline explicitly.

```python
class ExecutionContext:
    def __init__(self):
        self.counter = 1
        self.current_ram = None
        self.original_ram = None

    def next_id(self) -> int:
        pid = self.counter
        self.counter += 1
        return pid

    def reset(self):
        self.counter = 1

    def set_initial_ram(self, ram: float):
        self.original_ram = ram
        self.current_ram = ram

    def update_ram(self, percentage_change: float) -> float:
        self.current_ram = self.current_ram + (self.current_ram * percentage_change / 100)
        return self.current_ram
```

### PredefinedOrderExecutor (new)

Benchmarks a provided list of dimension orders. Uses `ExecutionMode.ITERATIONS`. Follows the same `_evaluate_permutation` flow as existing executors.

### MainExecutor changes

- Accepts `orders_to_ignore: List[List[str]]`
- Before calling `_evaluate_permutation`, checks if the candidate permutation is in the ignore list; skips if so
- Best-order selection for multi-view: uses median of median query times across all views
- Best-order selection for multi-process: same approach (median of medians)

### Multi-view / Multi-process

- `_determine_query_permutation_result()` already iterates all views — no change needed
- `_determine_process_permutation_result()` extended to iterate all processes, returns `{process_name: [times]}`
- `PermutationResult` gains `composite_query_time()` and `composite_process_time()` methods that return median-of-medians across all views/processes
- `determine_best_result()` uses composite metrics for threshold comparison
- `MainExecutor.execute()` uses composite query time for greedy best-order selection (replacing the `self.view_name` singular reference)

### Output

- `to_row()` expanded to include per-view and per-process columns
- Filename pattern uses cube name + timestamp (no longer encodes single view/process)
- Report improvements deferred to a later phase (RushTI 2.0 style)

## Bug Fixes

- Remove `LABEL_MAP` from `optimuspy.py` (dead code)
- Fix `dimensions_to_exclude` default: `str.split("", ",")` producing `[""]` — replaced by JSON array input

## File Structure

```
optimuspy.py          — entry point, CLI, JSON loading, main()
executors.py          — OptipyzerExecutor, OriginalOrderExecutor, MainExecutor, PredefinedOrderExecutor
results.py            — ExecutionContext, PermutationResult, OptimusResult
execution_mode.py     — ExecutionMode enum (unchanged)
config/
  config.ini          — TM1 connection params (moved from root)
```
