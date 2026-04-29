# Multi-View / Multi-Process

Optimize against multiple views and / or multiple TI processes for a more representative score.

## Why use multiple views

A single view samples one query pattern. The optimal dimension order for "drill down by Customer × Time" may not be optimal for "filter by Region, total by Period". Benchmarking against several representative views finds an order that's good across the workload, not just one query.

```json
{
  "views": [
    "Optimus_Daily_Drill",
    "Optimus_Monthly_Summary",
    "Optimus_YTD_By_Region"
  ]
}
```

Each view runs `executions` times per iteration. The composite query time is the **median of per-view medians** — robust against an outlier view that happens to be slow on a particular order.

!!! tip "View naming"
    By convention, prefix benchmark views with `Optimus_` so they're easy to identify in the cube's view list and exclude from end-user navigation.

## Why use TI processes

Some cubes are written to by long-running ETLs. The dimension order can change ETL execution time as much as query time. Benchmarking processes ensures the chosen order doesn't regress your overnight refresh.

```json
{
  "processes": [
    "Sales_Daily_Refresh",
    "Sales_Currency_Translate"
  ]
}
```

Each process runs `executions` times per iteration via `tm1.processes.execute_process_with_return`. Failed runs (any process error) abort the iteration with a clear log message.

## process_parameters

Most TI processes take parameters (year, month, scenario, etc.). Specify them per process:

```json
{
  "processes": ["Sales_Daily_Refresh"],
  "process_parameters": {
    "Sales_Daily_Refresh": {
      "pYear": "2026",
      "pMonth": "01",
      "pScenario": "Actual"
    }
  }
}
```

Parameter names and values are passed verbatim to TM1. Mismatched parameters fail fast with the TM1 error message.

## Combined view + process benchmarking

```json
{
  "instance": "tm1srv01",
  "cube": "Sales",
  "views": ["Optimus_Daily_Drill", "Optimus_Monthly_Summary"],
  "processes": ["Sales_Daily_Refresh"],
  "process_parameters": {
    "Sales_Daily_Refresh": { "pYear": "2026", "pMonth": "01" }
  },
  "executions": 5,
  "output": "xlsx"
}
```

Per-iteration cost: `executions × (n_views + n_processes)`. With the example above: `5 × (2 + 1) = 15` operations per iteration. With ~30 greedy iterations on an 8-dim cube, that's 450 operations total — plan for the run time accordingly.

## Choosing executions

| executions | Use case |
|---|---|
| `1` | Smoke test — confirm the config works |
| `3` | Quick triage — rough relative ranking |
| `5` | Default — good balance for most cubes |
| `10+` | Production decision — high confidence on close races |
