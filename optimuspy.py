import argparse
import configparser
import itertools
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

from checkpoint import CheckpointManager
from executors import (OriginalOrderExecutor, MainExecutor, PredefinedOrderExecutor,
                       PositionOptimizerExecutor, DimensionOptimizerExecutor)
from results import ExecutionContext, OptimusResult

APP_NAME = "optimuspy"
TIME_STAMP = time.strftime("%Y-%m-%d_%H-%M-%S", time.localtime())
LOGFILE = APP_NAME + ".log"
RESULT_PATH = Path("results/")
RESULT_FILENAME = "{}_{}"  # cube_name, timestamp


def set_current_directory():
    # determine if application is a script file or frozen exe
    if getattr(sys, 'frozen', False):
        application_path = os.path.abspath(sys.executable)
    else:
        application_path = os.path.abspath(__file__)

    directory = os.path.dirname(application_path)
    # set current directory
    os.chdir(directory)
    return directory


def configure_logging():
    logging.basicConfig(
        filename=LOGFILE,
        format="%(asctime)s - " + APP_NAME + " - %(levelname)s - %(message)s",
        level=logging.INFO,
    )
    # also log to stdout
    logging.getLogger().addHandler(logging.StreamHandler(sys.stdout))


def get_tm1_config(config_ini_path: str):
    config = configparser.ConfigParser()
    config.read(config_ini_path)
    return config


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

    # Mutual exclusivity check
    exclusive_fields = ['predefined_orders', 'optimize_position', 'optimize_dimension']
    active = [f for f in exclusive_fields if f in config]
    if len(active) > 1:
        raise ValueError(f"Only one of {exclusive_fields} can be set. Found: {active}")

    if 'predefined_orders' in config:
        for order in config['predefined_orders']:
            if not isinstance(order, list):
                raise ValueError("Each entry in 'predefined_orders' must be a list of dimension names")

    if 'orders_to_ignore' in config:
        for order in config['orders_to_ignore']:
            if not isinstance(order, list):
                raise ValueError("Each entry in 'orders_to_ignore' must be a list of dimension names")

    if 'optimize_position' in config:
        val = config['optimize_position']
        if val not in ('first', 'last') and not isinstance(val, int):
            raise ValueError("'optimize_position' must be 'first', 'last', or an integer (1-based)")
        if isinstance(val, int) and val < 1:
            raise ValueError("'optimize_position' must be >= 1")

    if 'optimize_dimension' in config:
        val = config['optimize_dimension']
        if not isinstance(val, str) or not val.strip():
            raise ValueError("'optimize_dimension' must be a non-empty string")


def resolve_position(value, num_dimensions: int) -> int:
    if value == "first":
        return 0
    if value == "last":
        return num_dimensions - 1
    pos = int(value)
    if pos < 1 or pos > num_dimensions:
        raise ValueError(f"Position {pos} out of range (1-{num_dimensions})")
    return pos - 1


def is_dimension_only_numeric(tm1: TM1Service, dimension_name: str) -> bool:
    if tm1.hierarchies.exists(dimension_name=dimension_name, hierarchy_name="Leaves"):
        hierarchy_name = "Leaves"
    else:
        hierarchy_name = dimension_name

    elements = tm1.elements.get_element_types(
        dimension_name=dimension_name,
        hierarchy_name=hierarchy_name,
        skip_consolidations=True)

    return all(e == "Numeric" for e in elements.values())


def build_vmm_vmt_mdx(cube_name: str):
    return MdxBuilder.from_cube("}CubeProperties") \
        .add_member_tuple_to_rows(Member.of("}Cubes", cube_name)) \
        .add_hierarchy_set_to_column_axis(
        MdxHierarchySet.members([
            Member.of("}CubeProperties", "VMM"),
            Member.of("}CubeProperties", "VMT")])) \
        .to_mdx()


def retrieve_vmm_vmt(tm1: TM1Service, cube_name: str) -> tuple:
    mdx = build_vmm_vmt_mdx(cube_name)
    values = list(tm1.cells.execute_mdx_values(mdx))
    return str(values[0]), str(values[1])


def write_vmm_vmt(tm1: TM1Service, cube_name: str, vmm: str, vmt: str):
    mdx = build_vmm_vmt_mdx(cube_name)
    tm1.cells.write_values_through_cellset(mdx, [vmm, vmt])


