import json
from typing import Any, Literal

from pydantic import BaseModel, Field


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
    "node_transition",
    "error",
    "done",
]


class AgentStreamEvent(BaseModel):
    event: AgentEventType
    data: dict[str, Any] | BaseModel = Field(default_factory=dict)

    def to_sse(self) -> str:
        """Serializes the event into Server-Sent Events (SSE) format."""
        payload = self.data.model_dump() if isinstance(self.data, BaseModel) else self.data
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
