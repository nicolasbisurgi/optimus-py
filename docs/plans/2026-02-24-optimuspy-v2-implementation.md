# OptimusPy v2.0 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform OptimusPy from a CLI-arg-driven single-view tool into a JSON-config-driven tool with two run modes (optimize/set), predefined/ignored dimension orders, and multi-view/process support.

**Architecture:** Keep the flat 4-file structure. Extract PermutationResult class-level state into an ExecutionContext object. Add PredefinedOrderExecutor. Rewrite CLI to accept mode + JSON config. Multi-view/process ranking uses median-of-medians composite metric.

**Tech Stack:** Python 3.12, TM1py, seaborn/matplotlib, xlsxwriter, pandas

**Note:** This project has no test suite and requires a live TM1 server. Verification is done via syntax checks (`python -c "import <module>"`) and code review. Each task includes a verification step.

---

### Task 1: Move config.ini to config/ directory

**Files:**
- Move: `config.ini` -> `config/config.ini`
- Modify: `.gitignore`

**Step 1: Create config directory and move file**

```bash
mkdir -p config
mv config.ini config/config.ini
```

**Step 2: Update .gitignore**

Add `config/config.ini` to gitignore (connection params should not be committed). Keep a `config/config.ini.example` checked in.

Create `config/config.ini.example`:
```ini
[tm1srv01]
address=
port=
user=
password=
decode_b64=True
ssl=True
```

Current `.gitignore`:
```
.idea/
dist/
.venv/
build/
__pycache__/
*.pyc
results/
*.log
```

Add to `.gitignore`:
```
config/config.ini
```

**Step 3: Commit**

```bash
git add config/config.ini.example .gitignore
git commit -m "chore: move config.ini to config/ directory, add example config"
```

---

### Task 2: Create ExecutionContext in results.py

This replaces the fragile class-level mutable state on `PermutationResult` (`counter`, `current_ram`, `original_ram`).

**Files:**
- Modify: `results.py` (add class before `PermutationResult`, around line 24)

**Step 1: Add ExecutionContext class**

Insert before the `PermutationResult` class definition (line 25 of `results.py`):

```python
class ExecutionContext:
    """Tracks mutable state across permutation evaluations within a single optimization run."""

    def __init__(self):
        self.counter = 1
        self.current_ram = None
        self.original_ram = None

    def next_id(self) -> int:
        pid = self.counter
        self.counter += 1
        return pid

    def reset(self):
        self.counter = 1

    def set_initial_ram(self, ram: float):
        self.original_ram = ram
        self.current_ram = ram

    def update_ram(self, percentage_change: float) -> float:
        self.current_ram = self.current_ram + (self.current_ram * percentage_change / 100)
        return self.current_ram
```

**Step 2: Refactor PermutationResult to use ExecutionContext**

Change `PermutationResult.__init__` signature to accept `context: ExecutionContext` instead of `reset_counter: bool`. Remove all three class-level variables (`counter`, `current_ram`, `original_ram`).

Current signature (line 30-33):
```python
def __init__(self, mode: str, cube_name: str, view_names: list, process_name: str, dimension_order: list,
             query_times_by_view: dict, process_times_by_process: dict, ram_usage: float = None,
             ram_percentage_change: float = None,
             reset_counter: bool = False):
```

New signature:
```python
def __init__(self, context: ExecutionContext, mode: str, cube_name: str, view_names: list,
             process_names: list, dimension_order: list,
             query_times_by_view: dict, process_times_by_process: dict, ram_usage: float = None,
             ram_percentage_change: float = None):
```

Key changes inside `__init__`:
- Replace `self.process_name = process_name` with `self.process_names = process_names` and `self.include_process = bool(process_names)`
- RAM logic uses `context` instead of class variables:
  ```python
  if ram_usage:
      self.ram_usage = ram_usage
      context.set_initial_ram(ram_usage)
  elif ram_percentage_change is not None:
      self.ram_usage = context.update_ram(ram_percentage_change)
  else:
      raise RuntimeError("Either 'ram_usage' or 'ram_percentage_change' must be provided")
  ```
