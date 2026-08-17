import pytest
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import MemorySaver

from src.core import FakeChatModel
from src.graphs.chat.graph import build_agent
from src.graphs.registry import GraphRegistry
from src.runtime import AgentRuntime
from src.schemas import AgentStreamEvent, TodoItem, TodoUpdateEventData


class TestTodoEventSchema:
    def test_todo_update_event_creation_and_sse_serialization(self):
        todos = [
            TodoItem(content="1. 데이터셋 로드", status="completed"),
            TodoItem(content="2. 결측치 및 기술 통계 분석", status="in_progress"),
            TodoItem(content="3. 상관관계 히트맵 차트 생성", status="pending"),
        ]
        event = AgentStreamEvent.todo_update(todos=todos)

        assert event.event == "todo_update"
        assert isinstance(event.data, TodoUpdateEventData)
        assert len(event.data.todos) == 3
        assert event.data.todos[0].content == "1. 데이터셋 로드"
        assert event.data.todos[0].status == "completed"

        sse_output = event.to_sse()
        assert sse_output.startswith("event: todo_update\n")
        assert "1. 데이터셋 로드" in sse_output
        assert "in_progress" in sse_output


class TestTodoListMiddlewareAndStreaming:
    @pytest.mark.asyncio
    async def test_deep_agent_includes_write_todos_tool(self):
        checkpointer = MemorySaver()
        fake_llm = FakeChatModel()
        agent = build_agent(checkpointer=checkpointer, model=fake_llm)

        # In create_deep_agent with TodoListMiddleware, write_todos tool is bound upon execution
        config = {"configurable": {"thread_id": "test_write_todos_bind"}}
        await agent.ainvoke({"messages": [HumanMessage(content="Hello")]}, config=config)

        assert fake_llm.bound_tools is not None
        tool_names = [
            getattr(t, "name", str(t)) if not isinstance(t, dict) else t.get("name")
            for t in fake_llm.bound_tools
        ]
        assert "write_todos" in tool_names

    @pytest.mark.asyncio
    async def test_gateway_streams_todo_update_events(self):
        tool_call_1 = {
            "name": "write_todos",
            "args": {
                "todos": [
                    {"content": "1. CSV 파일 확인", "status": "in_progress"},
                    {"content": "2. 매출 추이 그래프 작성", "status": "pending"},
                ]
            },
            "id": "call_todo_plan_1",
        }
        fake_llm = FakeChatModel(
            turn_sequence=[
                {"tool_calls": [tool_call_1], "responses": [""]},
                {"tool_calls": None, "tokens": ["분석", " ", "계획을", " ", "수립했습니다."]},
            ]
        )

        registry = GraphRegistry()
        registry.register("todo_test", build_agent)
        checkpointer = MemorySaver()
        gateway = AgentRuntime.create_in_memory(
            registry=registry,
            checkpointer=checkpointer,
            model=fake_llm,
        )

        events: list[AgentStreamEvent] = []
        async for event in gateway.stream_execution(
            messages=[{"role": "user", "content": "매출 데이터 분석해줘"}],
            thread_id="thread_todo_stream_1",
            agent_type="todo_test",
        ):
            events.append(event)

        event_types = [e.event for e in events]
        assert "todo_update" in event_types
        assert "token" in event_types
        assert "done" in event_types

        todo_events = [e for e in events if e.event == "todo_update"]
        assert len(todo_events) >= 1
        first_todo_data = todo_events[0].data
        assert isinstance(first_todo_data, TodoUpdateEventData)
        assert len(first_todo_data.todos) == 2
        assert first_todo_data.todos[0].content == "1. CSV 파일 확인"
        assert first_todo_data.todos[0].status == "in_progress"
        assert first_todo_data.todos[1].content == "2. 매출 추이 그래프 작성"
        assert first_todo_data.todos[1].status == "pending"

        token_events = [e for e in events if e.event == "token"]
        assert len(token_events) > 0
        combined_text = "".join(e.data.content for e in token_events)
        assert "수립했습니다" in combined_text

    @pytest.mark.asyncio
    async def test_multi_step_todo_status_transitions(self):
        tool_call_step_1 = {
            "name": "write_todos",
            "args": {
                "todos": [
                    {"content": "Step 1", "status": "in_progress"},
                    {"content": "Step 2", "status": "pending"},
                ]
            },
            "id": "tc_step_1",
        }
        tool_call_step_2 = {
            "name": "write_todos",
            "args": {
                "todos": [
                    {"content": "Step 1", "status": "completed"},
                    {"content": "Step 2", "status": "in_progress"},
                ]
            },
            "id": "tc_step_2",
        }
        tool_call_step_3 = {
            "name": "write_todos",
            "args": {
                "todos": [
                    {"content": "Step 1", "status": "completed"},
                    {"content": "Step 2", "status": "completed"},
                ]
            },
            "id": "tc_step_3",
        }

        fake_llm = FakeChatModel(
            turn_sequence=[
                {"tool_calls": [tool_call_step_1], "responses": [""]},
                {"tool_calls": [tool_call_step_2], "responses": [""]},
                {"tool_calls": [tool_call_step_3], "responses": [""]},
                {"tool_calls": None, "tokens": ["모든", " ", "단계가", " ", "완료되었습니다."]},
            ]
        )

        registry = GraphRegistry()
        registry.register("todo_multistep", build_agent)
        checkpointer = MemorySaver()
        gateway = AgentRuntime.create_in_memory(
            registry=registry,
            checkpointer=checkpointer,
            model=fake_llm,
        )

        events: list[AgentStreamEvent] = []
        async for event in gateway.stream_execution(
            messages=[{"role": "user", "content": "전체 분석 파이프라인 수행"}],
            thread_id="thread_todo_multistep_1",
            agent_type="todo_multistep",
        ):
            events.append(event)

        todo_events = [e for e in events if e.event == "todo_update"]
        assert len(todo_events) >= 3

        # Verify final todo state is completed
        final_todo_data = todo_events[-1].data
        assert isinstance(final_todo_data, TodoUpdateEventData)
        assert all(t.status == "completed" for t in final_todo_data.todos)
