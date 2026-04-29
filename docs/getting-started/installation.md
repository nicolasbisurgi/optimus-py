# Installation

OptimusPy ships in three forms: a PyPI package for Python developers, an editable install from source for contributors, and a prebuilt Windows executable for environments where Python is unavailable.

!!! info "Requirements"
    - Python 3.9 or newer
    - Network access to your TM1 / Planning Analytics server
    - For the web UI: a modern browser (Chrome, Firefox, Edge, Safari)

## From PyPI

The simplest install. Picks up the latest stable release and all dependencies (TM1py, pandas, mdxpy, openpyxl).

```bash
pip install optimuspy
```

Verify the install:

```bash
optimuspy --help
```

## From source

Use this for contributing or running the latest unreleased changes.

```bash
git clone https://github.com/cubewise-code/optimus-py.git
cd optimus-py
pip install -e .
```

`-e` installs in editable mode — code changes take effect without reinstalling. The `optimuspy` and `python -m optimuspy` commands both become available.

## Prebuilt Windows executable

Download the latest `.exe` build when you cannot install Python (locked-down servers, kiosk environments, etc.).

1. Open the [Actions tab](https://github.com/cubewise-code/optimus-py/actions) of the repository.
2. Click the most recent successful **Build Executable** run.
3. Scroll to the **Artifacts** section and download `optimuspy-winOS`.
4. Unzip — the bundle contains `optimuspy.exe` plus the `config/` folder.

> 📸 **Screenshot needed:** The GitHub Actions Artifacts section showing the downloadable `.exe` bundle.

## Next step

Configure your first TM1 connection: [TM1 Connection →](tm1-connection.md)
