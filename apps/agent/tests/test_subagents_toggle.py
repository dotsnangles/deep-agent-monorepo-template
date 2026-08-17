import pytest
from langgraph.checkpoint.memory import MemorySaver

from src.core.testing import FakeChatModel
from src.graphs.chat.graph import build_agent
from src.graphs.registry import GraphRegistry
from src.runtime import AgentRuntime


@pytest.mark.asyncio
class TestSubagentsToggle:
    async def test_build_agent_defaults_to_single_vanilla_agent(self):
        """By default, agent compiles in pure vanilla single-agent mode without subagents."""
        fake_llm = FakeChatModel(responses=["Direct answer from single agent"])
        checkpointer = MemorySaver()

        agent_graph = build_agent(
            model=fake_llm,
            checkpointer=checkpointer,
        )
        assert agent_graph is not None

        registry = GraphRegistry()
        registry.register(
            "default",
            lambda **kw: build_agent(model=fake_llm, **kw),
        )

        gateway = AgentRuntime.create_in_memory(
            registry=registry,
            checkpointer=checkpointer,
            model=fake_llm,
        )

        events = []
        async for ev in gateway.stream_execution(
            messages=[{"role": "user", "content": "Hello single agent"}],
            thread_id="test-single-agent-thread",
            agent_type="default",
        ):
            events.append(ev)

        assert any(e.event == "token" for e in events)
        assert any(e.event == "done" for e in events)

    async def test_build_agent_with_custom_subagents_list(self):
        """When custom subagents are provided, it injects them into the deep agent graph."""
        fake_llm = FakeChatModel(responses=["Custom subagent answer"])
        checkpointer = MemorySaver()
        custom_subagents = [
            {
                "name": "custom_specialist",
                "description": "A custom specialist agent",
                "system_prompt": "You are a custom specialist.",
                "tools": [],
            }
        ]

        agent_graph = build_agent(
            model=fake_llm,
            checkpointer=checkpointer,
            subagents=custom_subagents,
        )
        assert agent_graph is not None
