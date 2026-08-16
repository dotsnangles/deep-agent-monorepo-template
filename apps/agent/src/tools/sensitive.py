from collections.abc import Callable
from typing import Any

from langchain_core.tools import BaseTool, tool

_SENSITIVE_TOOLS: dict[str, dict[str, Any]] = {}


def sensitive_tool(
    description: str | None = None,
    name: str | None = None,
) -> Callable:
    """Decorator marking a LangChain tool as requiring HITL approval before execution."""

    def decorator(func: Callable) -> BaseTool:
        func_doc = getattr(func, "__doc__", None) or ""
        tool_desc = description or func_doc or f"Execution of {func.__name__}"
        tool_name = name or func.__name__

        # LangChain tool decorator with explicit description
        t = tool(description=tool_desc)(func)

        # Register in sensitive registry
        _SENSITIVE_TOOLS[tool_name] = {
            "name": tool_name,
            "description": tool_desc,
            "requires_approval": True,
        }
        return t

    return decorator


def is_sensitive_tool(tool_or_name: str | BaseTool | Any) -> bool:
    """Checks if a tool or tool name is registered as requiring approval."""
    if isinstance(tool_or_name, str):
        return tool_or_name in _SENSITIVE_TOOLS
    tool_name = getattr(tool_or_name, "name", str(tool_or_name))
    return tool_name in _SENSITIVE_TOOLS


def get_sensitive_tool_metadata(tool_or_name: str | BaseTool | Any) -> dict[str, Any] | None:
    """Returns metadata dict for a sensitive tool if registered, else None."""
    name = tool_or_name if isinstance(tool_or_name, str) else getattr(tool_or_name, "name", "")
    return _SENSITIVE_TOOLS.get(name)


# --- Built-in Default Sensitive Tools ---


@sensitive_tool(description="시스템 쉘 명령어를 실행합니다.")
def execute_command(command: str) -> str:
    """Executes a system shell command (requires human approval).

    Args:
        command: The shell command to run.
    """
    return f"Executed command: '{command}' successfully."


@sensitive_tool(description="지정된 경로의 파일에 내용을 작성하거나 수정합니다.")
def write_file(filepath: str, content: str) -> str:
    """Writes or overwrites content to a specified file path (requires human approval).

    Args:
        filepath: Target file path.
        content: Text content to write.
    """
    return f"Successfully wrote {len(content)} characters to {filepath}."


@sensitive_tool(description="지정된 리소스를 영구적으로 삭제합니다.")
def delete_resource(resource_id: str) -> str:
    """Deletes a database or storage resource (requires human approval).

    Args:
        resource_id: The ID of the resource to delete.
    """
    return f"Resource '{resource_id}' was deleted permanently."


def get_sensitive_tools() -> list[BaseTool]:
    """Returns list of built-in sensitive tools."""
    return [
        execute_command,
        write_file,
        delete_resource,
    ]
