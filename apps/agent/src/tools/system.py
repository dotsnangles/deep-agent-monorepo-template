import datetime

from langchain_core.tools import tool


@tool
def get_current_time() -> str:
    """Returns the current date and time."""
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


@tool
def calculate(expression: str) -> str:
    """Evaluates a basic mathematical expression safely.

    Args:
        expression: A mathematical expression string, e.g. "12 * 8 + 4"
    """
    try:
        allowed = set("0123456789+-*/(). ")
        if not set(expression).issubset(allowed):
            return "Error: Unsupported characters in mathematical expression"
        result = eval(expression, {"__builtins__": {}})
        return f"Result: {result}"
    except Exception as e:
        return f"Calculation error: {e}"


@tool
def query_system_info() -> str:
    """Returns basic system status information."""
    return "System Status: Online | Agent Engine: LangChain Deep Agent + CopilotKit AG-UI"


@tool
def finalize() -> dict[str, str]:
    """Signal task completion."""
    return {"status": "done", "message": "Task execution completed successfully."}


def get_default_tools() -> list:
    """Returns list of built-in system tools for deep agents."""
    return [
        get_current_time,
        calculate,
        query_system_info,
        finalize,
    ]
