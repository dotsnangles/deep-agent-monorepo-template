from pathlib import Path

import pytest
from langgraph.checkpoint.memory import MemorySaver

from src.core.testing import FakeChatModel
from src.graphs.chat.backends import DockerSandboxBackend
from src.graphs.chat.graph import build_agent
from src.graphs.chat.subagents import get_default_subagents
from src.graphs.registry import GraphRegistry
from src.runtime import AgentRuntime
from src.schemas import (
    AgentStreamEvent,
    SubagentEndEventData,
    SubagentStartEventData,
)


class TestDataAnalysisFlowAndSubagents:
    @pytest.fixture
    def session_dir(self, tmp_path: Path) -> Path:
        sess = tmp_path / "sessions" / "test-e2e-data-1"
        sess.mkdir(parents=True, exist_ok=True)
        return sess

    def test_default_subagents_definition(self):
        subagents = get_default_subagents()
        assert isinstance(subagents, list)

    @pytest.mark.asyncio
    async def test_subagent_event_schema_and_sse_serialization(self):
        start_ev = AgentStreamEvent.subagent_start(
            subagent="data_analyst",
            task="CSV 이상치 분석 및 요약 통계 계산",
            run_id="run_sub_1",
        )
        assert start_ev.event == "subagent_start"
        assert isinstance(start_ev.data, SubagentStartEventData)
        assert start_ev.data.subagent == "data_analyst"
        assert "이상치 분석" in start_ev.data.task

        sse_start = start_ev.to_sse()
        assert "event: subagent_start\n" in sse_start
        assert "data_analyst" in sse_start

        end_ev = AgentStreamEvent.subagent_end(
            subagent="data_analyst",
            output="평균 매출: 1,500만원, 성장률: 23%",
            run_id="run_sub_1",
        )
        assert end_ev.event == "subagent_end"
        assert isinstance(end_ev.data, SubagentEndEventData)
        assert "성장률: 23%" in str(end_ev.data.output)

        sse_end = end_ev.to_sse()
        assert "event: subagent_end\n" in sse_end

    @pytest.mark.asyncio
    async def test_end_to_end_data_analysis_and_delegation_stream(self, session_dir: Path):
        # 1. Setup Sandbox Backend with CSV data
        backend = DockerSandboxBackend(root_dir=session_dir, thread_id="test-e2e-data-1")
        await backend.awrite(
            "sales_2026.csv",
            "month,sales,profit\nJan,100,20\nFeb,150,35\nMar,200,50\nApr,250,70\n",
        )

        # 2. Configure multi-turn FakeChatModel simulating the full analysis lifecycle
        # Turn 1 (Supervisor): Main Agent writes task plan
        tool_call_todo = {
            "name": "write_todos",
            "args": {
                "todos": [
                    {"content": "1. 데이터 분석 및 통계 요약", "status": "in_progress"},
                    {"content": "2. 월별 매출 성장 차트 생성", "status": "pending"},
                    {"content": "3. 최종 인사이트 보고서 작성", "status": "pending"},
                ]
            },
            "id": "call_plan_1",
        }
        # Turn 2 (Supervisor): Delegate to data_analyst subagent
        tool_call_task = {
            "name": "task",
            "args": {
                "subagent_type": "data_analyst",
                "description": (
                    "sales_2026.csv 데이터를 바탕으로 총 매출을 계산하고 chart.png를 생성해줘"
                ),
            },
            "id": "call_delegate_1",
        }
        # Turn 3 (Subagent data_analyst): Subagent executes python code in the sandbox
        tool_call_exec = {
            "name": "execute",
            "args": {
                "command": (
                    'python3 -c "'
                    "with open('chart.png', 'wb') as f: f.write(b'PNG_IMAGE_DATA'); "
                    "print('CHART_GENERATED: chart.png')"
                    '"'
                )
            },
            "id": "call_exec_chart_1",
        }
        # Turn 4 (Subagent data_analyst): Subagent returns compressed numeric findings to supervisor
        subagent_response = {
            "tool_calls": None,
            "tokens": ["데이터 계산 완료: 총 매출 700, chart.png 파일 저장 완료."],
        }
        # Turn 5 (Supervisor): Main Agent marks todos as completed
        tool_call_todo_done = {
            "name": "write_todos",
            "args": {
                "todos": [
                    {"content": "1. 데이터 분석 및 통계 요약", "status": "completed"},
                    {"content": "2. 월별 매출 성장 차트 생성", "status": "completed"},
                    {"content": "3. 최종 인사이트 보고서 작성", "status": "completed"},
                ]
            },
            "id": "call_plan_done_1",
        }
        # Turn 6 (Supervisor): Main Agent delivers final insight report
        supervisor_final = {
            "tool_calls": None,
            "tokens": [
                "### 📊 2026년 매출 분석 보고서\n\n",
                "- **총 매출**: 700\n",
                "- **평균 이익률**: 25%\n\n",
                "![월별 매출 성장 차트](/workspace/sessions/test-e2e-data-1/chart.png)\n",
            ],
        }

        fake_llm = FakeChatModel(
            turn_sequence=[
                {"tool_calls": [tool_call_todo], "responses": [""]},
                {"tool_calls": [tool_call_task], "responses": [""]},
                {"tool_calls": [tool_call_exec], "responses": [""]},
                subagent_response,
                {"tool_calls": [tool_call_todo_done], "responses": [""]},
                supervisor_final,
            ]
        )

        custom_subagents = [
            {
                "name": "data_analyst",
                "description": "Pandas data analyst",
                "system_prompt": "You analyze data.",
                "tools": [],
            }
        ]
        registry = GraphRegistry()
        registry.register(
            "data_analysis",
            lambda **kw: build_agent(
                interrupt_on={},
                subagents=custom_subagents,
                enable_subagents=True,
                **kw,
            ),
        )
        checkpointer = MemorySaver()
        gateway = AgentRuntime.create_in_memory(
            registry=registry,
            checkpointer=checkpointer,
            model=fake_llm,
        )

        events: list[AgentStreamEvent] = []
        async for ev in gateway.stream_execution(
            messages=[{"role": "user", "content": "sales_2026.csv 파일 분석하고 차트 그려줘"}],
            thread_id="test-e2e-data-1",
            agent_type="data_analysis",
            backend=backend,
        ):
            events.append(ev)

        event_types = [e.event for e in events]
        assert "todo_update" in event_types
        assert "subagent_start" in event_types
        assert "subagent_end" in event_types
        assert "tool_start" in event_types
        assert "tool_end" in event_types
        assert "token" in event_types
        assert "done" in event_types

        # Verify chart artifact was generated in sandbox
        assert (session_dir / "chart.png").exists()

        # Verify token content
        token_events = [e for e in events if e.event == "token"]
        full_text = "".join(e.data.content for e in token_events)
        assert "매출 분석 보고서" in full_text
        assert "chart.png" in full_text

    @pytest.mark.asyncio
    async def test_subagent_hitl_approval_and_resumption(self, session_dir: Path):
        backend = DockerSandboxBackend(root_dir=session_dir, thread_id="test-e2e-hitl-1")

        # Phase 1: Request with default interrupt_on={"execute": True} triggers HITL approval
        t1 = {
            "tool_calls": [
                {
                    "name": "execute",
                    "args": {
                        "command": (
                            "python3 -c \"with open('approved.txt', 'w') as f: "
                            "f.write('HITL_SUCCESS')\""
                        )
                    },
                    "id": "call_hitl_exec_1",
                }
            ],
            "responses": [""],
        }
        t2 = {
            "tool_calls": None,
            "tokens": ["명령어가 안전하게 승인되어 실행되었습니다."],
        }
        fake_llm = FakeChatModel(turn_sequence=[t1, t2])
        registry = GraphRegistry()
        registry.register(
            "data_analysis",
            lambda **kw: build_agent(interrupt_on={"execute": True}, **kw),
        )
        checkpointer = MemorySaver()
        gateway = AgentRuntime.create_in_memory(
            registry=registry,
            checkpointer=checkpointer,
            model=fake_llm,
        )

        phase1_events: list[AgentStreamEvent] = []
        async for ev in gateway.stream_execution(
            messages=[{"role": "user", "content": "approved.txt 생성해줘"}],
            thread_id="test-e2e-hitl-1",
            agent_type="data_analysis",
            backend=backend,
        ):
            phase1_events.append(ev)

        assert any(e.event == "approval_request" for e in phase1_events)
        done_ev = next(e for e in phase1_events if e.event == "done")
        assert done_ev.data.finish_reason == "interrupt"
        assert not (session_dir / "approved.txt").exists()

        # Phase 2: Resume with approved decision
        phase2_events: list[AgentStreamEvent] = []
        async for ev in gateway.stream_execution(
            messages=[],
            thread_id="test-e2e-hitl-1",
            agent_type="data_analysis",
            resume_action={"tool_call_id": "call_hitl_exec_1", "approved": True},
            backend=backend,
        ):
            phase2_events.append(ev)

        assert (session_dir / "approved.txt").exists()
        assert any(e.event == "token" for e in phase2_events)
        done2_ev = next(e for e in phase2_events if e.event == "done")
        assert done2_ev.data.finish_reason == "stop"
