
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from pydantic import BaseModel

from src.core.config import get_llm
from src.core.observability import get_langfuse_callback
from src.graphs.chat.prompts import MAIN_SYSTEM_PROMPT

chat_router = APIRouter(prefix="/chat", tags=["chat"])

ROLE_MESSAGE_MAP = {
    "user": HumanMessage,
    "assistant": AIMessage,
    "system": SystemMessage,
}


class ChatMessageInput(BaseModel):
    role: str
    content: str


class ChatStreamRequest(BaseModel):
    thread_id: str | None = None
    messages: list[ChatMessageInput]


@chat_router.post("/stream")
async def stream_chat(req: ChatStreamRequest):
    """Streams LLM chat response for active path conversation context."""
    llm = get_llm()
    lf_callback = get_langfuse_callback()
    callbacks = [lf_callback] if lf_callback else []

    lc_messages: list[BaseMessage] = [SystemMessage(content=MAIN_SYSTEM_PROMPT)]
    for msg in req.messages:
        msg_cls = ROLE_MESSAGE_MAP.get(msg.role.lower(), HumanMessage)
        lc_messages.append(msg_cls(content=msg.content))

    async def token_generator():
        try:
            async for chunk in llm.astream(
                lc_messages,
                config={
                    "callbacks": callbacks,
                    "metadata": {
                        "langfuse_session_id": req.thread_id or "default",
                        "langfuse_trace_name": "Hollow Echo Message Tree Stream",
                    },
                },
            ):
                content = chunk.content if hasattr(chunk, "content") else str(chunk)
                if content:
                    yield content
        except Exception as e:
            print(f"[ERROR] Chat stream error: {e}")
            yield f"\n[답변 생성 중 오류: {str(e)}]"

    return StreamingResponse(token_generator(), media_type="text/plain; charset=utf-8")