- `self.ram_reduction = 1 - context.current_ram / context.original_ram`
- `self.permutation_id = context.next_id()` (no more reset_counter logic — caller resets context)
- `self.ram_percentage_change = ram_percentage_change or 0`

**Step 3: Update median_process_time to handle multiple processes**

Current (line 80-83):
```python
def median_process_time(self, process_name: str = None) -> float:
    process_name = process_name or self.process_name
    median = statistics.median(self.process_times_by_process[process_name])
    return median
```

New:
```python
def median_process_time(self, process_name: str = None) -> float:
    process_name = process_name or self.process_names[0]
    return statistics.median(self.process_times_by_process[process_name])
```

**Step 4: Add composite metric methods**

Add after `median_process_time`:

```python
def composite_query_time(self) -> float:
    """Median of median query times across all views."""
    medians = [statistics.median(times) for times in self.query_times_by_view.values()]
    return statistics.median(medians) if len(medians) > 1 else medians[0]

def composite_process_time(self) -> float:
    """Median of median process times across all processes."""
    if not self.process_times_by_process:
        return 0.0
    medians = [statistics.median(times) for times in self.process_times_by_process.values()]
    return statistics.median(medians) if len(medians) > 1 else medians[0]
```

**Step 5: Update build_header and to_row for multi-view/process**

Update `HEADER` constant (line 16-17) to remove single-view/process columns. Replace with composite columns:
```python
HEADER = ["ID", "Mode", "Is Best", "Composite Query Time", "Query Ratio",
          "Composite Process Time", "Process Ratio", "RAM", "RAM in GB", "% Reduction"]
```

Update `to_row` to use composite metrics. Change signature from `(self, view_name: str, process_name: str, ...)` to `(self, original_order_result: 'PermutationResult')`:

```python
def to_row(self, original_order_result: 'PermutationResult') -> List[str]:
    composite_qt = self.composite_query_time()
    original_composite_qt = original_order_result.composite_query_time()
    query_time_ratio = composite_qt / original_composite_qt - 1

    row = [
        str(self.permutation_id),
        self.mode.label,
        str(self.is_best),
        composite_qt,
        query_time_ratio]

    if self.include_process:
        composite_pt = self.composite_process_time()
        original_composite_pt = original_order_result.composite_process_time()
        process_time_ratio = composite_pt / original_composite_pt - 1
        row += [composite_pt, process_time_ratio]
    else:
        row += [0, 0]

    ram_in_gb = float(self.ram_usage) / (1024 ** 3)
    row += [self.ram_usage, ram_in_gb, f"{self.ram_reduction:.0%}"] + list(self.dimension_order)
    return row
```

Update `to_csv_row` similarly (remove `view_name`/`process_name` params):
```python
def to_csv_row(self, original_order_result: 'PermutationResult') -> str:
    row = [str(i) for i in self.to_row(original_order_result)]
    return SEPARATOR.join(row) + "\n"
```

**Step 6: Update OptimusResult**

Update `determine_best_result` (line 255-291) to use composite metrics:

```python
def determine_best_result(self) -> Union[PermutationResult, None]:
    ram_range = [r.ram_usage for r in self.permutation_results]
    min_ram, max_ram = min(ram_range), max(ram_range)

    query_range = [r.composite_query_time() for r in self.permutation_results]
    min_query, max_query = min(query_range), max(query_range)

    if self.include_process:
        process_range = [r.composite_process_time() for r in self.permutation_results]
        min_process, max_process = min(process_range), max(process_range)
    else:
        min_process = max_process = 1

    for value in (0.01, 0.025, 0.05):
        ram_threshold = min_ram + value * (max_ram - min_ram)
        query_threshold = min_query + value * (max_query - min_query)

        if self.include_process:
            process_threshold = min_process + value * (max_process - min_process)
            for r in self.permutation_results:
                if (r.ram_usage <= ram_threshold
                        and r.composite_query_time() <= query_threshold
                        and r.composite_process_time() <= process_threshold):
                    return r
        else:
            for r in self.permutation_results:
                if (r.ram_usage <= ram_threshold
                        and r.composite_query_time() <= query_threshold):
                    return r

    return None
```

