from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from src.core import AgentExecutionGateway
from src.schemas import AttachmentInput

chat_router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessageInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    role: str = Field(
        default="user",
        description="Message author role: user, assistant, system",
    )
    content: str = Field(
        default="",
        description="Text content of the message",
    )
    attachments: list[AttachmentInput] = Field(
        default_factory=list,
        description="List of attached files (multimodal images, documents)",
    )


class ResumeActionInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tool_call_id: str | None = Field(
        default=None,
        alias="toolCallId",
        description="ID of the tool call being approved/rejected",
    )
    approved: bool = Field(
        default=True,
        description="Whether the user approved tool execution",
    )
    reason: str | None = Field(
        default=None,
        description="Optional rejection reason or feedback",
    )


class ChatStreamRequestDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    thread_id: str | None = Field(
        default=None,
        alias="threadId",
        description="Unique conversation session or thread ID",
    )
    messages: list[ChatMessageInput] = Field(
        default_factory=list,
        description="List of messages in active path",
    )
    agent_type: str = Field(
        default="default",
        alias="agentType",
        description="Agent graph workflow type",
    )
    system_prompt: str | None = Field(
        default=None,
        alias="systemPrompt",
        description="Optional custom system prompt override",
    )
    resume: ResumeActionInput | None = Field(
        default=None,
        description="Optional resume payload for Human-In-The-Loop approval/rejection",
    )


# Alias for backward compatibility
ChatStreamRequest = ChatStreamRequestDTO


def get_gateway(request: Request) -> AgentExecutionGateway:
    """Dependency provider for AgentExecutionGateway."""
    if hasattr(request.app.state, "gateway") and request.app.state.gateway:
        return request.app.state.gateway
    return AgentExecutionGateway()


@chat_router.post("/stream")
async def stream_chat(
    req: ChatStreamRequestDTO,
    gateway: AgentExecutionGateway = Depends(get_gateway),
) -> StreamingResponse:
    """Streams structured SSE events (text/event-stream) via AgentExecutionGateway."""

    resume_dict: dict[str, Any] | None = None
    if req.resume:
        resume_dict = req.resume.model_dump(by_alias=False)

    async def sse_event_generator() -> AsyncIterator[str]:
        async for event in gateway.stream_execution(
            messages=[msg.model_dump(by_alias=False) for msg in req.messages],
            thread_id=req.thread_id,
            agent_type=req.agent_type,
            system_prompt=req.system_prompt,
            resume_action=resume_dict,
        ):
            yield event.to_sse()

    return StreamingResponse(
        sse_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
