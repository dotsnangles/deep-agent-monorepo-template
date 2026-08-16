import logging
from collections.abc import AsyncIterator
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langgraph.checkpoint.base import BaseCheckpointSaver

from src.core.config import get_llm
from src.core.observability import get_langfuse_callback
from src.core.redis import RedisEventBroker, RedisStreamingCallbackHandler
from src.graphs.chat.prompts import MAIN_SYSTEM_PROMPT
from src.graphs.registry import GraphRegistry, global_graph_registry
from src.schemas.events import AgentStreamEvent

logger = logging.getLogger(__name__)

ROLE_MAP = {
    "user": HumanMessage,
    "human": HumanMessage,
    "assistant": AIMessage,
    "ai": AIMessage,
    "system": SystemMessage,
}


def _normalize_messages(
    messages: list[BaseMessage | dict[str, Any]],
    system_prompt: str | None = None,
) -> list[BaseMessage]:
    """Converts mixed dicts/BaseMessages into BaseMessages with effective system prompt."""
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
            content = str(msg.get("content", ""))
            cls = ROLE_MAP.get(role, HumanMessage)
            if cls is SystemMessage:
                has_system = True
                normalized.append(SystemMessage(content=effective_system))
            else:
                normalized.append(cls(content=content))

    if not has_system:
        normalized.insert(0, SystemMessage(content=effective_system))

    return normalized


class AgentExecutionGateway:
    """Deep domain execution facade orchestrating graph resolution and SSE event streaming."""

    def __init__(
        self,
        registry: GraphRegistry | None = None,
        checkpointer: BaseCheckpointSaver | None = None,
        store: Any = None,
        model: Any = None,
        event_broker: RedisEventBroker | None = None,
    ):
        self.registry = registry or global_graph_registry
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
        messages: list[BaseMessage | dict[str, Any]],
        thread_id: str | None = None,
        agent_type: str = "default",
        model: Any = None,
        system_prompt: str | None = None,
        config: dict[str, Any] | None = None,
    ) -> AsyncIterator[AgentStreamEvent]:
        """Streams structured AgentStreamEvents for the given conversation messages."""
        lc_messages = _normalize_messages(messages, system_prompt=system_prompt)
        effective_model = model or self.default_model or get_llm()
        effective_thread_id = thread_id or "default"
        callbacks = self._build_callbacks(thread_id)

        stream_config: dict[str, Any] = {
            "callbacks": callbacks,
            "metadata": {
                "langfuse_session_id": effective_thread_id,
                "langfuse_trace_name": f"Hollow Echo Stream ({agent_type})",
            },
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

                # Check if graph has astream_events capability
                if hasattr(graph, "astream_events"):
                    total_tokens = 0
                    async for event in graph.astream_events(
                        {"messages": lc_messages},
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
                            # Check for tool calls on completed model step
                            output = event.get("data", {}).get("output")
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
                            yield AgentStreamEvent.node_transition(node=event.get("name", "node"))

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
