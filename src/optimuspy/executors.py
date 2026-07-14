import logging
import random
import time
from itertools import chain
from typing import List, Dict

from TM1py import TM1Service, Process

from optimuspy.execution_mode import ExecutionMode
from optimuspy.metrics import read_cube_memory_bytes
from optimuspy.results import ExecutionContext, PermutationResult


class OptimizationCancelled(Exception):
    pass


def swap(order: list, i1, i2) -> List[str]:
    seq = order[:]
    seq[i1], seq[i2] = seq[i2], seq[i1]
    return seq


def swap_random(order: list) -> List[str]:
    idx = range(len(order))
    i1, i2 = random.sample(idx, 2)
    return swap(order, i1, i2)


class OptipyzerExecutor:
    def __init__(self, tm1: TM1Service, cube_name: str, view_names: List[str], process_names: List[str],
                 displayed_dimension_order: List[str],
                 executions: int, measure_dimension_only_numeric: bool, context: ExecutionContext,
                 checkpoint_manager=None, process_parameters: dict = None, cancel_event=None,
                 is_v12: bool = False):
        self.tm1 = tm1
        self.cube_name = cube_name
        self.view_names = view_names
        self.process_names = process_names
        self.dimensions = displayed_dimension_order
        self.executions = executions
        self.measure_dimension_only_numeric = measure_dimension_only_numeric
        self.is_v12 = is_v12
        self.mode = None
        self.include_process = bool(process_names)
        self.cube_dim_number = len(self.dimensions)
        self.context = context
        self.checkpoint_manager = checkpoint_manager
        self.process_parameters = process_parameters or {}
        self.cancel_event = cancel_event
        self._initial_dimension_order = None
        self._original_order_result = None
        self._resumed_results = []

    def _check_cancelled(self):
        if self.cancel_event and self.cancel_event.is_set():
            raise OptimizationCancelled("Optimization cancelled by user")

    def set_resume_context(self, initial_dimension_order, original_order_result, resumed_results):
        """Set checkpoint resume context. Must be called before execute() when resuming."""
        self._initial_dimension_order = initial_dimension_order
        self._original_order_result = original_order_result
        self._resumed_results = resumed_results

    def _determine_query_permutation_result(self) -> Dict[str, List[float]]:
        query_times_by_view = {}
        for view_name in self.view_names:
            query_times = []
            for _ in range(self.executions):
                self.clear_cube_cache()

                before = time.time()
                self.tm1.cells.create_cellset_from_view(cube_name=self.cube_name, view_name=view_name, private=False)
                query_times.append(time.time() - before)
            query_times_by_view[view_name] = query_times
        return query_times_by_view

    def _determine_process_permutation_result(self) -> Dict[str, List[float]]:
        process_times_by_process = {}
        for process_name in self.process_names:
            execution_times = []
            for _ in range(self.executions):
                self.clear_cube_cache()
                before = time.time()
                params = self.process_parameters.get(process_name, {})
                success, status, _ = self.tm1.processes.execute_with_return(process_name=process_name, **params)
                if not success:
                    raise RuntimeError(f"Process: '{process_name}' not successful; Status: '{status}'")
                execution_times.append(time.time() - before)
            process_times_by_process[process_name] = execution_times
        return process_times_by_process

    def _evaluate_permutation(self, permutation: List[str], retrieve_ram: bool = False,
                              is_original_order: bool = False,
                              total_permutations=None) -> PermutationResult:
        if is_original_order:
            progress_label = "Original Order"
        else:
            progress_label = f"Iteration {self.context.counter - 2} of {total_permutations}"

        logging.info(f"{progress_label} - Testing order: {permutation}")

        reorder_start = time.time()
        ram_percentage_change = self.tm1.cubes.update_storage_dimension_order(self.cube_name, permutation)
        reorder_duration = time.time() - reorder_start
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
            ram_percentage_change, reorder_duration)

        query_log = ""
        if self.view_names:
            query_log = f" - Query [s]: {permutation_result.composite_query_time():.5f}"

        process_log = ""
        if self.include_process:
            process_log = f" - Process [s]: {permutation_result.composite_process_time():.5f}"

        logging.info(f"{progress_label} - Result: RAM [GB]: {permutation_result.ram_usage / 1024 ** 3:.2f}"
                     + query_log + process_log)

        return permutation_result

    def _retrieve_ram_usage(self):
        # RAM baseline in bytes via MetricService (cube_memory_used), version-agnostic.
        # v11 keeps the read-retry loop; v12 fails fast (see read_cube_memory_bytes).
        return read_cube_memory_bytes(self.tm1, self.cube_name, self.is_v12)

    def _has_string_elements(self, dimension_name: str) -> bool:
        hierarchy_name = "Leaves" if self.tm1.hierarchies.exists(
            dimension_name=dimension_name, hierarchy_name="Leaves") else dimension_name
        elements = self.tm1.elements.get_element_types(
            dimension_name=dimension_name, hierarchy_name=hierarchy_name, skip_consolidations=True)
        return any(etype != "Numeric" for etype in elements.values())

    def clear_cube_cache(self):
        process = Process(name="", prolog_procedure=f"DebugUtility(125 ,0 ,0 ,'{self.cube_name}' ,'' ,'');")
        success, status, error_log_file = self.tm1.processes.execute_process_with_return(process)

        if not success:
            raise RuntimeError(f"Failed to clear cache for cube '{self.cube_name}'. Status: '{status}'")

    def _save_checkpoint(self, new_results, last_applied_order, executor_state=None):
        if not self.checkpoint_manager:
            return
        if not self._original_order_result or not self._initial_dimension_order:
            logging.warning("Checkpoint skipped — resume context not set (call set_resume_context first)")
            return
        all_completed = self._resumed_results + new_results
        self.checkpoint_manager.save(
            executor_type=self.__class__.__name__,
            execution_context=self.context,
            initial_dimension_order=self._initial_dimension_order,
            last_applied_order=last_applied_order,
            original_order_result=self._original_order_result,
            completed_results=all_completed,
            executor_state=executor_state)

    def _sweep_into_position(self, current_order, target_position, candidate_dims,
                             total_permutations, skip_candidate=None,
                             skip_permutation=None, checkpoint_cb=None):
        """P1 primitive: swap each candidate dim into target_position, evaluate.

        Returns the PermutationResult for each candidate that was actually tested.
        Shared by PositionOptimizerExecutor (all candidates) and Fold A (τ-frontier).
        """
        results = []
        for dim in candidate_dims:
            if skip_candidate and skip_candidate(dim, target_position):
                continue
            permutation = swap(current_order, target_position, current_order.index(dim))
            if skip_permutation and skip_permutation(permutation):
                continue
            self._check_cancelled()
            result = self._evaluate_permutation(permutation, total_permutations=total_permutations)
            results.append(result)
            if checkpoint_cb:
                checkpoint_cb(dim, results)
        return results

    def _sweep_across_positions(self, current_order, target_dim, candidate_positions,
                                total_permutations, skip_permutation=None,
                                checkpoint_cb=None):
        """P2 primitive: move target_dim into each candidate position, evaluate.

        Shared by DimensionOptimizerExecutor (all positions) and Fold B (τ span).
        """
        results = []
        for position in candidate_positions:
            permutation = swap(current_order, position, current_order.index(target_dim))
            if skip_permutation and skip_permutation(permutation):
                continue
            self._check_cancelled()
            result = self._evaluate_permutation(permutation, total_permutations=total_permutations)
            results.append(result)
            if checkpoint_cb:
                checkpoint_cb(position, results)
        return results

    def _pick_best(self, results, ranking):
        """Return the best result by the position's ranking metric (ascending)."""
        if ranking == "query":
            key = lambda r: r.composite_query_time()
        elif ranking == "process":
            key = lambda r: r.composite_process_time()
        else:
            key = lambda r: r.ram_usage
        return sorted(results, key=key)[0]