def retrieve_performance_monitor_state(tm1: TM1Service):
    config = tm1.server.get_active_configuration()
    return config["Administration"]["PerformanceMonitorOn"]


def activate_performance_monitor(tm1: TM1Service):
    config = {
        "Administration": {"PerformanceMonitorOn": True}
    }
    tm1.server.update_static_configuration(config)


def deactivate_performance_monitor(tm1: TM1Service):
    config = {
        "Administration": {"PerformanceMonitorOn": False}
    }
    tm1.server.update_static_configuration(config)


def retrieve_ram_usage(tm1: TM1Service, cube_name: str) -> float:
    """Retrieve RAM usage for a cube from the performance monitor."""
    mdx = """
    SELECT
    {{ [}}PerfCubes].[{}] }} ON ROWS,
    {{ [}}StatsStatsByCube].[Total Memory Used] }} ON COLUMNS
    FROM [}}StatsByCube]
    WHERE ([}}TimeIntervals].[LATEST])
    """.format(cube_name)
    value = list(tm1.cells.execute_mdx_values(mdx=mdx))[0]
    return float(value) if value else 0.0


def main(mode: str, cube_config: dict, config_ini_path: str, password: str = None,
         no_resume: bool = False) -> bool:
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
    optimize_position = cube_config.get('optimize_position')
    optimize_dimension = cube_config.get('optimize_dimension')

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
            return _execute_set_mode(tm1, cube_name, predefined_orders[0])

        # OPTIMIZE mode
        return _execute_optimize_mode(
            tm1, cube_name, instance_name, view_names, process_names, executions,
            output, update, fast, dimensions_to_exclude, predefined_orders,
            orders_to_ignore, optimize_position, optimize_dimension,
            initial_dimension_order, cube_config, no_resume)


def _deduplicate_results(*result_lists):
    """Deduplicate PermutationResult objects by permutation_id, preserving order."""
    seen = set()
    unique = []
    for r in itertools.chain(*result_lists):
        if r is not None and r.permutation_id not in seen:
            seen.add(r.permutation_id)
            unique.append(r)
    return unique


def _execute_set_mode(tm1: TM1Service, cube_name: str, target_order: List[str]) -> bool:
    logging.info(f"SET mode: applying dimension order for cube '{cube_name}' to: {target_order}")

    original_performance_monitor_state = None
    ram_before = None
    try:
        original_performance_monitor_state = retrieve_performance_monitor_state(tm1)
        activate_performance_monitor(tm1)
        ram_before = retrieve_ram_usage(tm1, cube_name)
    except Exception:
        pass

    try:
        tm1.cubes.update_storage_dimension_order(cube_name, target_order)
        logging.info(f"Dimension order updated for cube '{cube_name}'")

        try:
            time.sleep(5)
            ram_after = retrieve_ram_usage(tm1, cube_name)
            if ram_before and ram_after:
                logging.info(f"RAM before: {ram_before / 1024 ** 3:.2f} GB, after: {ram_after / 1024 ** 3:.2f} GB")
        except Exception:
            pass

        return True
    finally:
        with suppress(Exception):
            if original_performance_monitor_state is not None and not original_performance_monitor_state:
                deactivate_performance_monitor(tm1)


