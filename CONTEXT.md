# OptimusPy

OptimusPy benchmarks TM1 cube dimension-storage orders to find the order that minimises RAM (and/or query time). It reorders a cube's storage dimensions, measures the resulting per-cube memory, and reports the best permutation.

## Language

### Memory measurement

**RAM baseline**:
The per-cube memory figure OptimusPy reads before and after each permutation to decide which order is best. Always held internally in **bytes**.
_Avoid_: "memory footprint", "size"

**cube_memory_used**:
The canonical MetricService metric name for a cube's total memory. Replaces the v11-only `StatsByCube` → `Total Memory Used` lookup. Version-agnostic in *name*, but its `Unit` differs by server version.
_Avoid_: "Total Memory Used" (that is the v11 MDX measure, now an implementation detail behind the metric)

**MetricService**:
The version-agnostic TM1py service (`tm1.metrics`, TM1py ≥ 2.3.0) that serves model statistics. `by_cube()` returns per-cube gauge rows; OptimusPy uses it as the single source of RAM data on both v11 and v12.
_Avoid_: "StatsByCube" / "PerfCubes" (v11 control cubes, now hidden behind MetricService)

**Unit (of a metric)**:
The unit tag MetricService attaches to each metric value (`B`, `KB`, `MB`, `#`, `%`…). MetricService normalises metric *names* across versions but **not** units — `cube_memory_used` is `B` on v11 and `KB` on v12. Callers must read `Unit` and convert to bytes.
_Avoid_: assuming a fixed unit; hardcoding `×1024`

### Dimension shape

**cardinality**:
The number of leaf-level elements in a dimension. The cheap, reorder-free signal OptimusPy uses to decide, pin, and prune dimension orderings in the greedy optimizer. Distinct from RAM: a high-**cardinality** dimension is not necessarily a large **RAM baseline** contributor (density/sparsity matters more), which is why placement is still confirmed by measurement.
_Avoid_: "size" (reserved-against for memory — ambiguous), "dimension size", "number of elements" (imprecise about leaf vs consolidated)

**leaf-count tolerance (τ)**:
The ratio that decides whether the greedy will test *both* relative orderings of two dimensions. If one dimension's **cardinality** is ≥ τ× another's, theory decides the order (larger ⇒ sparser ⇒ later) and the reverse ordering is never tested; within τ the pair is *undecided* and both orderings are tested, because density — which OptimusPy cannot know in advance — may justify either. Larger τ ⇒ looser ⇒ more orderings tested. Applied full-strength at RAM-ranked positions, looser at query-ranked positions, and not at all at process-ranked positions (see `docs/adr/0002`). Pinning a dimension (e.g. a 50k-leaf dim to the back) is just the degenerate case where τ leaves it the only candidate for an end position.
_Avoid_: "bucket" / "size band" — an earlier, lossier framing; dimensions do not fall into fixed cardinality bands, ordering is decided pairwise.

## Relationships

- A **permutation** (storage dimension order) produces one **RAM baseline** reading via **cube_memory_used**
- **cube_memory_used** is served by **MetricService**, carrying a **Unit** that must be converted to bytes at the read boundary

## Scope of the v12 migration

Behavior is **frozen** — only the *data source* changes. The RAM model is unchanged: read a **RAM baseline** once at the start, then derive every other permutation's RAM by applying the `%` change that `update_storage_dimension_order` returns (confirmed to return a real `%` on v11 **and** v12). OptimusPy does **not** read per-permutation memory from the server. The migration swaps the `}StatsByCube` MDX reads for `MetricService.by_cube()` reads. On v11 the Performance Monitor must still be active before reading (toggled via `tm1.metrics` lifecycle methods); on v12 nothing is toggled because the metric is always available. The VMM/VMT cap raise-and-restore is v11-only too — it reads/writes the `}CubeProperties` control cube, which does not exist on v12, so optimize mode simply skips it there.

## config.ini location resolution

Both entry points (`optimuspy` CLI and `python -m optimuspy.ui`) resolve the connection config the same way, via `resolve_config_path`:

- `--config PATH` (explicit) beats the built-in default.
- No `--config` ⇒ falls back to `config/config.ini`, which stays **writable** (the UI Settings page can create/edit/delete instances in it).
- Explicit `--config PATH` ⇒ treated as owned by another tool and **read-only**; OptimusPy never writes to it. This is what lets a `config.ini` be shared safely with other tm1py tools (e.g. RushTI) instead of duplicating credentials.
- Explicit `--config PATH` that doesn't exist ⇒ fail-fast: print `ERROR: config.ini not found: <path>` and exit 1, no traceback. (The default path has no such existence check; it's left to the existing read path.)

Out of scope / not shipped: no environment-variable override, no keyring integration (deferred to a later phase), no comment-preserving INI writer.

## Flagged ambiguities

- "RAM" / "memory" was used loosely — resolved: OptimusPy's internal canonical unit is **bytes**; conversion from the metric's reported **Unit** happens once, at the read boundary, so all downstream `/ 1024**3` GB math is unchanged.

## Example dialogue

> **Dev:** "After a permutation, where do we get the new **RAM baseline**?"
> **Domain expert:** "From **MetricService** `by_cube()` — read the `cube_memory_used` row, then convert by its **Unit**: `B`→×1, `KB`→×1024. Never assume bytes; v12 reports KB."
