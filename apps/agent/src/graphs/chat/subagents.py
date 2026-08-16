"""Subagents extension module for LangChain Deep Agents.

By default, the agent runs in 100% vanilla single-agent mode (subagents=[]).
Custom specialized subagent configurations can be injected via `build_agent(subagents=[...])`.
"""

from typing import Any


def get_default_subagents() -> list[dict[str, Any]]:
    """Returns empty list by default (pure single-agent mode)."""
    return []
