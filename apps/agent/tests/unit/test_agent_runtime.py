import asyncio
from pathlib import Path
import pytest

from src.runtime.events import AgentStreamEvent, StreamEventType
from src.runtime.runtime import AgentRuntime
from src.runtime.types import (
    AgentStateSnapshot,
    AgentTurn,
    ApprovalDecision,
    Attachment,
    ChatMessage,
)
from src.infrastructure.models.adapter import FakeChatModelAdapter


class TestAgentRuntime:
    @pytest.mark.asyncio
    async def test_runtime_in_memory_stream_text_turn(self):
        fake_model = FakeChatModelAdapter(scripted_tokens=["Hello", " from", " deep", " runtime!"])
        runtime = AgentRuntime.create_in_memory(model=fake_model)

        turn = AgentTurn(thread_id="thread-test-1", input="Hello agent")
        events: list[AgentStreamEvent] = []
        async for event in runtime.stream(turn):
            events.append(event)

        event_types = [e.event for e in events]
        assert StreamEventType.NODE_TRANSITION in event_types
        assert StreamEventType.TOKEN in event_types
        assert StreamEventType.DONE in event_types

        tokens = [e.data.content for e in events if e.event == StreamEventType.TOKEN]  # type: ignore
        assert "".join(tokens) == "Hello from deep runtime!"

    @pytest.mark.asyncio
    async def test_runtime_in_memory_multimodal_turn(self):
        fake_model = FakeChatModelAdapter(scripted_tokens=["I see your image."])
        runtime = AgentRuntime.create_in_memory(model=fake_model)

        att = Attachment(
            name="screenshot.png",
            url="https://s3.example.com/screenshot.png",
            mime_type="image/png",
            size_bytes=4096,
        )
        msgs = [ChatMessage(role="user", content="Look at this", attachments=[att])]
        turn = AgentTurn(thread_id="thread-test-2", input=msgs)

        events = [e async for e in runtime.stream(turn)]
        assert any(e.event == StreamEventType.TOKEN for e in events)
        assert any(e.event == StreamEventType.DONE for e in events)

    @pytest.mark.asyncio
    async def test_runtime_in_memory_artifact_sync(self, tmp_path: Path):
        fake_model = FakeChatModelAdapter(scripted_tokens=["Analysis complete."])
        runtime = AgentRuntime.create_in_memory(model=fake_model, workspace_dir=tmp_path)

        # Simulate sandbox file created during turn
        sess_dir = tmp_path / "thread-test-3" / "artifacts"
        sess_dir.mkdir(parents=True, exist_ok=True)
        (sess_dir / "report.csv").write_text("a,b,c\n1,2,3", encoding="utf-8")

        turn = AgentTurn(thread_id="thread-test-3", input="Generate report")
        events = [e async for e in runtime.stream(turn)]

        event_types = [e.event for e in events]
        assert StreamEventType.ARTIFACT_CREATED in event_types
        assert StreamEventType.DONE in event_types

        # Verify artifact_created occurred before done
        art_idx = event_types.index(StreamEventType.ARTIFACT_CREATED)
        done_idx = event_types.index(StreamEventType.DONE)
        assert art_idx < done_idx

        art_event = events[art_idx]
        assert art_event.data.name == "report.csv"  # type: ignore
        assert art_event.data.mime_type == "text/csv; charset=utf-8"  # type: ignore

    @pytest.mark.asyncio
    async def test_runtime_single_flight_concurrency_lock(self):
        runtime = AgentRuntime.create_in_memory(concurrency_limit=1)

        # Lock acquisition & release
        turn1 = AgentTurn(thread_id="thread-concurrency-1", input="Task 1")
        turn2 = AgentTurn(thread_id="thread-concurrency-2", input="Task 2")

        # Run concurrently
        res1, res2 = await asyncio.gather(
            runtime._collect_events(turn1),
            runtime._collect_events(turn2),
        )

        assert any(e.event == StreamEventType.DONE for e in res1)
        assert any(e.event == StreamEventType.DONE for e in res2)

    @pytest.mark.asyncio
    async def test_runtime_inspect_state(self):
        runtime = AgentRuntime.create_in_memory()
        snapshot = await runtime.inspect("thread-empty")
        assert snapshot.thread_id == "thread-empty"
        assert snapshot.is_interrupted is False
        assert snapshot.turn_count == 0
