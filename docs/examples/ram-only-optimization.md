# Example: RAM-Only Optimization

The fastest baseline. No views, no processes — just RAM. Perfect for a first pass on a model where you don't have benchmark views set up yet.

## Config

```json
{
  "instance": "tm1srv01",
  "cube": "Sales",
  "executions": 5,
  "output": "csv"
}
```

That's it. The absence of `views` and `processes` triggers RAM-only mode.

## Run command

```bash
optimuspy optimize sales_ram_only.json
```

## Expected output

A console log per iteration:

```
Original Order - Testing order: ['Periods', 'Currency', 'Versions', 'Accounts', 'Customer', 'Sales']
Original Order - Result: RAM [GB]: 4.21
Iteration 1 of 30 - Testing order: ['Sales', 'Currency', 'Versions', 'Accounts', 'Customer', 'Periods']
Iteration 1 of 30 - Result: RAM [GB]: 3.84
...
Iteration 30 of 30 - Testing order: ['Periods', 'Sales', 'Currency', 'Versions', 'Customer', 'Accounts']
Iteration 30 of 30 - Result: RAM [GB]: 2.71
Completed analysis for cube 'Sales'
Iteration 30 was the best one for cube 'Sales' - RAM [GB]: 2.71 - Order: ['Periods', 'Sales', 'Currency', 'Versions', 'Customer', 'Accounts']
Restored original dimension order for cube 'Sales'
```

The last line confirms the original order has been restored. Add `"update": true` to apply the best order automatically.

## Output files

```
results/
├── Sales_2026-04-01_15-23-44.html   ← interactive report
└── Sales_2026-04-01_15-23-44.csv    ← raw data
```

The CSV has one row per tested order. Its column header and first two rows, from a run on `plan_BudgetPlan` with one view:

```text
ID,Mode,Is Best,Composite Query Time,Query Ratio,Composite Process Time,Process Ratio,RAM,RAM in GB,% Reduction,Reorder Duration,Dimension1,Dimension2,Dimension3,Dimension4,Dimension5,Dimension6,Dimension7
1,Original Order,False,0.15396904945373535,0.0,0,0,4191232.0,0.0039033889770507812,0%,0.17728924751281738,plan_version,plan_business_unit,plan_exchange_rates,plan_department,plan_source,plan_chart_of_accounts,plan_time
2,Iterations,False,0.15952587127685547,0.036090511975199524,0,0,4191232.0,0.0039033889770507812,0%,0.3442380428314209,plan_business_unit,plan_version,plan_exchange_rates,plan_department,plan_source,plan_chart_of_accounts,plan_time
```

## When this is enough

RAM-only optimization is a good first pass when:

- You don't have representative views configured yet
- The cube is **read-mostly** and RAM dominates the cost
- You want a **quick triage** before committing to a longer view-based benchmark

For production-critical cubes, follow up with [View Benchmarking](view-benchmarking.md).

## Sample file

The repository includes [`samples/optimize.json`](optimize.json) — copy it into your working directory and edit for your cube.
