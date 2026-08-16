import logging
from collections.abc import AsyncIterator
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.types import Command

from src.core.config import get_llm
from src.core.observability import get_langfuse_callback
from src.core.redis import RedisEventBroker, RedisStreamingCallbackHandler
from src.graphs.chat.prompts import MAIN_SYSTEM_PROMPT
from src.schemas import AgentStreamEvent, AttachmentInput

logger = logging.getLogger(__name__)

ROLE_MAP = {
    "user": HumanMessage,
    "human": HumanMessage,
    "assistant": AIMessage,
    "ai": AIMessage,
    "system": SystemMessage,
}


def _is_image_attachment(att: AttachmentInput) -> bool:
    return att.mime_type.lower().startswith("image/")


def _format_document_attachments(docs: list[AttachmentInput]) -> str:
    sections = [
        f"- **{doc.name}** ({doc.mime_type}, {doc.size} bytes): [Download/View Document]({doc.url})"
        for doc in docs
    ]
    return "\n[Attached Documents]\n" + "\n".join(sections)


def _build_multimodal_content(
    text_content: str,
    images: list[AttachmentInput],
) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    if text_content:
        blocks.append({"type": "text", "text": text_content})
    for img in images:
        blocks.append(
            {
                "type": "image_url",
                "image_url": {"url": img.url},
            }
        )
    return blocks


def _normalize_messages(
    messages: list[BaseMessage | dict[str, Any]] | None,
    system_prompt: str | None = None,
) -> list[BaseMessage]:
    """Converts input messages into BaseMessages with system prompt and attachments."""
    if not messages:
        return [SystemMessage(content=system_prompt or MAIN_SYSTEM_PROMPT)]

    normalized: list[BaseMessage] = []
    has_system = False
    effective_system = system_prompt or MAIN_SYSTEM_PROMPT

    for msg in messages:
        if isinstance(msg, BaseMessage):
            if isinstance(msg, SystemMessage):
                has_system = True
                normalized.append(SystemMessage(content=effective_system))
            else:
                normalized.append(msg)
        elif isinstance(msg, dict):
            role = str(msg.get("role", "user")).lower()
            raw_content = str(msg.get("content", ""))
            attachments_raw = msg.get("attachments") or []

            parsed_attachments: list[AttachmentInput] = []
            for att in attachments_raw:
                if isinstance(att, AttachmentInput):
                    parsed_attachments.append(att)
                elif isinstance(att, dict):
                    parsed_attachments.append(AttachmentInput.model_validate(att))

            # Partition typed attachments into images and documents
            images = [att for att in parsed_attachments if _is_image_attachment(att)]
            docs = [att for att in parsed_attachments if not _is_image_attachment(att)]

            text_content = raw_content
            if docs:
                doc_header = _format_document_attachments(docs)
                if text_content:
                    text_content = f"{text_content}\n\n{doc_header}"
                else:
                    text_content = doc_header.strip()

            cls = ROLE_MAP.get(role, HumanMessage)
            if cls is SystemMessage:
                has_system = True
                normalized.append(SystemMessage(content=effective_system))
            else:
                if images:
                    content_blocks = _build_multimodal_content(text_content, images)
                    normalized.append(cls(content=content_blocks))
                else:
                    normalized.append(cls(content=text_content))

    if not has_system:
        normalized.insert(0, SystemMessage(content=effective_system))

    return normalized


def _extract_user_prompt_info(
    messages: list[BaseMessage | dict[str, Any]] | None,
) -> tuple[str, bool, int]:
    """Extracts latest user prompt snippet, multimodal attachment presence, and turn count."""
    if not messages:
        return "", False, 0

    user_msgs: list[str] = []
    has_attachments = False

    for msg in messages:
        content = ""
        atts: list[Any] = []
        is_user = False

        if isinstance(msg, dict):
            role = str(msg.get("role", "")).lower()
            if role in ("user", "human"):
                is_user = True
                content = str(msg.get("content", ""))
                atts = msg.get("attachments") or []
        elif isinstance(msg, HumanMessage):
            is_user = True
            raw_content = msg.content
            if isinstance(raw_content, str):
                content = raw_content
            elif isinstance(raw_content, list):
                text_parts = [
                    b.get("text", "")
                    for b in raw_content
                    if isinstance(b, dict) and b.get("type") == "text"
                ]
                content = " ".join(text_parts)
                has_attachments = any(
                    isinstance(b, dict) and b.get("type") == "image_url" for b in raw_content
                )

        if is_user:
            user_msgs.append(content.strip())
            if atts:
                has_attachments = True

    latest_prompt = user_msgs[-1] if user_msgs else ""
    turn_index = len(user_msgs)
    return latest_prompt, has_attachments, turn_index


