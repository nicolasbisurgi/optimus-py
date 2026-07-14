from optimuspy.executors import MainExecutor
from tests.test_fold_a import make_main_executor


def test_fold_b_seeds_cardinality_ascending_with_measure_last(scripted):
    dims = ["Big", "Sm", "Md", "M"]
    card = {"Big": 50000, "Sm": 50, "Md": 300, "M": 3}
    ex = make_main_executor(dims, card, fast=True)
    log = []
    scripted(ex, lambda o: 100.0, log)
    ex.context.set_initial_ram(100.0)
    ex._run_fold_b()
    # first evaluated order is the seed: ascending cardinality, measure last
    assert log[0] == ["Sm", "Md", "Big", "M"]
    # every pairwise cardinality gap here is >= tau_ram (4x), so fold_b_refine_order
    # decides every dim (nothing undecided) -> the seed apply is the ONLY reorder.
    assert len(log) == 1


def test_fold_b_skips_pinned_dims_and_refines_only_undecided(scripted):
    # NOTE: the brief's original assertion here — `all(o.index("Big") == 2 for o
    # in log)` — is not reachable: Big is pinned/decided (excluded from *refine*,
    # i.e. never chosen as the dim a sweep repositions), but _sweep_across_positions
    # moves dims via raw index swaps, so a genuinely undecided dim (A or B) being
    # swept INTO Big's seeded slot (position 2) necessarily displaces Big out of
    # it as a side effect of that swap. Hand-trace confirms this actually happens
    # here (dim B's tau-allowed span is exactly (1, 2), and 2 is Big's seeded
    # slot), so the literal brief assertion fails on a correct implementation.
    # The real, reachable invariant is: Big is never the *target_dim* of a sweep
    # (fold_b_refine_order excludes it) — we verify that directly by spying on
    # _sweep_across_positions instead of inferring it from collateral positions.
    dims = ["A", "B", "Big", "M"]
    card = {"A": 180, "B": 205, "Big": 50000, "M": 3}  # A,B undecided; Big pinned
    ex = make_main_executor(dims, card, fast=True)
    log = []
    scripted(ex, lambda o: 100.0 - len(log) * 0.1, log)
    ex.context.set_initial_ram(100.0)

    swept_dims = []
    original_sweep = ex._sweep_across_positions

    def spy_sweep(current_order, target_dim, candidate_positions, *args, **kwargs):
        swept_dims.append(target_dim)
        return original_sweep(current_order, target_dim, candidate_positions, *args, **kwargs)

    ex._sweep_across_positions = spy_sweep

    ex._run_fold_b()

    # Big is never the dimension a sweep repositions — it is excluded from
    # refine entirely because it is decided (pinned) relative to every neighbour.
    assert "Big" not in swept_dims
    # Only the genuinely undecided dims (A, B) were ever swept.
    assert set(swept_dims) == {"A", "B"}
    # first evaluated order is still the seed, with Big in its seeded slot.
    assert log[0].index("Big") == 2


def test_fold_b_caps_at_k_passes(scripted, monkeypatch):
    import optimuspy.tau as tau_mod
    monkeypatch.setattr(tau_mod, "FOLD_B_MAX_PASSES", 2)
    dims = ["A", "B", "C", "M"]
    card = {"A": 100, "B": 110, "C": 120, "M": 3}  # all undecided -> always "improvable"
    ex = make_main_executor(dims, card, fast=True)
    log = []
    # strictly decreasing RAM so every pass finds an improvement -> would loop forever if uncapped
    scripted(ex, lambda o: 100.0 - len(log) * 0.01, log)
    ex.context.set_initial_ram(100.0)
    ex._run_fold_b()
    # bounded: seed(1) + at most K passes * (dims * positions) reorders
    assert len(log) <= 1 + 2 * 3 * 3


def test_fold_b_rejects_ties_and_stops_early_when_a_pass_improves_nothing(scripted):
    # Ties (best_val == the current placement's metric) must NOT be accepted —
    # only a STRICT improvement may move resulting_order. With every candidate
    # tied at the same RAM, the very first pass finds nothing better, so the
    # K-pass loop must stop after pass 0 instead of burning all FOLD_B_MAX_PASSES.
    dims = ["A", "B", "M"]
    card = {"A": 100, "B": 110, "M": 3}  # A,B undecided; M pinned
    ex = make_main_executor(dims, card, fast=True)
    log = []
    scripted(ex, lambda o: 100.0, log)  # every permutation ties at the same RAM
    ex.context.set_initial_ram(100.0)
    ex._run_fold_b()
    # seed(1) + one full pass over refine=[B,A]: B has 1 allowed position, A has 2.
    # If ties were wrongly accepted (`<=` instead of `<`), resulting_order would
    # keep "changing" and the loop would run the full 2 passes instead of 1.
    assert len(log) == 4


def test_fold_b_process_only_leaves_position_span_unpruned(scripted):
    # ADR-0002: process-only cubes must NOT tau-prune the position SPAN
    # (tau_span=None), even though the refine SET is still pinned via TAU_RAM.
    dims = ["A", "B", "Big", "M"]
    card = {"A": 180, "B": 205, "Big": 50000, "M": 3}
    ex = make_main_executor(dims, card, fast=True, process_names=["P"])
    log = []
    scripted(ex, lambda o: 100.0, log)  # ties everywhere -> no improvement ever accepted
    ex.context.set_initial_ram(100.0)

    swept_dims = []
    original_sweep = ex._sweep_across_positions

    def spy_sweep(current_order, target_dim, candidate_positions, *args, **kwargs):
        swept_dims.append(target_dim)
        return original_sweep(current_order, target_dim, candidate_positions, *args, **kwargs)

    ex._sweep_across_positions = spy_sweep

    ex._run_fold_b()

    # Big/M are still decided (pinned) under TAU_RAM -> excluded from refine.
    assert set(swept_dims) == {"A", "B"}
    # Seed places B at index 1; under a tau_ram-PRUNED span, B could never reach
    # index 0 (M must precede it there, so lo=1). Reaching index 0 proves the
    # SPAN itself was left unpruned for this process-only cube.
    assert any(o.index("B") == 0 for o in log)


