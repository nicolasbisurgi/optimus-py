# The storage order is the frame, and the last slot is the only thing locked in it

## Context

A TM1 cube has two dimension orders. `get_dimension_names()` returns the **presentation** order — the build order, shown in Architect, conventionally ending with the measure dimension for readability. `get_storage_dimension_order()` returns the **storage** order — what the server physically stores the cube in, what `update_storage_dimension_order` writes, and the only one that determines RAM and query behaviour.

OptimusPy's engine was built on the wrong one. Every executor was constructed with the presentation order (`core.py:453, 475, 486, 492, 501` at `686039d^`) and `_collect_dimension_metadata` ran over it (`:497`), while the cube was restored to the storage order and the string check was derived from *its* last element. The engine permuted one list; the server enforced against, and was restored to, another.

Around that mismatch the codebase had accumulated three separate implementations of one rule — "a dimension with string elements goes last" — plus a fourth enforcement path that queried the server once per candidate order. The rule itself was also stated wrongly. TM1's constraint is about the **last position of the storage order**, but the code asked whether a *dimension* carried strings, and then moved it.

The three tiers of admissibility this work introduced — well-formedness, the server constraint, user preference — are defined in `CONTEXT.md` under "Order admissibility" (`01f3eac`), which is where the project's vocabulary lives. They are not restated here.

## Decision

**The storage order is the frame.** The engine reasons about `get_storage_dimension_order()` and nothing else. A single pure module, `src/optimuspy/order_frame.py`, is built from that order plus one boolean — whether the last slot is locked — and answers whether a candidate order is admissible, returning a reason when it is not. Every order source consults it: both greedy folds, predefined orders, position and dimension optimization, and set mode. It holds no `TM1Service`, performs no I/O, and logs nothing; the caller logs the reason it returns.

**Only the last slot is locked, and only when the dimension in it has string elements.** That dimension never moves, whatever the order source. Any candidate that would move it is skipped with a logged reason and processing continues. There is no relocation and no repair: OptimusPy never moves a dimension to satisfy this constraint. A cube whose storage-last dimension is numeric-only has no lock and every position is free.

The read is the existing `initial_dimension_order` variable, **not** a fresh `get_storage_dimension_order()` call at the construction site. On resume that variable is reassigned from the checkpoint ([ADR-0003](0003-resume-validates-dimension-set-and-recovers-in-flight-reorder.md) §2) *before* the executors are built, so it carries the true original order. The locked dimension is the same either way — TM1 never permitted a reorder that moved a string dimension off the last slot — but a fresh read would re-derive the RAM baseline from a crash-reordered cube, which is silent and visible only in the final figures.

## Three findings recorded here

These are invisible in the diff and will be misread as bugs by whoever meets them next.

### 1. The shared-dimension disagreement — the one case where old and new behaviour differ

The deleted block (`MainExecutor._run_fold_a`, added by `49e5678`, removed by `67e147d`) appended **every** dimension in `string_dims` to the end of the resulting order. Its own comment conceded the assumption: *"TM1 permits at most one such dim, but a list is handled defensively."*

Dimensions are shared between cubes. A cube can therefore contain a dimension that carries string elements because of how *another* cube uses it, while in this cube it is an ordinary sparse dimension somewhere in the middle. The old rule moved it to the back. The locked-slot rule leaves it where the search puts it, placed by **cardinality** like any other dimension.

This is the substantive reason the deletion was safe, and it is not a simplification: on such a cube the two rules recommend different orders. `49e5678` itself was a local workaround for the presentation/storage mismatch — it was added to handle *"an already-optimized cube (build order != storage order)"* where the string dimension is not presentation-last, and its own message notes the common case was a no-op. Once the engine reads the storage order, `resulting_order[-1]` **is** the storage-last dimension, which **is** the one the lock keys off, so the branch it guarded can no longer be reached.

**Two call sites still apply the old rule, deliberately.** `_compute_suggested_order` (`core.py:745`, `suggested = non_string_dims + string_dims`) and the heuristic pass's target builder (`optimize_db.py:202`, `target = numeric + string_dims`) both still move every string-bearing dimension to the back. On a cube with a shared string-bearing dimension that is not its measure, **the greedy and the suggestion now recommend different orders.** That is a divergence, not a duplication, and it is deferred rather than overlooked: both are heuristics that propose an order without measuring it, and bringing them onto the frame is its own piece of work with its own tests. It is recorded here so the next reader does not discover it as a contradiction.

### 2. The `_has_string_elements` defect

`_has_string_elements` (`executors.py:219-224` at `9f9ddf8^`, where it was deleted) ran `get_element_types` **once per candidate order, inside the sweep** — a live server round-trip in the measurement loop — and it asked the wrong question. It asked whether the *candidate dimension* carried string elements.

A numeric candidate therefore passed the check and was swept into the last slot, displacing the locked dimension, and TM1 rejected the resulting write. The question that matters is not what the candidate contains but whether the **resulting order** is admissible, which is what the frame asks. One check per cube replaces N checks per sweep, and the function is deleted.

