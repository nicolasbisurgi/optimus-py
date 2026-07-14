# src/optimuspy/tau.py
"""Leaf-count tolerance (τ) — the cardinality-pruning core of the smart greedy.

Pure functions over dimension *cardinality* (leaf-element counts). No TM1, no
I/O. See docs/adr/0002-cardinality-pruning-keyed-to-optimization-metric.md and
CONTEXT.md (terms: cardinality, leaf-count tolerance (τ)).

The decided-after relation: X is *decided to sit after* Y (larger => sparser =>
later) iff cardinality(X) / cardinality(Y) >= τ. It is a strict partial order
(antisymmetric; transitive for τ > 1), so it can never produce a contradictory
cycle. Pinning and the confidence gate are emergent degenerate cases, not
special-cased here.
"""
from typing import List, Tuple

# Initial tunable ratios — validated against samples/, not user-exposed. None final.
TAU_RAM = 4.0     # decides an ordering at RAM-ranked positions (full strength)
TAU_QUERY = 10.0  # looser ratio at query-ranked front positions
FOLD_B_MAX_PASSES = 2  # K: Fold B coordinate-descent pass cap


def decides_after(card_larger: int, card_smaller: int, tau: float) -> bool:
    """True if card_larger is decided to sit AFTER card_smaller (>= τ ratio)."""
    if card_smaller <= 0:
        return card_larger > 0
    return card_larger / card_smaller >= tau


def back_frontier(unplaced: List[Tuple[str, int]], tau: float) -> List[str]:
    """Dims eligible for the current back-most open position.

    The maximal elements of the decided-after order: a dim survives unless some
    other unplaced dim is decided to sit after it. Equivalently, dims within τ of
    the current maximum cardinality. Preserves input order.
    """
    if not unplaced:
        return []
    maximum = max(card for _, card in unplaced)
    return [name for name, card in unplaced if not decides_after(maximum, card, tau)]


def front_frontier(unplaced: List[Tuple[str, int]], tau: float) -> List[str]:
    """Dims eligible for the current front-most open position.

    The minimal elements: a dim survives unless it is decided to sit after some
    other unplaced dim. Equivalently, dims within τ of the current minimum
    cardinality. Preserves input order.
    """
    if not unplaced:
        return []
    minimum = min(card for _, card in unplaced)
    return [name for name, card in unplaced if not decides_after(card, minimum, tau)]
