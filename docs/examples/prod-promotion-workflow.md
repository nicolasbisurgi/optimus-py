# Example: PROD Promotion Workflow

End-to-end: optimize in DEV (or any production-like instance), export the results, apply to PROD. The recommended OptimusPy lifecycle.

## Why this workflow exists

OptimusPy is **never run in production**. The benchmarking process:

- Sets VMM / VMT to 1,000,000 (disables stargate caching during the run)
- Runs hundreds of `update_storage_dimension_order` calls (each rewrites the cube on disk)
- Runs queries / processes against the cube repeatedly

These are fine in a non-PROD environment with the same data and infrastructure. They're **not** OK in production. The PROD promotion workflow uses OptimusPy's results without re-running benchmarks against PROD.

## Step 1 — Optimize in DEV

Run benchmarks on a production-like environment (DEV, UAT, PA Playground — anywhere with the same data shape):

```bash
optimuspy optimize sales_dev.json
```

Where `sales_dev.json` points at the DEV instance:

```json
{
  "instance": "tm1srv01_dev",
  "cube": "Sales",
  "views": ["Optimus_Daily_Drill", "Optimus_Monthly_Summary"],
  "executions": 5,
  "output": "xlsx"
}
```

The HTML report names the winning order. Verify it makes sense — sometimes the best order has surprising tradeoffs you want to manually validate.

## Step 2 — Export from Sync Order

Open the UI on the DEV instance, navigate to **Sync Order**:

1. Connect to **source = `tm1srv01_dev`** (where you ran the benchmark)
2. Drag the optimized cubes onto the Target panel
3. Click **Export to Folder**

OptimusPy writes one `set_order.json` per cube into `exports/`:

```
exports/
├── Sales.json
└── Budget.json
```

Each file's `instance` field is set to whatever target you had selected — edit if needed.

> 📸 **Screenshot needed:** Sync Order page after Export, showing source connected to DEV and the success toast.

## Step 3 — Apply to PROD

Two choices.

### Option A — From the UI

In the same Sync Order page, switch the target to **PROD**, click **Apply All**. The job runs in the background; live progress on the Jobs page.

### Option B — Via CLI (recommended for CI/CD)

Edit each exported JSON's `instance` field to point at PROD, then loop:

```bash
for f in exports/*.json; do
  optimuspy set "$f" --config config/production.ini
done | tee deployment-$(date +%Y-%m-%d).log
```

Capture the log file. Each apply records RAM before and after — useful for change tickets.

## Step 4 — Verify

After apply, run a quick scan on PROD to confirm the new orders are in place:

```bash
optimuspy scan --instance tm1srv01_prod --include-optimized
```

The `Storage Order` column on the previously-touched cubes should now match what you applied.

## Rollback

Keep the previous orders in version control. If a rollback is needed, restore the prior `set_order.json` files and re-run the loop. The CLI is idempotent — re-applying the same order is safe.