class OriginalOrderExecutor(OptipyzerExecutor):
    def __init__(self, tm1: TM1Service, cube_name: str, view_names: List[str], process_names: List[str],
                 dimensions: List[str], executions: int,
                 measure_dimension_only_numeric: bool, original_dimension_order: List[str],
                 context: ExecutionContext, checkpoint_manager=None, process_parameters: dict = None,
                 cancel_event=None, is_v12: bool = False):
        super().__init__(tm1, cube_name, view_names, process_names, dimensions, executions,
                         measure_dimension_only_numeric, context, checkpoint_manager, process_parameters,
                         cancel_event, is_v12=is_v12)
        self.mode = ExecutionMode.ORIGINAL_ORDER
        self.original_dimension_order = original_dimension_order

    def execute(self):
        self._check_cancelled()
        # at initial execution ram must be retrieved
        return [self._evaluate_permutation(
            self.original_dimension_order,
            retrieve_ram=True,
            is_original_order=True)]


class MainExecutor(OptipyzerExecutor):
    def __init__(self, tm1: TM1Service, cube_name: str, view_names: List[str], process_names: List[str],
                 dimensions: List[str], executions: int, measure_dimension_only_numeric: bool,
                 context: ExecutionContext, fast: bool = False,
                 dimensions_to_exclude: List[str] = None,
                 orders_to_ignore: List[List[str]] = None,
                 checkpoint_manager=None, process_parameters: dict = None,
                 dimension_position_rules: list = None, cancel_event=None, is_v12: bool = False):
        super().__init__(tm1, cube_name, view_names, process_names, dimensions, executions,
                         measure_dimension_only_numeric, context, checkpoint_manager, process_parameters,
                         cancel_event, is_v12=is_v12)
        self.mode = ExecutionMode.ITERATIONS
        self.fast = fast
        self.dimensions_to_exclude = dimensions_to_exclude or []
        self.orders_to_ignore = orders_to_ignore or []
        self.dimension_position_rules = dimension_position_rules or []

    def _violates_position_rules(self, permutation: List[str]) -> bool:
        for rule in self.dimension_position_rules:
            dim_name = rule['dimension']
            pos = rule['position']
            if dim_name not in permutation:
                continue
            actual_index = permutation.index(dim_name)
            if pos == 'first' and actual_index == 0:
                return True
            elif pos == 'last' and actual_index == len(permutation) - 1:
                return True
            else:
                try:
                    if actual_index == int(pos) - 1:
                        return True
                except (ValueError, TypeError):
                    pass
        return False

    def _check_swap_dim_with_str_to_last_position(
            self, dimension_name: str, target_position: int
    ) -> bool:
        # if a dimension has strings and target dimension is the last dimension in the cube - do not swap.
        # rest API allows to swap a dim with string to the last position, but not out of the last position
        last_target_position = target_position + 1 == self.cube_dim_number
        if last_target_position and self._has_string_elements(dimension_name):
            logging.info(
                f"Skip swapping dimension '{dimension_name}' into last position because it has string elements")
            return True
        return False

    def execute(self, resume_state: dict = None) -> List[PermutationResult]:
        dimensions = self.dimensions[:]
        resulting_order = self.dimensions[:]
        permutation_results = []
        # dimensions that we're allowed to swap
        dimension_pool = [
            dim for dim in self.dimensions[:] if dim not in self.dimensions_to_exclude
        ]

        mid = int(len(dimension_pool) / 2)

        if not self.measure_dimension_only_numeric:
            dimension_pool.remove(self.dimensions[-1])
            dimensions.remove(self.dimensions[-1])

        if self.fast:
            total_permutations = len(dimension_pool) * 2 - 1
        else:
            total_permutations = sum(range(2, len(dimension_pool) + 1))

        # Restore greedy algorithm state from checkpoint
        resume_iteration = -1
        resume_tested_dims = set()
        resumed_result_ids = set()
        executor_state = resume_state.get("executor_state", {}) if resume_state else {}
        if "greedy_state" in executor_state:
            gs = executor_state["greedy_state"]
            resulting_order = gs["resulting_order"]
            dimension_pool = gs["dimension_pool"]
            resume_iteration = gs["iteration"]
            dimensions = gs["dimensions"]
            resume_tested_dims = set(gs.get("tested_dims_in_current_round", []))
            resumed_result_ids = set(gs.get("results_per_dimension_ids", []))
            logging.info(f"Resuming greedy algorithm from iteration {resume_iteration}")

        # iteration through positions like: n, 0, n-1, 1, n-2, 2, ...
        for iteration, target_position in enumerate(
                chain(*zip(reversed(range(len(dimensions))), range(len(dimensions))))):
            if self.fast and iteration == 2:
                break

            if target_position == mid:
                break

            # Skip fully completed iterations
            if iteration < resume_iteration:
                continue

            results_per_dimension = list()

            # Rebuild results_per_dimension from resumed results for current iteration
            if iteration == resume_iteration and self._resumed_results:
                results_per_dimension = [
                    r for r in self._resumed_results if r.permutation_id in resumed_result_ids
                ]

            # for the current position - swap all the allowed dimensions and append all possible orders to the result set
            for dimension in dimension_pool:
                # Skip dimensions already tested in this round (from checkpoint)
                if iteration == resume_iteration and dimension in resume_tested_dims:
                    continue

                original_position = resulting_order.index(dimension)
                dimension_target = resulting_order[target_position]

                if (not self._check_swap_dim_with_str_to_last_position(dimension, target_position)
                        and dimension_target in dimension_pool):
                    permutation = list(resulting_order)
                    permutation = swap(permutation, target_position, original_position)

                    # skip ignored orders
                    if permutation in self.orders_to_ignore:
                        logging.debug(f"Skipping ignored order: {permutation}")
                        continue

                    # skip orders violating position rules
                    if self._violates_position_rules(permutation):
                        logging.debug(f"Skipping order due to position rule violation: {permutation}")
                        continue

                    self._check_cancelled()
                    permutation_result = self._evaluate_permutation(permutation, total_permutations=total_permutations)
                    permutation_results.append(permutation_result)
                    results_per_dimension.append(permutation_result)

                    # Save checkpoint after each permutation
                    self._save_checkpoint(
                        new_results=permutation_results,
                        last_applied_order=list(permutation),
                        executor_state={
                            "greedy_state": {
                                "resulting_order": list(resulting_order),
                                "dimension_pool": list(dimension_pool),
                                "iteration": iteration,
                                "dimensions": list(dimensions),
                                "tested_dims_in_current_round": [
                                    d for d in dimension_pool
                                    if d == dimension or (iteration == resume_iteration and d in resume_tested_dims)
                                    or dimension_pool.index(d) < dimension_pool.index(dimension)
                                ],
                                "results_per_dimension_ids": [r.permutation_id for r in results_per_dimension],
                            }
                        })

            # Clear resume state after first resumed iteration completes
            if iteration == resume_iteration:
                resume_tested_dims = set()
                resumed_result_ids = set()

            # only check for best results if any valid dim swaps are returned
            if len(results_per_dimension) > 0:
                if target_position > mid:
                    best_order = sorted(
                        results_per_dimension,
                        key=lambda r: r.ram_usage)[0]
                elif self.view_names:
                    best_order = sorted(
                        results_per_dimension,
                        key=lambda r: r.composite_query_time())[0]
                elif self.process_names:
                    best_order = sorted(
                        results_per_dimension,
                        key=lambda r: r.composite_process_time())[0]
                else:
                    best_order = sorted(
                        results_per_dimension,
                        key=lambda r: r.ram_usage)[0]

                resulting_order = list(best_order.dimension_order)
                dimension_pool.remove(resulting_order[target_position])

        return permutation_results


