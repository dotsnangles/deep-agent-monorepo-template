"""Robust Todo List Middleware for Deep Agents.

Extends standard TodoListMiddleware to guarantee automatic 100% completion
when the agent concludes its execution.
"""

from __future__ import annotations

from typing import Any
from langchain.agents.middleware import TodoListMiddleware
from langchain_core.messages import AIMessage
from typing_extensions import override


class RobustTodoListMiddleware(TodoListMiddleware):
    """Enhanced TodoListMiddleware with turn-end auto-completion."""

    @override
    def after_model(
        self, state: dict[str, Any], runtime: Any
    ) -> dict[str, Any] | None:
        base_res = super().after_model(state, runtime)
        if base_res is not None:
            return base_res

        messages = state.get("messages", [])
        if not messages:
            return None

        last_ai_msg = next((msg for msg in reversed(messages) if isinstance(msg, AIMessage)), None)
        if not last_ai_msg:
            return None

        # When the model produces final response without tool calls (turn completed):
        if not last_ai_msg.tool_calls and bool(last_ai_msg.content):
            todos = state.get("todos", [])
            if todos and any(
                (t.get("status") if isinstance(t, dict) else getattr(t, "status", None)) != "completed"
                for t in todos
            ):
                completed_todos = [
                    {**t, "status": "completed"}
                    if isinstance(t, dict)
                    else {"content": getattr(t, "content", ""), "status": "completed"}
                    for t in todos
                ]
                return {"todos": completed_todos}

        return None

    @override
    async def aafter_model(
        self, state: dict[str, Any], runtime: Any
    ) -> dict[str, Any] | None:
        return self.after_model(state, runtime)