def _execute_optimize_mode(tm1: TM1Service, cube_name: str, instance_name: str,
                           view_names: List[str],
                           process_names: List[str], executions: int, output: str, update: bool,
                           fast: bool, dimensions_to_exclude: List[str], predefined_orders: List[List[str]],
                           orders_to_ignore: List[List[str]], optimize_position=None,
                           optimize_dimension: str = None,
                           initial_dimension_order: List[str] = None,
                           cube_config: dict = None, no_resume: bool = False) -> bool:
    original_performance_monitor_state = retrieve_performance_monitor_state(tm1)
    activate_performance_monitor(tm1)

    original_vmm, original_vmt = retrieve_vmm_vmt(tm1, cube_name)
    write_vmm_vmt(tm1, cube_name, "1000000", "1000000")

    displayed_dimension_order = tm1.cubes.get_dimension_names(cube_name=cube_name)
    measure_dimension_only_numeric = is_dimension_only_numeric(tm1, initial_dimension_order[-1])

    context = ExecutionContext()
    permutation_results = []
    optimus_result = None

    # Checkpoint setup
    config_fingerprint = CheckpointManager.compute_config_fingerprint(cube_config) if cube_config else ""
    checkpoint_mgr = CheckpointManager(cube_name, instance_name, config_fingerprint, RESULT_PATH)

    # Try to resume from checkpoint
    resumed_results = []
    original_order_result = None
    resume_state = None

    if not no_resume and checkpoint_mgr.exists():
        if checkpoint_mgr.validate(initial_dimension_order):
            checkpoint_data = checkpoint_mgr.load()
            logging.info("Resuming from checkpoint — restoring previous progress")

            # Restore execution context
            CheckpointManager.restore_execution_context(context, checkpoint_data)

            # Restore original order result
            original_order_result = CheckpointManager.deserialize_result(
                checkpoint_data["original_order_result"])

            # Restore completed results
            resumed_results = [
                CheckpointManager.deserialize_result(r)
                for r in checkpoint_data["completed_results"]
            ]

            resume_state = checkpoint_data
            logging.info(f"Restored {len(resumed_results)} completed permutations from checkpoint")
        else:
            logging.warning("Checkpoint invalid — starting fresh")
            checkpoint_mgr.remove()
    elif no_resume and checkpoint_mgr.exists():
        logging.info("--no-resume specified — ignoring existing checkpoint")
        checkpoint_mgr.remove()

    try:
        # Benchmark original order (skip if resumed)
        if original_order_result is None:
            original_executor = OriginalOrderExecutor(
                tm1, cube_name, view_names, process_names, displayed_dimension_order, executions,
                measure_dimension_only_numeric, initial_dimension_order, context,
                checkpoint_manager=checkpoint_mgr)
            permutation_results += original_executor.execute()
            original_order_result = permutation_results[0]

            # Save initial checkpoint with original order result
            checkpoint_mgr.save(
                executor_type="OriginalOrderExecutor",
                execution_context=context,
                initial_dimension_order=initial_dimension_order,
                last_applied_order=initial_dimension_order,
                original_order_result=original_order_result,
                completed_results=[])

        # Run iterations: targeted, predefined, or greedy algorithm
        if optimize_position is not None:
            resolved_pos = resolve_position(optimize_position, len(displayed_dimension_order))
            logging.info(f"Optimizing position {resolved_pos + 1} (0-based: {resolved_pos}) "
                         f"for cube '{cube_name}'")
            executor = PositionOptimizerExecutor(
                tm1, cube_name, view_names, process_names, displayed_dimension_order, executions,
                measure_dimension_only_numeric, resolved_pos, context, dimensions_to_exclude,
                checkpoint_manager=checkpoint_mgr)
        elif optimize_dimension:
            if optimize_dimension not in displayed_dimension_order:
                raise ValueError(
                    f"Dimension '{optimize_dimension}' not found in cube '{cube_name}'. "
                    f"Available: {displayed_dimension_order}")
            logging.info(f"Optimizing dimension '{optimize_dimension}' for cube '{cube_name}'")
            executor = DimensionOptimizerExecutor(
                tm1, cube_name, view_names, process_names, displayed_dimension_order, executions,
                measure_dimension_only_numeric, optimize_dimension, context,
                checkpoint_manager=checkpoint_mgr)
        elif predefined_orders:
            executor = PredefinedOrderExecutor(
                tm1, cube_name, view_names, process_names, displayed_dimension_order, executions,
                measure_dimension_only_numeric, predefined_orders, context,
                checkpoint_manager=checkpoint_mgr)
        else:
            executor = MainExecutor(
                tm1, cube_name, view_names, process_names, displayed_dimension_order, executions,
                measure_dimension_only_numeric, context, fast, dimensions_to_exclude, orders_to_ignore,
                checkpoint_manager=checkpoint_mgr)

        # Set resume context on executor
        executor.set_resume_context(initial_dimension_order, original_order_result, resumed_results)

        # Execute (with resume state if available)
        new_results = executor.execute(resume_state=resume_state)
        permutation_results += new_results

        # Combine resumed + new results for final analysis
        unique_results = _deduplicate_results(
            [original_order_result], resumed_results, permutation_results)

        optimus_result = OptimusResult(cube_name, unique_results)
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

        # Success — remove checkpoint
        checkpoint_mgr.remove()

    except Exception as e:
        logging.error(f"Fatal error: {e}", exc_info=True)
        logging.info("Re-run the same command to resume from checkpoint")
        return False

    finally:
        with suppress(Exception):
            write_vmm_vmt(tm1, cube_name, original_vmm, original_vmt)

        with suppress(Exception):
            if original_performance_monitor_state:
                activate_performance_monitor(tm1)
            else:
                deactivate_performance_monitor(tm1)

        # Build results from whatever we have (resumed + new)
        unique_for_output = _deduplicate_results(
            [original_order_result], resumed_results, permutation_results)

        if unique_for_output:
            if optimus_result is None:
                optimus_result = OptimusResult(cube_name, unique_for_output)
            file_base = RESULT_FILENAME.format(cube_name, TIME_STAMP)

            optimus_result.to_html(RESULT_PATH / f"{file_base}.html", total_duration=context.elapsed)
            optimus_result.to_png(RESULT_PATH / f"{file_base}.png")

            if output.upper() == "XLSX":
                optimus_result.to_xlsx(RESULT_PATH / f"{file_base}.xlsx")
            else:
                optimus_result.to_csv(RESULT_PATH / f"{file_base}.csv")

    return True


