import pytest
from langchain_core.tools import tool
from langgraph.checkpoint.memory import MemorySaver

from src.core import FakeChatModel
from src.graphs.chat.graph import build_agent
from src.graphs.registry import GraphRegistry
from src.runtime import AgentRuntime
from src.schemas import AgentStreamEvent


@tool
def execute_command(command: str) -> str:
    """Execute a system shell command."""
    return f"Executed command: '{command}' successfully."


@pytest.fixture
def hitl_gateway_fixture():
    checkpointer = MemorySaver()
    registry = GraphRegistry()
    registry.register(
        "hitl_test",
        lambda **kw: build_agent(
            tools=[execute_command],
            interrupt_on={"execute_command": True},
            **kw,
        ),
    )
    fake_llm = FakeChatModel()
    gateway = AgentRuntime.create_in_memory(
        registry=registry,
        checkpointer=checkpointer,
        model=fake_llm,
    )
    return {
        "gateway": gateway,
        "model": fake_llm,
        "checkpointer": checkpointer,
    }


class TestRuntimeHITL:
    @pytest.mark.asyncio
    async def test_stream_execution_emits_approval_request_on_interrupt(self, hitl_gateway_fixture):
        tool_call = {
            "name": "execute_command",
            "args": {"command": "npm install"},
            "id": "call_hitl_stream_1",
        }
        fake_llm: FakeChatModel = hitl_gateway_fixture["model"]
        fake_llm.tool_calls = [tool_call]
        fake_llm.responses = ["명령어가 실행되었습니다."]

        gateway: AgentRuntime = hitl_gateway_fixture["gateway"]

        events: list[AgentStreamEvent] = []
        async for event in gateway.stream_execution(
            messages=[{"role": "user", "content": "패키지 설치해줘"}],
            thread_id="thread_hitl_stream",
            agent_type="hitl_test",
        ):
            events.append(event)

        event_types = [e.event for e in events]
        assert "approval_request" in event_types
        assert "done" in event_types

        approval_event = next(e for e in events if e.event == "approval_request")
        assert approval_event.data.tool == "execute_command"
        assert approval_event.data.tool_call_id == "call_hitl_stream_1"
        assert approval_event.data.input == {"command": "npm install"}

        done_event = next(e for e in events if e.event == "done")
        assert done_event.data.finish_reason == "interrupt"

    @pytest.mark.asyncio
    async def test_stream_execution_resumes_with_approval_and_streams_response(
        self, hitl_gateway_fixture
    ):
        tool_call = {
            "name": "execute_command",
            "args": {"command": "echo 'ok'"},
            "id": "call_hitl_resume_1",
        }
        fake_llm: FakeChatModel = hitl_gateway_fixture["model"]
        fake_llm.tool_calls = [tool_call]
        fake_llm.tokens = ["명령어", " ", "실행", " ", "완료"]

        gateway: AgentRuntime = hitl_gateway_fixture["gateway"]

        # 1. Initial invocation halts at interrupt
        initial_events: list[AgentStreamEvent] = []
        async for event in gateway.stream_execution(
            messages=[{"role": "user", "content": "실행"}],
            thread_id="thread_resume_stream",
            agent_type="hitl_test",
        ):
            initial_events.append(event)

        assert any(e.event == "approval_request" for e in initial_events)

        # 2. Next model call returns tokens, not tool call
        fake_llm.tool_calls = None

        # 3. Resume invocation
        resume_events: list[AgentStreamEvent] = []
        async for event in gateway.stream_execution(
            messages=[],
            thread_id="thread_resume_stream",
            agent_type="hitl_test",
            resume={"approved": True},
        ):
            resume_events.append(event)

        resume_types = [e.event for e in resume_events]
        assert "token" in resume_types
        assert "done" in resume_types

        token_events = [e for e in resume_events if e.event == "token"]
        combined = "".join(e.data.content for e in token_events)
        assert combined == "명령어 실행 완료"

        done_event = next(e for e in resume_events if e.event == "done")
        assert done_event.data.finish_reason == "stop"

    @pytest.mark.asyncio
    async def test_stream_execution_resumes_with_rejection(self, hitl_gateway_fixture):
        tool_call = {
            "name": "execute_command",
            "args": {"command": "delete resource res_123"},
            "id": "call_reject_stream_1",
        }
        fake_llm: FakeChatModel = hitl_gateway_fixture["model"]
        fake_llm.tool_calls = [tool_call]
        fake_llm.tokens = ["삭제", " ", "취소됨"]

        gateway: AgentRuntime = hitl_gateway_fixture["gateway"]

        # 1. Trigger interrupt
        async for _ in gateway.stream_execution(
            messages=[{"role": "user", "content": "삭제해줘"}],
            thread_id="thread_reject_stream",
            agent_type="hitl_test",
        ):
            pass

        # 2. Resume with Rejection
        fake_llm.tool_calls = None

        resume_events: list[AgentStreamEvent] = []
        async for event in gateway.stream_execution(
            messages=[],
            thread_id="thread_reject_stream",
            agent_type="hitl_test",
            resume={"approved": False, "reason": "사용자 거부"},
        ):
            resume_events.append(event)

        assert any(e.event == "token" for e in resume_events)
        done_event = next(e for e in resume_events if e.event == "done")
        assert done_event.data.finish_reason == "stop"
