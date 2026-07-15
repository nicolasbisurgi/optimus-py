# JSON Config Reference

Every field accepted by an OptimusPy cube config, with types, defaults, and validation rules.

## Required fields

| Field | Type | Description |
|---|---|---|
| `instance` | string | Section name from `config.ini`. |
| `cube` | string | Name of the cube to optimize. |
| `executions` | integer | How many times each query/process runs per iteration. Median wins. |
| `output` | string | `"csv"` or `"xlsx"`. Always also generates `.html`. |

## Optional fields — common

| Field | Type | Default | Description |
|---|---|---|---|
| `views` | array of strings | `[]` | Public view names to benchmark. Skip = RAM-only optimization. |
| `processes` | array of strings | `[]` | TI process names to benchmark. Each runs `executions` times. |
| `process_parameters` | object | `{}` | Per-process parameter overrides. See [Multi-Process](multi-view-multi-process.md). |
| `update` / `auto_apply` | boolean | `false` | `true` writes the best order back to the cube. `false` restores original. |
| `fast` | boolean | `false` | Fast fold: seed from the cardinality-suggested order, then coordinate-descent refine only the τ-undecided dimensions (≤2 passes). `false` runs the thorough τ-frontier search. |
| `dimensions_to_exclude` | array of strings | `[]` | Keep these dims fixed during greedy search. |

## Optional fields — mode-specific

Exactly one of these may be set. They're mutually exclusive.

| Field | Type | Used by |
|---|---|---|
| `predefined_orders` | array of arrays of strings | [Predefined mode](../modes/predefined-orders.md) |
| `optimize_position` | string or integer | [Position mode](../modes/position-optimization.md) |
| `optimize_dimension` | string | [Dimension mode](../modes/dimension-optimization.md) |

## Optional fields — constraints

| Field | Type | Description |
|---|---|---|
| `orders_to_ignore` | array of arrays of strings | Skip these orders during greedy search. Ignored in predefined mode. |
| `dimension_position_rules` | array of objects | Lock dims to specific positions. See [Dimension Position Rules](dimension-position-rules.md). |

## Validation rules

OptimusPy validates the config on startup. Errors fail fast before connecting to TM1:

- All required fields must be present.
- `views` and `processes` must be arrays (or absent).
- For `set` mode: `predefined_orders` must have exactly one entry.
- Only one of `predefined_orders` / `optimize_position` / `optimize_dimension` may be set.
- `optimize_position` must be `"first"`, `"last"`, or an integer ≥ 1.
- `optimize_dimension` must be a non-empty string.
- Each entry in `predefined_orders` and `orders_to_ignore` must be an array of strings.
- `process_parameters` keys must match process names; values must be `{param: value}` dicts.

## Examples for each pattern

Minimal greedy:

```json
{ "instance": "tm1srv01", "cube": "Sales", "executions": 5, "output": "csv" }
```

Greedy + views + auto-apply:

```json
{
  "instance": "tm1srv01",
  "cube": "Sales",
  "views": ["Optimus_View1"],
  "executions": 5,
  "output": "xlsx",
  "update": true
}
```

Predefined, two candidates:

```json
{
  "instance": "tm1srv01",
  "cube": "Sales",
  "executions": 5,
  "output": "csv",
  "predefined_orders": [
    ["Time", "Version", "Product", "Customer", "SalesMeasure"],
    ["Customer", "Product", "Time", "Version", "SalesMeasure"]
  ]
}
```

Set (apply only):

```json
{
  "instance": "tm1srv01_prod",
  "cube": "Sales",
  "executions": 1,
  "output": "csv",
  "predefined_orders": [["Time", "Version", "Product", "Customer", "SalesMeasure"]]
}
```

Position, optimize last:

```json
{
  "instance": "tm1srv01",
  "cube": "Sales",
  "executions": 5,
  "output": "csv",
  "optimize_position": "last"
}
```

Greedy with constraints:

```json
{
  "instance": "tm1srv01",
  "cube": "Sales",
  "executions": 5,
  "output": "csv",
  "dimensions_to_exclude": ["Time"],
  "dimension_position_rules": [
    { "dimension": "Version", "position": 2 }
  ],
  "orders_to_ignore": [
    ["Product", "Customer", "Time", "Version", "SalesMeasure"]
  ]
}
```
