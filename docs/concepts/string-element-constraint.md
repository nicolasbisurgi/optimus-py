# String Element Constraint

TM1 has a hard rule: dimensions containing **string elements** can only appear in the **last position** of a cube's storage order. OptimusPy enforces this automatically.

## The constraint

In TM1, the last dimension of a cube is the **measure dimension**. Numeric values are stored against members of every other dimension, but string values can only be stored in the measure dimension.

If a dimension that contains any string element is placed anywhere except last, `update_storage_dimension_order` fails with:

```
TM1 error: String elements not allowed in this dimension position
```

This is a TM1 limitation, not an OptimusPy choice. It applies whether the dimension is mostly numeric and contains a single string element, or is entirely string-typed.

## How OptimusPy detects it

Before benchmarking, OptimusPy queries each dimension's element types via `tm1.elements.get_element_types`. If any leaf element has type `String`, the dimension is flagged.

The cached **dimension intelligence** in the UI surfaces this with a "has strings" badge per dimension on the Overview tab.

## What gets skipped

During greedy / position / dimension optimization, swap candidates that would put a string-bearing dimension anywhere except last are silently skipped. The skipped order does **not** appear in the result count.

```
Skipping order due to string element constraint: ['Time', 'Region', 'Measures', ...]
```

This message is logged at DEBUG level (suppressed by default) — see [Optimization Logging](../concepts/how-it-works.md) for verbose output.

## When the last position is a string dim

If your cube already has a string-bearing dimension in the last position (which it must, if any dim has strings), OptimusPy treats that dimension as **locked** to the last slot. The greedy algorithm only permutes the remaining N-1 dimensions across positions 0 to N-2.

## What if I want to remove the string elements?

The TM1 cookbook has detailed guidance — typically you split the dimension into "measure" + "attribute" pieces. Once strings are removed, OptimusPy's [scan](../modes/scan-mode.md) re-detects the change (after a [cache clear](../ui/settings-page.md)) and the dimension becomes a normal swap candidate again.
