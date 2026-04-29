# VMM / VMT Handling

OptimusPy temporarily sets VMM and VMT to 1,000,000 before benchmarking, then restores their original values when finished. This page explains why.

## What VMM and VMT do

Every TM1 cube has two stargate-cache thresholds, stored in the `}CubeProperties` control cube:

| Property | Meaning |
|---|---|
| **VMM** | Maximum memory (in KB) a stargate view is allowed to use. Larger views are not cached. |
| **VMT** | Time threshold (in milliseconds) a query must take before its result becomes a candidate for caching. |

In normal operation these limits help TM1 reuse expensive queries across users.

## Why we override them

If stargate caching is active during a benchmark, query times reflect **cache hits** rather than the real cost of the dimension order. The first execution might take 2 seconds; subsequent runs return in milliseconds because they hit the stargate cache.

This makes the benchmark useless — every order would look fast after the first execution.

By setting VMM and VMT to **1,000,000** (effectively infinity for both), no result qualifies for caching. Every query runs from scratch and the timing reflects the true cost of the current dimension order.

## How OptimusPy applies the override

```python
# Read the current values
original_vmm, original_vmt = retrieve_vmm_vmt(tm1, cube_name)

# Override
write_vmm_vmt(tm1, cube_name, "1000000", "1000000")

try:
    # ... run all benchmark iterations ...
finally:
    # Always restore — even on exception or cancellation
    write_vmm_vmt(tm1, cube_name, original_vmm, original_vmt)
```

The `finally` block guarantees restoration. Even if the job is cancelled or the Python process is killed mid-run with `Ctrl+C`, the restoration runs. (If the process is **forcibly killed** — `kill -9`, blue screen — VMM/VMT may be left at 1,000,000. Re-running OptimusPy detects the existing values and warns.)

## Side effect: cache invalidation

Setting VMM/VMT also invalidates any existing stargate views for the cube. After a benchmark run, the first few user queries will rebuild the cache. This is normal and expected — the alternative is invalid measurements.

If the cube is **production-critical** and you can't tolerate a brief warm-up window, run OptimusPy on a non-PROD copy. (You should anyway — see the [PROD Promotion Workflow](../examples/prod-promotion-workflow.md).)