def _build_trace_metadata(
    messages: list[BaseMessage | dict[str, Any]] | None,
    agent_type: str = "default",
    thread_id: str | None = None,
) -> dict[str, Any]:
    """Constructs enriched Langfuse trace metadata with turn names, active path stats, and tags."""
    latest_prompt, has_attachments, turn_index = _extract_user_prompt_info(messages)
    effective_thread_id = thread_id or "default"

    # Truncate trace name if prompt is too long
    if latest_prompt:
        clean_snippet = latest_prompt.replace("\n", " ").strip()
        if len(clean_snippet) > 35:
            snippet = f"{clean_snippet[:35]}..."
        else:
            snippet = clean_snippet
        trace_name = f"💬 {snippet}"
    else:
        trace_name = f"Hollow Echo Stream ({agent_type})"

    tags = ["chat", "streaming", f"agent:{agent_type}"]
    if has_attachments:
        tags.append("multimodal")

    metadata: dict[str, Any] = {
        "langfuse_session_id": effective_thread_id,
        "langfuse_trace_name": trace_name,
        "langfuse_tags": tags,
        "user_prompt": latest_prompt,
        "active_path_length": len(messages) if messages else 0,
        "turn_index": turn_index,
    }
    if has_attachments:
        metadata["has_attachments"] = True

    return metadata


def _extract_interrupt_events(graph_state: Any) -> list[AgentStreamEvent]:
    """Encapsulates extraction of approval_request events from LangGraph state."""
    events: list[AgentStreamEvent] = []
    if not graph_state or not getattr(graph_state, "tasks", None):
        return events

    for task in graph_state.tasks:
        if task.interrupts:
            for interrupt_item in task.interrupts:
                val = interrupt_item.value
                if isinstance(val, dict):
                    events.append(
                        AgentStreamEvent.approval_request(
                            tool=val.get("tool", "tool"),
                            tool_input=val.get("input", {}),
                            tool_call_id=val.get("tool_call_id", ""),
                            description=val.get("description"),
                        )
                    )
    return events


