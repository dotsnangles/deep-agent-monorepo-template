import pytest
from langgraph.checkpoint.memory import MemorySaver

from src.core.gateway import AgentExecutionGateway
from src.core.testing import FakeChatModel
from src.graphs.chat.graph import build_agent
from src.graphs.chat.subagents import get_default_subagents
from src.graphs.registry import GraphRegistry


@pytest.mark.asyncio
class TestSubagentsToggle:
    async def test_build_agent_with_subagents_disabled(self):
        """When enable_subagents=False, agent compiles in single-agent mode without subagents."""
        fake_llm = FakeChatModel(responses=["Direct answer from single agent"])
        checkpointer = MemorySaver()

        agent_graph = build_agent(
            model=fake_llm,
            checkpointer=checkpointer,
            enable_subagents=False,
        )
        assert agent_graph is not None

        registry = GraphRegistry()
        registry.register(
            "default",
            lambda **kw: build_agent(model=fake_llm, enable_subagents=False, **kw),
        )

        gateway = AgentExecutionGateway(
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

    async def test_build_agent_with_subagents_enabled(self):
        """When enable_subagents=True, agent graph is compiled with specialized subagents."""
        fake_llm = FakeChatModel(responses=["Delegated or direct answer"])
        checkpointer = MemorySaver()

        agent_graph = build_agent(
            model=fake_llm,
            checkpointer=checkpointer,
            enable_subagents=True,
        )
        assert agent_graph is not None

    async def test_build_agent_with_explicit_subagents_list(self):
        """When subagents is explicitly provided, it overrides defaults and enables subagents."""
        fake_llm = FakeChatModel(responses=["Custom subagent answer"])
        checkpointer = MemorySaver()
        custom_subagents = get_default_subagents()[:1]

        agent_graph = build_agent(
            model=fake_llm,
            checkpointer=checkpointer,
            subagents=custom_subagents,
        )
        assert agent_graph is not None
