# How It Works

OptimusPy benchmarks dimension orders by physically reordering the cube on the TM1 server, running queries (and optionally TI processes), measuring RAM and time, and recording the result. This page walks through the full pipeline.

## High-level pipeline

```
1. Capture the original dimension order
2. Disable TM1's stargate cache (set VMM/VMT to 1,000,000)
3. Evaluate the original order as a baseline
4. Run iterations:
     For each candidate order:
       a. Apply the order to the cube
       b. Clear cube cache
       c. Run each view N times — record query times
       d. Run each process N times — record process times
       e. Read RAM from }StatsByCube
       f. Save a checkpoint
5. Pick the best result by composite score
6. Apply best (if update=true) or restore the original
7. Restore VMM/VMT
8. Generate HTML / CSV / XLSX report
```

Steps 2 and 7 are wrapped in a `try/finally` — even if the job fails or is cancelled, VMM/VMT and the original order are always restored.

## The greedy outside-in algorithm

For an N-dimension cube, the algorithm walks position indices in the sequence:

```
N-1, 0, N-2, 1, N-3, 2, ..., (stops at the middle)
```

For each target position, it tries swapping every remaining dimension into that slot, measures, and locks the winner. This produces approximately `N × (N-1)` evaluations vs. `N!` for full enumeration:

| Dims | Full enumeration | Greedy iterations |
|---|---|---|
| 5 | 120 | 20 |
| 6 | 720 | 30 |
| 7 | 5,040 | 42 |
| 8 | 40,320 | 56 |
| 10 | 3,628,800 | 90 |

The greedy converges to a near-optimal order in a fraction of the time. It can miss the global optimum in rare interaction cases, which is why [Predefined Orders](../modes/predefined-orders.md) exists for hand-tuned A/B testing.

## Composite metrics

When multiple views and/or processes are tested, OptimusPy reports a single number per metric using the **median of medians**:

- For each view: take the median of all N executions
- Composite query time: take the median across per-view medians
- Same logic for processes

Median-of-medians is robust against outliers (TM1 servers occasionally have transient spikes from other workloads).

## Cache & VMM/VMT handling

TM1's **stargate views** cache aggregated query results per cube. If the cache is warm, query times reflect cache hits — not the real cost of the dimension order.

OptimusPy:

1. Sets VMM (memory threshold) and VMT (time threshold) to **1,000,000** before benchmarking. This effectively disables stargate caching for the duration.
2. Calls `DebugUtility(125, 0, 0, '<cube>', '', '')` between iterations to clear any residual cache.
3. Restores the original VMM/VMT in the `finally` block.

[Why VMM/VMT matters → VMM/VMT Handling](vmm-vmt-handling.md)
