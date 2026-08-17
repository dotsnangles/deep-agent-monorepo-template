"""Legacy compatibility wrapper for AgentExecutionGateway, delegating to AgentRuntime."""
from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

from src.domain.ports import PersistencePort, SandboxExecutionPort, StoragePort
from src.graphs.chat.prompts import MAIN_SYSTEM_PROMPT
from src.infrastructure.sandbox.adapter import InProcessSandboxAdapter
from src.runtime.events import AgentStreamEvent
from src.runtime.runtime import AgentRuntime, _normalize_turn_messages
from src.runtime.types import AgentTurn, ApprovalDecision, Attachment, ChatMessage

logger = logging.getLogger(__name__)


def _is_image_attachment(att: dict[str, Any]) -> bool:
    mime = (att.get("mime_type") or att.get("mimeType") or "").lower()
    return mime.startswith("image/")


def _format_document_attachments(docs: list[dict[str, Any]]) -> str:
    sections = [
        f"- **{doc.get('name', 'document')}** ({doc.get('mime_type') or doc.get('mimeType', 'unknown')}, {doc.get('size') or doc.get('size_bytes', 0)} bytes): [Download/View Document]({doc.get('url', '')})"
        for doc in docs
    ]
    return "\n[Attached Documents]\n" + "\n".join(sections)


def _build_multimodal_content(text_content: str, images: list[dict[str, Any]]) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    if text_content:
        blocks.append({"type": "text", "text": text_content})
    for img in images:
        blocks.append(
            {
                "type": "image_url",
                "image_url": {"url": img.get("url", "")},
            }
        )
    return blocks


def _normalize_messages(
    raw_messages: list[dict[str, Any]], system_prompt: str | None = None
) -> list[BaseMessage]:
    effective_system_prompt = system_prompt or MAIN_SYSTEM_PROMPT
    if not raw_messages:
        return [SystemMessage(content=effective_system_prompt)]

    normalized: list[BaseMessage] = []
    has_system = False

    for msg in raw_messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        attachments = msg.get("attachments", []) or []

        if role == "system":
            has_system = True
            normalized.append(SystemMessage(content=content or effective_system_prompt))
        elif role == "assistant":
            normalized.append(AIMessage(content=content))
        elif role == "user":
            images = [att for att in attachments if _is_image_attachment(att)]
            docs = [att for att in attachments if not _is_image_attachment(att)]

            text_part = content
            if docs:
                doc_section = _format_document_attachments(docs)
                text_part = f"{text_part}\n\n{doc_section}" if text_part else doc_section

            if images:
                content_blocks = _build_multimodal_content(text_part, images)
                normalized.append(HumanMessage(content=content_blocks))
            else:
                normalized.append(HumanMessage(content=text_part))
        else:
            normalized.append(HumanMessage(content=content))

    if not has_system:
        normalized.insert(0, SystemMessage(content=effective_system_prompt))

    return normalized


def _build_trace_metadata(
    messages: list[dict[str, Any]],
    agent_type: str,
    thread_id: str | None = None,
    user_id: str | None = None,
    environment: str | None = None,
) -> dict[str, Any]:
    active_user_prompt = ""
    turn_index = 0
    has_attachments = False

    if messages:
        user_messages = [m for m in messages if m.get("role") == "user"]
        if user_messages:
            turn_index = len(user_messages)
            last_msg = user_messages[-1]
            active_user_prompt = last_msg.get("content", "")
            if last_msg.get("attachments"):
                has_attachments = True

    env = environment or "development"
    tags = ["chat", "streaming", f"agent:{agent_type}", f"env:{env}"]
    if has_attachments:
        tags.append("multimodal")

    prompt_snippet = active_user_prompt.strip()
    if len(prompt_snippet) > 30:
        prompt_snippet = prompt_snippet[:30] + "..."

    trace_name = f"[Turn {turn_index}] {prompt_snippet}" if prompt_snippet else f"Agent Stream ({agent_type})"

    metadata: dict[str, Any] = {
        "langfuse_session_id": thread_id or "anonymous",
        "langfuse_user_id": user_id or "anonymous",
        "langfuse_trace_name": trace_name,
        "langfuse_tags": tags,
        "agent_type": agent_type,
        "user_prompt": active_user_prompt,
        "active_path_length": len(messages),
        "turn_index": turn_index,
        "has_attachments": has_attachments,
    }
    return metadata