def test_fold_b_uses_looser_query_tau_when_views_present(scripted):
    # With views set, both the refine SET and the position SPAN use TAU_QUERY
    # (10x), not TAU_RAM (4x). B/A = 500/100 = 5x: decided (excluded from refine)
    # under TAU_RAM, but undecided (included) under TAU_QUERY. If Fold B
    # mistakenly used TAU_RAM here, refine would be empty and nothing beyond the
    # seed would ever be evaluated.
    dims = ["A", "B", "M"]
    card = {"A": 100, "B": 500, "M": 3}
    ex = make_main_executor(dims, card, fast=True, view_names=["V"])
    log = []
    scripted(ex, lambda o: 100.0, log, query_of=lambda o: 1.0)  # ties -> no acceptance needed
    ex.context.set_initial_ram(100.0)
    ex._run_fold_b()
    # Coordinate descent genuinely swept B and A beyond the seed -> only possible
    # under the looser TAU_QUERY refine set.
    assert len(log) > 1


def test_fold_b_never_refines_string_dim_off_last(scripted):
    # Review fix: refine must exclude ALL string-bearing dims (decided-by-rule,
    # seeded last), not just the pinned measure. Before the fix, a non-measure
    # string dim that happens to be "undecided" by cardinality (within tau of
    # some other dim) stayed in refine. Since the seed always places string dims
    # last, and the span->positions filter forbids a string dim's OWN sweep from
    # landing back on the last index, refining it necessarily moves it off the
    # last slot with no way back -- violating the hard string-last TM1 rule.
    #
    # "S" (card 120) is deliberately within tau of "D1" (card 100, 1.2x) so it is
    # genuinely undecided -> a real trigger for the bug, not a decided/pinned dim
    # that would be excluded anyway. "D2" (card 50000) dominates D1 by >>4x, which
    # caps D1's own allowed span below the last index (index 3) -- so D1's sweep
    # can never collaterally bump S off its seeded slot either, keeping the
    # assertion clean.
    dims = ["D1", "D2", "S", "M"]
    card = {"D1": 100, "D2": 50000, "S": 120, "M": 3}
    ex = make_main_executor(dims, card, fast=True, string_dims=["S"])
    log = []
    scripted(ex, lambda o: 100.0, log)  # ties everywhere -> nothing ever accepted
    ex.context.set_initial_ram(100.0)

    swept_dims = []
    original_sweep = ex._sweep_across_positions

    def spy_sweep(current_order, target_dim, candidate_positions, *args, **kwargs):
        swept_dims.append(target_dim)
        return original_sweep(current_order, target_dim, candidate_positions, *args, **kwargs)

    ex._sweep_across_positions = spy_sweep

    ex._run_fold_b()

    # S is undecided (within tau of D1) yet must NEVER be the target dim a sweep
    # repositions -- it is excluded from refine unconditionally as a string dim.
    assert "S" not in swept_dims
    # The genuinely undecided non-string dim (D1) was still refined normally.
    assert "D1" in swept_dims
    # S never leaves its seeded last slot in any evaluated order.
    assert all(o[-1] == "S" for o in log)


def test_fold_b_resume_skips_seed_and_completed_passes(scripted):
    # On resume, _run_fold_b must NOT re-apply the seed (that % was already
    # anchored before checkpointing) and must resume from the checkpointed
    # current_order / pass_index rather than restarting the coordinate descent.
    dims = ["A", "B", "C", "M"]
    card = {"A": 100, "B": 110, "C": 120, "M": 3}  # all undecided -> always "improvable"
    ex = make_main_executor(dims, card, fast=True)
    log = []
    scripted(ex, lambda o: 100.0 - len(log) * 0.1, log)
    ex.context.set_initial_ram(100.0)

    resumed_order = ["C", "B", "M", "A"]
    resume_state = {"executor_state": {"fold_b_state": {
        "seed_order": ["A", "B", "C", "M"],
        "current_order": list(resumed_order),
        "pass_index": 1,  # only the last of FOLD_B_MAX_PASSES=2 remains
    }}}
    ex._run_fold_b(resume_state)

    # No seed re-apply: the first evaluation must be a sweep candidate derived
    # from the resumed current_order, not the freshly-computed seed.
    assert log[0] != ["A", "B", "C", "M"]
    assert log[0] == ["B", "C", "M", "A"]
    # Only ONE remaining pass ran (pass_index resumed at 1, cap is 2): refine=[C,B,A].
    # dim C sweeps 3 positions (current_idx=0 -> [1,2,3]), then dim B sweeps 2
    # positions (current_idx=1 -> [2,3]), then dim A sweeps 3 positions (its
    # current_idx has shifted to 0 by then, since resulting_order was updated by
    # the C- and B-sweeps within this same pass -> [1,2,3] again). 3+2+3=8, with
    # no seed-apply reorder.
    assert len(log) == 8
