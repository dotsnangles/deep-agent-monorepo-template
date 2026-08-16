"""Subagents module for LangChain Deep Agents.

Embraces the official LangChain Deep Agents architecture:
- Deep Agents automatically provides a native `general-purpose` subagent inheriting
  the supervisor's model (Super Model), VFS tools, and skills.
- The supervisor can delegate tasks on demand via
  `task(description="...", subagent_type="general-purpose")`
  to perform context quarantine without requiring pre-declared static personas.
- Custom specialized subagents can be injected via `create_custom_subagent(...)`
  or `CompiledSubAgent(...)` passed to `build_agent(subagents=[...])`.
"""

from typing import Any


def get_default_subagents() -> list[dict[str, Any]]:
    """Returns empty list by default.

    In LangChain Deep Agents, passing an empty list allows the framework to automatically
    attach the native `general-purpose` subagent inheriting the supervisor's model.
    """
    return []


def create_custom_subagent(
    name: str,
    description: str,
    system_prompt: str,
    tools: list[Any] | None = None,
    model: Any = None,
    middleware: list[Any] | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """Helper factory for defining a custom SubAgent dictionary.

    Args:
        name: Unique identifier for the subagent (used by task tool).
        description: Description of what this subagent specializes in.
        system_prompt: Specific instructions for the subagent.
        tools: Optional tools override. If omitted, inherits parent agent's tools.
        model: Optional model override. If omitted, inherits parent agent's model.
        middleware: Optional custom middleware for the subagent.
    """
    subagent_dict: dict[str, Any] = {
        "name": name,
        "description": description,
        "system_prompt": system_prompt,
        **kwargs,
    }
    if tools is not None:
        subagent_dict["tools"] = tools
    if model is not None:
        subagent_dict["model"] = model
    if middleware is not None:
        subagent_dict["middleware"] = middleware
    return subagent_dict
