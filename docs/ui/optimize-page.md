# Optimize Page

The Optimize page is the heart of OptimusPy. Connect to an instance, scan for candidate cubes, and configure benchmarks — one cube at a time or in bulk.

> 📸 **Screenshot needed:** Optimize page with cube list populated and a cube selected.

## Connecting & scanning

1. Pick an instance from the sidebar **Instance Switcher**. The UI runs a connection test and a fast model scan.
2. Adjust the **RAM threshold** slider to control how aggressively cubes are filtered (default: 60% of total model RAM).
3. Toggle **Include Optimized** to also list cubes that already have a custom storage order.

The scan calls `}StatsByCube` on the TM1 server — a single fast MDX query. Results are cached locally for 24 hours; click **Re-scan** to refresh.

## Cube workspace

Click any cube in the list to open its workspace. Three tabs:

### Overview

Dimension table with leaf element counts, string-element flags, and a **Suggested Order** generated from a size-based heuristic (small dims first, string-bearing dims locked last).

> 📸 **Screenshot needed:** Overview tab showing dimension table and Suggested Order panel.

### Configure

Pick the optimization mode and tune parameters. Available modes:

- **Greedy** — full outside-in benchmark (default)
- **Predefined Orders** — test a known list of orders
- **Position** — optimize a single position
- **Dimension** — optimize a single dimension

For each mode you can:

- Pick **views** to benchmark query speed
- Pick **TI processes** to benchmark ETL time (with parameter overrides)
- Set **executions** (how many times each query/process runs — median wins)
- Set **dimensions to exclude** (kept fixed during the search)
- Set **dimension position rules** (lock specific dims to specific positions)
- Toggle **auto-apply** to write the best order back to the cube

> 📸 **Screenshot needed:** Configure tab with greedy mode, views selected, and dimension position rules applied.

### Run

Preview the generated JSON config (it's identical to what the CLI consumes) and **Run Optimization**. The job spawns in the background and streams progress to the Activity Monitor.

> 📸 **Screenshot needed:** Run tab with JSON preview and Run button.

## Cancelling a job

Click the running job in the sidebar Activity Monitor → **Cancel**. OptimusPy aborts the current iteration cleanly, restores the original VMM/VMT, and writes a checkpoint so you can resume later.

## What happens next

Results land on the [Results page](results-page.md). Live progress is on the [Jobs page](jobs-page.md).