Record the consequence, because it looks like a regression and is not: on a locked cube, `optimize_position: "last"` and `optimize_dimension: <the locked dimension>` now **evaluate nothing**. Every candidate would move the locked dimension, so every candidate is skipped and the run produces no results and exits normally with the skip count logged. That is the honest answer for a slot with exactly one legal occupant. Previously those runs produced measurements for orders the server had refused to apply.

### 3. The `mid` unification, against ADR-0002

Fold A computed `mid = int(len(dimension_pool)/2)` from a pool that excluded the excluded and string dimensions; Fold B computed `int(len(resulting_order)/2)` from the full length; `target_position` indexed a third list. Setting `dimensions_to_exclude` therefore shifted the front/back split, so query-ranked front positions were pruned with the strict `TAU_RAM` instead of the wider `TAU_QUERY` — the outcome [ADR-0002](0002-cardinality-pruning-keyed-to-optimization-metric.md) explicitly rejected. Both folds now derive `mid` once, from the full storage order (`b7cd6d3`).

**State the claim precisely.** It is **not** that the swept set depends only on the dimension count: an excluded dimension's slot is still skipped, so the set of positions actually swept still varies with exclusions. What is now true is that **the range and the break point depend only on the dimension count, so the τ ranking assigned to each position no longer shifts when `dimensions_to_exclude` is set.**

That is the behaviour ADR-0002 called for, so this restores documented behaviour rather than changing it. **ADR-0002 needs no amendment** — it is referenced, not revised.

The swept positions do change, and not in one direction:

| Cube | Before | After |
|---|---|---|
| 6 dims, locked | `[0, 4, 1, 3]` | `[0, 4, 1]` |
| 6 dims, 1 excluded | `[5, 0, 4, 1, 3]` | `[5, 0, 4, 1]` |
| 8 dims, locked | `[0, 6, 1, 5, 2, 4]` | `[0, 6, 1, 5, 2]` |
| 7 dims, locked, 2 excluded | `[0, 5, 1, 4]` | `[0, 5, 1, 4, 2]` |
| 7 dims, locked | `[0, 5, 1, 4, 2]` | unchanged |

It **shortens** where the pool midpoint sat below the cube's own, and **lengthens** where two or more exclusions had pushed it further down. Anyone comparing run durations across this release needs this table: a shorter run is not evidence of lost coverage, and a longer one is not a regression.

The 7-dimension locked cube is worth its row. Seven is odd, so `len(pool)//2` and `len(dimensions)//2` were both `3` there — `mid` never moved on it. The extra position that cube gained came entirely from widening Fold A's sweep range to the full storage order with an occupant guard closing the locked slot, and it stays, correctly: it is that cube's true half-split.

## Considered alternatives

- **Amend ADR-0002 and ADR-0003 in place.** Rejected: both are accurate records of decisions taken under the arrangement this work replaced. A fourth ADR is cheaper than editing two, and rewriting a decided record to match later code destroys the reason the record exists.
- **Keep the relocation as defence in depth.** Rejected. It cannot fire after the engine reads the storage order, and code that cannot fire is not defence — it is a second rule waiting to disagree with the first, which is how the codebase reached three implementations of one constraint.
- **Make the lock a property of the dimension rather than the position.** Rejected: it is what produced the shared-dimension bug above. A dimension's element types are a property of the dimension across the whole model; the constraint is about one slot in one cube.
- **Have the frame repair an inadmissible order instead of skipping it.** Rejected: a repaired order is one the user did not ask for, reported as though they had. Skipping with a logged reason keeps the result set honest, and the result count reflects only orders that were genuinely measured.
- **Apply the frame's user preferences to explicitly named orders too.** Rejected. The lock is a server constraint and binds everything; position rules, excluded dimensions and ignored orders are preferences that shape a *search*. A TM1 developer who names an exact order in `predefined_orders` or `set` mode gets it.

## Consequences

- One module decides admissibility. No other code enforces the string constraint: `grep -rn "_has_string_elements\|_string_last_skip" src/` returns nothing.
- Production TM1 round-trips are removed from inside the sweep — the lock is one check per cube, not one per candidate.
- On a locked cube, `optimize_position: "last"` and `optimize_dimension: <locked dim>` produce no results. This is a visible behaviour change for anyone who was running them.
- On a cube with a shared string-bearing dimension that is not its measure, the greedy and `_compute_suggested_order` / `optimize-db` recommend different orders until those two are moved onto the frame.
- `dimensions_to_exclude` no longer changes which metric ranks a position, and run durations shift in both directions across this release (table above).
- Because the frame is pure, admissibility is fully testable offline. That is what let the test suite split into an offline default and an opt-in live suite without a `FakeTM1`.
- `docs/concepts/string-element-constraint.md` is rewritten around the locked slot; `CONTEXT.md` carries **order frame**, **locked slot** and **the three tiers** as project vocabulary.