class PredefinedOrderExecutor(OptipyzerExecutor):
    def __init__(self, tm1: TM1Service, cube_name: str, view_names: List[str], process_names: List[str],
                 dimensions: List[str], executions: int,
                 measure_dimension_only_numeric: bool, predefined_orders: List[List[str]],
                 context: ExecutionContext, checkpoint_manager=None, process_parameters: dict = None,
                 cancel_event=None, is_v12: bool = False):
        super().__init__(tm1, cube_name, view_names, process_names, dimensions, executions,
                         measure_dimension_only_numeric, context, checkpoint_manager, process_parameters,
                         cancel_event, is_v12=is_v12)
        self.mode = ExecutionMode.ITERATIONS
        self.predefined_orders = predefined_orders

    def execute(self, resume_state: dict = None) -> List[PermutationResult]:
        total = len(self.predefined_orders)
        results = []

        completed_indices = set()
        executor_state = resume_state.get("executor_state", {}) if resume_state else {}
        if "predefined_state" in executor_state:
            completed_indices = set(executor_state["predefined_state"]["completed_indices"])
            logging.info(f"Resuming predefined orders: {len(completed_indices)}/{total} already completed")

        for idx, order in enumerate(self.predefined_orders):
            if idx in completed_indices:
                continue

            self._check_cancelled()
            result = self._evaluate_permutation(order, total_permutations=total)
            results.append(result)

            # Save checkpoint after each permutation
            completed_indices.add(idx)
            self._save_checkpoint(
                new_results=results,
                last_applied_order=list(order),
                executor_state={
                    "predefined_state": {"completed_indices": sorted(completed_indices)}
                })

        return results


