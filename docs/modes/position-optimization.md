# Position Optimization

Optimize a single dimension position only. Faster than full greedy when you have a strong reason to focus on one slot.

## When to use

- The **last position** matters most for query speed (it determines the measure dimension's locality). You want to find the best last-position dimension while leaving the rest alone.
- You've manually placed most dimensions and want to confirm the **first** or **last** choice.
- You're iterating: run greedy once, then re-run position optimization on the position you're least sure about with more `executions` for higher confidence.

## JSON config example

Optimize the last position:

```json
{
  "instance": "tm1srv01",
  "cube": "Sales",
  "executions": 5,
  "output": "csv",
  "optimize_position": "last"
}
```

Optimize a specific position (1-based):

```json
{
  "optimize_position": 3
}
```

| Value | Meaning |
|---|---|
| `"first"` | Position 0 (the leftmost slot) |
| `"last"` | Position N-1 (the rightmost slot — typically the measure dim) |
| Integer ≥ 1 | A 1-based index. `1` is first, `2` is second, etc. |

## What it does

OptimusPy keeps every other dimension fixed in its current position and tries swapping each remaining dimension into the target position. Iterations = N-1 (one per dimension, minus the one already there).

## Interaction with the string-element constraint

If `optimize_position` is `"last"` and any dimension has string elements, that dimension is **excluded from the swap candidates** (TM1 won't allow string dims anywhere except last — but if it's the only string dim, it stays where it is). See [String Element Constraint](../concepts/string-element-constraint.md).

## CLI

```bash
optimuspy optimize sales_position.json
```
