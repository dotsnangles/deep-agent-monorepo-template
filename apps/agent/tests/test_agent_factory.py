import os
from unittest.mock import patch

from langgraph.graph.state import CompiledStateGraph

from src.core.checkpointer import CheckpointerFactory
from src.core.config import EnvironmentMode, get_deep_agent_mode
from src.core.testing import FakeChatModel
from src.graphs.chat.factory import DeepAgentEnvironmentFactory
from src.graphs.chat.graph import build_agent


def test_factory_creates_local_slm_agent():
    """Verify that DeepAgentEnvironmentFactory produces a valid graph in local_slm mode."""
    with patch.dict(os.environ, {"DEEP_AGENT_MODE": "local_slm", "LLM_PROVIDER": "ollama"}):
        model = FakeChatModel()
        checkpointer = CheckpointerFactory.get_default_checkpointer()
        store = CheckpointerFactory.get_default_store()

        agent_graph = DeepAgentEnvironmentFactory.create_agent(
            model=model,
            checkpointer=checkpointer,
            store=store,
        )

        assert isinstance(agent_graph, CompiledStateGraph)
        assert get_deep_agent_mode() == EnvironmentMode.LOCAL_SLM


def test_factory_creates_production_cloud_agent():
    """Verify that DeepAgentEnvironmentFactory produces a valid graph in production_cloud mode."""
    with patch.dict(os.environ, {"DEEP_AGENT_MODE": "production_cloud", "LLM_PROVIDER": "openai"}):
        model = FakeChatModel()
        checkpointer = CheckpointerFactory.get_default_checkpointer()
        store = CheckpointerFactory.get_default_store()

        agent_graph = DeepAgentEnvironmentFactory.create_agent(
            model=model,
            checkpointer=checkpointer,
            store=store,
            enable_subagents=True,
        )

        assert isinstance(agent_graph, CompiledStateGraph)
        assert get_deep_agent_mode() == EnvironmentMode.PRODUCTION_CLOUD


def test_build_agent_delegates_seamlessly_across_environments():
    """Verify backward compatibility of build_agent() delegating to the factory."""
    model = FakeChatModel()

    # 1. Test in local_slm mode
    with patch.dict(os.environ, {"DEEP_AGENT_MODE": "local_slm"}):
        graph_local = build_agent(model=model)
        assert isinstance(graph_local, CompiledStateGraph)

    # 2. Test in production_cloud mode
    with patch.dict(os.environ, {"DEEP_AGENT_MODE": "production_cloud"}):
        graph_prod = build_agent(model=model, enable_subagents=True)
        assert isinstance(graph_prod, CompiledStateGraph)
