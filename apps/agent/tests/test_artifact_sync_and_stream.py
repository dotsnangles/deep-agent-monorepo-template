from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import MemorySaver

from src.core.artifacts import ArtifactSyncProcessor
from src.core.testing import FakeChatModel
from src.graphs.chat.backends import DockerSandboxBackend
from src.graphs.chat.graph import build_agent
from src.graphs.registry import GraphRegistry
from src.runtime import AgentRuntime
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

        # Verify DB select and inserts were called (1 SELECT + 2 INSERTs)
        assert mock_cursor.execute.call_count == 3

        # 2. Verify idempotency on second scan
        second_events = await processor.sync_session_artifacts(
            session_id="sess-100",
            message_id="msg-999",
        )
        assert len(second_events) == 0

    @pytest.mark.asyncio
    async def test_artifact_sync_processor_hash_change_detection_and_versioning(self, tmp_path: Path):
        workspace_dir = tmp_path / "sessions"
        sess_dir = workspace_dir / "sess-hash-1"
        artifacts_dir = sess_dir / "artifacts"
        artifacts_dir.mkdir(parents=True, exist_ok=True)

        doc_path = artifacts_dir / "report.txt"
        doc_path.write_text("Version 1 content", encoding="utf-8")

        storage = FakeAsyncStorageService()
        mock_cursor = AsyncMock()
        mock_cursor.fetchall.return_value = []
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.__aenter__.return_value = mock_cursor
        mock_pool = MagicMock()
        mock_pool.connection.return_value.__aenter__.return_value = mock_conn

        processor = ArtifactSyncProcessor(
            workspace_dir=workspace_dir,
            storage_service=storage,
            db_pool=mock_pool,
        )

        # Turn 1: Create version 1
        ev1 = await processor.sync_session_artifacts(
            session_id="sess-hash-1",
            message_id="asst_msg_turn1",
        )
        assert len(ev1) == 1
        assert ev1[0].name == "report.txt"
        assert ev1[0].message_id == "asst_msg_turn1"
        assert "content_hash" in ev1[0].metadata
        v1_hash = ev1[0].metadata["content_hash"]
        assert len(v1_hash) == 64

        # Turn 2: Unrelated prompt ("hello") - content unchanged -> NO-OP
        ev2 = await processor.sync_session_artifacts(
            session_id="sess-hash-1",
            message_id="asst_msg_turn2",
        )
        assert len(ev2) == 0  # No duplicate artifact created!

        # Turn 3: User requests modification - content changed -> New Version Snapshot
        doc_path.write_text("Version 2 updated content", encoding="utf-8")
        ev3 = await processor.sync_session_artifacts(
            session_id="sess-hash-1",
            message_id="asst_msg_turn3",
        )
        assert len(ev3) == 1
        assert ev3[0].name == "report.txt"
        assert ev3[0].message_id == "asst_msg_turn3"
        v2_hash = ev3[0].metadata["content_hash"]
        assert v2_hash != v1_hash

    @pytest.mark.asyncio
    async def test_artifact_sync_processor_restores_from_db_on_server_restart(self, tmp_path: Path):
        workspace_dir = tmp_path / "sessions"
        sess_dir = workspace_dir / "sess-restart-1"
        artifacts_dir = sess_dir / "artifacts"
        artifacts_dir.mkdir(parents=True, exist_ok=True)

        doc_path = artifacts_dir / "love_letter.txt"
        doc_path.write_text("Forever yours", encoding="utf-8")

        from src.core.artifacts import compute_file_sha256
        file_hash = compute_file_sha256(doc_path)

        storage = FakeAsyncStorageService()
        mock_cursor = AsyncMock()
        # Mock DB returning existing artifact metadata from prior server session
        mock_cursor.fetchall.return_value = [("love_letter.txt", file_hash)]
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.__aenter__.return_value = mock_cursor
        mock_pool = MagicMock()
        mock_pool.connection.return_value.__aenter__.return_value = mock_conn

        # Fresh instance (server restarted, empty in-memory state)
        processor = ArtifactSyncProcessor(
            workspace_dir=workspace_dir,
            storage_service=storage,
            db_pool=mock_pool,
        )

        events = await processor.sync_session_artifacts(
            session_id="sess-restart-1",
            message_id="asst_msg_new_turn",
        )
        # Because content_hash matches DB record, no duplicate should be registered!
        assert len(events) == 0
        assert len(storage.uploaded) == 0

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

        gateway = AgentRuntime.create_in_memory(
            workspace_dir=workspace_dir,
            registry=registry,
            model=fake_llm,
            checkpointer=MemorySaver(),
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

    @pytest.mark.asyncio
    async def test_s3_storage_service_upload_and_presigned_url(self, tmp_path: Path):
        from src.core.artifacts import S3StorageService

        test_file = tmp_path / "test_chart.png"
        test_file.write_bytes(b"\x89PNG\r\n\x1a\nfake_image_bytes")

        # Mock boto3 s3 client
        mock_boto_client = MagicMock()
        storage = S3StorageService(s3_client=mock_boto_client, bucket_name="test-bucket")

        await storage.upload_file(test_file, "artifacts/sessions/s1/test_chart.png", "image/png")
        assert mock_boto_client.upload_file.called
        call_args = mock_boto_client.upload_file.call_args
        assert call_args[0][0] == str(test_file)
        assert call_args[0][1] == "test-bucket"
        assert call_args[0][2] == "artifacts/sessions/s1/test_chart.png"

        mock_boto_client.generate_presigned_url.return_value = "https://s3.example.com/test_chart.png?sig=123"
        url = await storage.generate_presigned_download_url("artifacts/sessions/s1/test_chart.png")
        assert url == "https://s3.example.com/test_chart.png?sig=123"

    @pytest.mark.asyncio
    async def test_app_lifespan_wires_artifact_processor_with_pool_and_storage(self):
        from src.controllers.app import create_app

        app = create_app()
        # Mock CheckpointerFactory to return a pool
        mock_pool = MagicMock()
        mock_conn = MagicMock()
        mock_pool.connection.return_value.__aenter__.return_value = mock_conn

        with pytest.MonkeyPatch.context() as mp:
            mp.setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/testdb")
            mp.setattr("src.core.checkpointer.CheckpointerFactory.create_pool", AsyncMock(return_value=mock_pool))
            mp.setattr("src.core.checkpointer.CheckpointerFactory.create_checkpointer", MagicMock(return_value=MemorySaver()))
            mp.setattr("src.core.checkpointer.CheckpointerFactory.create_store", MagicMock(return_value=None))
            mp.setattr("src.core.checkpointer.CheckpointerFactory.close_pool", AsyncMock())

            async with app.router.lifespan_context(app):
                assert app.state.agent_runtime is not None
                assert app.state.agent_runtime.storage is not None
