import os
from unittest.mock import patch

from langgraph.checkpoint.memory import MemorySaver

from src.core.config import EnvironmentMode
from src.core.testing import FakeChatModel
from src.graphs.chat.factory import DeepAgentEnvironmentFactory


def test_summarization_tool_attached_by_default():
    """Verify that create_summarization_tool_middleware is attached by default."""
    model = FakeChatModel()
    checkpointer = MemorySaver()

    # 1. Cloud provider mode
    with patch.dict(os.environ, {"DEEP_AGENT_MODE": "cloud_provider"}):
        graph_cloud = DeepAgentEnvironmentFactory.create_agent(
            model=model,
            checkpointer=checkpointer,
            mode=EnvironmentMode.CLOUD_PROVIDER,
        )
        assert graph_cloud is not None

    # 2. Local SLM mode
    with patch.dict(os.environ, {"DEEP_AGENT_MODE": "local_slm"}):
        graph_local = DeepAgentEnvironmentFactory.create_agent(
            model=model,
            checkpointer=checkpointer,
            mode=EnvironmentMode.LOCAL_SLM,
        )
        assert graph_local is not None


def test_summarization_tool_toggle():
    """Verify that enable_summarization_tool=False disables the compaction tool middleware."""
    model = FakeChatModel()
    checkpointer = MemorySaver()

    graph = DeepAgentEnvironmentFactory.create_agent(
        model=model,
        checkpointer=checkpointer,
        enable_summarization_tool=False,
    )
    assert graph is not None