class InferenceSerializationGateway:
    _instance: InferenceSerializationGateway | None = None

    def __init__(self, concurrency_limit: int | None = None):
        self.concurrency_limit = concurrency_limit

    @classmethod
    def get_instance(cls, concurrency_limit: int | None = None) -> InferenceSerializationGateway:
        if cls._instance is None:
            cls._instance = cls(concurrency_limit=concurrency_limit)
        return cls._instance


class AgentExecutionGateway:
    def __init__(
        self,
        registry: Any = None,
        checkpointer: Any = None,
        store: Any = None,
        event_broker: Any = None,
        artifact_processor: Any = None,
        concurrency_limit: int | None = None,
        model: Any = None,
    ):
        from src.core.checkpointer import CheckpointerFactory
        effective_checkpointer = checkpointer or CheckpointerFactory.get_default_checkpointer()

        self.runtime = AgentRuntime.create_in_memory(
            model=model, concurrency_limit=concurrency_limit
        )
        if effective_checkpointer:
            self.runtime.persistence.checkpointer = effective_checkpointer
        if store:
            self.runtime.persistence.store = store
        if event_broker:
            self.runtime.event_broker = event_broker
        if model:
            self.runtime.model = model
        if registry:
            self.runtime.registry = registry
        self.artifact_processor = artifact_processor
        if artifact_processor:
            if hasattr(artifact_processor, "workspace_dir"):
                self.runtime.sandbox = InProcessSandboxAdapter(root_dir=artifact_processor.workspace_dir)

    @property
    def default_model(self):
        return self.runtime.model

    @default_model.setter
    def default_model(self, val: Any):
        self.runtime.model = val

    @property
    def checkpointer(self):
        return getattr(self.runtime.persistence, "checkpointer", None)

    @property
    def store(self):
        return getattr(self.runtime.persistence, "store", None)

    async def stream_execution(
        self,
        messages: list[dict[str, Any]] | None = None,
        thread_id: str | None = None,
        user_id: str | None = None,
        agent_type: str = "default",
        system_prompt: str | None = None,
        resume_action: dict[str, Any] | None = None,
        assistant_message_id: str | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[AgentStreamEvent]:
        tid = thread_id or "default-thread"

        if resume_action:
            turn_input = ApprovalDecision(
                tool_call_id=resume_action.get("tool_call_id") or resume_action.get("toolCallId") or "",
                approved=resume_action.get("approved", True),
                feedback=resume_action.get("reason"),
            )
        else:
            turn_input = []
            for m in (messages or []):
                if isinstance(m, BaseMessage):
                    role = "user" if isinstance(m, HumanMessage) else ("assistant" if isinstance(m, AIMessage) else "system")
                    turn_input.append(ChatMessage(role=role, content=str(m.content), attachments=[]))
                elif isinstance(m, dict):
                    turn_input.append(
                        ChatMessage(
                            role=m.get("role", "user"),
                            content=m.get("content", ""),
                            attachments=[
                                Attachment(
                                    name=a.get("name", "file"),
                                    url=a.get("url", ""),
                                    mime_type=a.get("mime_type") or a.get("mimeType", "application/octet-stream"),
                                    size_bytes=a.get("size") or a.get("size_bytes") or a.get("sizeBytes", 0),
                                )
                                for a in m.get("attachments", [])
                            ],
                        )
                    )
                else:
                    turn_input.append(ChatMessage(role="user", content=str(m), attachments=[]))

        if "model" in kwargs and kwargs["model"] is not None:
            self.runtime.model = kwargs["model"]

        turn = AgentTurn(
            thread_id=tid,
            input=turn_input,
            user_id=user_id,
            assistant_message_id=assistant_message_id,
            agent_type=agent_type,
            system_prompt=system_prompt,
            backend=kwargs.get("backend"),
            model=kwargs.get("model"),
        )

        async for event in self.runtime.stream(turn):
            yield event
