# Sync Order Page

Promote optimized dimension orders from a non-production instance (where you ran benchmarks) to production (where you didn't). Drag cubes from a Source panel on the left to a Target panel on the right, then either apply directly or export CLI-compatible JSON files.

> 📸 **Screenshot needed:** Sync Order page with both panels populated and a cube being dragged from Source to Target.

## Source panel

1. Pick a **source instance** from the dropdown and click **Connect & Scan**.
2. The full cube list appears — toggle **Include Optimized** if you want to also see cubes with a custom storage order (recommended for sync workflows).
3. Drag any cube row from the source list onto the Target panel's drop zone.

The drag order matters — the order in which you drop cubes into the Target panel becomes the order in which they're applied.

## Target panel

1. Pick a **target instance** and click **Connect**. (You don't have to connect the target to drag — connecting just enables the current-vs-proposed preview and the Apply button.)
2. Each dropped cube renders as a card showing:
    - **Current (Target)** — the cube's current storage order on the target instance
    - **Proposed (Source)** — the storage order from the source instance, with changes highlighted

> 📸 **Screenshot needed:** A target card showing current vs proposed orders side by side, with highlighted dim changes.

3. Cubes that don't exist on the target are flagged with a warning and excluded from Apply.

## Apply All

Runs all proposed orders sequentially as a background job. Live progress streams to the [Jobs page](jobs-page.md). Each cube reports `success` or `error` independently — one failure does not abort the batch.

!!! warning "Production effect"
    Apply All directly mutates the target cube via `update_storage_dimension_order`. There is no preview-only mode. Verify the target panel before clicking.

## Export to Folder

Generates one `set_order.json` file per cube into the local `exports/` directory. Each file is **CLI-compatible** with `optimuspy set <file>.json`. Use this when you'd rather apply orders via a controlled deployment pipeline than from the UI.

```json
{
  "instance": "tm1srv01_prod",
  "cube": "Sales",
  "predefined_orders": [["Time", "Version", "Product", "Customer", "SalesMeasure"]],
  "executions": 1,
  "output": "csv"
}
```

```bash
optimuspy set exports/Sales.json
```

## Same-instance warning

If source and target are the same instance, OptimusPy shows an informational toast — useful when you're testing the workflow against a single instance, but easy to miss otherwise.
