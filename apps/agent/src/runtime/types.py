from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, Union


@dataclass(frozen=True)
class Attachment:
    """Represents a multimodal file attachment (image, document)."""
    name: str
    url: str
    mime_type: str
    size_bytes: int


@dataclass(frozen=True)
class ChatMessage:
    """Represents a normalized conversational message in active path."""
    role: Literal["user", "assistant", "system"]
    content: str
    attachments: list[Attachment] = field(default_factory=list)


@dataclass(frozen=True)
class ApprovalDecision:
    """Human-In-The-Loop action decision payload."""
    tool_call_id: str
    approved: bool
    feedback: str | None = None


@dataclass(frozen=True)
class AgentTurn:
    """Represents a single invocation turn in an agent conversation."""
    thread_id: str
    input: Union[str, list[ChatMessage], ApprovalDecision]
    user_id: str | None = None
    assistant_message_id: str | None = None
    agent_type: str = "default"
    system_prompt: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class AgentStateSnapshot:
    """Read-only view of a conversation thread state."""
    thread_id: str
    is_interrupted: bool
    pending_tool_approvals: list[dict[str, Any]]
    turn_count: int
    active_artifacts: list[dict[str, Any]]
    metadata: dict[str, Any] = field(default_factory=dict)
