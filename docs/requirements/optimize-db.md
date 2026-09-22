# Optimize DB — the instance-wide heuristic pass

Optimize DB applies the cardinality heuristic once to every eligible cube in an instance, one cube at a time, under a wall-clock budget. **Nothing is benchmarked**: no permutation is tested, no query is timed, and the only evidence of improvement is the percentage `update_storage_dimension_order` returns.

It is a bulk `set` pass, not an optimization. That word is reserved for the measured greedy search, which carries evidence a heuristic pass does not.

For how to drive it, see [Optimize DB Mode](../modes/optimize-db.md).

## Why it exists

Running the measured optimizer cube by cube across a whole model is a multi-day exercise carried out at full memory footprint. Applying the heuristic to the entire instance first, then restarting the server, lowers the footprint enough to make the real exercise cheaper afterwards. Smallest-to-largest is not a guaranteed optimal order, but it lands close on most cubes.

## The heuristic

The target order is **leaf-count ascending**, always. The `order` option controls the order cubes are *processed* in, not the order dimensions are placed in.

String-bearing dimensions go to the back, under `string_policy`:

- `skip_any` (default) — any cube with a string-bearing dimension is skipped entirely.
- `pin_last` — one string-bearing dimension is placed last and the numeric dimensions are sorted ascending in front of it. More than one string-bearing dimension is always skipped: TM1 keeps string values in the last dimension, so there is no safe placement and the cube needs separate analysis.

This is the dimension-keyed rule, not the [locked slot](order-frame.md#the-locked-slot). On a cube with a shared string-bearing dimension that is not its measure, this pass and the measured greedy recommend different orders.

## Planning

The planner is pure — every TM1 read has already happened before it runs — so a plan is reproducible from its inputs. It produces an ordered queue and a **skip ledger**, and every cube not in the queue is in the ledger with a reason:

| Reason | Meaning |
|---|---|
| `excluded` | Matched an `exclude_cubes` pattern (case-insensitive, `*`/`?` wildcards) |
| `empty` | No memory in use |
| `below_min_ram` | Under `min_cube_mb` |
| `too_few_dimensions` | Fewer than 3 dimensions |
| `string_elements` | Has string elements, under `skip_any` |
| `multiple_string_dims` | More than one dimension with strings |
| `already_in_target_order` | The heuristic would change nothing |

The plan also records the **coverage figure** — the share of total model RAM the queued cubes account for — and the chores that were active when it was built. `--dry-run` produces the plan and stops: it performs no reorder, no chore change, and no server write of any kind, so an operator can review it before committing a weekend to the sweep.

## The budget

`time_limit_hours` is checked **only between cubes**. A running `ReorderDimensions` is a blocking server-side rebuild with no safe abort, so a sweep overshoots by the duration of whatever cube it last started.

This is deliberate: the budget exists to stop the sweep running forever, not to guarantee an end time. Whether the next cube fits is extrapolated from observed throughput — the median bytes/second over the last few completed cubes, rather than the single previous sample, so one cube that hit lock contention does not poison the next decision. No ETA is ever produced.

The deadline is absolute and anchored to the original start, so resuming an interrupted run does not extend it.

## Derived savings

Normally the saving is the percentage `update_storage_dimension_order` returns. When a dropped connection loses that response, the reorder has still happened or still not happened — `ReorderDimensions` is atomic, so the cube sits at either the original or the target order — but the percentage is gone and is nowhere on the server.

In that case the run reconnects, establishes which order the cube is in, and computes the saving from an absolute `cube_memory_used` read against the pre-reorder figure it recorded. Such values are tagged `derived` in the run artifact, because they are a measurement rather than the server's own arithmetic. Derived cubes are excluded from the throughput samples that feed the budget estimate, since their duration includes the reconnect.

## Regressions and failures

- **Regression.** With `revert_on_regression` (default on), a cube whose reported change is positive is put straight back to its original order and marked `reverted`.
- **Consecutive failures.** `max_consecutive_failures` (default 3) aborts the run. A single failed cube is left in its original order and the sweep continues.
- **Connection loss.** Three reconnection attempts on a 30/60/120-second ladder. A server still unreachable after that is down, and nothing further is attempted against it.

## Chores

With `disable_active_chores`, the run deactivates the chores that are active **at execution time** — read live rather than taken from the plan's snapshot — and records the list *before* the first deactivation call, so a crash mid-loop still leaves a complete record of what may have been turned off.

Only chores this run deactivated are ever re-activated. A chore an operator disabled in the meantime stays disabled. Restoration is idempotent, and `--restore-chores <plan-id>` is the recovery entry point when a process dies with chores still off.

## Artifacts

Three, one job each:

| Artifact | File | Contents |
|---|---|---|
| **plan** | `optdb_plan_<plan_id>.json` | The queue, each cube's target order, every skip reason, the coverage figure, the active chores at build time |
| **run** | `optdb_run_<plan_id>.json` | Per-cube status, original order (so a regression can be reverted), pre-reorder RAM baseline, the reported `%` and whether it was derived, durations, chore lifecycle state |
| **report** | console | Rendered from the run |

The run artifact is written after every transition, which is what makes it simultaneously the resume point, the final report, and — when the process dies with chores deactivated — the only record of which chores must be re-activated.

## Guarantees

- No cube is benchmarked, and no permutation other than the single target order is applied.
- Every cube in the instance is either in the queue or in the skip ledger with a reason.
- `--dry-run` writes nothing to the server.
- A cube that regresses is restored to the order it started in.
- A saving that was measured rather than reported is labelled as such.
- Chores are only re-activated if this run deactivated them.
