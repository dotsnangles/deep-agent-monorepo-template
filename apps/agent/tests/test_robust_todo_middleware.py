"""Unit tests for RobustTodoListMiddleware."""

from typing import Any
from unittest.mock import MagicMock

from langchain_core.messages import AIMessage, HumanMessage
from src.graphs.chat.todo_middleware import RobustTodoListMiddleware


def test_robust_todo_middleware_initialization():
    mw = RobustTodoListMiddleware()
    assert len(mw.tools) == 1
    assert mw.tools[0].name == "write_todos"


def test_robust_todo_middleware_auto_completes_at_turn_end():
    mw = RobustTodoListMiddleware()
    mock_runtime = MagicMock()

    state: dict[str, Any] = {
        "todos": [
            {"content": "Step 1", "status": "completed"},
            {"content": "Step 2", "status": "in_progress"},
            {"content": "Step 3", "status": "pending"},
        ],
        "messages": [
            HumanMessage(content="Do task"),
            AIMessage(content="I have completed all the steps and generated the report!", tool_calls=[]),
        ],
    }

    update = mw.after_model(state, mock_runtime)
    assert update is not None
    assert "todos" in update
    assert all(t["status"] == "completed" for t in update["todos"])


def test_robust_todo_middleware_does_not_auto_complete_while_calling_tools():
    mw = RobustTodoListMiddleware()
    mock_runtime = MagicMock()

    state: dict[str, Any] = {
        "todos": [
            {"content": "Step 1", "status": "completed"},
            {"content": "Step 2", "status": "in_progress"},
        ],
        "messages": [
            AIMessage(
                content="",
                tool_calls=[{"id": "call_1", "name": "execute", "args": {"command": "ls"}}],
            ),
        ],
    }

    update = mw.after_model(state, mock_runtime)
    assert update is None
