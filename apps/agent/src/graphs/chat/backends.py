import asyncio
import logging
import os
import shutil
from collections.abc import Callable
from pathlib import Path
from typing import Any

from deepagents.backends.filesystem import FilesystemBackend
from deepagents.backends.protocol import (
    DeleteResult,
    EditResult,
    ExecuteResponse,
    ReadResult,
    SandboxBackendProtocol,
    WriteResult,
)

logger = logging.getLogger(__name__)

DEFAULT_CONTAINER_NAME = "hollow-echo-distant-signal-sandbox-runner"
DEFAULT_WORKSPACE_DIR = Path("./workspace/sessions")
DENIED_PATTERNS = (".env", ".git", "../", "..\\")


def _is_denied_path(file_path: str) -> bool:
    normalized = file_path.replace("\\", "/").strip("/")
    parts = normalized.split("/")
    for part in parts:
        if part.startswith(".env") or part == ".git" or part == "..":
            return True
    return False


class DockerSandboxBackend(FilesystemBackend, SandboxBackendProtocol):
    """Self-hosted Docker Sandbox Backend for secure, zero-cost code and shell execution.

    Implements SandboxBackendProtocolV2 with thread-scoped session workspace mounting
    and local filesystem fallback.
    """

    def __init__(
        self,
        root_dir: Path | str,
        thread_id: str = "default",
        container_name: str = DEFAULT_CONTAINER_NAME,
        timeout: int = 30,
        max_output_bytes: int = 100_000,
        mock_runner: Callable[[str, str], Any] | None = None,
        **kwargs: Any,
    ):
        self.root_dir = Path(root_dir).resolve()
        self.root_dir.mkdir(parents=True, exist_ok=True)
        self.thread_id = thread_id
        self.container_name = container_name
        self.default_timeout = timeout
        self.max_output_bytes = max_output_bytes
        self.mock_runner = mock_runner
        super().__init__(root_dir=str(self.root_dir), virtual_mode=True, **kwargs)

    @property
    def id(self) -> str:
        return f"docker_sandbox_{self.thread_id}"

    # --- Security-hardened filesystem operations ---

    def read(self, file_path: str, offset: int = 0, limit: int = 2000) -> ReadResult:
        if _is_denied_path(file_path):
            return ReadResult(error=f"Permission denied: Access to '{file_path}' is not allowed.")
        return super().read(file_path, offset=offset, limit=limit)

    async def aread(self, file_path: str, offset: int = 0, limit: int = 2000) -> ReadResult:
        if _is_denied_path(file_path):
            return ReadResult(error=f"Permission denied: Access to '{file_path}' is not allowed.")
        return await super().aread(file_path, offset=offset, limit=limit)

    def write(self, file_path: str, content: str) -> WriteResult:
        if _is_denied_path(file_path):
            return WriteResult(error=f"Permission denied: Writing to '{file_path}' is not allowed.")
        return super().write(file_path, content)

    async def awrite(self, file_path: str, content: str) -> WriteResult:
        if _is_denied_path(file_path):
            return WriteResult(error=f"Permission denied: Writing to '{file_path}' is not allowed.")
        return await super().awrite(file_path, content)

    def edit(
        self, file_path: str, old_string: str, new_string: str, replace_all: bool = False
    ) -> EditResult:
        if _is_denied_path(file_path):
            return EditResult(error=f"Permission denied: Editing '{file_path}' is not allowed.")
        return super().edit(file_path, old_string, new_string, replace_all=replace_all)

    async def aedit(
        self, file_path: str, old_string: str, new_string: str, replace_all: bool = False
    ) -> EditResult:
        if _is_denied_path(file_path):
            return EditResult(error=f"Permission denied: Editing '{file_path}' is not allowed.")
        return await super().aedit(file_path, old_string, new_string, replace_all=replace_all)

    def delete(self, file_path: str) -> DeleteResult:
        if _is_denied_path(file_path):
            return DeleteResult(error=f"Permission denied: Deleting '{file_path}' is not allowed.")
        return super().delete(file_path)

    async def adelete(self, file_path: str) -> DeleteResult:
        if _is_denied_path(file_path):
            return DeleteResult(error=f"Permission denied: Deleting '{file_path}' is not allowed.")
        return await super().adelete(file_path)

    # --- Sandbox Execution ---

    def execute(self, command: str, *, timeout: int | None = None) -> ExecuteResponse:
        """Synchronously execute a command in the sandbox."""
        return asyncio.run(self.aexecute(command, timeout=timeout))

    async def aexecute(self, command: str, *, timeout: int | None = None) -> ExecuteResponse:
        """Asynchronously execute a command inside Docker container or local workspace."""
        effective_timeout = timeout if timeout is not None else self.default_timeout

        if self.mock_runner:
            res = self.mock_runner(command, str(self.root_dir))
            if asyncio.iscoroutine(res):
                res = await res
            if isinstance(res, ExecuteResponse):
                return res
            return ExecuteResponse(output=str(res), exit_code=0, truncated=False)

        # Check if Docker runner container is available and running
        use_docker = False
        if shutil.which("docker") and self.container_name:
            try:
                check_cmd = ["docker", "inspect", "-f", "{{.State.Running}}", self.container_name]
                proc = await asyncio.create_subprocess_exec(
                    *check_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, _ = await proc.communicate()
                if stdout.decode().strip() == "true":
                    use_docker = True
            except Exception as e:
                logger.debug("Docker runner check failed: %s", e)

        try:
            if use_docker:
                # Execute inside the container's mounted session folder
                container_workdir = f"/workspace/sessions/{self.thread_id}"
                docker_cmd = [
                    "docker",
                    "exec",
                    "-w",
                    container_workdir,
                    self.container_name,
                    "/bin/sh",
                    "-c",
                    command,
                ]
                proc = await asyncio.create_subprocess_exec(
                    *docker_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
            else:
                # Fallback to local subprocess in isolated root_dir
                proc = await asyncio.create_subprocess_shell(
                    command,
                    cwd=str(self.root_dir),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env={
                        **os.environ,
                        "PYTHONPATH": str(self.root_dir),
                    },
                )

            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(), timeout=effective_timeout
            )
            raw_output = (
                stdout_bytes.decode("utf-8", errors="replace")
                + stderr_bytes.decode("utf-8", errors="replace")
            )
            exit_code = proc.returncode

            is_truncated = len(raw_output) > self.max_output_bytes
            output = raw_output[: self.max_output_bytes]
            return ExecuteResponse(
                output=output,
                exit_code=exit_code,
                truncated=is_truncated,
            )
        except TimeoutError:
            try:
                proc.kill()
            except Exception:
                pass
            return ExecuteResponse(
                output=f"Error: Command timed out after {effective_timeout} seconds.",
                exit_code=124,
                truncated=False,
            )
        except Exception as err:
            logger.error("Sandbox execution error: %s", err)
            return ExecuteResponse(
                output=f"Execution error: {err}",
                exit_code=1,
                truncated=False,
            )


def get_session_backend(
    thread_id: str,
    base_dir: Path | str | None = None,
    container_name: str = DEFAULT_CONTAINER_NAME,
    **kwargs: Any,
) -> DockerSandboxBackend:
    """Factory creating and preparing a DockerSandboxBackend for a specific chat/agent thread."""
    base = Path(base_dir) if base_dir is not None else DEFAULT_WORKSPACE_DIR
    session_dir = base / thread_id
    session_dir.mkdir(parents=True, exist_ok=True)
    return DockerSandboxBackend(
        root_dir=session_dir,
        thread_id=thread_id,
        container_name=container_name,
        **kwargs,
    )