Update output methods to remove `view_name`/`process_name` params:

`to_dataframe(self)`:
```python
def to_dataframe(self) -> pd.DataFrame:
    header = self.permutation_results[0].build_header()
    rows = [r.to_row(self.original_order_result) for r in self.permutation_results]
    return pd.DataFrame(rows, columns=header)
```

`to_lines(self)`:
```python
def to_lines(self) -> List[str]:
    lines = itertools.chain(
        [self.permutation_results[0].build_csv_header()],
        [r.to_csv_row(self.original_order_result) for r in self.permutation_results])
    return list(lines)
```

`to_csv(self, file_name)`:
```python
def to_csv(self, file_name):
    lines = self.to_lines()
    os.makedirs(os.path.dirname(str(file_name)), exist_ok=True)
    with open(str(file_name), "w") as file:
        file.writelines(lines)
```

`to_xlsx(self, file_name)`:
```python
def to_xlsx(self, file_name):
    try:
        import xlsxwriter
        workbook = xlsxwriter.Workbook(file_name)
        worksheet = workbook.add_worksheet()
        line_data = []
        header_format = workbook.add_format({'bold': True})
        original_format = workbook.add_format({'bg_color': '#DCE6F1'})
        result_format = workbook.add_format({'bg_color': '#B3FBC1'})
        iteration_format = workbook.add_format({'bg_color': '#FFFFFF'})

        for row, line in enumerate(self.to_lines()):
            line_data = line.split(SEPARATOR)
            if "Original" in line_data[1]:
                row_format = original_format
            elif "Result" in line_data[1]:
                row_format = result_format
            elif row == 0:
                row_format = header_format
            else:
                row_format = iteration_format
            for col, item in enumerate(line_data):
                worksheet.write(row, col, item, row_format)

        if line_data:
            worksheet.autofilter(0, 0, 0, len(line_data) - 1)
        workbook.close()
    except ImportError:
        logging.warning("Failed to import xlsxwriter. Writing to csv instead")
        file_name = file_name.with_suffix(".csv")
        return self.to_csv(file_name)
```

`to_png(self, file_name)`:
```python
def to_png(self, file_name: str):
    df = self.to_dataframe()
    plt.figure(figsize=(8, 8))
    sns.set_style("ticks")

    p = sns.scatterplot(
        data=df,
        x="RAM in GB",
        y="Query Ratio",
        size="Composite Process Time" if self.include_process else None,
        hue="Mode",
        palette=PALETTE,
        edgecolors="black",
        legend=True,
        alpha=0.8,
        sizes=(20, 500) if self.include_process else None)

    for index, row in df.iterrows():
        p.text(row["RAM in GB"], row["Query Ratio"], row["ID"], color='black')

    sns.despine(trim=True, offset=2)
    p.set(title=f"Dimension Reorder Results for {self.cube_name}")
    p.set_xlabel("RAM (GB)")
    p.set_ylabel("Query Time Compared to Original Order")
    p.legend(title='Legend', loc='best')
    plt.grid()
    plt.tight_layout()
    os.makedirs(os.path.dirname(str(file_name)), exist_ok=True)
    plt.savefig(file_name, dpi=400)
    plt.clf()
```

**Step 7: Verify**

```bash
python -c "from results import ExecutionContext, PermutationResult, OptimusResult; print('results.py OK')"
```

**Step 8: Commit**

```bash
git add results.py
git commit -m "refactor: extract ExecutionContext, add composite metrics, multi-view/process support in results"
```

---

### Task 3: Update executors.py for ExecutionContext + multi-process

**Files:**
- Modify: `executors.py`

**Step 1: Update imports**

Change line 10:
```python
from results import PermutationResult
```
to:
```python
from results import ExecutionContext, PermutationResult
```

**Step 2: Update OptipyzerExecutor base class**

