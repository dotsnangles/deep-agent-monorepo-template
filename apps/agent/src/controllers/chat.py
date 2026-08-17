import uuid
from collections.abc import AsyncIterator
from typing import Any
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from src.controllers.dependencies import get_agent_runtime
from src.runtime.runtime import AgentRuntime
from src.runtime.types import (
    AgentTurn,
    ApprovalDecision,
    Attachment,
    ChatMessage,
)
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
    user_id: str | None = Field(
        default=None,
        alias="userId",
        description="User identifier for tenant isolation and Langfuse user tracking",
    )
    messages: list[ChatMessageInput] = Field(
        default_factory=list,
        description="List of messages in active path",
    )
    assistant_message_id: str | None = Field(
        default=None,
        alias="assistantMessageId",
        description="Unique assistant message node ID to bind generated artifacts to",
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


@chat_router.post("/stream")
async def stream_chat(
    req: ChatStreamRequestDTO,
    runtime: AgentRuntime = Depends(get_agent_runtime),
) -> StreamingResponse:
    """Streams structured SSE events (text/event-stream) via AgentRuntime."""
    if req.resume:
        turn_input = ApprovalDecision(
            tool_call_id=req.resume.tool_call_id or "",
            approved=req.resume.approved,
            feedback=req.resume.reason,
        )
    else:
        turn_input = [
            ChatMessage(
                role=msg.role,  # type: ignore
                content=msg.content,
                attachments=[
                    Attachment(
                        name=a.name,
                        url=a.url,
                        mime_type=a.mime_type,
                        size_bytes=a.size_bytes or 0,
                    )
                    for a in msg.attachments
                ],
            )
            for msg in req.messages
        ]

    turn = AgentTurn(
        thread_id=req.thread_id or str(uuid.uuid4()),
        input=turn_input,
        user_id=req.user_id,
        assistant_message_id=req.assistant_message_id,
        agent_type=req.agent_type,
        system_prompt=req.system_prompt,
    )

    async def sse_event_generator() -> AsyncIterator[str]:
        async for event in runtime.stream(turn):
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
