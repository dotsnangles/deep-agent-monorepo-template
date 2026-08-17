import operator
from typing import Annotated, TypedDict

import pytest
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from src.core.testing import FakeChatModel
from src.graphs.registry import GraphRegistry
from src.runtime import AgentRuntime
from src.schemas.events import AgentStreamEvent


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], operator.add]


# Simple test graph factory
def build_test_graph(checkpointer=None, model=None, **kwargs):
    workflow = StateGraph(AgentState)

    async def call_model(state: AgentState):
        effective_model = model or FakeChatModel(responses=["Graph generated response"])
        response = await effective_model.ainvoke(state["messages"])
        return {"messages": [response]}

    workflow.add_node("agent", call_model)
    workflow.add_edge(START, "agent")
    workflow.add_edge("agent", END)

    return workflow.compile(checkpointer=checkpointer)


class TestGraphRegistry:
    def test_registry_defaults_and_listing(self):
        registry = GraphRegistry()
        assert registry.has_graph("default")
        assert registry.has_graph("chat")
        assert "default" in registry.list_graphs()

    def test_custom_graph_registration(self):
        registry = GraphRegistry()

        def mock_factory(**kwargs):
            return {"status": "compiled", "model": kwargs.get("model")}

        registry.register("custom_agent", mock_factory)

        assert registry.has_graph("custom_agent")
        graph = registry.get_graph("custom_agent", model="fake_model")
        assert graph["status"] == "compiled"
        assert graph["model"] == "fake_model"

    def test_registry_fallback_to_default_for_unknown_agent(self):
        registry = GraphRegistry()

        def mock_default(**kwargs):
            return "default_graph"

        registry.register("default", mock_default)

        resolved = registry.get_graph("unknown_nonexistent")
        assert resolved == "default_graph"


class TestAgentRuntime:
    @pytest.mark.asyncio
    async def test_stream_execution_with_dictionary_messages(self):
        fake_llm = FakeChatModel(tokens=["Response"])
        gateway = AgentRuntime.create_in_memory(model=fake_llm)

        events: list[AgentStreamEvent] = []
        async for event in gateway.stream_execution(
            messages=[{"role": "user", "content": "Hello"}],
            thread_id="thread_dict",
            agent_type="direct",
        ):
            events.append(event)

        assert any(e.event == "token" for e in events)
        assert events[-1].event == "done"

    @pytest.mark.asyncio
    async def test_stream_execution_with_custom_system_prompt(self):
        fake_llm = FakeChatModel(tokens=["Custom prompt response"])
        gateway = AgentRuntime.create_in_memory(model=fake_llm)

        events: list[AgentStreamEvent] = []
        async for event in gateway.stream_execution(
            messages=[
                SystemMessage(content="Original prompt"),
                HumanMessage(content="Hi"),
            ],
            system_prompt="Overridden prompt",
            agent_type="direct",
        ):
            events.append(event)

        assert any(e.event == "token" for e in events)

    @pytest.mark.asyncio
    async def test_stream_execution_yields_token_and_done_events(self):
        fake_llm = FakeChatModel(tokens=["Streamed", " ", "response", " ", "content"])
        checkpointer = MemorySaver()
        gateway = AgentRuntime.create_in_memory(model=fake_llm, checkpointer=checkpointer)

        events: list[AgentStreamEvent] = []
        async for event in gateway.stream_execution(
            messages=[{"role": "user", "content": "Test prompt"}],
            thread_id="sess_123",
            agent_type="direct",
        ):
            events.append(event)

        assert len(events) >= 2
        token_events = [e for e in events if e.event == "token"]
        assert len(token_events) == 5
        combined_text = "".join(e.data.content for e in token_events)
        assert combined_text == "Streamed response content"

        done_event = events[-1]
        assert done_event.event == "done"
        assert done_event.data.finish_reason == "stop"
        assert done_event.data.metadata["thread_id"] == "sess_123"

    @pytest.mark.asyncio
    async def test_stream_execution_with_compiled_graph_and_checkpointer(self):
        registry = GraphRegistry()
        registry.register("test_graph", build_test_graph)

        fake_llm = FakeChatModel(tokens=["Graph", " ", "output"])
        checkpointer = MemorySaver()
        gateway = AgentRuntime.create_in_memory(
            registry=registry,
            checkpointer=checkpointer,
            model=fake_llm,
        )

        events: list[AgentStreamEvent] = []
        async for event in gateway.stream_execution(
            messages=[HumanMessage(content="Hello graph")],
            thread_id="test_thread_cp",
            agent_type="test_graph",
        ):
            events.append(event)

        assert any(e.event == "token" for e in events)
        assert events[-1].event == "done"

        # Verify thread state checkpoint was saved in MemorySaver
        saved_state = await checkpointer.aget_tuple(
            {"configurable": {"thread_id": "test_thread_cp"}}
        )
        assert saved_state is not None
        assert "messages" in saved_state.checkpoint["channel_values"]

    @pytest.mark.asyncio
    async def test_stream_execution_yields_tool_start_events(self):
        tool_call_def = {"name": "search_docs", "args": {"query": "python"}, "id": "call_999"}
        fake_llm = FakeChatModel(tool_calls=[tool_call_def])
        gateway = AgentRuntime.create_in_memory(model=fake_llm)

        events: list[AgentStreamEvent] = []
        async for event in gateway.stream_execution(
            messages=[HumanMessage(content="Search docs")],
            agent_type="direct",
        ):
            events.append(event)

        tool_events = [e for e in events if e.event == "tool_start"]
        assert len(tool_events) == 1
        assert tool_events[0].data.tool == "search_docs"
        assert tool_events[0].data.run_id == "call_999"

    @pytest.mark.asyncio
    async def test_stream_execution_handles_errors_gracefully(self):
        class BrokenChatModel(FakeChatModel):
            def _generate(self, *args, **kwargs):
                raise RuntimeError("Simulated LLM Provider Outage")

            async def _agenerate(self, *args, **kwargs):
                raise RuntimeError("Simulated LLM Provider Outage")

            async def _astream(self, *args, **kwargs):
                raise RuntimeError("Simulated LLM Provider Outage")
                yield  # pragma: no cover

        gateway = AgentRuntime.create_in_memory(model=BrokenChatModel())

        events: list[AgentStreamEvent] = []
        async for event in gateway.stream_execution(
            messages=[{"role": "user", "content": "Hi"}],
            agent_type="direct",
        ):
            events.append(event)

        assert len(events) == 1
        assert events[0].event == "error"
        assert "Simulated LLM Provider Outage" in events[0].data.message
