import json
import pytest
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command

from src.core.testing import FakeChatModel
from src.graphs.chat import build_hitl_agent_graph
from src.schemas import AgentStreamEvent, ApprovalRequestEventData
from src.tools import (
    execute_command,
    get_sensitive_tool_metadata,
    get_sensitive_tools,
    is_sensitive_tool,
    sensitive_tool,
)


class TestApprovalRequestEventSchema:
    def test_approval_request_event_creation_and_sse_serialization(self):
        event = AgentStreamEvent.approval_request(
            tool="execute_command",
            tool_input={"command": "rm -rf /tmp/test"},
            tool_call_id="call_abc123",
            description="임시 디렉토리 파일 삭제 승인 요청",
        )

        assert event.event == "approval_request"
        assert isinstance(event.data, ApprovalRequestEventData)
        assert event.data.tool == "execute_command"
        assert event.data.tool_call_id == "call_abc123"
        assert event.data.requires_approval is True
        assert event.data.description == "임시 디렉토리 파일 삭제 승인 요청"

        sse_output = event.to_sse()
        assert sse_output.startswith("event: approval_request\n")
        assert '"toolCallId": "call_abc123"' in sse_output
        assert '"requiresApproval": true' in sse_output
        assert "execute_command" in sse_output


class TestSensitiveToolRegistry:
    def test_sensitive_tool_decorator_and_detection(self):
        @sensitive_tool(description="데이터베이스 테이블을 삭제합니다.")
        def drop_table(table_name: str) -> str:
            """Drop a database table."""
            return f"Dropped {table_name}"

        assert is_sensitive_tool("drop_table")
        assert is_sensitive_tool(drop_table)
        meta = get_sensitive_tool_metadata("drop_table")
        assert meta is not None
        assert meta["description"] == "데이터베이스 테이블을 삭제합니다."
        assert meta["requires_approval"] is True

    def test_builtin_sensitive_tools(self):
        sensitive_tools = get_sensitive_tools()
        tool_names = [t.name for t in sensitive_tools]
        assert "execute_command" in tool_names
        assert "write_file" in tool_names
        assert "delete_resource" in tool_names

        assert is_sensitive_tool(execute_command)
        assert is_sensitive_tool("write_file")


class TestLangGraphHITLInterruptAndResume:
    @pytest.mark.asyncio
    async def test_graph_interrupts_on_sensitive_tool_call(self):
        tool_call = {
            "name": "execute_command",
            "args": {"command": "git pull origin main"},
            "id": "call_hitl_1",
        }
        fake_llm = FakeChatModel(
            tool_calls=[tool_call],
            responses=["명령어가 실행되었습니다."],
        )
        checkpointer = MemorySaver()

        graph = build_hitl_agent_graph(
            checkpointer=checkpointer,
            model=fake_llm,
        )

        thread_config = {"configurable": {"thread_id": "thread_hitl_test"}}

        # 1. Run graph until interrupt
        await graph.ainvoke(
            {"messages": [HumanMessage(content="코드 업데이트해줘")]},
            config=thread_config,
        )

        # Graph should have paused at the interrupt inside tools node
        state = await graph.aget_state(thread_config)
        assert len(state.tasks) > 0
        interrupts = state.tasks[0].interrupts
        assert len(interrupts) > 0
        interrupt_data = interrupts[0].value
        assert interrupt_data["tool"] == "execute_command"
        assert interrupt_data["tool_call_id"] == "call_hitl_1"
        assert interrupt_data["input"] == {"command": "git pull origin main"}
        assert interrupt_data["requires_approval"] is True

    @pytest.mark.asyncio
    async def test_graph_resumes_when_approved(self):
        tool_call = {
            "name": "execute_command",
            "args": {"command": "echo 'hello'"},
            "id": "call_approve_1",
        }
        # First invocation returns tool call, second invocation (after tool execution) returns final answer
        fake_llm = FakeChatModel(
            tool_calls=[tool_call],
            responses=["도구가 성공적으로 실행되었습니다."],
        )
        checkpointer = MemorySaver()
        graph = build_hitl_agent_graph(checkpointer=checkpointer, model=fake_llm)
        thread_config = {"configurable": {"thread_id": "thread_approve_test"}}

        # 1. Trigger interrupt
        await graph.ainvoke(
            {"messages": [HumanMessage(content="명령어 실행해줘")]},
            config=thread_config,
        )

        # 2. Resume with Approved Command
        # Next model invocation will not return tool calls
        fake_llm.tool_calls = None

        resume_result = await graph.ainvoke(
            Command(resume={"approved": True}),
            config=thread_config,
        )

        messages = resume_result["messages"]
        tool_messages = [m for m in messages if getattr(m, "tool_call_id", None) == "call_approve_1"]
        assert len(tool_messages) == 1
        assert "Executed command" in tool_messages[0].content

    @pytest.mark.asyncio
    async def test_graph_resumes_with_rejection_feedback(self):
        tool_call = {
            "name": "delete_resource",
            "args": {"resource_id": "res_999"},
            "id": "call_reject_1",
        }
        fake_llm = FakeChatModel(
            tool_calls=[tool_call],
            responses=["삭제가 거부되었습니다."],
        )
        checkpointer = MemorySaver()
        graph = build_hitl_agent_graph(checkpointer=checkpointer, model=fake_llm)
        thread_config = {"configurable": {"thread_id": "thread_reject_test"}}

        # 1. Trigger interrupt
        await graph.ainvoke(
            {"messages": [HumanMessage(content="리소스 삭제해줘")]},
            config=thread_config,
        )

        # 2. Resume with Rejection
        fake_llm.tool_calls = None

        resume_result = await graph.ainvoke(
            Command(resume={"approved": False, "reason": "위험한 작업으로 판단되어 거부했습니다."}),
            config=thread_config,
        )

        messages = resume_result["messages"]
        tool_messages = [m for m in messages if getattr(m, "tool_call_id", None) == "call_reject_1"]
        assert len(tool_messages) == 1
        assert tool_messages[0].status == "error"
        assert "위험한 작업으로 판단되어 거부했습니다." in tool_messages[0].content
