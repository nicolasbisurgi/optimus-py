# Checkpoints & Resume

OptimusPy persists progress mid-run so a crash, network blip, or `Ctrl+C` doesn't lose hours of benchmarking work.

## When checkpoints are written

After **every successful permutation evaluation**. The checkpoint contains:

- The original dimension order (for restoration)
- The original RAM baseline
- The list of completed `PermutationResult` objects (deserialized from disk on resume)
- The greedy algorithm state (current iteration, target position, tested dimensions in this round)
- A fingerprint of the input config (so a changed config invalidates the checkpoint)

Checkpoints live in `results/` named `checkpoint_{cube}_{instance}.json`.

## Resuming from a checkpoint

Just **re-run the same command**:

```bash
optimuspy optimize my_cube.json
```

OptimusPy detects the checkpoint, validates that:

1. The current dimension order matches the original captured at start
2. The config fingerprint matches the saved one

If both match, it logs:

```
Resuming from checkpoint — restoring previous progress
Restored 23 completed permutations from checkpoint
```

…and continues from where it left off. Already-completed permutations are not re-evaluated.

If validation fails (someone changed the cube manually, or the config was edited), OptimusPy logs a warning and starts fresh.

## Disabling resume

To force a clean start and ignore any existing checkpoint:

```bash
optimuspy optimize my_cube.json --no-resume
```

The existing checkpoint is deleted before the run starts.

## When checkpoints are removed

- On **successful completion** of the optimization run
- On `--no-resume` re-run
- Manually: `rm results/checkpoint_<cube>_<instance>.json`

## Cancelled jobs

When you cancel from the [Jobs page](../ui/jobs-page.md), OptimusPy:

1. Stops the current iteration cleanly
2. Restores VMM/VMT and the original dimension order
3. Writes a final checkpoint
4. Exits

Re-launching the same config resumes from the last completed iteration.

## Concurrent runs

There is **no lock file**. If you launch two OptimusPy processes against the same cube, both will read the same checkpoint, race on `update_storage_dimension_order`, and produce undefined results. Don't do this.

The web UI's [JobManager](../ui/jobs-page.md) prevents concurrent jobs **within the same UI process**. Cross-process safety is your responsibility.