def _execute_scan_mode(tm1: TM1Service, instance_name: str, min_dims: int,
                       output_dir: str = None) -> bool:
    logging.info(f"Scanning instance '{instance_name}' for optimization candidates...")

    # Get all non-control cubes
    all_cubes = tm1.cubes.get_all_names(skip_control_cubes=True)
    logging.info(f"Found {len(all_cubes)} non-control cubes")

    # Build dimension info and filter by dimension count + optimization status
    candidates = []
    for cube_name in all_cubes:
        visible_order = tm1.cubes.get_dimension_names(cube_name=cube_name)
        dim_count = len(visible_order)

        if dim_count < min_dims:
            continue

        storage_order = tm1.cubes.get_storage_dimension_order(cube_name=cube_name)

        # Keep only cubes where storage == visible (not yet optimized)
        if list(visible_order) != list(storage_order):
            continue

        candidates.append({
            "cube_name": cube_name,
            "dimension_order": list(visible_order),
            "dim_count": dim_count,
        })

    if not candidates:
        logging.info(f"No candidate cubes found (min dimensions: {min_dims}, not yet optimized)")
        return True

    # Get RAM usage via performance monitor
    ram_by_cube = {}
    original_perf_state = None
    try:
        original_perf_state = retrieve_performance_monitor_state(tm1)
        activate_performance_monitor(tm1)

        mdx = """
        SELECT
          NON EMPTY {[}StatsStatsByCube].[Total Memory Used]} ON COLUMNS,
          NON EMPTY {[}PerfCubes].[}PerfCubes].Members} ON ROWS
        FROM [}StatsByCube]
        WHERE ([}TimeIntervals].[LATEST])
        """
        df = tm1.cells.execute_mdx_dataframe(mdx)
        for _, row in df.iterrows():
            cube = row.iloc[0]  # First column is the cube name from }PerfCubes
            ram_value = row.iloc[1]  # Second column is Total Memory Used
            ram_by_cube[str(cube)] = float(ram_value) if ram_value else 0.0

    except Exception as e:
        logging.warning(f"Could not retrieve RAM usage from performance monitor: {e}")
    finally:
        with suppress(Exception):
            if original_perf_state is not None and not original_perf_state:
                deactivate_performance_monitor(tm1)

    # Attach RAM to candidates and sort by RAM descending
    for c in candidates:
        c["ram_bytes"] = ram_by_cube.get(c["cube_name"], 0.0)
        c["ram_gb"] = c["ram_bytes"] / (1024 ** 3)

    candidates.sort(key=lambda c: c["ram_bytes"], reverse=True)

    # Print table
    total_ram = sum(c["ram_gb"] for c in candidates)
    print(f"\nFound {len(candidates)} candidate cubes "
          f"(min dimensions: {min_dims}, not yet optimized):\n")

    # Calculate column widths
    max_name = max(len(c["cube_name"]) for c in candidates)
    max_name = max(max_name, 9)  # "Cube Name" header

    header = f"  {'#':>3}  {'Cube Name':<{max_name}}  {'Dims':>4}  {'RAM (GB)':>9}  Dimension Order"
    print(header)
    print(f"  {'─' * 3}  {'─' * max_name}  {'─' * 4}  {'─' * 9}  {'─' * 30}")

    for i, c in enumerate(candidates, 1):
        dims_str = str(c["dimension_order"])
        if len(dims_str) > 60:
            dims_str = dims_str[:57] + "..."
        print(f"  {i:>3}  {c['cube_name']:<{max_name}}  {c['dim_count']:>4}  {c['ram_gb']:>9.2f}  {dims_str}")

    print(f"\n  Total: {len(candidates)} cubes, {total_ram:.2f} GB combined RAM\n")

    # Generate JSON configs if output directory specified
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        for c in candidates:
            config_data = {
                "instance": instance_name,
                "cube": c["cube_name"],
                "views": [],
                "executions": 5,
                "output": "csv",
            }
            config_path = os.path.join(output_dir, f"{c['cube_name']}.json")
            with open(config_path, "w") as f:
                json.dump(config_data, f, indent=2)

        logging.info(f"Generated {len(candidates)} config files in {output_dir}/")
    else:
        print("  To generate config files: re-run with --output <directory>\n")

    return True


