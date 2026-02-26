import base64
import io
import itertools
import json
import logging
import os
import statistics
import time
from pathlib import Path
from typing import List, Union
from execution_mode import ExecutionMode

import seaborn as sns

sns.set_theme()
import matplotlib.pyplot as plt
import pandas as pd

SEPARATOR = ","
HEADER = ["ID", "Mode", "Is Best", "Composite Query Time", "Query Ratio",
          "Composite Process Time", "Process Ratio", "RAM", "RAM in GB", "% Reduction",
          "Reorder Duration"]

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
        self.start_time = time.time()

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

    @property
    def elapsed(self) -> float:
        return time.time() - self.start_time


class PermutationResult:

    def __init__(self, context: ExecutionContext, mode: str, cube_name: str, view_names: list,
                 process_names: list, dimension_order: list,
                 query_times_by_view: dict, process_times_by_process: dict, ram_usage: float = None,
                 ram_percentage_change: float = None, reorder_duration: float = 0.0):

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
        self.reorder_duration = reorder_duration
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
        row += [self.ram_usage, ram_in_gb, f"{self.ram_reduction:.0%}",
                self.reorder_duration] + list(self.dimension_order)

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

    @staticmethod
    def _load_logo_base64() -> str:
        logo_path = Path(__file__).parent / "images" / "logo.png"
        if not logo_path.exists():
            return ""
        try:
            from PIL import Image
            img = Image.open(logo_path)
            ratio = 300 / img.width
            img = img.resize((300, int(img.height * ratio)), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="PNG", optimize=True)
            return base64.b64encode(buf.getvalue()).decode()
        except ImportError:
            with open(logo_path, "rb") as f:
                return base64.b64encode(f.read()).decode()

    def to_html(self, file_name, total_duration: float = 0.0):
        original = self.original_order_result
        best = self.best_result
        logo_b64 = self._load_logo_base64()
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")

        # Summary metrics
        original_ram_gb = original.ram_usage / (1024 ** 3)
        best_ram_gb = best.ram_usage / (1024 ** 3) if best else original_ram_gb
        ram_reduction = best.ram_reduction if best else 0
        original_qt = original.composite_query_time()
        best_qt = best.composite_query_time() if best else original_qt
        query_improvement = 1 - best_qt / original_qt if best and original_qt else 0
        orders_tested = len(self.permutation_results)

        def fmt_duration(seconds):
            if seconds < 60:
                return f"{seconds:.1f}s"
            m, s = divmod(seconds, 60)
            if m < 60:
                return f"{int(m)}m {int(s)}s"
            h, m = divmod(m, 60)
            return f"{int(h)}h {int(m)}m {int(s)}s"

        def fmt_pct(value):
            return f"{value:+.1%}" if value != 0 else "0.0%"

        # Build chart data
        chart_data = []
        for r in self.permutation_results:
            ram_gb = float(r.ram_usage) / (1024 ** 3)
            qt_ratio = r.composite_query_time() / original_qt - 1 if original_qt else 0
            chart_data.append({
                "id": r.permutation_id,
                "x": round(ram_gb, 4),
                "y": round(qt_ratio, 4),
                "mode": r.mode.label,
                "order": " > ".join(r.dimension_order),
                "processTime": round(r.composite_process_time(), 5) if self.include_process else None,
            })

        # Build table rows
        dim_count = len(self.permutation_results[0].dimension_order)
        table_rows_html = ""
        for r in self.permutation_results:
            composite_qt = r.composite_query_time()
            qt_ratio = composite_qt / original_qt - 1 if original_qt else 0
            ram_gb = float(r.ram_usage) / (1024 ** 3)

            if r.mode == ExecutionMode.ORIGINAL_ORDER:
                row_class = "row-original"
            elif r.mode == ExecutionMode.RESULT:
                row_class = "row-best"
            else:
                row_class = ""

            mode_badge = r.mode.label
            if r.mode == ExecutionMode.ORIGINAL_ORDER:
                mode_badge = f'<span class="badge badge-original">{r.mode.label}</span>'
            elif r.mode == ExecutionMode.RESULT:
                mode_badge = f'<span class="badge badge-best">Best</span>'
            else:
                mode_badge = f'<span class="badge badge-iteration">{r.mode.label}</span>'

            process_cells = ""
            if self.include_process:
                composite_pt = r.composite_process_time()
                original_pt = original.composite_process_time()
                pt_ratio = composite_pt / original_pt - 1 if original_pt else 0
                process_cells = f"""
                    <td class="num">{composite_pt:.5f}</td>
                    <td class="num {'positive' if pt_ratio > 0 else 'negative' if pt_ratio < 0 else ''}">{fmt_pct(pt_ratio)}</td>"""

            dim_cells = "".join(f"<td>{d}</td>" for d in r.dimension_order)

            table_rows_html += f"""
                <tr class="{row_class}">
                    <td class="num">{r.permutation_id}</td>
                    <td>{mode_badge}</td>
                    <td class="num">{composite_qt:.5f}</td>
                    <td class="num {'positive' if qt_ratio > 0 else 'negative' if qt_ratio < 0 else ''}">{fmt_pct(qt_ratio)}</td>
                    {process_cells}
                    <td class="num">{ram_gb:.2f}</td>
                    <td class="num">{f'{r.ram_reduction:.0%}'}</td>
                    <td class="num">{r.reorder_duration:.1f}</td>
                    {dim_cells}
                </tr>"""

        # Process header columns
        process_header = ""
        if self.include_process:
            process_header = """
                        <th>Process Time (s)</th>
                        <th>Process Ratio</th>"""

        dim_headers = "".join(f"<th>Dim {i+1}</th>" for i in range(dim_count))

        # Process summary cards
        process_cards = ""
        if self.include_process and best:
            original_pt = original.composite_process_time()
            best_pt = best.composite_process_time()
            proc_improvement = 1 - best_pt / original_pt if original_pt else 0
            process_cards = f"""
                <div class="card">
                    <div class="card-label">Best Process Time</div>
                    <div class="card-value">{best_pt:.3f}s</div>
                    <div class="card-sub">{fmt_pct(-proc_improvement)} vs original</div>
                </div>"""

        # Best order display
        best_order_html = ""
        if best:
            original_dims = original.dimension_order
            best_dims = best.dimension_order
            arrows = []
            for i, dim in enumerate(best_dims):
                orig_pos = list(original_dims).index(dim)
                if orig_pos < i:
                    cls = "dim-moved-down"
                elif orig_pos > i:
                    cls = "dim-moved-up"
                else:
                    cls = "dim-same"
                arrows.append(f'<span class="dim-tag {cls}">{dim}</span>')
            best_order_html = f"""
            <div class="panel">
                <h2>Recommended Dimension Order</h2>
                <div class="dim-order">
                    {"".join(arrows)}
                </div>
                <div class="dim-legend">
                    <span class="dim-tag dim-moved-up">Moved up</span>
                    <span class="dim-tag dim-moved-down">Moved down</span>
                    <span class="dim-tag dim-same">Unchanged</span>
                </div>
            </div>"""

        logo_html = ""
        if logo_b64:
            logo_html = f'<img src="data:image/png;base64,{logo_b64}" alt="OptimusPy" class="logo">'

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>OptimusPy Report — {self.cube_name}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #F8FAFC;
        color: #1E293B;
        line-height: 1.5;
    }}
    .container {{ max-width: 1440px; margin: 0 auto; padding: 24px; }}
    .header {{
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid #E2E8F0;
    }}
    .header-left {{ display: flex; align-items: center; gap: 16px; }}
    .logo {{ height: 48px; width: auto; }}
    .header h1 {{ font-size: 20px; font-weight: 600; color: #0F172A; }}
    .header-meta {{ font-size: 13px; color: #64748B; text-align: right; }}
    .cards {{
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
    }}
    .card {{
        background: #fff;
        border: 1px solid #E2E8F0;
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }}
    .card-label {{ font-size: 12px; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500; }}
    .card-value {{ font-size: 24px; font-weight: 700; color: #0F172A; font-family: 'SF Mono', 'Fira Code', monospace; margin: 4px 0; }}
    .card-sub {{ font-size: 12px; color: #64748B; }}
    .card-sub .positive {{ color: #DC2626; }}
    .card-sub .negative {{ color: #16A34A; }}
    .panel {{
        background: #fff;
        border: 1px solid #E2E8F0;
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 24px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }}
    .panel h2 {{ font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #0F172A; }}
    .chart-container {{ position: relative; height: 400px; }}
    table {{
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
    }}
    th {{
        background: #F8FAFC;
        border-bottom: 2px solid #E2E8F0;
        padding: 10px 12px;
        text-align: left;
        font-weight: 600;
        color: #475569;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        position: sticky;
        top: 0;
        z-index: 1;
    }}
    td {{
        padding: 8px 12px;
        border-bottom: 1px solid #F1F5F9;
    }}
    .num {{ font-family: 'SF Mono', 'Fira Code', monospace; text-align: right; }}
    .positive {{ color: #DC2626; }}
    .negative {{ color: #16A34A; }}
    .row-original {{ background: #EFF6FF; }}
    .row-best {{ background: #F0FDF4; }}
    tr:hover {{ background: #F8FAFC; }}
    .row-original:hover {{ background: #DBEAFE; }}
    .row-best:hover {{ background: #DCFCE7; }}
    .badge {{
        display: inline-block;
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.02em;
    }}
    .badge-original {{ background: #DBEAFE; color: #1E40AF; }}
    .badge-best {{ background: #DCFCE7; color: #166534; }}
    .badge-iteration {{ background: #F1F5F9; color: #475569; }}
    .dim-order {{ display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }}
    .dim-tag {{
        display: inline-block;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
    }}
    .dim-moved-up {{ background: #DCFCE7; color: #166534; }}
    .dim-moved-down {{ background: #FEE2E2; color: #991B1B; }}
    .dim-same {{ background: #F1F5F9; color: #475569; }}
    .dim-legend {{ display: flex; gap: 12px; font-size: 12px; color: #64748B; }}
    .dim-legend .dim-tag {{ padding: 2px 8px; font-size: 11px; }}
    .table-scroll {{ overflow-x: auto; }}
    .footer {{ text-align: center; padding: 24px 0; font-size: 12px; color: #94A3B8; }}
</style>
</head>
<body>
<div class="container">
    <div class="header">
        <div class="header-left">
            {logo_html}
            <h1>Optimization Report — {self.cube_name}</h1>
        </div>
        <div class="header-meta">
            Generated {timestamp}
        </div>
    </div>

    <div class="cards">
        <div class="card">
            <div class="card-label">Cube</div>
            <div class="card-value" style="font-size:18px">{self.cube_name}</div>
        </div>
        <div class="card">
            <div class="card-label">Orders Tested</div>
            <div class="card-value">{orders_tested}</div>
        </div>
        <div class="card">
            <div class="card-label">Original RAM</div>
            <div class="card-value">{original_ram_gb:.2f} GB</div>
        </div>
        <div class="card">
            <div class="card-label">Best RAM</div>
            <div class="card-value">{best_ram_gb:.2f} GB</div>
            <div class="card-sub"><span class="{'negative' if ram_reduction > 0 else ''}">{f'{ram_reduction:.0%}'} reduction</span></div>
        </div>
        <div class="card">
            <div class="card-label">Original Query Time</div>
            <div class="card-value">{original_qt:.3f}s</div>
        </div>
        <div class="card">
            <div class="card-label">Best Query Time</div>
            <div class="card-value">{best_qt:.3f}s</div>
            <div class="card-sub"><span class="{'negative' if query_improvement > 0 else ''}">{fmt_pct(-query_improvement)} vs original</span></div>
        </div>
        {process_cards}
        <div class="card">
            <div class="card-label">Total Duration</div>
            <div class="card-value" style="font-size:18px">{fmt_duration(total_duration)}</div>
        </div>
    </div>

    {best_order_html}

    <div class="panel">
        <h2>RAM vs Query Performance</h2>
        <div class="chart-container">
            <canvas id="scatterChart"></canvas>
        </div>
    </div>

    <div class="panel">
        <h2>All Permutation Results</h2>
        <div class="table-scroll">
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Mode</th>
                        <th>Query Time (s)</th>
                        <th>Query Ratio</th>
                        {process_header}
                        <th>RAM (GB)</th>
                        <th>RAM Reduction</th>
                        <th>Reorder (s)</th>
                        {dim_headers}
                    </tr>
                </thead>
                <tbody>
                    {table_rows_html}
                </tbody>
            </table>
        </div>
    </div>

    <div class="footer">
        OptimusPy v2.0 — TM1 Cube Dimension Order Optimizer
    </div>
</div>

<script>
const data = {json.dumps(chart_data)};

const colorMap = {{
    'Original Order': {{ bg: 'rgba(59,130,246,0.7)', border: '#2563EB' }},
    'Result':         {{ bg: 'rgba(34,197,94,0.7)',  border: '#16A34A' }},
    'Iterations':     {{ bg: 'rgba(148,163,184,0.5)', border: '#64748B' }},
}};

const datasets = {{}};
data.forEach(d => {{
    if (!datasets[d.mode]) {{
        const c = colorMap[d.mode] || {{ bg: 'rgba(148,163,184,0.5)', border: '#64748B' }};
        datasets[d.mode] = {{
            label: d.mode,
            data: [],
            backgroundColor: c.bg,
            borderColor: c.border,
            borderWidth: 1.5,
            pointRadius: d.mode === 'Iterations' ? 5 : 8,
            pointHoverRadius: 10,
        }};
    }}
    datasets[d.mode].data.push({{ x: d.x, y: d.y, id: d.id, order: d.order }});
}});

new Chart(document.getElementById('scatterChart'), {{
    type: 'scatter',
    data: {{ datasets: Object.values(datasets) }},
    options: {{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {{
            tooltip: {{
                callbacks: {{
                    label: ctx => {{
                        const pt = ctx.raw;
                        return [
                            `#${{pt.id}} — ${{ctx.dataset.label}}`,
                            `RAM: ${{pt.x.toFixed(2)}} GB`,
                            `Query Ratio: ${{(pt.y * 100).toFixed(1)}}%`,
                            pt.order
                        ];
                    }}
                }}
            }},
            legend: {{ position: 'top' }}
        }},
        scales: {{
            x: {{ title: {{ display: true, text: 'RAM (GB)' }} }},
            y: {{
                title: {{ display: true, text: 'Query Time vs Original' }},
                ticks: {{ callback: v => (v * 100).toFixed(0) + '%' }}
            }}
        }}
    }}
}});
</script>
</body>
</html>"""

        os.makedirs(os.path.dirname(str(file_name)), exist_ok=True)
        with open(str(file_name), "w") as f:
            f.write(html)

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
