# Dimension Position Rules

Constrain the greedy search by locking specific dimensions to specific positions. The algorithm only permutes the remaining dimensions.

## When to use

- A specific dimension is **always queried first** in your workload — lock it to position 0 to avoid testing orders where it isn't.
- A measure dimension that **must** stay at the last position (string elements force this anyway, but the explicit rule is documentation).
- An **internal best-practice** says "Currency always goes last among non-string dims".

## JSON config example

```json
{
  "instance": "tm1srv01",
  "cube": "Sales",
  "executions": 5,
  "output": "csv",
  "dimension_position_rules": [
    { "dimension": "Time",     "position": 0 },
    { "dimension": "Currency", "position": 3 }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `dimension` | string | Dimension name. Must exist in the cube. |
| `position` | integer | 0-based position. Must be valid for the cube's dimension count. |

Multiple rules may target different dimensions; they cannot target the same position.

## Interaction with greedy search

OptimusPy:

1. Validates the rules against the cube's dimension list (typos / out-of-range positions fail fast).
2. Pre-applies the rules to set the locked dimensions in their target positions.
3. Runs greedy on the remaining N - (number of locked dims) positions.
4. Skips and logs any candidate order that would violate a rule.

The skip messages are logged at DEBUG level (suppressed by default). The result count reflects only the orders that were actually evaluated.

## Interaction with `dimensions_to_exclude`

| Field | Effect |
|---|---|
| `dimensions_to_exclude` | Removes the dimension from the swap pool — it stays in its **current** position. |
| `dimension_position_rules` | Forces the dimension to a **specific** position (which may differ from the current). |

Use `dimensions_to_exclude` when you want to leave a dimension where it is. Use `dimension_position_rules` when you want to enforce a specific layout.

## Interaction with the string-element constraint

If a rule places a string-bearing dimension anywhere except last, OptimusPy fails on startup with:

```
ValueError: Rule violates string element constraint:
  dimension 'Currency' has string elements, must be last (position 7)
  rule places it at position 3
```

The check happens before any TM1 work — typos are caught immediately.