class PositionOptimizerExecutor(OptipyzerExecutor):
    """Find the best dimension for a given position."""

    def __init__(self, tm1: TM1Service, cube_name: str, view_names: List[str], process_names: List[str],
                 dimensions: List[str], executions: int, measure_dimension_only_numeric: bool,
                 target_position: int, context: ExecutionContext,
                 dimensions_to_exclude: List[str] = None, checkpoint_manager=None,
                 process_parameters: dict = None, cancel_event=None, is_v12: bool = False):
        super().__init__(tm1, cube_name, view_names, process_names, dimensions, executions,
                         measure_dimension_only_numeric, context, checkpoint_manager, process_parameters,
                         cancel_event, is_v12=is_v12)
        self.mode = ExecutionMode.ITERATIONS
        self.target_position = target_position
        self.dimensions_to_exclude = dimensions_to_exclude or []

    def execute(self, resume_state: dict = None) -> List[PermutationResult]:
        current_order = self.dimensions[:]
        is_last = (self.target_position == len(current_order) - 1)

        completed_dimensions = set()
        executor_state = resume_state.get("executor_state", {}) if resume_state else {}
        if "position_state" in executor_state:
            completed_dimensions = set(executor_state["position_state"]["completed_dimensions"])
            logging.info(f"Resuming position optimizer: {len(completed_dimensions)} dimensions already tested")

        candidates = [
            dim for dim in current_order
            if dim != current_order[self.target_position] and dim not in self.dimensions_to_exclude
        ]
        # last-position + string dims are not legal candidates for the last slot
        eligible = [d for d in candidates
                    if not (is_last and self._has_string_elements(d))]
        total = len(eligible)

        def skip_candidate(dim, target_position):
            if dim in completed_dimensions:
                return True
            if is_last and self._has_string_elements(dim):
                logging.info(f"Skip '{dim}' — has string elements, can't be last")
                return True
            return False

        def checkpoint_cb(dim, results):
            completed_dimensions.add(dim)
            self._save_checkpoint(
                new_results=results,
                last_applied_order=list(results[-1].dimension_order),
                executor_state={"position_state": {"completed_dimensions": sorted(completed_dimensions)}})

        return self._sweep_into_position(
            current_order, self.target_position, candidates, total_permutations=total,
            skip_candidate=skip_candidate, checkpoint_cb=checkpoint_cb)


