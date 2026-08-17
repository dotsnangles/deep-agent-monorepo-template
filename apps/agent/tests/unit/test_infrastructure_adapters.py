import asyncio
from pathlib import Path
import pytest

from src.domain.ports import (
    ArtifactDescriptor,
    ModelProviderPort,
    PersistencePort,
    SandboxExecutionPort,
    StoragePort,
    ToolDefinition,
)
from src.runtime.types import ChatMessage
from src.infrastructure.models.adapter import FakeChatModelAdapter, LangChainModelAdapter
from src.infrastructure.persistence.adapter import (
    InMemoryPersistenceAdapter,
    PostgresPersistenceAdapter,
)
from src.infrastructure.sandbox.adapter import (
    DockerSandboxAdapter,
    InProcessSandboxAdapter,
)
from src.infrastructure.storage.adapter import (
    InMemoryStorageAdapter,
    S3StorageAdapter,
)


class TestPersistenceAdapters:
    @pytest.mark.asyncio
    async def test_in_memory_persistence_adapter(self):
        adapter = InMemoryPersistenceAdapter()
        assert isinstance(adapter, PersistencePort)

        # 1. Checkpoint save & retrieve
        await adapter.save_checkpoint(
            thread_id="t-1",
            state={"messages": [{"role": "user", "content": "hello"}]},
            metadata={"step": 1},
        )
        snapshot = await adapter.get_state("t-1")
        assert snapshot is not None
        assert snapshot.values["messages"][0]["content"] == "hello"

        # 2. Store get & put
        await adapter.store_put(("memories",), "user_pref", {"theme": "dark"})
        pref = await adapter.store_get(("memories",), "user_pref")
        assert pref == {"theme": "dark"}

        # 3. Clear messages
        msg_obj = type("Msg", (), {"id": "msg-1", "content": "hello"})()
        await adapter.save_checkpoint(
            thread_id="t-2",
            state={"messages": [msg_obj]},
            metadata={},
        )
        await adapter.clear_messages("t-2", ["msg-1"])
        st = await adapter.get_state("t-2")
        assert len(st.values["messages"]) == 0


class TestSandboxAdapters:
    @pytest.mark.asyncio
    async def test_in_process_sandbox_adapter(self, tmp_path: Path):
        adapter = InProcessSandboxAdapter(root_dir=tmp_path)
        assert isinstance(adapter, SandboxExecutionPort)

        # 1. File write and read
        await adapter.write_file("sess-1", "test.txt", "Hello sandbox")
        content = await adapter.read_file("sess-1", "test.txt")
        assert content == "Hello sandbox"

        # 2. Command execution
        result = await adapter.execute_command("sess-1", "python3 -c 'print(1+1)'")
        assert result.exit_code == 0
        assert "2" in result.stdout

        # 3. Artifact listing
        await adapter.write_file("sess-1", "artifacts/chart.png", "fake_png")
        artifacts = await adapter.list_workspace_artifacts("sess-1")
        assert len(artifacts) == 1
        assert artifacts[0].path == "artifacts/chart.png"
        assert artifacts[0].mime_type == "image/png"

    @pytest.mark.asyncio
    async def test_sandbox_security_denial(self, tmp_path: Path):
        adapter = InProcessSandboxAdapter(root_dir=tmp_path)
        docker_adapter = DockerSandboxAdapter(root_dir=tmp_path)

        with pytest.raises(PermissionError):
            await adapter.write_file("sess-1", ".env", "SECRET=123")

        with pytest.raises(PermissionError):
            await adapter.read_file("sess-1", "../sensitive.txt")

        # Command denial
        res1 = await adapter.execute_command("sess-1", "cat .env")
        assert res1.exit_code == 1
        assert "PermissionError" in res1.stderr

        res2 = await docker_adapter.execute_command("sess-1", "cat ../config.json")
        assert res2.exit_code == 1
        assert "PermissionError" in res2.stderr


class TestStorageAdapters:
    @pytest.mark.asyncio
    async def test_in_memory_storage_adapter(self):
        adapter = InMemoryStorageAdapter()
        assert isinstance(adapter, StoragePort)

        # 1. Upload & Presigned URL
        await adapter.upload("artifacts/test.png", b"image_bytes", "image/png")
        url = await adapter.generate_presigned_url("artifacts/test.png")
        assert url.startswith("http")

        # 2. Record metadata & Check synced hashes
        desc = ArtifactDescriptor(
            id="art-1",
            session_id="sess-1",
            message_id="msg-1",
            name="test.png",
            download_url=url,
            storage_key="artifacts/test.png",
            mime_type="image/png",
            size_bytes=11,
            content_hash="hash123",
        )
        await adapter.record_artifact_metadata(desc)
        hashes = await adapter.get_synced_hashes("sess-1")
        assert hashes.get("artifacts/test.png") == "hash123"


class TestModelAdapters:
    @pytest.mark.asyncio
    async def test_fake_chat_model_adapter(self):
        adapter = FakeChatModelAdapter(scripted_tokens=["Hello", " from", " agent!"])
        assert isinstance(adapter, ModelProviderPort)

        chunks = []
        async for chunk in adapter.generate_stream(
            messages=[ChatMessage(role="user", content="Hi")],
            system_prompt="You are helpful.",
        ):
            chunks.append(chunk)

        assert len(chunks) == 4
        assert "".join(c.token for c in chunks if c.token) == "Hello from agent!"
        assert chunks[-1].finish_reason == "stop"
