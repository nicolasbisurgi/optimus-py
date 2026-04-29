# Example: TI Process Benchmarking

Benchmark with TurboIntegrator processes for a full ETL-aware optimization. Useful when the cube is hit by long-running data loads or transformations and you don't want the dimension order optimization to regress them.

## Config

```json
{
  "instance": "tm1srv01",
  "cube": "Sales",
  "views": ["Optimus_Daily_Drill"],
  "processes": [
    "Sales_Daily_Refresh",
    "Sales_Currency_Translate"
  ],
  "process_parameters": {
    "Sales_Daily_Refresh": {
      "pYear": "2026",
      "pMonth": "01",
      "pScenario": "Actual"
    },
    "Sales_Currency_Translate": {
      "pYear": "2026"
    }
  },
  "executions": 3,
  "output": "xlsx"
}
```

| Field | Notes |
|---|---|
| `processes` | Each process runs `executions` times per iteration. |
| `process_parameters` | Per-process parameter overrides. Names and values pass to TM1 unchanged. |
| `executions` | Lower than usual (3 vs 5) because process runs are slow — keep total benchmark time reasonable. |

!!! warning "Side effects"
    The processes run for real every iteration. If they write to other cubes or external systems, **point them at a non-PROD environment**. Don't benchmark on a cube whose ETL emails customers.

## Run command

```bash
optimuspy optimize sales_processes.json
```

## Reading the composite process time

```
Iteration 12 of 30 - Testing order: ['Periods', 'Sales', 'Currency', ...]
Iteration 12 of 30 - Result: RAM [GB]: 3.12 - Query [s]: 0.84321 - Process [s]: 47.3
```

- **Process [s]** — composite process time = median across processes, where each process's time = median of N executions

The chosen winner is ranked by composite query time (when views are present) — process time is reported for verification, not for ranking. If you want process time to drive the ranking, use processes only with no views.

> 📸 **Screenshot needed:** XLSX opened in Excel with separate sheets for permutations, per-view times, and per-process times.

## Sample file

[`samples/optimize.json`](optimize.json) shows the basic shape — add `processes` and `process_parameters` blocks to enable process benchmarking.
