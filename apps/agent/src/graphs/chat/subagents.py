from typing import Any

DATA_ANALYST_PROMPT = """You are a senior data analyst and quantitative engineer.
Your role is to inspect datasets, run statistical aggregations, perform calculations
using Python (pandas, numpy, scipy), and extract critical insights from structured data.
Execute all calculations inside the sandbox and return clear, concise,
and structured numeric findings.
"""

CHART_GENERATOR_PROMPT = """You are an expert data visualization engineer.
Your role is to generate beautiful, publication-ready charts using matplotlib and seaborn.
Always save generated figures as PNG files in the current workspace directory
(e.g. 'chart.png' or 'distribution.png').
Follow best practices:
- High DPI (dpi=300)
- Clear axis labels and legends
- Consistent color palettes
- Clean typography and formatting
Return the filename of the generated chart and a brief explanation of what it shows.
"""


def get_default_subagents() -> list[dict[str, Any]]:
    """Returns the default specialized subagent specifications for deep data analysis."""
    return [
        {
            "name": "data_analyst",
            "description": (
                "Performs numerical calculations, statistical summaries, regression, "
                "and tabular data processing on datasets."
            ),
            "system_prompt": DATA_ANALYST_PROMPT,
        },
        {
            "name": "chart_generator",
            "description": (
                "Generates high-quality statistical visualizations, trend plots, "
                "and distribution charts saved as PNG images."
            ),
            "system_prompt": CHART_GENERATOR_PROMPT,
        },
    ]
