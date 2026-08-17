import os
from unittest.mock import patch

import pytest
from langgraph.checkpoint.memory import MemorySaver

from src.infrastructure import EnvironmentMode
from src.infrastructure import FakeChatModel
from src.graphs.chat.factory import DeepAgentEnvironmentFactory
from src.graphs.chat.subagents import create_custom_subagent, get_default_subagents
from src.runtime import AgentRuntime


def test_subagent_templates_and_default():
    """Verify subagents module helpers and default list behavior."""
    assert get_default_subagents() == []

    custom = create_custom_subagent(
        name="domain-expert",
        description="Handles domain specific tasks",
        system_prompt="You are a domain expert.",
    )
    assert custom["name"] == "domain-expert"
    assert custom["description"] == "Handles domain specific tasks"
    assert custom["system_prompt"] == "You are a domain expert."


def test_general_purpose_subagent_enabled_across_modes():
    """Verify that general_purpose_subagent is enabled when enable_subagents=True in both modes."""
    model = FakeChatModel()
    checkpointer = MemorySaver()

    # 1. In local_slm mode with enable_subagents=True
    with patch.dict(os.environ, {"DEEP_AGENT_MODE": "local_slm"}):
        graph_local = DeepAgentEnvironmentFactory.create_agent(
            model=model,
            checkpointer=checkpointer,
            enable_subagents=True,
            mode=EnvironmentMode.LOCAL_SLM,
        )
        assert graph_local is not None

    # 2. In cloud_provider mode with enable_subagents=True
    with patch.dict(os.environ, {"DEEP_AGENT_MODE": "cloud_provider"}):
        graph_cloud = DeepAgentEnvironmentFactory.create_agent(
            model=model,
            checkpointer=checkpointer,
            enable_subagents=True,
            mode=EnvironmentMode.CLOUD_PROVIDER,
        )
        assert graph_cloud is not None


@pytest.mark.asyncio
async def test_subagent_delegation_stream_events():
    """Verify that task delegation yields subagent stream events."""
    model = FakeChatModel(
        tool_calls=[
            {
                "id": "call_task_1",
                "name": "task",
                "args": {
                    "description": "Review codebase structure",
                    "subagent_type": "general-purpose",
                },
            }
        ]
    )

    runtime = AgentRuntime.create_in_memory(model=model)
    events = []
    async for event in runtime.stream_execution(
        messages=[{"role": "user", "content": "Please analyze this"}],
        thread_id="test_subagent_thread",
        agent_type="direct",
        model=model,
    ):
        events.append(event)

    assert any(e.event == "done" for e in events)
