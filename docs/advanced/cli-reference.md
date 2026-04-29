# CLI Reference

Every command, mode, and flag.

## Command syntax

```
optimuspy <mode> <cube_config.json> [options]
```

| Mode | Purpose |
|---|---|
| `optimize` | Benchmark dimension orders (greedy / predefined / position / dimension) |
| `set` | Apply a specific order without benchmarking |
| `scan` | Discover candidate cubes in an instance |

## Global options

| Option | Default | Description |
|---|---|---|
| `--config <path>` | `config/config.ini` | Path to TM1 connection config |
| `-p <password>` | (from config.ini) | Override password for the active instance |
| `--no-resume` | (off) | Ignore any existing checkpoint and start fresh |

## `optimize` mode

```bash
optimuspy optimize my_cube.json
optimuspy optimize my_cube.json --config config/production.ini
optimuspy optimize my_cube.json -p mypassword
```

The behavior (greedy vs predefined vs position vs dimension) is determined by the JSON config:

- **Greedy** — no special field
- **Predefined** — `predefined_orders` is set
- **Position** — `optimize_position` is set
- **Dimension** — `optimize_dimension` is set

Mutually exclusive — only one of `predefined_orders` / `optimize_position` / `optimize_dimension` may be set.

## `set` mode

```bash
optimuspy set apply_sales.json
```

Requires `predefined_orders` with **exactly one** entry — the order to apply. No iterations, no measurements.

## `scan` mode

```bash
optimuspy scan --instance tm1srv01
optimuspy scan --instance tm1srv01 --output configs/auto/
optimuspy scan --instance tm1srv01 --include-optimized
```

| Option | Description |
|---|---|
| `--instance <name>` | **Required.** Section name in `config.ini`. |
| `--output <dir>` | Generate one JSON config per candidate cube into this directory. |
| `--include-optimized` | Show cubes that already have a custom storage order. |
| `--ram-percent <int>` | RAM threshold (default 60). Cubes accounting for up to this % of total model RAM are listed. |

## Module mode

```bash
python -m optimuspy optimize my_cube.json
```

Identical behavior to the `optimuspy` console script — useful when the script is not on `PATH`.

## Web UI

```bash
python -m optimuspy.ui                   # default localhost:8765
python -m optimuspy.ui --port 9000
python -m optimuspy.ui --config production.ini
```

[UI Overview →](../ui/overview.md)

## Backward-compatible script entry

For installations from source without `pip install -e .`:

```bash
python optimuspy.py optimize my_cube.json
python ui.py
```

Both wrappers call into the same `optimuspy` package.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Validation failure or runtime error |
| `2` | TM1 connection failure |

Exit codes are useful in CI/CD pipelines and shell loops over multiple configs.
