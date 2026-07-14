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
       e. Read RAM from the TM1py Metrics service (`cube_memory_used`), version-agnostic across v11 and v12
       f. Save a checkpoint
5. Pick the best result by composite score
6. Apply best (if update=true) or restore the original
7. Restore VMM/VMT
8. Generate HTML / CSV / XLSX report
```

Steps 2 and 7 are wrapped in a `try/finally` — even if the job fails or is cancelled, VMM/VMT and the original order are always restored.

## The cardinality-aware greedy (two folds)

OptimusPy compares each dimension's **cardinality** (leaf-element count — a
cheap, reorder-free signal) using a **leaf-count tolerance ratio (τ)**. When one
dimension's cardinality is at least τ× another's, leaf-count theory *decides*
their order (larger ⇒ sparser ⇒ later) and the reverse is never tested. When two
dimensions are within τ, the pair is *undecided* and both orderings are measured —
density, which OptimusPy cannot know in advance, picks the winner.

τ is **keyed to the ranking metric** (see ADR-0002): full strength at RAM-ranked
positions, looser at query-ranked front positions, and switched off at
process-ranked front positions (cardinality cannot predict process time).
**Adding a view unlocks front-half pruning** — it is the user-facing lever for
making a slow process-only cube fast.

Two folds, selected by the `fast` flag:

- **Thorough (`fast: false`, default)** walks position indices `N-1, 0, N-2,
  1, …` outside-in. At each position it tests only the **τ-frontier** of the
  unplaced dimensions (those within τ of the position's extreme cardinality),
  locks the measured winner, and continues. A dimension that dominates every
  other by ≫ τ (e.g. a 50,000-leaf dimension) is the sole candidate for the
  back-most slot — it is *pinned* there in a single reorder and never tested
  elsewhere.
- **Fast (`fast: true`)** seeds from the cardinality-suggested order (ascending
  cardinality, string/measure dims last), applies it in one reorder, then runs
  **coordinate-descent** refinement: each *undecided* dimension is swept across
  only its τ-allowed positions, largest dimensions first, for at most two passes
  (stopping early once a pass improves nothing).

If every dimension is within τ of the next, nothing is decided and the thorough
fold degrades gracefully to a full outside-in search — uniform cubes are
unaffected by construction.

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
