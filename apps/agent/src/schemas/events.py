import json
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class TokenEventData(BaseModel):
    content: str


class ToolStartEventData(BaseModel):
    tool: str
    input: Any
    run_id: str | None = None


class ToolEndEventData(BaseModel):
    tool: str
    output: Any
    run_id: str | None = None


class TodoItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    content: str
    status: Literal["pending", "in_progress", "completed"] = "pending"
    id: str | None = None


class TodoUpdateEventData(BaseModel):
    todos: list[TodoItem]


class SubagentStartEventData(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    subagent: str
    task: str
    run_id: str | None = Field(default=None, serialization_alias="runId")


class SubagentEndEventData(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    subagent: str
    output: Any
    run_id: str | None = Field(default=None, serialization_alias="runId")


class ApprovalRequestEventData(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tool: str
    input: Any
    tool_call_id: str = Field(..., serialization_alias="toolCallId")
    description: str | None = None
    requires_approval: bool = Field(default=True, serialization_alias="requiresApproval")


class ArtifactCreatedEventData(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    session_id: str = Field(..., serialization_alias="sessionId")
    message_id: str | None = Field(default=None, serialization_alias="messageId")
    name: str
    url: str
    storage_key: str = Field(..., serialization_alias="storageKey")
    mime_type: str = Field(..., serialization_alias="mimeType")
    size_bytes: int | None = Field(default=None, serialization_alias="sizeBytes")
    metadata: dict[str, Any] = Field(default_factory=dict)


class NodeTransitionEventData(BaseModel):
    node: str
    state_summary: dict[str, Any] | None = None


class ErrorEventData(BaseModel):
    message: str
    code: str | None = "AGENT_ERROR"


class DoneEventData(BaseModel):
    finish_reason: str = "stop"
    metadata: dict[str, Any] | None = None


AgentEventType = Literal[
    "token",
    "tool_start",
    "tool_end",
    "todo_update",
    "subagent_start",
    "subagent_end",
    "approval_request",
    "artifact_created",
    "node_transition",
    "error",
    "done",
]


class AgentStreamEvent(BaseModel):
    event: AgentEventType
    data: dict[str, Any] | BaseModel = Field(default_factory=dict)

    def to_sse(self) -> str:
        """Serializes the event into Server-Sent Events (SSE) format with camelCase aliases."""
        payload = (
            self.data.model_dump(by_alias=True) if isinstance(self.data, BaseModel) else self.data
        )
        json_data = json.dumps(payload, ensure_ascii=False)
        return f"event: {self.event}\ndata: {json_data}\n\n"

    @classmethod
    def token(cls, content: str) -> "AgentStreamEvent":
        return cls(event="token", data=TokenEventData(content=content))

    @classmethod
    def tool_start(
        cls,
        tool: str,
        tool_input: Any,
        run_id: str | None = None,
    ) -> "AgentStreamEvent":
        return cls(
            event="tool_start",
            data=ToolStartEventData(tool=tool, input=tool_input, run_id=run_id),
        )

    @classmethod
    def tool_end(
        cls,
        tool: str,
        output: Any,
        run_id: str | None = None,
    ) -> "AgentStreamEvent":
        return cls(
            event="tool_end",
            data=ToolEndEventData(tool=tool, output=output, run_id=run_id),
        )

    @classmethod
    def todo_update(
        cls,
        todos: list[dict[str, Any] | TodoItem],
    ) -> "AgentStreamEvent":
        parsed_todos: list[TodoItem] = []
        for t in todos:
            if isinstance(t, TodoItem):
                parsed_todos.append(t)
            elif isinstance(t, dict):
                parsed_todos.append(TodoItem.model_validate(t))
        return cls(
            event="todo_update",
            data=TodoUpdateEventData(todos=parsed_todos),
        )

    @classmethod
    def subagent_start(
        cls,
        subagent: str,
        task: str,
        run_id: str | None = None,
    ) -> "AgentStreamEvent":
        return cls(
            event="subagent_start",
            data=SubagentStartEventData(subagent=subagent, task=task, run_id=run_id),
        )

    @classmethod
    def subagent_end(
        cls,
        subagent: str,
        output: Any,
        run_id: str | None = None,
    ) -> "AgentStreamEvent":
        return cls(
            event="subagent_end",
            data=SubagentEndEventData(subagent=subagent, output=output, run_id=run_id),
        )

    @classmethod
    def approval_request(
        cls,
        tool: str,
        tool_input: Any,
        tool_call_id: str,
        description: str | None = None,
    ) -> "AgentStreamEvent":
        return cls(
            event="approval_request",
            data=ApprovalRequestEventData(
                tool=tool,
                input=tool_input,
                tool_call_id=tool_call_id,
                description=description,
            ),
        )

    @classmethod
    def artifact_created(
        cls,
        id: str,
        session_id: str,
        name: str,
        url: str,
        storage_key: str,
        mime_type: str,
        message_id: str | None = None,
        size_bytes: int | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> "AgentStreamEvent":
        return cls(
            event="artifact_created",
            data=ArtifactCreatedEventData(
                id=id,
                session_id=session_id,
                message_id=message_id,
                name=name,
                url=url,
                storage_key=storage_key,
                mime_type=mime_type,
                size_bytes=size_bytes,
                metadata=metadata or {},
            ),
        )

    @classmethod
    def node_transition(
        cls,
        node: str,
        state_summary: dict[str, Any] | None = None,
    ) -> "AgentStreamEvent":
        return cls(
            event="node_transition",
            data=NodeTransitionEventData(node=node, state_summary=state_summary),
        )

    @classmethod
    def error(cls, message: str, code: str = "AGENT_ERROR") -> "AgentStreamEvent":
        return cls(event="error", data=ErrorEventData(message=message, code=code))

    @classmethod
    def done(
        cls,
        finish_reason: str = "stop",
        metadata: dict[str, Any] | None = None,
    ) -> "AgentStreamEvent":
        return cls(
            event="done",
            data=DoneEventData(finish_reason=finish_reason, metadata=metadata),
        )
