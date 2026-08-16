from pathlib import Path

import pytest
from deepagents.backends.protocol import ExecuteResponse, SandboxBackendProtocol
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import MemorySaver

from src.core.testing import FakeChatModel
from src.graphs.chat.backends import DockerSandboxBackend, get_session_backend
from src.graphs.chat.graph import build_agent


class TestDockerSandboxBackend:
    @pytest.fixture
    def session_dir(self, tmp_path: Path) -> Path:
        sess_dir = tmp_path / "sessions" / "test-session-1"
        sess_dir.mkdir(parents=True, exist_ok=True)
        return sess_dir

    def test_implements_sandbox_backend_protocol(self, session_dir: Path):
        backend = DockerSandboxBackend(root_dir=session_dir, thread_id="test-session-1")
        assert isinstance(backend, SandboxBackendProtocol)

    @pytest.mark.asyncio
    async def test_filesystem_operations(self, session_dir: Path):
        backend = DockerSandboxBackend(root_dir=session_dir, thread_id="test-session-1")

        # Write file
        write_res = await backend.awrite("data.csv", "id,name,value\n1,Alpha,100\n2,Beta,200\n")
        assert write_res.error is None
        assert (session_dir / "data.csv").exists()

        # Read file
        read_res = await backend.aread("data.csv")
        assert read_res.error is None
        assert read_res.file_data is not None
        assert "Alpha" in read_res.file_data["content"]

        # Edit file
        edit_res = await backend.aedit("data.csv", "Alpha", "Gamma")
        assert edit_res.error is None
        read_edited = await backend.aread("data.csv")
        assert "Gamma" in read_edited.file_data["content"]
        assert "Alpha" not in read_edited.file_data["content"]

        # List files
        ls_res = await backend.als("")
        assert ls_res.error is None
        file_names = [e["path"] if isinstance(e, dict) else e.path for e in ls_res.entries]
        assert any("data.csv" in fn for fn in file_names)

    @pytest.mark.asyncio
    async def test_security_deny_sensitive_files(self, session_dir: Path):
        backend = DockerSandboxBackend(root_dir=session_dir, thread_id="test-session-1")

        # Deny .env write/read
        write_env = await backend.awrite(".env", "SECRET=12345")
        assert write_env.error is not None
        assert "Permission denied" in write_env.error or "not allowed" in write_env.error.lower()

        write_env_prod = await backend.awrite(".env.production", "SECRET=12345")
        assert write_env_prod.error is not None

        # Deny .git access
        write_git = await backend.awrite(".git/config", "[core]")
        assert write_git.error is not None

    @pytest.mark.asyncio
    async def test_command_execution_and_artifact_generation(self, session_dir: Path):
        backend = DockerSandboxBackend(
            root_dir=session_dir,
            thread_id="test-session-1",
        )

        python_script = (
            "import os\n"
            "with open('result.txt', 'w') as f:\n"
            "    f.write('calculation_complete: 42')\n"
            "print('SCRIPT_DONE')\n"
        )
        await backend.awrite("script.py", python_script)

        # Execute command
        exec_res = await backend.aexecute("python3 script.py")
        assert isinstance(exec_res, ExecuteResponse)
        assert exec_res.exit_code == 0
        assert "SCRIPT_DONE" in exec_res.output

        # Verify artifact created directly in session directory
        assert (session_dir / "result.txt").exists()
        res_read = await backend.aread("result.txt")
        assert "calculation_complete: 42" in res_read.file_data["content"]

    @pytest.mark.asyncio
    async def test_factory_get_session_backend(self, tmp_path: Path):
        backend = get_session_backend(
            thread_id="thread-xyz-789",
            base_dir=tmp_path / "sessions",
        )
        assert backend.thread_id == "thread-xyz-789"
        assert backend.root_dir.exists()
        assert "thread-xyz-789" in str(backend.root_dir)

    @pytest.mark.asyncio
    async def test_deep_agent_integration_with_sandbox_backend(self, session_dir: Path):
        backend = DockerSandboxBackend(root_dir=session_dir, thread_id="test-agent-sandbox")
        fake_llm = FakeChatModel()
        agent = build_agent(
            backend=backend,
            model=fake_llm,
            checkpointer=MemorySaver(),
        )

        config = {"configurable": {"thread_id": "test-agent-sandbox"}}
        await agent.ainvoke({"messages": [HumanMessage(content="Run analysis")]}, config=config)

        bound_tool_names = [
            getattr(t, "name", str(t)) if not isinstance(t, dict) else t.get("name")
            for t in fake_llm.bound_tools
        ]
        assert "execute" in bound_tool_names
        assert "write_todos" in bound_tool_names
        assert "read_file" in bound_tool_names