Change `__init__` (lines 26-38) to accept `context`, `process_names` (list), and `view_names`:

```python
class OptipyzerExecutor:
    def __init__(self, tm1: TM1Service, cube_name: str, view_names: List[str], process_names: List[str],
                 displayed_dimension_order: List[str],
                 executions: int, measure_dimension_only_numeric: bool, context: ExecutionContext):
        self.tm1 = tm1
        self.cube_name = cube_name
        self.view_names = view_names
        self.process_names = process_names
        self.dimensions = displayed_dimension_order
        self.executions = executions
        self.measure_dimension_only_numeric = measure_dimension_only_numeric
        self.mode = None
        self.include_process = bool(process_names)
        self.cube_dim_number = len(self.dimensions)
        self.context = context
```

**Step 3: Update `_determine_process_permutation_result` for multiple processes**

Replace current method (lines 53-66) with:

```python
def _determine_process_permutation_result(self) -> Dict[str, List[float]]:
    process_times_by_process = {}
    for process_name in self.process_names:
        execution_times = []
        for _ in range(self.executions):
            self.clear_cube_cache()
            before = time.time()
            success, status, _ = self.tm1.processes.execute_with_return(process_name=process_name)
            if not success:
                raise RuntimeError(f"Process: '{process_name}' not successful; Status: '{status}'")
            execution_times.append(time.time() - before)
        process_times_by_process[process_name] = execution_times
    return process_times_by_process
```

**Step 4: Update `_evaluate_permutation` to use ExecutionContext**

Replace the `PermutationResult` construction and logging. Key changes:
- Pass `self.context` as first arg to `PermutationResult`
- Pass `self.process_names` (list) instead of `self.process_name`
- Remove `reset_counter` parameter (caller resets context directly)
- Update progress logging to use `self.context.counter` instead of `PermutationResult.counter`

```python
def _evaluate_permutation(self, permutation: List[str], retrieve_ram: bool = False,
                          is_original_order: bool = False,
                          total_permutations=None) -> PermutationResult:
    ram_percentage_change = self.tm1.cubes.update_storage_dimension_order(self.cube_name, permutation)
    query_times_by_view = self._determine_query_permutation_result()

    process_times_by_process = None
    if self.include_process:
        process_times_by_process = self._determine_process_permutation_result()

    ram_usage = None
    if retrieve_ram:
        ram_usage = self._retrieve_ram_usage()

    permutation_result = PermutationResult(
        self.context, self.mode, self.cube_name, self.view_names, self.process_names,
        permutation, query_times_by_view, process_times_by_process, ram_usage,
        ram_percentage_change)

    if is_original_order:
        progress_log = "Original Order"
    else:
        progress_log = f"Iteration {self.context.counter - 2} of {total_permutations}"

    process_log = " - No process included in test"
    if self.include_process:
        process_log = f" - Composite process time [s]: {permutation_result.composite_process_time():.5f}"

    logging.info(f"{progress_log} - Evaluated order: {permutation} "
                 f"- RAM [GB]: {permutation_result.ram_usage / 1024 ** 3:.2f} "
                 f"- Composite query time [s]: {permutation_result.composite_query_time():.5f}"
                 + process_log)

    return permutation_result
```

**Step 5: Update OriginalOrderExecutor**

```python
class OriginalOrderExecutor(OptipyzerExecutor):
    def __init__(self, tm1: TM1Service, cube_name: str, view_names: List[str], process_names: List[str],
                 dimensions: List[str], executions: int,
                 measure_dimension_only_numeric: bool, original_dimension_order: List[str],
                 context: ExecutionContext):
        super().__init__(tm1, cube_name, view_names, process_names, dimensions, executions,
                         measure_dimension_only_numeric, context)
        self.mode = ExecutionMode.ORIGINAL_ORDER
        self.original_dimension_order = original_dimension_order

    def execute(self):
        return [self._evaluate_permutation(
            self.original_dimension_order,
            retrieve_ram=True,
            is_original_order=True)]
```

