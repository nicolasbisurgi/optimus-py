# UI Overview

OptimusPy ships with a local web UI that wraps the entire scan → configure → optimize → apply workflow. It's a single-page app served by a lightweight Python HTTP server — no extra dependencies, no cloud.

## Launching

```bash
python -m optimuspy.ui
```

Your default browser opens automatically at `http://127.0.0.1:8765`. The server runs in the foreground — `Ctrl+C` to stop.

### Custom port

```bash
python -m optimuspy.ui --port 9000
```

### Custom config file

```bash
python -m optimuspy.ui --config config/production.ini
```

### From the executable

If you're using the prebuilt Windows `.exe`:

```cmd
optimuspy.exe ui
```

## Sidebar navigation

> 📸 **Screenshot needed:** The full sidebar with all five pages and the instance switcher visible.

| Item | Purpose |
|---|---|
| **Instance switcher** | Pick the active TM1 connection. The current instance powers all pages. |
| **Optimize** | Scan candidates and run benchmarks for one or many cubes. |
| **Sync Order** | Promote dimension orders from a source instance to a target instance. |
| **Results** | Browse generated HTML / CSV / XLSX reports. |
| **Settings** | Manage TM1 connections, theme, and local cache. |

The sidebar collapses to icons on narrow screens. The **Activity Monitor** at the bottom shows live progress when a job is running.

## Live progress (SSE)

Long-running jobs stream progress over Server-Sent Events. You'll see per-iteration updates without refreshing the page — works in any modern browser.

## Caching

Scan results and per-cube intelligence (leaf counts, suggested orders) are cached in your browser's `localStorage`:

- Scan cache → 24-hour expiry
- Intelligence cache → 7-day expiry

If you change something on the TM1 server (e.g. delete string elements, rename a dimension), use **Settings → Clear Cache** to force a fresh fetch.

## Pages at a glance

- **[Optimize](optimize-page.md)** — the main workflow: scan, configure, run.
- **[Sync Order](sync-order-page.md)** — drag-and-drop cross-instance promotion.
- **[Results](results-page.md)** — generated HTML reports + raw data.
- **[Settings](settings-page.md)** — connection CRUD + cache management.
