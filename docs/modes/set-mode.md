# Set Mode

Apply a specific dimension order to a cube without benchmarking. No iterations, no measurements — just a write.

## When to use

- **Promoting** an optimized order from DEV to PROD.
- **Rolling back** to a known-good order after a failed experiment.
- **Scripted deployments** as part of a release pipeline.

For interactive cross-instance promotion, the [Sync Order page](../ui/sync-order-page.md) is usually faster. Use Set mode when you want CLI scripting or version control of the exact order applied.

## JSON config

Set mode reuses the cube config schema with a single rule: `predefined_orders` must contain **exactly one** entry — the order to apply.

```json
{
  "instance": "tm1srv01_prod",
  "cube": "Sales",
  "predefined_orders": [
    ["Time", "Version", "Product", "Customer", "SalesMeasure"]
  ],
  "executions": 1,
  "output": "csv"
}
```

`executions` and `output` are required by the schema but ignored — they only matter for benchmarks.

## CLI usage

```bash
optimuspy set sales_prod.json
```

OptimusPy validates the cube exists, that the dimension list matches the cube's current dimensions (a sanity check — no missing or extra dims), then calls `update_storage_dimension_order`.

## Output

A short log line and a non-zero exit code on failure:

```
2026-04-01 14:22:01 - optimuspy - INFO - SET mode: applying dimension order for cube 'Sales' to: ['Time', 'Version', 'Product', 'Customer', 'SalesMeasure']
2026-04-01 14:22:03 - optimuspy - INFO - Dimension order updated for cube 'Sales'
2026-04-01 14:22:08 - optimuspy - INFO - RAM before: 4.21 GB, after: 2.84 GB
```

## Bulk apply via shell

The Sync Order page's **Export to Folder** button generates one `set_order.json` per cube. Apply them all in a loop:

```bash
for f in exports/*.json; do
  optimuspy set "$f"
done
```

[End-to-end example → PROD Promotion Workflow](../examples/prod-promotion-workflow.md)
