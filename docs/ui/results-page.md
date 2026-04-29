# Results Page

All optimization runs write artifacts to the local `results/` directory. The Results page lists them with most recent first and lets you open or download each file.

> 📸 **Screenshot needed:** Results page showing a list of result files with cube names, types, and timestamps.

## Result file types

Every successful run generates one HTML report. Depending on the `output` field in your config, you also get a CSV or an XLSX with the raw data.

| Extension | Purpose |
|---|---|
| `.html` | Interactive report with podium + scatter chart |
| `.csv` | One row per tested permutation, all metrics |
| `.xlsx` | Same as CSV, multi-sheet with formatting |

Files are named `{cube}_{YYYY-MM-DD_HH-MM-SS}.{ext}` so they sort chronologically.

## Reading the HTML report

Open any `.html` file. The report has three sections:

### Podium

Top three orders by composite score, side-by-side. The winner is highlighted.

> 📸 **Screenshot needed:** The podium section of the HTML report with three side-by-side order cards.

### Scatter chart (Chart.js)

Every tested permutation plotted on RAM (X) vs query time (Y). Hover any dot for the full order. The original order is marked in a contrasting color.

> 📸 **Screenshot needed:** Scatter chart showing all tested orders, with the original and best orders highlighted.

### Detail table

Every permutation, every metric, sortable. Use this when you want to dig into the raw numbers — RAM in bytes, individual query times per view, individual process times per process.

## Downloading CSV / XLSX

Click any row's filename. CSVs open in Excel / Numbers / your editor of choice. XLSX files have separate sheets for permutations, per-view query times, per-process times, and configuration metadata.

## Where results live on disk

```
results/
├── Sales_2026-04-01_15-23-44.html
├── Sales_2026-04-01_15-23-44.csv
└── Budget_2026-04-01_16-02-11.html
```

Files are never auto-deleted — clean up old runs manually.

## Checkpoint files

Files named `checkpoint_*.json` in `results/` are mid-run state snapshots used by the resume feature. They're hidden from the Results page list. See [Checkpoints & Resume](../advanced/checkpoints-resume.md).
