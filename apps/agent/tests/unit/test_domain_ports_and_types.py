import json
from collections.abc import AsyncIterator
from dataclasses import FrozenInstanceError
import pytest

from src.domain.ports import (
    AgentExecutionPort,
    ModelChunk,
    ModelProviderPort,
    PersistencePort,
    SandboxExecutionPort,
    SandboxResult,
    StateSnapshot,
    StoragePort,
)
from src.runtime.events import (
    AgentStreamEvent,
    ApprovalRequestEventData,
    ArtifactCreatedEventData,
    DoneEventData,
    ErrorEventData,
    NodeTransitionEventData,
    StreamEventType,
    SubagentEndEventData,
    SubagentStartEventData,
    TodoItem,
    TodoUpdateEventData,
    TokenEventData,
    ToolEndEventData,
    ToolStartEventData,
)
from src.runtime.types import (
    AgentStateSnapshot,
    AgentTurn,
    ApprovalDecision,
    Attachment,
    ChatMessage,
)


class TestDomainValueTypes:
    def test_attachment_creation_and_immutability(self):
        att = Attachment(
            name="chart.png",
            url="https://s3.example.com/chart.png",
            mime_type="image/png",
            size_bytes=1024,
        )
        assert att.name == "chart.png"
        assert att.mime_type == "image/png"
        assert att.size_bytes == 1024

        with pytest.raises(FrozenInstanceError):
            att.name = "new_name.png"  # type: ignore

    def test_chat_message_with_attachments(self):
        att = Attachment(
            name="doc.pdf",
            url="https://s3.example.com/doc.pdf",
            mime_type="application/pdf",
            size_bytes=2048,
        )
        msg = ChatMessage(role="user", content="Analyze this file", attachments=[att])
        assert msg.role == "user"
        assert msg.content == "Analyze this file"
        assert len(msg.attachments) == 1
        assert msg.attachments[0].name == "doc.pdf"

        with pytest.raises(FrozenInstanceError):
            msg.content = "Changed"  # type: ignore

    def test_agent_turn_polymorphism(self):
        # 1. String input
        turn1 = AgentTurn(thread_id="t-1", input="Hello agent")
        assert turn1.thread_id == "t-1"
        assert turn1.input == "Hello agent"
        assert turn1.agent_type == "default"

        # 2. List of ChatMessages input
        msgs = [ChatMessage(role="user", content="Task 1")]
        turn2 = AgentTurn(thread_id="t-2", input=msgs, user_id="u-123")
        assert turn2.thread_id == "t-2"
        assert turn2.input == msgs
        assert turn2.user_id == "u-123"

        # 3. ApprovalDecision input
        decision = ApprovalDecision(tool_call_id="call_1", approved=True)
        turn3 = AgentTurn(thread_id="t-3", input=decision)
        assert turn3.input == decision

    def test_agent_state_snapshot(self):
        snapshot = AgentStateSnapshot(
            thread_id="t-100",
            is_interrupted=True,
            pending_tool_approvals=[{"tool": "execute", "args": {"command": "rm -rf"}}],
            turn_count=3,
            active_artifacts=[{"name": "plot.png", "url": "http://..."}],
            metadata={"environment": "production"},
        )
        assert snapshot.thread_id == "t-100"
        assert snapshot.is_interrupted is True
        assert len(snapshot.pending_tool_approvals) == 1
        assert snapshot.turn_count == 3


