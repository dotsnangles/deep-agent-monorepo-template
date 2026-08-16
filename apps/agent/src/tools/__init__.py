"""Custom tools extension package for LangChain Deep Agents.

By default, the agent runs in 100% pure vanilla mode using LangChain Deep Agents
built-in tools (execute, ls, read_file, write_file, edit_file, delete, write_todos).
Custom tools created in this module can be passed into `build_agent(tools=[...])`.
"""

from langchain_core.tools import tool

__all__ = ["tool"]
