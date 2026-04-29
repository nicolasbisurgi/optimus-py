# Dimension Optimization

Test every valid position for one specific dimension while keeping others fixed. The mirror of [Position Optimization](position-optimization.md) — instead of asking "what dimension should go in this slot?", it asks "where should this dimension go?".

## When to use

- You suspect a specific dimension is in the **wrong slot** and want to find its best home.
- After a greedy run, you want to **double-check** that one specific dimension's position is justified.
- A new dimension was added to the cube and you want to see where it fits best.

## JSON config example

```json
{
  "instance": "tm1srv01",
  "cube": "Sales",
  "executions": 5,
  "output": "csv",
  "optimize_dimension": "Customer"
}
```

`optimize_dimension` must be a **valid dimension name** in the cube. OptimusPy validates this on startup — typos fail fast with a clear error.

## What it does

OptimusPy keeps every other dimension fixed in its current position and slides the target dimension through every position, measuring at each one.

For an 8-dimension cube, this is 7 evaluations (the dim's current position is also tested as the baseline) — much faster than full greedy (which is ~56 iterations).

## Interaction with the string-element constraint

If the target dimension has string elements, only the **last** position is valid. OptimusPy detects this, skips invalid positions, and reports the constraint in the result.

## CLI

```bash
optimuspy optimize sales_dimension.json
```