class TestAgentStreamEvents:
    def test_token_event_sse_serialization(self):
        event = AgentStreamEvent.token("Hello, world!")
        assert event.event == StreamEventType.TOKEN
        assert isinstance(event.data, TokenEventData)
        assert event.data.content == "Hello, world!"
        
        sse_str = event.to_sse()
        assert sse_str.startswith("event: token\n")
        assert '"content": "Hello, world!"' in sse_str
        assert sse_str.endswith("\n\n")

    def test_tool_start_and_end_events(self):
        start_ev = AgentStreamEvent.tool_start(
            tool="write_todos", tool_input={"todos": []}, run_id="run_1"
        )
        assert start_ev.event == StreamEventType.TOOL_START
        assert isinstance(start_ev.data, ToolStartEventData)
        assert start_ev.data.tool == "write_todos"
        assert start_ev.run_id == "run_1"

        end_ev = AgentStreamEvent.tool_end(
            tool="write_todos", output={"status": "ok"}, run_id="run_1"
        )
        assert end_ev.event == StreamEventType.TOOL_END
        assert isinstance(end_ev.data, ToolEndEventData)

    def test_todo_update_event(self):
        todos = [
            {"content": "Step 1", "status": "completed"},
            {"content": "Step 2", "status": "in_progress"},
        ]
        ev = AgentStreamEvent.todo_update(todos)
        assert ev.event == StreamEventType.TODO_UPDATE
        assert isinstance(ev.data, TodoUpdateEventData)
        assert len(ev.data.todos) == 2
        assert ev.data.todos[0].status == "completed"

    def test_approval_request_event(self):
        ev = AgentStreamEvent.approval_request(
            tool="execute",
            tool_input={"cmd": "ls"},
            tool_call_id="call_99",
            description="Authorize shell execution",
        )
        assert ev.event == StreamEventType.APPROVAL_REQUEST
        assert isinstance(ev.data, ApprovalRequestEventData)
        assert ev.data.tool_call_id == "call_99"
        assert ev.data.requires_approval is True

    def test_artifact_created_event(self):
        ev = AgentStreamEvent.artifact_created(
            id="art-1",
            session_id="sess-1",
            message_id="msg-1",
            name="chart.png",
            url="https://s3/chart.png",
            storage_key="artifacts/chart.png",
            mime_type="image/png",
            size_bytes=512,
        )
        assert ev.event == StreamEventType.ARTIFACT_CREATED
        assert isinstance(ev.data, ArtifactCreatedEventData)
        assert ev.data.name == "chart.png"

    def test_done_and_error_events(self):
        done_ev = AgentStreamEvent.done(finish_reason="stop", metadata={"total_tokens": 42})
        assert done_ev.event == StreamEventType.DONE
        assert isinstance(done_ev.data, DoneEventData)
        assert done_ev.data.finish_reason == "stop"

        err_ev = AgentStreamEvent.error(message="Rate limit exceeded", code="RATE_LIMIT")
        assert err_ev.event == StreamEventType.ERROR
        assert isinstance(err_ev.data, ErrorEventData)
        assert err_ev.data.code == "RATE_LIMIT"


class TestDomainPortProtocols:
    def test_persistence_port_conformance(self):
        class MockPersistenceAdapter:
            async def get_state(self, thread_id: str) -> StateSnapshot | None:
                return None

            async def save_checkpoint(
                self, thread_id: str, state: dict, metadata: dict
            ) -> None:
                pass

            async def clear_messages(self, thread_id: str, message_ids: list[str]) -> None:
                pass

            async def store_get(
                self, namespace: tuple[str, ...], key: str
            ) -> dict | None:
                return None

            async def store_put(
                self, namespace: tuple[str, ...], key: str, value: dict
            ) -> None:
                pass

        adapter = MockPersistenceAdapter()
        assert isinstance(adapter, PersistencePort)

    def test_sandbox_execution_port_conformance(self):
        class MockSandboxAdapter:
            async def execute_command(
                self, session_id: str, command: str, timeout_seconds: int = 30
            ) -> SandboxResult:
                return SandboxResult(stdout="", stderr="", exit_code=0)

            async def read_file(
                self, session_id: str, file_path: str, offset: int = 0, limit: int = 2000
            ) -> str:
                return ""

            async def write_file(
                self, session_id: str, file_path: str, content: str
            ) -> None:
                pass

            async def list_workspace_artifacts(self, session_id: str) -> list:
                return []

            async def read_artifact_bytes(
                self, session_id: str, relative_path: str
            ) -> bytes:
                return b""

        adapter = MockSandboxAdapter()
        assert isinstance(adapter, SandboxExecutionPort)

    def test_storage_port_conformance(self):
        class MockStorageAdapter:
            async def upload(
                self, storage_key: str, data: bytes, mime_type: str
            ) -> None:
                pass

            async def generate_presigned_url(
                self, storage_key: str, expires_in_seconds: int = 3600
            ) -> str:
                return "https://..."

            async def record_artifact_metadata(self, artifact) -> None:
                pass

            async def get_synced_hashes(self, session_id: str) -> dict[str, str]:
                return {}

        adapter = MockStorageAdapter()
        assert isinstance(adapter, StoragePort)

    def test_agent_execution_port_conformance(self):
        class MockAgentEngine:
            async def stream(self, turn: AgentTurn) -> AsyncIterator[AgentStreamEvent]:
                yield AgentStreamEvent.done()

            async def inspect(self, thread_id: str) -> AgentStateSnapshot:
                return AgentStateSnapshot(thread_id=thread_id)

        engine = MockAgentEngine()
        assert isinstance(engine, AgentExecutionPort)
