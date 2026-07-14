# Optimize Mode

The default mode. OptimusPy benchmarks dimension permutations using a greedy outside-in algorithm and reports the order with the best composite score.

## When to use

- You have **no strong prior** about which order will win.
- You want a **systematic search** rather than testing a hand-picked list.
- The cube is **expensive enough** to justify spending benchmark time.

If you already have a short list of candidate orders, use [Predefined Orders](predefined-orders.md) instead — it's faster and more controlled.

## How the greedy algorithm works

OptimusPy walks dimension positions from the outside in: position 0 (first), position N-1 (last), position 1 (second), position N-2 (second-to-last), and so on, stopping at the middle.

For each position, it tries swapping every remaining dimension into that slot and measures RAM (and optionally query / process time). The winner is locked into that position; the algorithm moves on to the next position with one fewer free dimension.

This converges in roughly `N × (N-1)` evaluations rather than `N!`, which is the difference between minutes and millennia for a typical 8-dimension cube.

Set **`fast: true`** for the seed-and-refine fold (see [How It Works](../concepts/how-it-works.md)).

[Full algorithm walkthrough → How It Works](../concepts/how-it-works.md)

## JSON config example

Minimal — RAM only, no views, no processes:

```json
{
  "instance": "tm1srv01",
  "cube": "Sales",
  "executions": 5,
  "output": "csv"
}
```

With views and process benchmarking:

```json
{
  "instance": "tm1srv01",
  "cube": "Sales",
  "views": ["Optimus_Sales_View"],
  "processes": ["Sales_Daily_Refresh"],
  "process_parameters": {
    "Sales_Daily_Refresh": { "pYear": "2026", "pMonth": "01" }
  },
  "executions": 5,
  "output": "xlsx",
  "update": false
}
```

| Field | Purpose |
|---|---|
| `executions` | Each query / process runs this many times. Median is reported. Higher = more accurate, slower. `5` is a good default. |
| `update` | `true` writes the best order back to the cube. `false` reports it but restores the original. |
| `dimensions_to_exclude` | Keep these dims fixed during the search. |

[Full reference → JSON Config Reference](../advanced/json-config-reference.md)

## Reading the result

Open the generated HTML in `results/`. The podium shows the top three orders. The order at position #1 is the recommended one — apply it via `update: true` on the next run, the [Set mode](set-mode.md), or the [Sync Order page](../ui/sync-order-page.md).

## CLI

```bash
optimuspy optimize my_cube.json
```
