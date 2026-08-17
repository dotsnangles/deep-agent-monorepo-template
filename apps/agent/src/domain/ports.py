from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Protocol, runtime_checkable

from src.domain.types import (
    AgentStateSnapshot,
    AgentTurn,
    ApprovalDecision,
    Attachment,
    ChatMessage,
)

if TYPE_CHECKING:
    from src.runtime.events import AgentStreamEvent


@dataclass(frozen=True)
class StateSnapshot:
    """Snapshot of a conversation state checkpoint."""
    values: dict[str, Any]
    next_nodes: tuple[str, ...]
    config: dict[str, Any]
    metadata: dict[str, Any]
    created_at: str
    tasks: tuple[Any, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class SandboxResult:
    """Result of command execution within an isolated sandbox."""
    stdout: str
    stderr: str
    exit_code: int
    truncated: bool = False


@dataclass(frozen=True)
class FileDescriptor:
    """Metadata describing a workspace file."""
    path: str
    size_bytes: int
    content_hash: str
    mime_type: str


@dataclass(frozen=True)
class ArtifactDescriptor:
    """Indexed metadata for a generated artifact."""
    id: str
    session_id: str
    message_id: str | None
    name: str
    download_url: str
    storage_key: str
    mime_type: str
    size_bytes: int
    content_hash: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ToolDefinition:
    """Definition for a tool provided to a foundation model."""
    name: str
    description: str
    parameters: dict[str, Any]


@dataclass(frozen=True)
class ModelChunk:
    """Streaming chunk emitted by a foundation model."""
    token: str | None = None
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    finish_reason: str | None = None


# ---------------------------------------------------------------------------
# Outbound Port Protocols
# ---------------------------------------------------------------------------

@runtime_checkable
class PersistencePort(Protocol):
    """Outbound Port for conversation state checkpoints and namespaced memory."""

    async def get_state(self, thread_id: str) -> StateSnapshot | None:
        """Fetch the latest state snapshot for a given thread."""
        ...

    async def save_checkpoint(
        self, thread_id: str, state: dict[str, Any], metadata: dict[str, Any]
    ) -> None:
        """Persist a state checkpoint for the thread."""
        ...

    async def clear_messages(self, thread_id: str, message_ids: list[str]) -> None:
        """Prune or synchronize message nodes in the thread checkpoint."""
        ...

    async def store_get(
        self, namespace: tuple[str, ...], key: str
    ) -> dict[str, Any] | None:
        """Retrieve long-term memory payload from namespaced key-value store."""
        ...

    async def store_put(
        self, namespace: tuple[str, ...], key: str, value: dict[str, Any]
    ) -> None:
        """Upsert long-term memory payload in namespaced key-value store."""
        ...


@runtime_checkable
class SandboxExecutionPort(Protocol):
    """Outbound Port for sandbox workspace operations and isolated command execution."""

    async def execute_command(
        self,
        session_id: str,
        command: str,
        timeout_seconds: int = 30,
    ) -> SandboxResult:
        """Execute shell or script command within the isolated session environment."""
        ...

    async def read_file(
        self, session_id: str, file_path: str, offset: int = 0, limit: int = 2000
    ) -> str:
        """Read a slice of text from a session workspace file."""
        ...

    async def write_file(
        self, session_id: str, file_path: str, content: str
    ) -> None:
        """Write text content to a session workspace file."""
        ...

    async def list_workspace_artifacts(
        self, session_id: str
    ) -> list[FileDescriptor]:
        """Inspect and return descriptors of all files in the session artifacts directory."""
        ...

    async def read_artifact_bytes(
        self, session_id: str, relative_path: str
    ) -> bytes:
        """Read binary payload of an artifact file for object storage upload."""
        ...


@runtime_checkable
class StoragePort(Protocol):
    """Outbound Port for blob object storage and presigned download URL issuance."""

    async def upload(
        self, storage_key: str, data: bytes, mime_type: str
    ) -> None:
        """Upload raw bytes to object storage."""
        ...

    async def generate_presigned_url(
        self, storage_key: str, expires_in_seconds: int = 3600
    ) -> str:
        """Generate a time-limited presigned download URL."""
        ...

    async def record_artifact_metadata(
        self, artifact: ArtifactDescriptor
    ) -> None:
        """Persist indexed artifact descriptor into database registry."""
        ...

    async def get_synced_hashes(self, session_id: str) -> dict[str, str]:
        """Fetch filename -> content_hash map of previously synced artifacts for a session."""
        ...


@runtime_checkable
class ModelProviderPort(Protocol):
    """Outbound Port for foundation model inference and streaming."""

    def generate_stream(
        self,
        messages: list[ChatMessage],
        system_prompt: str,
        tools: list[ToolDefinition] | None = None,
        config: dict[str, Any] | None = None,
    ) -> AsyncIterator[ModelChunk]:
        """Stream token chunks and tool call intents from the underlying model."""
        ...


# ---------------------------------------------------------------------------
# Inbound Port Protocols
# ---------------------------------------------------------------------------

@runtime_checkable
class AgentExecutionPort(Protocol):
    """Inbound Driving Port for initiating or resuming streaming agent workflows."""

    def stream(
        self, turn: AgentTurn
    ) -> AsyncIterator[AgentStreamEvent]:
        """Execute the agent workflow and yield real-time execution events."""
        ...

    async def inspect(
        self, thread_id: str
    ) -> AgentStateSnapshot:
        """Inspect current agent thread state, pending approvals, and artifacts."""
        ...