**Step 6: Update MainExecutor**

Constructor changes:
- Accept `process_names: List[str]` instead of `process_name: str`
- Accept `context: ExecutionContext`
- Accept `orders_to_ignore: List[List[str]]` (new)
- Remove the `self.view_name = view_names[0]` singular extraction and the warning log
- Use composite metric for greedy selection

```python
class MainExecutor(OptipyzerExecutor):
    def __init__(self, tm1: TM1Service, cube_name: str, view_names: List[str], process_names: List[str],
                 dimensions: List[str], executions: int, measure_dimension_only_numeric: bool,
                 context: ExecutionContext, fast: bool = False,
                 dimensions_to_exclude: List[str] = None,
                 orders_to_ignore: List[List[str]] = None):
        super().__init__(tm1, cube_name, view_names, process_names, dimensions, executions,
                         measure_dimension_only_numeric, context)
        self.mode = ExecutionMode.ITERATIONS
        self.fast = fast
        self.dimensions_to_exclude = dimensions_to_exclude or []
        self.orders_to_ignore = orders_to_ignore or []
```

In `execute()`, change best-order selection (line 246-248) from `r.median_query_time(self.view_name)` to `r.composite_query_time()`:

```python
best_order = sorted(
    results_per_dimension,
    key=lambda r: r.composite_query_time())[0]
```

Add ignore-list check before `_evaluate_permutation` in the inner loop (after line 231):

```python
permutation = swap(permutation, target_position, original_position)
if permutation in self.orders_to_ignore:
    logging.info(f"Skipping ignored order: {permutation}")
    continue
```

**Step 7: Add PredefinedOrderExecutor**

Add after `MainExecutor` class:

```python
class PredefinedOrderExecutor(OptipyzerExecutor):
    def __init__(self, tm1: TM1Service, cube_name: str, view_names: List[str], process_names: List[str],
                 dimensions: List[str], executions: int,
                 measure_dimension_only_numeric: bool, predefined_orders: List[List[str]],
                 context: ExecutionContext):
        super().__init__(tm1, cube_name, view_names, process_names, dimensions, executions,
                         measure_dimension_only_numeric, context)
        self.mode = ExecutionMode.ITERATIONS
        self.predefined_orders = predefined_orders

    def execute(self) -> List[PermutationResult]:
        total = len(self.predefined_orders)
        results = []
        for order in self.predefined_orders:
            result = self._evaluate_permutation(order, total_permutations=total)
            results.append(result)
        return results
```

**Step 8: Verify**

```bash
python -c "from executors import OptipyzerExecutor, OriginalOrderExecutor, MainExecutor, PredefinedOrderExecutor; print('executors.py OK')"
```

**Step 9: Commit**

```bash
git add executors.py
git commit -m "refactor: update executors for ExecutionContext, multi-process, ignore list, add PredefinedOrderExecutor"
```

---

### Task 4: Rewrite optimuspy.py — CLI, JSON config, main() orchestration

**Files:**
- Modify: `optimuspy.py` (full rewrite of CLI and main function)

**Step 1: Replace CLI with new argparse**

Replace everything from line 238 onward (`if __name__ == "__main__":`) with:

```python
if __name__ == "__main__":
    configure_logging()
    set_current_directory()

    parser = argparse.ArgumentParser(description="OptimusPy v2.0 — TM1 Cube Dimension Order Optimizer")
    parser.add_argument('mode', choices=['optimize', 'set'],
                        help="Run mode: 'optimize' benchmarks orders, 'set' applies a specific order")
    parser.add_argument('cube_config', help="Path to cube JSON configuration file")
    parser.add_argument('--config', dest='config_ini', default='config/config.ini',
                        help="Path to TM1 connection config.ini (default: config/config.ini)")
    parser.add_argument('-p', '--password', dest='password', default=None,
                        help="TM1 password (overrides config.ini)")

    cmd_args = parser.parse_args()

    logging.info(f"Starting OptimusPy v2.0. Mode: {cmd_args.mode}, Config: {cmd_args.cube_config}")

    cube_config = load_cube_config(cmd_args.cube_config)
    validate_cube_config(cube_config, cmd_args.mode)

    success = main(
        mode=cmd_args.mode,
        cube_config=cube_config,
        config_ini_path=cmd_args.config_ini,
        password=cmd_args.password)

    if success:
        logging.info("Finished successfully")
    else:
        exit(1)
```