class DimensionOptimizerExecutor(OptipyzerExecutor):
    """Find the best position for a given dimension."""

    def __init__(self, tm1: TM1Service, cube_name: str, view_names: List[str], process_names: List[str],
                 dimensions: List[str], executions: int, measure_dimension_only_numeric: bool,
                 target_dimension: str, context: ExecutionContext, checkpoint_manager=None,
                 process_parameters: dict = None, cancel_event=None, is_v12: bool = False):
        super().__init__(tm1, cube_name, view_names, process_names, dimensions, executions,
                         measure_dimension_only_numeric, context, checkpoint_manager, process_parameters,
                         cancel_event, is_v12=is_v12)
        self.mode = ExecutionMode.ITERATIONS
        self.target_dimension = target_dimension

    def execute(self, resume_state: dict = None) -> List[PermutationResult]:
        current_order = self.dimensions[:]
        current_idx = current_order.index(self.target_dimension)
        has_strings = self._has_string_elements(self.target_dimension)
        last_pos = len(current_order) - 1
        results = []

        completed_positions = set()
        executor_state = resume_state.get("executor_state", {}) if resume_state else {}
        if "dimension_state" in executor_state:
            completed_positions = set(executor_state["dimension_state"]["completed_positions"])
            logging.info(f"Resuming dimension optimizer: {len(completed_positions)} positions already tested")

        total = last_pos if not has_strings else last_pos - 1
        for target_pos in range(len(current_order)):
            if target_pos == current_idx:
                continue
            if target_pos in completed_positions:
                continue
            if target_pos == last_pos and has_strings:
                logging.info(f"Skip last position — '{self.target_dimension}' has string elements")
                continue

            self._check_cancelled()
            permutation = swap(current_order, target_pos, current_idx)
            result = self._evaluate_permutation(permutation, total_permutations=total)
            results.append(result)

            # Save checkpoint after each permutation
            completed_positions.add(target_pos)
            self._save_checkpoint(
                new_results=results,
                last_applied_order=list(permutation),
                executor_state={
                    "dimension_state": {"completed_positions": sorted(completed_positions)}
                })

        return results
