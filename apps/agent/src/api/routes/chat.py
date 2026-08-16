from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from src.core import AgentExecutionGateway

chat_router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessageInput(BaseModel):
    role: str = Field(
        default="user",
        description="Message author role: user, assistant, system",
    )
    content: str = Field(
        default="",
        description="Text content of the message",
    )


class ChatStreamRequest(BaseModel):
    thread_id: str | None = Field(
        default=None,
        description="Unique conversation session or thread ID",
    )
    messages: list[ChatMessageInput] = Field(
        default_factory=list,
        description="List of messages in active path",
    )
    agent_type: str = Field(
        default="default",
        description="Agent graph workflow type",
    )
    system_prompt: str | None = Field(
        default=None,
        description="Optional custom system prompt override",
    )


def get_gateway(request: Request) -> AgentExecutionGateway:
    """Dependency provider for AgentExecutionGateway."""
    if hasattr(request.app.state, "gateway") and request.app.state.gateway:
        return request.app.state.gateway
    return AgentExecutionGateway()


@chat_router.post("/stream")
async def stream_chat(
    req: ChatStreamRequest,
    gateway: AgentExecutionGateway = Depends(get_gateway),
) -> StreamingResponse:
    """Streams structured SSE events (text/event-stream) via AgentExecutionGateway."""

    async def sse_event_generator() -> AsyncIterator[str]:
        async for event in gateway.stream_execution(
            messages=[msg.model_dump() for msg in req.messages],
            thread_id=req.thread_id,
            agent_type=req.agent_type,
            system_prompt=req.system_prompt,
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