**Step 2: Add JSON loading and validation functions**

Add after the imports section:

```python
import json

def load_cube_config(path: str) -> dict:
    with open(path, 'r') as f:
        return json.load(f)

def validate_cube_config(config: dict, mode: str):
    required = ['instance', 'cube', 'views', 'executions', 'output']
    for field in required:
        if field not in config:
            raise ValueError(f"Missing required field '{field}' in cube config")

    if not isinstance(config['views'], list) or len(config['views']) == 0:
        raise ValueError("'views' must be a non-empty list")

    if mode == 'set':
        if 'predefined_orders' not in config or len(config['predefined_orders']) != 1:
            raise ValueError("'set' mode requires 'predefined_orders' with exactly one entry")

    if 'predefined_orders' in config:
        for order in config['predefined_orders']:
            if not isinstance(order, list):
                raise ValueError("Each entry in 'predefined_orders' must be a list of dimension names")

    if 'orders_to_ignore' in config:
        for order in config['orders_to_ignore']:
            if not isinstance(order, list):
                raise ValueError("Each entry in 'orders_to_ignore' must be a list of dimension names")
```

**Step 3: Update get_tm1_config to accept path**

```python
def get_tm1_config(config_ini_path: str):
    config = configparser.ConfigParser()
    config.read(config_ini_path)
    return config
```

**Step 4: Rewrite main() function**

Remove old `main()` signature. Remove `LABEL_MAP`, `convert_arg_to_bool`. Remove old `RESULT_CSV`/`RESULT_XLSX`/`RESULT_PNG` templates. Replace with:

```python
RESULT_FILENAME = "{}_{}"  # cube_name, timestamp

def main(mode: str, cube_config: dict, config_ini_path: str, password: str = None) -> bool:
    instance_name = cube_config['instance']
    cube_name = cube_config['cube']
    view_names = cube_config['views']
    process_names = cube_config.get('processes', [])
    executions = cube_config['executions']
    output = cube_config['output']
    update = cube_config.get('update', False)
    fast = cube_config.get('fast', False)
    dimensions_to_exclude = cube_config.get('dimensions_to_exclude', [])
    predefined_orders = cube_config.get('predefined_orders', [])
    orders_to_ignore = cube_config.get('orders_to_ignore', [])

    config = get_tm1_config(config_ini_path)
    tm1_args = dict(config[instance_name])
    tm1_args['session_context'] = APP_NAME
    if password:
        tm1_args['password'] = password
        tm1_args['decode_b64'] = False

    with TM1Service(**tm1_args) as tm1:
        # Validate cube exists
        if not tm1.cubes.exists(cube_name):
            logging.error(f"Cube '{cube_name}' does not exist")
            return False

        # Validate views exist
        for view_name in view_names:
            if not tm1.cubes.views.exists(cube_name, view_name, private=False):
                logging.error(f"View '{view_name}' does not exist in cube '{cube_name}'")
                return False

        # Validate processes exist
        for process_name in process_names:
            if not tm1.processes.exists(process_name):
                logging.error(f"Process '{process_name}' does not exist")
                return False

        initial_dimension_order = tm1.cubes.get_storage_dimension_order(cube_name=cube_name)
        logging.info(f"Current dimension order for cube '{cube_name}': {initial_dimension_order}")

        # SET mode: apply order directly, no benchmarking
        if mode == 'set':
            target_order = predefined_orders[0]
            logging.info(f"Setting dimension order for cube '{cube_name}' to: {target_order}")
            ram_before = None
            try:
                from executors import OptipyzerExecutor
                # Use a temporary executor just to read RAM
                context = ExecutionContext()
                original_performance_monitor_state = retrieve_performance_monitor_state(tm1)
                activate_performance_monitor(tm1)
                # Rough RAM read via perf monitor
                mdx = """
                SELECT
                {{ [}}PerfCubes].[{}] }} ON ROWS,
                {{ [}}StatsStatsByCube].[Total Memory Used] }} ON COLUMNS
                FROM [}}StatsByCube]
                WHERE ([}}TimeIntervals].[LATEST])
                """.format(cube_name)
                ram_before = list(tm1.cells.execute_mdx_values(mdx=mdx))[0]
            except Exception:
                pass

            tm1.cubes.update_storage_dimension_order(cube_name, target_order)
            logging.info(f"Dimension order updated for cube '{cube_name}'")

            try:
                import time as t
                t.sleep(5)
                ram_after = list(tm1.cells.execute_mdx_values(mdx=mdx))[0]
                if ram_before and ram_after:
                    logging.info(f"RAM before: {ram_before / 1024**3:.2f} GB, after: {ram_after / 1024**3:.2f} GB")
            except Exception:
                pass

            return True

        # OPTIMIZE mode
        original_performance_monitor_state = retrieve_performance_monitor_state(tm1)
        activate_performance_monitor(tm1)

        original_vmm, original_vmt = retrieve_vmm_vmt(tm1, cube_name)
        write_vmm_vmt(tm1, cube_name, "1000000", "1000000")

        displayed_dimension_order = tm1.cubes.get_dimension_names(cube_name=cube_name)
        measure_dimension_only_numeric = is_dimension_only_numeric(tm1, initial_dimension_order[-1])

        context = ExecutionContext()
        permutation_results = []

        try:
            # Benchmark original order
            original_executor = OriginalOrderExecutor(
                tm1, cube_name, view_names, process_names, displayed_dimension_order, executions,
                measure_dimension_only_numeric, initial_dimension_order, context)
            permutation_results += original_executor.execute()

            # Run iterations
            if predefined_orders:
                executor = PredefinedOrderExecutor(
                    tm1, cube_name, view_names, process_names, displayed_dimension_order, executions,
                    measure_dimension_only_numeric, predefined_orders, context)
            else:
                executor = MainExecutor(
                    tm1, cube_name, view_names, process_names, displayed_dimension_order, executions,
                    measure_dimension_only_numeric, context, fast, dimensions_to_exclude, orders_to_ignore)
            permutation_results += executor.execute()

            optimus_result = OptimusResult(cube_name, permutation_results)
            best_permutation = optimus_result.best_result
            logging.info(f"Completed analysis for cube '{cube_name}'")

            if not best_permutation:
                tm1.cubes.update_storage_dimension_order(cube_name, initial_dimension_order)
                logging.info(
                    f"No ideal dimension order found for cube '{cube_name}'. "
                    f"Restored original order to {initial_dimension_order}. "
                    f"Please pick manually based on results.")
            else:
                best_order = best_permutation.dimension_order
                if update:
                    tm1.cubes.update_storage_dimension_order(cube_name, best_order)
                    logging.info(f"Updated dimension order for cube '{cube_name}' to {best_order}")
                else:
                    logging.info(f"Best order for cube '{cube_name}': {best_order}")
                    tm1.cubes.update_storage_dimension_order(cube_name, initial_dimension_order)
                    logging.info(f"Restored original dimension order for cube '{cube_name}'")

        except Exception as e:
            logging.error(f"Fatal error: {e}", exc_info=True)
            return False

        finally:
            with suppress(Exception):
                write_vmm_vmt(tm1, cube_name, original_vmm, original_vmt)

            with suppress(Exception):
                if original_performance_monitor_state:
                    activate_performance_monitor(tm1)
                else:
                    deactivate_performance_monitor(tm1)

            if permutation_results:
                optimus_result = OptimusResult(cube_name, permutation_results)
                file_base = RESULT_FILENAME.format(cube_name, TIME_STAMP)

                optimus_result.to_png(RESULT_PATH / f"{file_base}.png")

                if output.upper() == "XLSX":
                    optimus_result.to_xlsx(RESULT_PATH / f"{file_base}.xlsx")
                else:
                    optimus_result.to_csv(RESULT_PATH / f"{file_base}.csv")

    return True
```

