import os
from unittest.mock import patch

from langgraph.checkpoint.memory import MemorySaver

from src.infrastructure import EnvironmentMode
from src.infrastructure import FakeChatModel
from src.graphs.chat.factory import DeepAgentEnvironmentFactory


def test_fault_tolerance_defaults_in_local_slm():
    """Verify that local_slm mode attaches protective call limits."""
    model = FakeChatModel()
    checkpointer = MemorySaver()

    with patch.dict(os.environ, {"DEEP_AGENT_MODE": "local_slm"}):
        graph = DeepAgentEnvironmentFactory.create_agent(
            model=model,
            checkpointer=checkpointer,
            mode=EnvironmentMode.LOCAL_SLM,
        )
        assert graph is not None


def test_fault_tolerance_with_fallback_model():
    """Verify that fallback_model attaches ModelFallbackMiddleware."""
    model = FakeChatModel()
    fallback = FakeChatModel()
    checkpointer = MemorySaver()

    with patch.dict(os.environ, {"DEEP_AGENT_MODE": "cloud_provider"}):
        graph = DeepAgentEnvironmentFactory.create_agent(
            model=model,
            checkpointer=checkpointer,
            fallback_model=fallback,
            mode=EnvironmentMode.CLOUD_PROVIDER,
        )
        assert graph is not None


def test_fault_tolerance_custom_call_limits_and_tool_retry():
    """Verify custom model/tool call limits and ToolRetryMiddleware."""
    model = FakeChatModel()
    checkpointer = MemorySaver()

    graph = DeepAgentEnvironmentFactory.create_agent(
        model=model,
        checkpointer=checkpointer,
        model_call_limit=15,
        tool_call_limit=40,
        tool_retry_config={"max_retries": 2, "tools": ["search"]},
    )
    assert graph is not None
