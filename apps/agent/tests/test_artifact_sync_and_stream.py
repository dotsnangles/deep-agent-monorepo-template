from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import MemorySaver

from src.core.artifacts import ArtifactSyncProcessor
from src.core.gateway import AgentExecutionGateway
from src.core.testing import FakeChatModel
from src.graphs.chat.backends import DockerSandboxBackend
from src.graphs.chat.graph import build_agent
from src.graphs.registry import GraphRegistry
from src.schemas import AgentStreamEvent, ArtifactCreatedEventData


class FakeAsyncStorageService:
    def __init__(self, base_url="http://fake-s3.local"):
        self.base_url = base_url
        self.uploaded: list[tuple[Path, str, str]] = []

    async def upload_file(self, file_path: Path, storage_key: str, mime_type: str):
        self.uploaded.append((file_path, storage_key, mime_type))

    async def generate_presigned_download_url(self, storage_key: str) -> str:
        return f"{self.base_url}/{storage_key}?token=presigned"


class TestArtifactSyncAndStreamPipeline:
    @pytest.fixture
    def session_dir(self, tmp_path: Path) -> Path:
        sess = tmp_path / "sessions" / "test-sync-sess-1"
        sess.mkdir(parents=True, exist_ok=True)
        (sess / "artifacts").mkdir(parents=True, exist_ok=True)
        return sess

    @pytest.mark.asyncio
    async def test_artifact_created_event_schema_and_sse_serialization(self):
        art_ev = AgentStreamEvent.artifact_created(
            id="art_12345",
            session_id="session-abc",
            message_id="msg-xyz",
            name="chart.png",
            url="http://fake-s3.local/artifacts/sessions/session-abc/msg-xyz/chart.png?token=presigned",
            storage_key="artifacts/sessions/session-abc/msg-xyz/chart.png",
            mime_type="image/png",
            size_bytes=4096,
            metadata={"source": "test"},
        )

        assert art_ev.event == "artifact_created"
        assert isinstance(art_ev.data, ArtifactCreatedEventData)
        assert art_ev.data.id == "art_12345"
        assert art_ev.data.name == "chart.png"
        assert art_ev.data.session_id == "session-abc"
        assert art_ev.data.mime_type == "image/png"

        # Check SSE camelCase serialization
        sse = art_ev.to_sse()
        assert "event: artifact_created\n" in sse
        assert '"sessionId": "session-abc"' in sse
        assert '"messageId": "msg-xyz"' in sse
        assert '"storageKey": "artifacts/sessions/session-abc/msg-xyz/chart.png"' in sse
        assert '"sizeBytes": 4096' in sse

    @pytest.mark.asyncio
    async def test_artifact_sync_processor_scan_and_upload(self, tmp_path: Path):
        workspace_dir = tmp_path / "sessions"
        sess_dir = workspace_dir / "sess-100"
        artifacts_dir = sess_dir / "artifacts"
        artifacts_dir.mkdir(parents=True, exist_ok=True)

        # 1. Create deliverable files
        (artifacts_dir / "sales_chart.png").write_bytes(b"\x89PNG\r\n\x1a\n")
        (artifacts_dir / "data_summary.csv").write_text("id,total\n1,500\n", encoding="utf-8")
        # Create an internal root script that should be ignored
        (sess_dir / "_exec_tmp.py").write_text("print('root')", encoding="utf-8")

        storage = FakeAsyncStorageService()

        # Mock DB pool
        mock_cursor = AsyncMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.__aenter__.return_value = mock_cursor
        mock_pool = MagicMock()
        mock_pool.connection.return_value.__aenter__.return_value = mock_conn

        processor = ArtifactSyncProcessor(
            workspace_dir=workspace_dir,
            storage_service=storage,
            db_pool=mock_pool,
        )

        events = await processor.sync_session_artifacts(
            session_id="sess-100",
            message_id="msg-999",
        )

        assert len(events) == 2
        names = [e.name for e in events]
        assert "sales_chart.png" in names
        assert "data_summary.csv" in names

        # Verify Storage upload was called
        assert len(storage.uploaded) == 2
        uploaded_keys = [u[1] for u in storage.uploaded]
        assert "artifacts/sessions/sess-100/msg-999/sales_chart.png" in uploaded_keys
        assert "artifacts/sessions/sess-100/msg-999/data_summary.csv" in uploaded_keys

        # Verify DB insert was called
        assert mock_cursor.execute.call_count == 2

        # 2. Verify idempotency on second scan
        second_events = await processor.sync_session_artifacts(
            session_id="sess-100",
            message_id="msg-999",
        )
        assert len(second_events) == 0

    @pytest.mark.asyncio
    async def test_gateway_stream_chat_emits_artifact_created_events(self, tmp_path: Path):
        workspace_dir = tmp_path / "sessions"
        sess_id = "test-gateway-artifact-sess"
        sess_dir = workspace_dir / sess_id
        artifacts_dir = sess_dir / "artifacts"
        artifacts_dir.mkdir(parents=True, exist_ok=True)

        backend = DockerSandboxBackend(root_dir=sess_dir, thread_id=sess_id)
        # Write a chart inside artifacts/
        await backend.awrite("artifacts/growth_plot.png", "fake_plot_bytes")

        storage = FakeAsyncStorageService()
        processor = ArtifactSyncProcessor(
            workspace_dir=workspace_dir,
            storage_service=storage,
            db_pool=None,
        )

        fake_llm = FakeChatModel(responses=["Here is your growth plot."])
        registry = GraphRegistry()
        registry.register("default", build_agent)

        gateway = AgentExecutionGateway(
            registry=registry,
            model=fake_llm,
            checkpointer=MemorySaver(),
            artifact_processor=processor,
        )

        events = []
        async for ev in gateway.stream_execution(
            messages=[HumanMessage(content="Generate chart")],
            thread_id=sess_id,
            backend=backend,
        ):
            events.append(ev)

        event_types = [e.event for e in events]
        assert "artifact_created" in event_types
        assert "done" in event_types

        # Ensure artifact_created comes before done
        art_idx = event_types.index("artifact_created")
        done_idx = event_types.index("done")
        assert art_idx < done_idx

        # Verify artifact event payload
        art_ev = next(e for e in events if e.event == "artifact_created")
        assert art_ev.data.name == "growth_plot.png"
        assert art_ev.data.session_id == sess_id
        assert "growth_plot.png" in art_ev.data.url
