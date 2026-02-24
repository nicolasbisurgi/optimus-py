import itertools
import logging
import os
import statistics
from typing import List, Union
from execution_mode import ExecutionMode

import seaborn as sns

sns.set_theme()
import matplotlib.pyplot as plt
import pandas as pd

SEPARATOR = ","
HEADER = ["ID", "Mode", "Is Best", "Composite Query Time", "Query Ratio",
          "Composite Process Time", "Process Ratio", "RAM", "RAM in GB", "% Reduction"]

PALETTE = {
    'Original Order': 'tab:blue',
    'Result': 'tab:green',
    'Iterations': 'tab:grey'
}


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


class PermutationResult:

    def __init__(self, context: ExecutionContext, mode: str, cube_name: str, view_names: list,
                 process_names: list, dimension_order: list,
                 query_times_by_view: dict, process_times_by_process: dict, ram_usage: float = None,
                 ram_percentage_change: float = None):

        self.mode = ExecutionMode(mode)
        self.cube_name = cube_name
        self.view_names = view_names
        self.process_names = process_names
        self.dimension_order = dimension_order
        self.query_times_by_view = query_times_by_view
        self.process_times_by_process = process_times_by_process
        self.is_best = False
        self.include_process = bool(process_names)

        # from original dimension order
        if ram_usage is not None:
            self.ram_usage = ram_usage
            context.set_initial_ram(ram_usage)
        # from all other dimension orders
        elif ram_percentage_change is not None:
            self.ram_usage = context.update_ram(ram_percentage_change)
        else:
            raise RuntimeError("Either 'ram_usage' or 'ram_percentage_change' must be provided")

        self.ram_percentage_change = ram_percentage_change or 0
        self.ram_reduction = 1 - context.current_ram / context.original_ram
        self.permutation_id = context.next_id()

    def median_query_time(self, view_name: str = None) -> float:
        view_name = view_name or self.view_names[0]
        median = statistics.median(self.query_times_by_view[view_name])
        if not median:
            raise RuntimeError(f"view '{view_name}' in cube '{self.cube_name}' is too small")
        return median

    def median_process_time(self, process_name: str = None) -> float:
        process_name = process_name or self.process_names[0]
        return statistics.median(self.process_times_by_process[process_name])

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

    def build_header(self) -> list:
        dimensions = ["Dimension" + str(d) for d in range(1, len(self.dimension_order) + 1)]
        return HEADER + dimensions

    def build_csv_header(self) -> str:
        return SEPARATOR.join(self.build_header()) + "\n"

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

    def to_csv_row(self, original_order_result: 'PermutationResult') -> str:
        row = [str(i) for i in self.to_row(original_order_result)]
        return SEPARATOR.join(row) + "\n"


class OptimusResult:
    TEXT_FONT_SIZE = 5

    def __init__(self, cube_name: str, permutation_results: List[PermutationResult]):
        self.cube_name = cube_name
        self.permutation_results = permutation_results
        if len(permutation_results) == 0:
            raise RuntimeError("Number of permutation results can not be 0")
        self.include_process = permutation_results[0].include_process

        self.best_result = self.determine_best_result()
        if self.best_result:
            for permutation_result in permutation_results:
                if (permutation_result.permutation_id == self.best_result.permutation_id
                        and permutation_result.mode != ExecutionMode.ORIGINAL_ORDER):
                    permutation_result.is_best = True
                    permutation_result.mode = ExecutionMode.RESULT

    def to_dataframe(self) -> pd.DataFrame:
        header = self.permutation_results[0].build_header()
        rows = [r.to_row(self.original_order_result) for r in self.permutation_results]
        return pd.DataFrame(rows, columns=header)

    def to_lines(self) -> List[str]:
        lines = itertools.chain(
            [self.permutation_results[0].build_csv_header()],
            [r.to_csv_row(self.original_order_result) for r in self.permutation_results])
        return list(lines)

    def to_csv(self, file_name):
        lines = self.to_lines()
        os.makedirs(os.path.dirname(str(file_name)), exist_ok=True)
        with open(str(file_name), "w") as file:
            file.writelines(lines)

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

    def to_png(self, file_name):
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
            p.text(row["RAM in GB"],
                   row["Query Ratio"],
                   row["ID"],
                   color='black')

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

    @property
    def original_order_result(self) -> PermutationResult:
        for result in self.permutation_results:
            if result.mode == ExecutionMode.ORIGINAL_ORDER:
                return result

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

        # find a good balance between speed and ram and process speed
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

        # no dimension order falls in sweet spot
        return None
