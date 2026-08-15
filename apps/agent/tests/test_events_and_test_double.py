from unittest.mock import patch

import pytest
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import MemorySaver

from src.core.checkpointer import CheckpointerFactory
from src.core.testing import FakeChatModel
from src.schemas.events import AgentStreamEvent


class TestAgentStreamEvents:
    def test_token_event_sse_formatting(self):
        event = AgentStreamEvent.token(content="Hello world")
        sse = event.to_sse()
        assert sse.startswith("event: token\n")
        assert 'data: {"content": "Hello world"}\n\n' in sse

    def test_tool_start_and_end_events(self):
        start_event = AgentStreamEvent.tool_start(
            tool="search_docs",
            tool_input={"query": "agent"},
            run_id="run_1",
        )
        assert start_event.event == "tool_start"
        assert 'data: {"tool": "search_docs"' in start_event.to_sse()

        end_event = AgentStreamEvent.tool_end(
            tool="search_docs",
            output=["result 1"],
            run_id="run_1",
        )
        assert end_event.event == "tool_end"
        assert '"output": ["result 1"]' in end_event.to_sse()

    def test_node_transition_event(self):
        event = AgentStreamEvent.node_transition(
            node="generate_response",
            state_summary={"step": 2},
        )
        assert event.event == "node_transition"
        sse = event.to_sse()
        assert '"node": "generate_response"' in sse
        assert '"step": 2' in sse

    def test_error_and_done_events(self):
        err = AgentStreamEvent.error(message="Network timeout", code="TIMEOUT_ERROR")
        assert err.event == "error"
        assert '"message": "Network timeout"' in err.to_sse()

        done = AgentStreamEvent.done(finish_reason="stop", metadata={"total_tokens": 42})
        assert done.event == "done"
        assert '"finish_reason": "stop"' in done.to_sse()
        assert '"total_tokens": 42' in done.to_sse()


class TestFakeChatModel:
    @pytest.mark.asyncio
    async def test_fake_chat_model_astream(self):
        model = FakeChatModel(tokens=["Hello", " ", "from", " ", "FakeLLM"])
        messages = [HumanMessage(content="Hi")]

        received_tokens = []
        async for chunk in model.astream(messages):
            if chunk.content:
                received_tokens.append(chunk.content)

        assert received_tokens == ["Hello", " ", "from", " ", "FakeLLM"]
        assert "".join(received_tokens) == "Hello from FakeLLM"

    @pytest.mark.asyncio
    async def test_fake_chat_model_agenerate(self):
        model = FakeChatModel(responses=["Generated single response"])
        messages = [HumanMessage(content="Test")]

        res = await model.ainvoke(messages)
        assert res.content == "Generated single response"

    @pytest.mark.asyncio
    async def test_fake_chat_model_tool_calls(self):
        tool_call_def = {"name": "calculator", "args": {"expr": "2+2"}, "id": "call_123"}
        model = FakeChatModel(tool_calls=[tool_call_def])
        bound_model = model.bind_tools(tools=[{"name": "calculator"}])

        assert len(bound_model.bound_tools) == 1

        chunks = []
        async for chunk in bound_model.astream([HumanMessage(content="Calculate 2+2")]):
            chunks.append(chunk)

        assert len(chunks) >= 1
        assert chunks[0].tool_call_chunks[0]["name"] == "calculator"


class TestCheckpointerFactory:
    def test_checkpointer_factory_defaults_to_memory_saver_in_test(self):
        checkpointer = CheckpointerFactory.create_checkpointer(env="test")
        assert isinstance(checkpointer, MemorySaver)

    def test_checkpointer_factory_when_no_db_url(self):
        checkpointer = CheckpointerFactory.create_checkpointer(env="development", postgres_url="")
        assert isinstance(checkpointer, MemorySaver)

    def test_checkpointer_factory_instantiates_postgres_saver_when_configured(self):
        target_path = "langgraph.checkpoint.postgres.aio.AsyncPostgresSaver.from_conn_string"
        with patch(target_path) as mock_from_conn:
            mock_from_conn.return_value = "mock_postgres_saver"
            saver = CheckpointerFactory.create_checkpointer(
                env="production",
                postgres_url="postgresql://user:pass@localhost:5432/db",
            )
            assert saver == "mock_postgres_saver"
            mock_from_conn.assert_called_once_with("postgresql://user:pass@localhost:5432/db")