class AgentExecutionGateway:
    """Deep domain execution facade orchestrating graph resolution, HITL, and SSE streaming."""

    def __init__(
        self,
        registry: Any = None,
        checkpointer: BaseCheckpointSaver | None = None,
        store: Any = None,
        model: Any = None,
        event_broker: RedisEventBroker | None = None,
    ):
        if registry is None:
            from src.graphs.registry import global_graph_registry

            self.registry = global_graph_registry
        else:
            self.registry = registry

        self.checkpointer = checkpointer
        self.store = store
        self.default_model = model
        self.event_broker = event_broker

    def _build_callbacks(self, thread_id: str | None) -> list[Any]:
        callbacks: list[Any] = []
        lf_callback = get_langfuse_callback()
        if lf_callback:
            callbacks.append(lf_callback)

        if self.event_broker and self.event_broker.is_connected() and thread_id:
            callbacks.append(RedisStreamingCallbackHandler(self.event_broker, thread_id))

        return callbacks

    async def stream_execution(
        self,
        messages: list[BaseMessage | dict[str, Any]] | None = None,
        thread_id: str | None = None,
        agent_type: str = "default",
        model: Any = None,
        system_prompt: str | None = None,
        config: dict[str, Any] | None = None,
        resume_action: dict[str, Any] | None = None,
    ) -> AsyncIterator[AgentStreamEvent]:
        """Streams structured AgentStreamEvents with Human-In-The-Loop interrupt support."""
        lc_messages = _normalize_messages(messages, system_prompt=system_prompt)
        effective_model = model or self.default_model or get_llm()
        effective_thread_id = thread_id or "default"
        callbacks = self._build_callbacks(thread_id)

        trace_meta = _build_trace_metadata(
            messages,
            agent_type=agent_type,
            thread_id=effective_thread_id,
        )
        stream_config: dict[str, Any] = {
            "callbacks": callbacks,
            "metadata": trace_meta,
            "configurable": {
                "thread_id": effective_thread_id,
            },
        }
        if config:
            stream_config.update(config)

        try:
            # Check if a compilable LangGraph workflow is available in the registry
            if agent_type != "direct" and self.registry.has_graph(agent_type):
                graph = self.registry.get_graph(
                    agent_type=agent_type,
                    checkpointer=self.checkpointer,
                    store=self.store,
                    model=effective_model,
                )

                # Determine graph input: Command(resume=...) for HITL resume or initial input
                if resume_action is not None:
                    graph_input = Command(resume=resume_action)
                else:
                    graph_input = {"messages": lc_messages}

                # Check if graph has astream_events capability
                if hasattr(graph, "astream_events"):
                    total_tokens = 0
                    try:
                        async for event in graph.astream_events(
                            graph_input,
                            config=stream_config,
                            version="v2",
                        ):
                            kind = event.get("event")
                            if kind == "on_chat_model_stream":
                                chunk = event.get("data", {}).get("chunk")
                                content = getattr(chunk, "content", "")
                                if content and isinstance(content, str):
                                    total_tokens += len(content)
                                    yield AgentStreamEvent.token(content=content)
                            elif kind == "on_chat_model_end":
                                output = event.get("data", {}).get("output")
                                # Non-streaming fallback if model did not emit token stream events
                                end_content = getattr(output, "content", "")
                                if (
                                    end_content
                                    and isinstance(end_content, str)
                                    and total_tokens == 0
                                ):
                                    total_tokens += len(end_content)
                                    yield AgentStreamEvent.token(content=end_content)

                                tool_calls = getattr(output, "tool_calls", None) or []
                                for tc in tool_calls:
                                    yield AgentStreamEvent.tool_start(
                                        tool=tc.get("name", "tool"),
                                        tool_input=tc.get("args", {}),
                                        run_id=tc.get("id"),
                                    )
                            elif kind == "on_tool_start":
                                yield AgentStreamEvent.tool_start(
                                    tool=event.get("name", "tool"),
                                    tool_input=event.get("data", {}).get("input"),
                                    run_id=event.get("run_id"),
                                )
                            elif kind == "on_tool_end":
                                yield AgentStreamEvent.tool_end(
                                    tool=event.get("name", "tool"),
                                    output=event.get("data", {}).get("output"),
                                    run_id=event.get("run_id"),
                                )
                            elif kind == "on_chain_start" and event.get("name") in (
                                "agent",
                                "tools",
                                "generate",
                            ):
                                yield AgentStreamEvent.node_transition(
                                    node=event.get("name", "node")
                                )
                    except Exception as stream_err:
                        logger.error(
                            "Stream execution error for thread %s: %s",
                            effective_thread_id,
                            stream_err,
                        )
                        yield AgentStreamEvent.error(message=str(stream_err), code="STREAM_FAILED")
                        return

                    # After stream finishes, check if graph entered an interrupted state
                    if hasattr(graph, "aget_state"):
                        graph_state = await graph.aget_state(stream_config)
                        interrupt_events = _extract_interrupt_events(graph_state)
                        if interrupt_events:
                            for ie in interrupt_events:
                                yield ie
                            yield AgentStreamEvent.done(
                                finish_reason="interrupt",
                                metadata={
                                    "total_chars": total_tokens,
                                    "thread_id": effective_thread_id,
                                    "interrupted": True,
                                },
                            )
                            return

                    yield AgentStreamEvent.done(
                        finish_reason="stop",
                        metadata={"total_chars": total_tokens, "thread_id": effective_thread_id},
                    )
                    return

            # Direct Model Stream Fallback
            total_tokens = 0
            async for chunk in effective_model.astream(lc_messages, config=stream_config):
                content = chunk.content if hasattr(chunk, "content") else str(chunk)
                if content:
                    total_tokens += len(content)
                    yield AgentStreamEvent.token(content=content)

                tool_chunks = getattr(chunk, "tool_call_chunks", None)
                if tool_chunks:
                    for tc in tool_chunks:
                        yield AgentStreamEvent.tool_start(
                            tool=tc.get("name", "tool"),
                            tool_input=tc.get("args", {}),
                            run_id=tc.get("id"),
                        )

            yield AgentStreamEvent.done(
                finish_reason="stop",
                metadata={"total_chars": total_tokens, "thread_id": effective_thread_id},
            )
        except Exception as e:
            logger.error("Stream execution failed for thread %s: %s", effective_thread_id, e)
            yield AgentStreamEvent.error(message=str(e), code="EXECUTION_FAILED")
