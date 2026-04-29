# Exporting & Importing Orders

Promote optimized dimension orders from the instance where you ran benchmarks to the instance where they should take effect — usually DEV → PROD. Two paths: the [Sync Order](../ui/sync-order-page.md) page (interactive) or CLI-compatible JSON files (scripted).

## Export from the UI

Open the [Sync Order page](../ui/sync-order-page.md):

1. Connect to the **source** instance and scan.
2. Drag cubes from the source list to the target panel. Drag order = apply order.
3. Click **Export to Folder**.

OptimusPy writes one JSON per cube into the local `exports/` directory:

```
exports/
├── Sales.json
├── Budget.json
└── Forecast.json
```

> 📸 **Screenshot needed:** The Sync Order page after Export, showing the success toast and a Finder/Explorer view of the exports/ folder.

## CLI-compatible JSON format

Each exported file uses the **same schema** as a manually-written `set_order.json`:

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

The `instance` field defaults to whatever target instance you had selected at export time — change it if you want to apply to a different target.

## Bulk apply with the CLI

A loop over the exports folder:

=== "bash / zsh"

    ```bash
    for f in exports/*.json; do
      echo "Applying $f"
      optimuspy set "$f" || echo "FAILED: $f"
    done
    ```

=== "PowerShell"

    ```powershell
    Get-ChildItem exports/*.json | ForEach-Object {
      Write-Host "Applying $_"
      optimuspy set $_.FullName
    }
    ```

Each `optimuspy set` call exits non-zero on failure — useful for CI/CD pipelines.

## Apply via Sync Order page

If you'd rather apply from the UI, click **Apply All** on the Sync Order page. This runs the same `update_storage_dimension_order` calls in a background job with live progress on the [Jobs page](../ui/jobs-page.md).

| Method | When to use |
|---|---|
| **CLI loop** | Scripted deployments, version-controlled apply, CI/CD |
| **Apply All** | Ad-hoc promotions, one-off DEV → PROD workflows |
| **Direct call** to a single `set_order.json` | Rolling out one cube at a time |

## Verifying the apply

After apply, the `optimuspy set` log shows RAM before and after:

```
SET mode: applying dimension order for cube 'Sales' to: ['Time', 'Version', ...]
Dimension order updated for cube 'Sales'
RAM before: 4.21 GB, after: 2.84 GB
```

For a full audit trail across many cubes, capture stdout to a file:

```bash
for f in exports/*.json; do
  optimuspy set "$f"
done | tee deployment-2026-04-01.log
```