**Step 5: Update imports at the top of optimuspy.py**

```python
import argparse
import configparser
import json
import logging
import os
import sys
import time
from contextlib import suppress
from pathlib import Path
from typing import List

from TM1py import TM1Service
from mdxpy import MdxBuilder, Member, MdxHierarchySet

from executors import OriginalOrderExecutor, MainExecutor, PredefinedOrderExecutor
from results import ExecutionContext, OptimusResult
```

Remove `Union` from typing imports (no longer needed). Remove `Iterable` import. Remove `ExecutionMode` import (no longer used in optimuspy.py). Remove `LABEL_MAP`.

**Step 6: Remove dead code**

Delete:
- `LABEL_MAP` (lines 25-29)
- `convert_arg_to_bool` function (lines 60-68)
- `get_cubes_to_optimize` function (lines 124-139) — single cube from JSON config, no "all cubes" mode
- Old `RESULT_CSV`, `RESULT_XLSX`, `RESULT_PNG` format strings (lines 21-23)

**Step 7: Verify**

```bash
python -c "import optimuspy; print('optimuspy.py OK')"
```

**Step 8: Commit**

```bash
git add optimuspy.py
git commit -m "feat: rewrite CLI for JSON config, add optimize/set modes, multi-view/process support"
```

---

### Task 5: Create sample JSON config and update CLAUDE.md

**Files:**
- Create: `samples/sales_optimize.json`
- Create: `samples/sales_set.json`
- Modify: `CLAUDE.md`

**Step 1: Create sample configs**

`samples/sales_optimize.json`:
```json
{
  "instance": "tm1srv01",
  "cube": "Sales",
  "views": ["Optimus"],
  "processes": [],
  "executions": 10,
  "fast": false,
  "output": "csv",
  "update": false,
  "dimensions_to_exclude": [],
  "predefined_orders": [],
  "orders_to_ignore": []
}
```

`samples/sales_set.json`:
```json
{
  "instance": "tm1srv01",
  "cube": "Sales",
  "views": ["Optimus"],
  "processes": [],
  "executions": 1,
  "output": "csv",
  "update": false,
  "predefined_orders": [
    ["Time", "Version", "Product", "Customer", "SalesMeasure"]
  ]
}
```

**Step 2: Update CLAUDE.md**

Rewrite to reflect v2.0 CLI, JSON config, new architecture with ExecutionContext, PredefinedOrderExecutor, and multi-view/process support. Update the Running section, Architecture section, and Key Patterns.

**Step 3: Commit**

```bash
git add samples/ CLAUDE.md
git commit -m "docs: add sample JSON configs and update CLAUDE.md for v2.0"
```

---

### Task 6: Update PyInstaller spec and .gitignore

**Files:**
- Modify: `optimuspy.spec` (add any new hidden imports if needed)
- Modify: `.gitignore`

**Step 1: Update spec file**

The `datas` line (line 8) already bundles the 3 supporting modules. No new files need bundling. Verify the `hiddenimports` list doesn't need `json` (it's stdlib, should be fine).

**Step 2: Update .gitignore**

Final `.gitignore`:
```
.idea/
dist/
.venv/
build/
__pycache__/
*.pyc
results/
*.log
*.spec
config/config.ini
```

Note: remove `*.spec` if the spec file should remain tracked.

**Step 3: Verify full import chain**

```bash
python -c "
from results import ExecutionContext, PermutationResult, OptimusResult
from executors import OptipyzerExecutor, OriginalOrderExecutor, MainExecutor, PredefinedOrderExecutor
from execution_mode import ExecutionMode
print('All imports OK')
"
```

**Step 4: Commit**

```bash
git add optimuspy.spec .gitignore
git commit -m "chore: update spec and gitignore for v2.0"
```
