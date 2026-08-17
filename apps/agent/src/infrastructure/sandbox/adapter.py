from __future__ import annotations

import asyncio
import hashlib
import mimetypes
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

from src.domain.ports import FileDescriptor, SandboxExecutionPort, SandboxResult

MIME_TYPE_OVERRIDES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".html": "text/html; charset=utf-8",
    ".json": "application/json",
    ".csv": "text/csv; charset=utf-8",
    ".pdf": "application/pdf",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
}


def guess_mime_type(file_path: Path | str) -> str:
    path = Path(file_path)
    suffix = path.suffix.lower()
    if suffix in MIME_TYPE_OVERRIDES:
        return MIME_TYPE_OVERRIDES[suffix]
    guessed, _ = mimetypes.guess_type(str(path))
    return guessed or "application/octet-stream"


def is_denied_path(file_path: str) -> bool:
    normalized = file_path.replace("\\", "/").strip("/")
    parts = normalized.split("/")
    for part in parts:
        if part.startswith(".env") or part == ".git" or part == "..":
            return True
    return False


def is_denied_command(command: str) -> bool:
    """Checks whether command contains forbidden resource access or path traversal patterns."""
    forbidden = [".env", ".git", "../", "..\\"]
    cmd_lower = command.lower()
    for f in forbidden:
        if f in cmd_lower:
            return True
    return False


class InProcessSandboxAdapter(SandboxExecutionPort):
    """In-process sandbox executing commands directly on host in isolated temp directories."""

    def __init__(self, root_dir: Path | str = "./workspace/sessions"):
        self.root_dir = Path(root_dir).resolve()
        self.root_dir.mkdir(parents=True, exist_ok=True)

    def _get_session_dir(self, session_id: str) -> Path:
        session_dir = self.root_dir / session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        (session_dir / "artifacts").mkdir(parents=True, exist_ok=True)
        return session_dir

    async def execute_command(
        self, session_id: str, command: str, timeout_seconds: int = 30
    ) -> SandboxResult:
        if is_denied_command(command):
            return SandboxResult(
                stdout="",
                stderr="PermissionError: Command access to sensitive resource or path traversal denied.",
                exit_code=1,
            )
        session_dir = self._get_session_dir(session_id)
        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                cwd=str(session_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout_b, stderr_b = await asyncio.wait_for(
                proc.communicate(), timeout=timeout_seconds
            )
            return SandboxResult(
                stdout=stdout_b.decode("utf-8", errors="replace"),
                stderr=stderr_b.decode("utf-8", errors="replace"),
                exit_code=proc.returncode or 0,
            )
        except asyncio.TimeoutError:
            return SandboxResult(
                stdout="",
                stderr=f"Execution timed out after {timeout_seconds} seconds.",
                exit_code=-1,
            )
        except Exception as e:
            return SandboxResult(stdout="", stderr=str(e), exit_code=-1)

    async def read_file(
        self, session_id: str, file_path: str, offset: int = 0, limit: int = 2000
    ) -> str:
        if is_denied_path(file_path):
            raise PermissionError(f"Access to '{file_path}' is denied.")
        session_dir = self._get_session_dir(session_id)
        target = (session_dir / file_path).resolve()
        if not str(target).startswith(str(session_dir)):
            raise PermissionError("Path traversal denied.")
        if not target.exists():
            raise FileNotFoundError(f"File '{file_path}' not found.")
        return target.read_text(encoding="utf-8", errors="replace")

    async def write_file(
        self, session_id: str, file_path: str, content: str
    ) -> None:
        if is_denied_path(file_path):
            raise PermissionError(f"Writing to '{file_path}' is denied.")
        session_dir = self._get_session_dir(session_id)
        target = (session_dir / file_path).resolve()
        if not str(target).startswith(str(session_dir)):
            raise PermissionError("Path traversal denied.")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    async def list_workspace_artifacts(
        self, session_id: str
    ) -> list[FileDescriptor]:
        session_dir = self._get_session_dir(session_id)
        art_dir = session_dir / "artifacts"
        descriptors: list[FileDescriptor] = []
        if not art_dir.exists():
            return descriptors

        for p in art_dir.rglob("*"):
            if p.is_file() and not is_denied_path(p.name):
                rel_path = str(p.relative_to(session_dir)).replace("\\", "/")
                data = p.read_bytes()
                h = hashlib.sha256(data).hexdigest()
                descriptors.append(
                    FileDescriptor(
                        path=rel_path,
                        size_bytes=len(data),
                        content_hash=h,
                        mime_type=guess_mime_type(p),
                    )
                )
        return descriptors

    async def read_artifact_bytes(
        self, session_id: str, relative_path: str
    ) -> bytes:
        session_dir = self._get_session_dir(session_id)
        target = (session_dir / relative_path).resolve()
        if not str(target).startswith(str(session_dir)):
            raise PermissionError("Path traversal denied.")
        return target.read_bytes()


class DockerSandboxAdapter(InProcessSandboxAdapter):
    """Production Docker sandbox adapter executing inside a Docker runner container with local fallback."""

    def __init__(
        self,
        root_dir: Path | str = "./workspace/sessions",
        container_name: str = "agent-sandbox-runner",
    ):
        super().__init__(root_dir=root_dir)
        self.container_name = container_name

    async def execute_command(
        self, session_id: str, command: str, timeout_seconds: int = 30
    ) -> SandboxResult:
        if is_denied_command(command):
            return SandboxResult(
                stdout="",
                stderr="PermissionError: Command access to sensitive resource or path traversal denied.",
                exit_code=1,
            )

        # Check if docker is available and container running
        if shutil.which("docker") and self.container_name:
            session_dir = self._get_session_dir(session_id)
            container_workdir = f"/workspace/sessions/{session_id}"
            docker_cmd = f"docker exec -w {container_workdir} {self.container_name} sh -c {command!r}"
            try:
                proc = await asyncio.create_subprocess_shell(
                    docker_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout_b, stderr_b = await asyncio.wait_for(
                    proc.communicate(), timeout=timeout_seconds
                )
                if proc.returncode == 0 or b"No such container" not in stderr_b:
                    return SandboxResult(
                        stdout=stdout_b.decode("utf-8", errors="replace"),
                        stderr=stderr_b.decode("utf-8", errors="replace"),
                        exit_code=proc.returncode or 0,
                    )
            except Exception:
                pass

        # Fallback to in-process execution
        return await super().execute_command(session_id, command, timeout_seconds)
