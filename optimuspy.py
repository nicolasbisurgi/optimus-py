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

    if 'predefined_orders' in config:
        for order in config['predefined_orders']:
            if not isinstance(order, list):
                raise ValueError("Each entry in 'predefined_orders' must be a list of dimension names")

    if 'orders_to_ignore' in config:
        for order in config['orders_to_ignore']:
            if not isinstance(order, list):
                raise ValueError("Each entry in 'orders_to_ignore' must be a list of dimension names")


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
            return _execute_set_mode(tm1, cube_name, predefined_orders[0])

        # OPTIMIZE mode
        return _execute_optimize_mode(
            tm1, cube_name, view_names, process_names, executions,
            output, update, fast, dimensions_to_exclude, predefined_orders,
            orders_to_ignore, initial_dimension_order)


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


def _execute_optimize_mode(tm1: TM1Service, cube_name: str, view_names: List[str],
                           process_names: List[str], executions: int, output: str, update: bool,
                           fast: bool, dimensions_to_exclude: List[str], predefined_orders: List[List[str]],
                           orders_to_ignore: List[List[str]], initial_dimension_order: List[str]) -> bool:
    original_performance_monitor_state = retrieve_performance_monitor_state(tm1)
    activate_performance_monitor(tm1)

    original_vmm, original_vmt = retrieve_vmm_vmt(tm1, cube_name)
    write_vmm_vmt(tm1, cube_name, "1000000", "1000000")

    displayed_dimension_order = tm1.cubes.get_dimension_names(cube_name=cube_name)
    measure_dimension_only_numeric = is_dimension_only_numeric(tm1, initial_dimension_order[-1])

    context = ExecutionContext()
    permutation_results = []
    optimus_result = None

    try:
        # Benchmark original order
        original_executor = OriginalOrderExecutor(
            tm1, cube_name, view_names, process_names, displayed_dimension_order, executions,
            measure_dimension_only_numeric, initial_dimension_order, context)
        permutation_results += original_executor.execute()

        # Run iterations: predefined orders or greedy algorithm
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
            if optimus_result is None:
                optimus_result = OptimusResult(cube_name, permutation_results)
            file_base = RESULT_FILENAME.format(cube_name, TIME_STAMP)

            optimus_result.to_png(RESULT_PATH / f"{file_base}.png")

            if output.upper() == "XLSX":
                optimus_result.to_xlsx(RESULT_PATH / f"{file_base}.xlsx")
            else:
                optimus_result.to_csv(RESULT_PATH / f"{file_base}.csv")

    return True


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
