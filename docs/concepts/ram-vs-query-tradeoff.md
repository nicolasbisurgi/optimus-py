# RAM vs Query Tradeoff

A dimension order with the smallest RAM footprint is **not always** the fastest at querying. OptimusPy scores both and reports the order with the best balance.

## Why they're different

TM1 stores cube data sparsely. The dimension order affects:

- **Compression efficiency** (RAM) — orders that group dense dimensions together compress better.
- **Stargate view shape** (query time) — orders that put query-leading dimensions first generate more useful aggregates.

These goals can pull in different directions. A small dim early in the order is often great for RAM but bad for queries that filter on it (because the stargate has to materialize many slices).

## Composite query time

When you specify `views`, OptimusPy runs each view N times (`executions`), takes the median per view, then takes the median across views. Lower is better.

```python
view_medians = [median(times_for_view_1), median(times_for_view_2), ...]
composite_query_time = median(view_medians)
```

If you don't specify any views, query time is not measured and the result is ranked by RAM only.

## Composite RAM

Just one number: the cube's total memory used after the order is applied (read from `}StatsByCube` → `Total Memory Used`). RAM is measured **after** all queries have run, so it reflects the steady-state footprint.

## Picking the best result

OptimusPy ranks results in this order of preference:

1. If views are specified → lowest **composite query time**
2. Otherwise → lowest **RAM**

Ties are broken by RAM (when ranking by query time) or by query time (when ranking by RAM).

The HTML report's **scatter chart** plots both axes so you can see the full Pareto front, not just the winner. Sometimes a slightly-worse-on-the-primary-metric order is dramatically better on the secondary one — the scatter view makes that obvious.

> 📸 **Screenshot needed:** Scatter chart with one obvious winner and a Pareto-front alternative highlighted.

## Process time

When `processes` is set, the same composite logic applies — median of per-process medians. Process time is **not** used to rank results; it's reported alongside RAM and query time so you can verify the chosen order doesn't regress your ETLs.
