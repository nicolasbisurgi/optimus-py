# Predefined Orders

Skip the greedy search and benchmark a hand-picked list of dimension orders. The fastest, most controlled way to compare a few candidates head-to-head.

## When to use

- You've followed **TM1 best practices** (small dims first, string dims last, density rules) and want to confirm which of two or three candidates wins.
- A colleague proposed an order and you want to compare it against the current one.
- You're **A/B testing** the result of a Greedy run against the original to confirm the gain.

## JSON config example

```json
{
  "instance": "tm1srv01",
  "cube": "Sales",
  "views": ["Optimus_Sales_View"],
  "executions": 5,
  "output": "csv",
  "predefined_orders": [
    ["Time", "Version", "Product", "Customer", "SalesMeasure"],
    ["Customer", "Product", "Version", "Time", "SalesMeasure"],
    ["Product", "Customer", "Time", "Version", "SalesMeasure"]
  ]
}
```

OptimusPy benchmarks **only** these three orders. The original order is also evaluated automatically as a baseline. No greedy search, no extra iterations.

## Building orders in the UI

The Optimize page → Configure tab → **Mode: Predefined Orders** opens a builder. Drag dimensions to reorder them, then click **Add Order** to save. The builder shows the **leaf element count** next to each dimension to help you sort by size at a glance.

> 📸 **Screenshot needed:** The Build Predefined Order modal with leaf element counts visible next to each dimension.

You can add multiple orders to test them all in one run.

## Interaction with `orders_to_ignore`

`orders_to_ignore` is **ignored** in predefined mode — you've already explicitly listed every order you want tested. There's nothing to filter out.

## CLI

```bash
optimuspy optimize sales_predefined.json
```

Output is identical to greedy mode — same HTML report, same CSV/XLSX, same podium. The only difference is the iteration count.
