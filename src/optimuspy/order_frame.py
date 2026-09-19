# src/optimuspy/order_frame.py
"""The order frame — one authoritative frame of reference for a cube's dimension order.

A cube has one authoritative dimension order: `tm1.cubes.get_storage_dimension_order()`.
The frame owns that order and answers one question: is this candidate order
admissible, and if not, why.

If the dimension in the **last position** of the storage order contains string
elements, that position is a **locked slot**: the dimension never moves, whatever
the order source. This is a *server* constraint — TM1 rejects the write regardless
— so every order source consults the frame, and a candidate that would move the
locked dimension is skipped with a logged reason. Nothing is ever relocated.

Everything else the frame knows — position rules, excluded dimensions, ignored
orders — is a *user preference*, supplied by the greedy folds only. A TM1 developer
who names an explicit order in `predefined_orders` or set mode gets it, subject to
the lock alone.

Pure: no `TM1Service`, no I/O, and no logging of its own — `admits` returns the
reason and the caller decides how to report it. Offline-testable in the same
category as `tau.py`.

See CONTEXT.md ("Order admissibility") and docs/concepts/string-element-constraint.md.
"""
from typing import Dict, List, NamedTuple, Optional, Sequence, Set, Tuple

# Greppable codes for the reasons a candidate order is refused. The human-readable
# message travels alongside in `Admissibility.reason`.
REASON_NOT_A_PERMUTATION = "not_a_permutation"
REASON_LOCKED_SLOT = "locked_slot"
REASON_IGNORED_ORDER = "ignored_order"
REASON_POSITION_RULE = "position_rule"


class Admissibility(NamedTuple):
    """The frame's verdict on one candidate order.

    `code` is stable and greppable (for tests and log filtering); `reason` is the
    sentence a caller logs. Both are None when the order is admissible.
    """
    admissible: bool
    code: Optional[str] = None
    reason: Optional[str] = None


ADMISSIBLE = Admissibility(True)


class OrderFrame:
    """A cube's storage order plus the rules that decide which orders are allowed.

    Non-greedy callers construct it with the storage order and the lock alone, so
    only the server constraint applies. The greedy folds additionally supply the
    user preferences.
    """

    def __init__(self, storage_order: Sequence[str], last_slot_locked: bool, *,
                 dimensions_to_exclude: Sequence[str] = None,
                 orders_to_ignore: Sequence[Sequence[str]] = None,
                 position_rules: Sequence[Dict] = None):
        self.storage_order = list(storage_order)
        self.last_slot_locked = bool(last_slot_locked)
        self.dimensions_to_exclude = list(dimensions_to_exclude or [])
        self.orders_to_ignore = [list(order) for order in (orders_to_ignore or [])]
        self.position_rules = list(position_rules or [])
        self._dimensions = frozenset(self.storage_order)

    @property
    def locked_dimension(self) -> Optional[str]:
        """The dimension pinned to the last slot, or None when that slot is free."""
        if not self.last_slot_locked or not self.storage_order:
            return None
        return self.storage_order[-1]

    @property
    def locked_position(self) -> Optional[int]:
        """The index of the locked slot, or None when there is no lock."""
        if not self.last_slot_locked or not self.storage_order:
            return None
        return len(self.storage_order) - 1

    def movable_dimensions(self) -> List[str]:
        """Dimensions the greedy may relocate: storage order minus excluded minus locked.

        The locked dimension is not a swap candidate because it never moves; an
        excluded dimension is frozen at its original index by user preference.
        """
        locked = self.locked_dimension
        return [d for d in self.storage_order
                if d not in self.dimensions_to_exclude and d != locked]

    def reserved_positions(self) -> Set[int]:
        """Positions that are never a sweep target: excluded dims' slots + the locked slot."""
        reserved = {i for i, d in enumerate(self.storage_order)
                    if d in self.dimensions_to_exclude}
        locked_position = self.locked_position
        if locked_position is not None:
            reserved.add(locked_position)
        return reserved

    def admits(self, candidate_order: Sequence[str]) -> Admissibility:
        """Is this candidate order allowed? Returns the reason when it is not.

        The server constraint (the locked slot) is checked before any user
        preference, so a refusal always names the strongest reason.
        """
        candidate = list(candidate_order)

        if len(candidate) != len(self.storage_order) or frozenset(candidate) != self._dimensions:
            return Admissibility(
                False, REASON_NOT_A_PERMUTATION,
                f"order is not a permutation of the cube's dimensions "
                f"{self.storage_order}: {candidate}")

        locked = self.locked_dimension
        if locked is not None and candidate[-1] != locked:
            return Admissibility(
                False, REASON_LOCKED_SLOT,
                f"'{locked}' has string elements and is locked to the last position; "
                f"this order moves it to position {candidate.index(locked)}")

        if candidate in self.orders_to_ignore:
            return Admissibility(
                False, REASON_IGNORED_ORDER,
                f"order is listed in orders_to_ignore: {candidate}")

        unsatisfied = self._unsatisfied_position_rule(candidate)
        if unsatisfied is not None:
            rule, actual_index, required_index = unsatisfied
            return Admissibility(
                False, REASON_POSITION_RULE,
                f"dimension_position_rules: '{rule['dimension']}' must be at position "
                f"{required_index} ({rule['position']!r}), this order puts it at "
                f"{actual_index}")

        return ADMISSIBLE

    def _unsatisfied_position_rule(
            self, candidate: List[str]) -> Optional[Tuple[Dict, int, int]]:
        """The first position rule this order fails, as (rule, actual, required).

        A rule is *satisfied* when the dimension is at the position it names — that
        is the layout the user asked to lock. Integer positions are 0-based, per
        docs/advanced/dimension-position-rules.md; 'first' and 'last' are accepted
        as names for the end slots.

        A rule naming a dimension the cube does not have, or a position that cannot
        be read as an index, is skipped here: rejecting those is startup
        validation's job, where the message can name the config field.
        """
        for rule in self.position_rules:
            dim_name = rule['dimension']
            if dim_name not in candidate:
                continue
            required_index = self.required_index(rule['position'], len(candidate))
            if required_index is None:
                continue
            actual_index = candidate.index(dim_name)
            if actual_index != required_index:
                return rule, actual_index, required_index
        return None

    @staticmethod
    def required_index(position, dimension_count: int) -> Optional[int]:
        """The 0-based slot a rule's `position` names, or None if it names no slot.

        'first' and 'last' resolve to the end slots; an int is taken as written,
        0-based. Everything else resolves to None: a word that is not a keyword, a
        float (truncating 2.7 to 2 would silently reinterpret a malformed config),
        a bool, and — the reason `dimension_count` is a parameter — any index the
        cube does not have, whether too large or negative.

        None means "this rule names no slot", which `_unsatisfied_position_rule`
        passes over. Turning these into the errors the documentation promises is
        startup validation's job, where the message can name the config field.
        """
        if position == 'first':
            return 0
        if position == 'last':
            return dimension_count - 1
        # bool is a subclass of int, so True would otherwise resolve to slot 1.
        if isinstance(position, bool) or not isinstance(position, int):
            return None
        return position if 0 <= position < dimension_count else None