if __name__ == "__main__":
    configure_logging()
    set_current_directory()

    parser = argparse.ArgumentParser(description="OptimusPy v2.0 — TM1 Cube Dimension Order Optimizer")
    parser.add_argument('mode', choices=['optimize', 'set', 'scan'],
                        help="Run mode: 'optimize' benchmarks orders, 'set' applies a specific order, "
                             "'scan' discovers optimization candidates")
    parser.add_argument('cube_config', nargs='?', default=None,
                        help="Path to cube JSON configuration file (required for optimize/set)")
    parser.add_argument('--config', dest='config_ini', default='config/config.ini',
                        help="Path to TM1 connection config.ini (default: config/config.ini)")
    parser.add_argument('-p', '--password', dest='password', default=None,
                        help="TM1 password (overrides config.ini)")
    parser.add_argument('--no-resume', dest='no_resume', action='store_true', default=False,
                        help="Ignore existing checkpoint and start fresh (optimize only)")
    parser.add_argument('--instance', dest='instance', default=None,
                        help="TM1 instance name from config.ini (scan only)")
    parser.add_argument('--min-dims', dest='min_dims', type=int, default=4,
                        help="Minimum number of dimensions to consider (scan only, default: 4)")
    parser.add_argument('--output', dest='output_dir', default=None,
                        help="Output directory for generated JSON config files (scan only)")

    cmd_args = parser.parse_args()

    if cmd_args.mode == 'scan':
        if not cmd_args.instance:
            parser.error("scan mode requires --instance")

        logging.info(f"Starting OptimusPy v2.0. Mode: scan, Instance: {cmd_args.instance}")

        config = get_tm1_config(cmd_args.config_ini)
        tm1_args = dict(config[cmd_args.instance])
        tm1_args['session_context'] = APP_NAME
        if cmd_args.password:
            tm1_args['password'] = cmd_args.password
            tm1_args['decode_b64'] = False

        with TM1Service(**tm1_args) as tm1:
            success = _execute_scan_mode(
                tm1, cmd_args.instance, cmd_args.min_dims, cmd_args.output_dir)
    else:
        if not cmd_args.cube_config:
            parser.error(f"'{cmd_args.mode}' mode requires a cube config file")

        logging.info(f"Starting OptimusPy v2.0. Mode: {cmd_args.mode}, Config: {cmd_args.cube_config}")

        cube_config = load_cube_config(cmd_args.cube_config)
        validate_cube_config(cube_config, cmd_args.mode)

        success = main(
            mode=cmd_args.mode,
            cube_config=cube_config,
            config_ini_path=cmd_args.config_ini,
            password=cmd_args.password,
            no_resume=cmd_args.no_resume)

    if success:
        logging.info("Finished successfully")
    else:
        exit(1)
