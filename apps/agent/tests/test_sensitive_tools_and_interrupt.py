import pytest
from langchain_core.messages import HumanMessage
from langchain_core.tools import tool
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command

from src.infrastructure import FakeChatModel
from src.graphs.chat.graph import build_agent
from src.schemas import AgentStreamEvent, ApprovalRequestEventData


@tool
def custom_sensitive_action(command: str) -> str:
    """Executes a custom sensitive action requiring approval."""
    return f"Executed action: {command} successfully."


class TestApprovalRequestEventSchema:
    def test_approval_request_event_creation_and_sse_serialization(self):
        event = AgentStreamEvent.approval_request(
            tool="custom_sensitive_action",
            tool_input={"command": "deploy_prod"},
            tool_call_id="call_abc123",
            description="프로덕션 배포 승인 요청",
        )

        assert event.event == "approval_request"
        assert isinstance(event.data, ApprovalRequestEventData)
        assert event.data.tool == "custom_sensitive_action"
        assert event.data.tool_call_id == "call_abc123"
        assert event.data.requires_approval is True
        assert event.data.description == "프로덕션 배포 승인 요청"

        sse_output = event.to_sse()
        assert sse_output.startswith("event: approval_request\n")
        assert '"toolCallId": "call_abc123"' in sse_output
        assert '"requiresApproval": true' in sse_output
        assert "custom_sensitive_action" in sse_output


class TestLangGraphHITLInterruptAndResume:
    @pytest.mark.asyncio
    async def test_vanilla_agent_runs_without_interrupt_by_default(self):
        """Vanilla deep agent runs autonomously with interrupt_on={} by default."""
        fake_llm = FakeChatModel(responses=["자율 실행 완료."])
        checkpointer = MemorySaver()

        graph = build_agent(
            checkpointer=checkpointer,
            model=fake_llm,
        )

        thread_config = {"configurable": {"thread_id": "thread_vanilla_test"}}
        result = await graph.ainvoke(
            {"messages": [HumanMessage(content="일반 요청")]},
            config=thread_config,
        )
        assert "messages" in result
        assert len(result["messages"]) > 0

    @pytest.mark.asyncio
    async def test_custom_tool_interrupts_when_interrupt_on_specified(self):
        """When a custom tool is injected with interrupt_on, graph pauses at interrupt."""
        tool_call = {
            "name": "custom_sensitive_action",
            "args": {"command": "deploy_prod"},
            "id": "call_hitl_1",
        }
        fake_llm = FakeChatModel(
            tool_calls=[tool_call],
            responses=["배포가 완료되었습니다."],
        )
        checkpointer = MemorySaver()

        graph = build_agent(
            checkpointer=checkpointer,
            model=fake_llm,
            tools=[custom_sensitive_action],
            interrupt_on={"custom_sensitive_action": True},
        )

        thread_config = {"configurable": {"thread_id": "thread_hitl_test"}}

        # 1. Run graph until interrupt
        await graph.ainvoke(
            {"messages": [HumanMessage(content="프로덕션에 배포해줘")]},
            config=thread_config,
        )

        # Graph should have paused at the declarative interrupt
        state = await graph.aget_state(thread_config)
        assert len(state.tasks) > 0
        interrupts = state.tasks[0].interrupts
        assert len(interrupts) > 0
        interrupt_val = interrupts[0].value
        assert "action_requests" in interrupt_val
        action_req = interrupt_val["action_requests"][0]
        assert action_req["name"] == "custom_sensitive_action"
        assert action_req["args"] == {"command": "deploy_prod"}

    @pytest.mark.asyncio
    async def test_custom_tool_resumes_when_approved(self):
        """Graph resumes execution when approved decision is submitted."""
        tool_call = {
            "name": "custom_sensitive_action",
            "args": {"command": "execute_task"},
            "id": "call_approve_1",
        }
        fake_llm = FakeChatModel(
            tool_calls=[tool_call],
            responses=["도구가 성공적으로 실행되었습니다."],
        )
        checkpointer = MemorySaver()
        graph = build_agent(
            checkpointer=checkpointer,
            model=fake_llm,
            tools=[custom_sensitive_action],
            interrupt_on={"custom_sensitive_action": True},
        )
        thread_config = {"configurable": {"thread_id": "thread_approve_test"}}

        # 1. Trigger interrupt
        await graph.ainvoke(
            {"messages": [HumanMessage(content="작업 실행해줘")]},
            config=thread_config,
        )

        # 2. Resume with Approved Decision
        fake_llm.tool_calls = None

        resume_result = await graph.ainvoke(
            Command(resume={"decisions": [{"type": "approve"}]}),
            config=thread_config,
        )

        messages = resume_result["messages"]
        tool_messages = [
            m
            for m in messages
            if getattr(m, "name", None) == "custom_sensitive_action"
            or getattr(m, "tool_call_id", None) == "call_approve_1"
        ]
        assert len(tool_messages) >= 1
        assert "Executed action" in tool_messages[0].content

    @pytest.mark.asyncio
    async def test_custom_tool_resumes_with_rejection_feedback(self):
        """Graph resumes with rejection feedback when rejected."""
        tool_call = {
            "name": "custom_sensitive_action",
            "args": {"command": "dangerous_delete"},
            "id": "call_reject_1",
        }
        fake_llm = FakeChatModel(
            tool_calls=[tool_call],
            responses=["삭제가 거부되었습니다."],
        )
        checkpointer = MemorySaver()
        graph = build_agent(
            checkpointer=checkpointer,
            model=fake_llm,
            tools=[custom_sensitive_action],
            interrupt_on={"custom_sensitive_action": True},
        )
        thread_config = {"configurable": {"thread_id": "thread_reject_test"}}

        # 1. Trigger interrupt
        await graph.ainvoke(
            {"messages": [HumanMessage(content="위험한 삭제 실행해줘")]},
            config=thread_config,
        )

        # 2. Resume with Rejection Decision
        fake_llm.tool_calls = None

        resume_result = await graph.ainvoke(
            Command(
                resume={
                    "decisions": [
                        {"type": "reject", "message": "위험한 작업으로 판단되어 거부했습니다."}
                    ]
                }
            ),
            config=thread_config,
        )

        messages = resume_result["messages"]
        rejection_messages = [
            m
            for m in messages
            if "위험한 작업으로 판단되어 거부했습니다." in getattr(m, "content", "")
        ]
        assert len(rejection_messages) >= 1
