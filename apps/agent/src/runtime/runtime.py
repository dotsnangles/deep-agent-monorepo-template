from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    HumanMessage,
    RemoveMessage,
    SystemMessage,
    ToolMessage,
)
from langgraph.types import Command

from src.domain.ports import (
    AgentExecutionPort,
    ArtifactDescriptor,
    FileDescriptor,
    ModelProviderPort,
    PersistencePort,
    SandboxExecutionPort,
    StoragePort,
)
from src.runtime.events import AgentStreamEvent, StreamEventType
from src.runtime.types import (
    AgentStateSnapshot,
    AgentTurn,
    ApprovalDecision,
    Attachment,
    ChatMessage,
)

logger = logging.getLogger(__name__)


def _is_image_attachment(att: Any) -> bool:
    mime = (
        att.get("mime_type", att.get("mimeType", ""))
        if isinstance(att, dict)
        else getattr(att, "mime_type", getattr(att, "mimeType", ""))
    )
    return str(mime).lower().startswith("image/")


def _format_document_attachments(docs: list[Any]) -> str:
    sections = []
    for doc in docs:
        name = (
            doc.get("name", "document")
            if isinstance(doc, dict)
            else getattr(doc, "name", "document")
        )
        mime = (
            doc.get("mime_type", doc.get("mimeType", "application/octet-stream"))
            if isinstance(doc, dict)
            else getattr(doc, "mime_type", getattr(doc, "mimeType", "application/octet-stream"))
        )
        size = (
            doc.get("size", doc.get("size_bytes", 0))
            if isinstance(doc, dict)
            else getattr(doc, "size_bytes", getattr(doc, "size", 0))
        )
        url = doc.get("url", "") if isinstance(doc, dict) else getattr(doc, "url", "")
        sections.append(
            f"- **{name}** ({mime}, {size} bytes): [Download/View Document]({url})"
        )
    return "\n[Attached Documents]\n" + "\n".join(sections)


def _build_multimodal_content(
    text_content: str, images: list[Any]
) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    if text_content:
        blocks.append({"type": "text", "text": text_content})
    for img in images:
        url = img.get("url", "") if isinstance(img, dict) else getattr(img, "url", "")
        blocks.append(
            {
                "type": "image_url",
                "image_url": {"url": url},
            }
        )
    return blocks


def _normalize_turn_messages(
    turn_input: str | list[Any] | ApprovalDecision,
    system_prompt: str | None = None,
) -> list[BaseMessage]:
    from src.graphs.chat.prompts import MAIN_SYSTEM_PROMPT

    effective_sys = system_prompt or MAIN_SYSTEM_PROMPT

    if isinstance(turn_input, ApprovalDecision):
        return [SystemMessage(content=effective_sys)]

    if isinstance(turn_input, str):
        return [
            SystemMessage(content=effective_sys),
            HumanMessage(content=turn_input),
        ]

    normalized: list[BaseMessage] = []
    has_system = False

    for msg in turn_input:
        if isinstance(msg, BaseMessage):
            if isinstance(msg, SystemMessage):
                has_system = True
            normalized.append(msg)
            continue

        role = msg.get("role", "") if isinstance(msg, dict) else getattr(msg, "role", "")
        content = msg.get("content", "") if isinstance(msg, dict) else getattr(msg, "content", "")
        attachments = (
            msg.get("attachments", [])
            if isinstance(msg, dict)
            else getattr(msg, "attachments", [])
        )

        if role in ("system", "SystemMessage"):
            has_system = True
            normalized.append(SystemMessage(content=content or effective_sys))
        elif role in ("assistant", "AIMessage"):
            normalized.append(AIMessage(content=content))
        else:
            images = [att for att in attachments if _is_image_attachment(att)]
            docs = [att for att in attachments if not _is_image_attachment(att)]
            text = content
            if docs:
                doc_text = _format_document_attachments(docs)
                text = f"{text}\n\n{doc_text}" if text else doc_text

            if images:
                content_blocks = _build_multimodal_content(text, images)
                normalized.append(HumanMessage(content=content_blocks))
            else:
                normalized.append(HumanMessage(content=text))

    if not has_system:
        normalized.insert(0, SystemMessage(content=effective_sys))

    return normalized


def _build_trace_metadata(
    messages: list[Any],
    agent_type: str,
    thread_id: str,
    user_id: str | None = None,
    turn_index: int = 1,
    environment: str | None = None,
) -> dict[str, Any]:
    """Constructs enriched trace metadata for Langfuse and observability."""
    user_prompt = ""
    has_attachments = False

    if isinstance(messages, str):
        user_prompt = messages
    elif isinstance(messages, list):
        for msg in reversed(messages):
            role = msg.get("role") if isinstance(msg, dict) else getattr(msg, "role", getattr(msg, "type", ""))
            if role in ("user", "human"):
                content = msg.get("content") if isinstance(msg, dict) else getattr(msg, "content", "")
                if isinstance(content, str):
                    user_prompt = content
                elif isinstance(content, list):
                    text_parts = [
                        p.get("text", "")
                        for p in content
                        if isinstance(p, dict) and p.get("type") == "text"
                    ]
                    user_prompt = " ".join(text_parts)
                atts = msg.get("attachments") if isinstance(msg, dict) else getattr(msg, "attachments", [])
                if atts:
                    has_attachments = True
                break

    snippet = user_prompt.strip()
    if len(snippet) > 30:
        snippet = snippet[:30] + "..."

    user_msg_count = 0
    if isinstance(messages, list):
        user_msg_count = sum(
            1
            for m in messages
            if (m.get("role") if isinstance(m, dict) else getattr(m, "role", getattr(m, "type", "")))
            in ("user", "human")
        )
    effective_turn = max(turn_index, user_msg_count) if user_msg_count > 0 else turn_index

    trace_name = f"[Turn {effective_turn}] {snippet}" if snippet else f"[Turn {effective_turn}]"

    tags = ["chat", "streaming", f"agent:{agent_type}"]
    if environment:
        tags.append(f"env:{environment}")
    if has_attachments:
        tags.append("multimodal")

    return {
        "langfuse_session_id": thread_id,
        "langfuse_user_id": user_id,
        "langfuse_trace_name": trace_name,
        "langfuse_tags": tags,
        "user_prompt": user_prompt,
        "active_path_length": len(messages) if isinstance(messages, list) else 1,
        "turn_index": effective_turn,
        "has_attachments": has_attachments,
    }


def _extract_interrupt_events(graph_state: Any) -> list[AgentStreamEvent]:
    events: list[AgentStreamEvent] = []
    if not graph_state or not getattr(graph_state, "tasks", None):
        return events

    pending_tool_calls = []
    if hasattr(graph_state, "values") and isinstance(graph_state.values, dict):
        messages = graph_state.values.get("messages", [])
        if messages and hasattr(messages[-1], "tool_calls"):
            pending_tool_calls = messages[-1].tool_calls or []

    for task in graph_state.tasks:
        interrupts = getattr(task, "interrupts", [])
        for intr in interrupts:
            val = getattr(intr, "value", intr)
            if isinstance(val, dict) and "action_requests" in val:
                for req in val.get("action_requests", []):
                    tool_name = req.get("name", "unknown_tool")
                    tool_args = req.get("args", {})
                    matched_id = req.get("id") or req.get("tool_call_id")
                    if not matched_id and pending_tool_calls:
                        for tc in pending_tool_calls:
                            if tc.get("name") == tool_name and tc.get("args") == tool_args:
                                matched_id = tc.get("id")
                                break
                        if not matched_id and len(pending_tool_calls) == 1:
                            matched_id = pending_tool_calls[0].get("id")

                    events.append(
                        AgentStreamEvent.approval_request(
                            tool=tool_name,
                            tool_input=tool_args,
                            tool_call_id=matched_id or getattr(task, "id", "call_unknown"),
                            description=req.get(
                                "description",
                                f"Action '{tool_name}' requires authorization before execution.",
                            ),
                        )
                    )
            elif isinstance(val, dict) and ("tool" in val or "input" in val):
                events.append(
                    AgentStreamEvent.approval_request(
                        tool=val.get("tool", "unknown_tool"),
                        tool_input=val.get("input", val.get("args", {})),
                        tool_call_id=val.get("tool_call_id") or getattr(task, "id", "call_unknown"),
                        description=val.get(
                            "description",
                            f"Action '{val.get('tool')}' requires authorization before execution.",
                        ),
                    )
                )
    return events


class AgentRuntime(AgentExecutionPort):
    """Deep Execution Engine orchestrating AI graphs, sandboxes, persistence, and event streaming."""

    _semaphores: dict[int, asyncio.Semaphore] = {}

    def __init__(
        self,
        persistence: PersistencePort,
        sandbox: SandboxExecutionPort,
        storage: StoragePort,
        model: Any = None,
        event_broker: RedisEventBroker | None = None,
        registry: Any = None,
        concurrency_limit: int | None = None,
    ):
        self.persistence = persistence
        self.sandbox = sandbox
        self.storage = storage
        self.model = model
        self.event_broker = event_broker
        self.registry = registry
        if concurrency_limit is not None:
            self.concurrency_limit = concurrency_limit
        else:
            from src.infrastructure.config import get_inference_concurrency_limit

            self.concurrency_limit = get_inference_concurrency_limit()

    @property
    def checkpointer(self) -> Any:
        return getattr(self.persistence, "checkpointer", None)

    @checkpointer.setter
    def checkpointer(self, value: Any) -> None:
        if hasattr(self.persistence, "checkpointer"):
            self.persistence.checkpointer = value

    @property
    def store(self) -> Any:
        return getattr(self.persistence, "store", None)

    @store.setter
    def store(self, value: Any) -> None:
        if hasattr(self.persistence, "store"):
            self.persistence.store = value

    @property
    def default_model(self) -> Any:
        return self.model

    @default_model.setter
    def default_model(self, value: Any) -> None:
        self.model = value

    @classmethod
    def create_in_memory(
        cls,
        model: Any = None,
        workspace_dir: Path | str = "./workspace/sessions",
        registry: Any = None,
        concurrency_limit: int | None = None,
        checkpointer: Any = None,
        store: Any = None,
    ) -> AgentRuntime:
        """Factory for 100% in-memory hermetic testing."""
        from src.infrastructure import (
            FakeChatModelAdapter,
            InMemoryPersistenceAdapter,
            InMemoryStorageAdapter,
            InProcessSandboxAdapter,
        )

        return cls(
            persistence=InMemoryPersistenceAdapter(checkpointer=checkpointer, store=store),
            sandbox=InProcessSandboxAdapter(root_dir=workspace_dir),
            storage=InMemoryStorageAdapter(),
            model=model or FakeChatModelAdapter(),
            event_broker=None,
            registry=registry,
            concurrency_limit=concurrency_limit,
        )

    @classmethod
    async def create_production(
        cls,
        db_url: str | None = None,
        bucket_name: str | None = None,
        container_name: str = "agent-sandbox-runner",
        redis_url: str | None = None,
        model: Any = None,
    ) -> AgentRuntime:
        """Factory for production deployment with PostgreSQL, Docker, S3, and Redis."""
        import redis.asyncio as aioredis
        from src.infrastructure import (
            DockerSandboxAdapter,
            InMemoryPersistenceAdapter,
            PostgresPersistenceAdapter,
            RedisEventBroker,
            S3StorageAdapter,
            get_llm,
        )

        # 1. Persistence Adapter
        try:
            persistence = await PostgresPersistenceAdapter.create(db_url=db_url)
        except Exception as e:
            logger.warning("PostgresPersistenceAdapter fallback to in-memory: %s", e)
            persistence = InMemoryPersistenceAdapter()

        # 2. Sandbox Adapter
        sandbox = DockerSandboxAdapter(container_name=container_name)

        # 3. Storage Adapter
        db_pool = getattr(persistence, "pool", None)
        storage = S3StorageAdapter(bucket_name=bucket_name, db_pool=db_pool)

        # 4. Redis Event Broker
        broker = None
        if redis_url:
            try:
                r = aioredis.from_url(redis_url, decode_responses=True)
                await r.ping()
                broker = RedisEventBroker(r)
            except Exception as e:
                logger.warning("RedisEventBroker init failed: %s", e)

        return cls(
            persistence=persistence,
            sandbox=sandbox,
            storage=storage,
            model=model or get_llm(),
            event_broker=broker,
        )

    def _get_semaphore(self) -> asyncio.Semaphore | None:
        if self.concurrency_limit is None or self.concurrency_limit <= 0:
            return None
        if self.concurrency_limit not in self._semaphores:
            self._semaphores[self.concurrency_limit] = asyncio.Semaphore(self.concurrency_limit)
        return self._semaphores[self.concurrency_limit]

    async def stream_execution(
        self,
        request_or_thread_id: AgentTurn | str | None = None,
        messages: list[Any] | None = None,
        system_prompt: str | None = None,
        turn_index: int = 1,
        agent_type: str = "default",
        user_id: str | None = None,
        assistant_message_id: str | None = None,
        resume: Any = None,
        resume_action: Any = None,
        backend: str | None = None,
        model: Any = None,
        thread_id: str | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[AgentStreamEvent]:
        """Convenience stream method accepting either AgentTurn or positional/keyword arguments."""
        if isinstance(request_or_thread_id, AgentTurn):
            turn = request_or_thread_id
        else:
            eff_thread_id = thread_id or (
                request_or_thread_id if isinstance(request_or_thread_id, str) else "default"
            )
            eff_resume = resume if resume is not None else resume_action
            turn = AgentTurn(
                thread_id=eff_thread_id,
                input=messages or [],
                system_prompt=system_prompt,
                agent_type=agent_type,
                turn_index=turn_index,
                user_id=user_id,
                assistant_message_id=assistant_message_id,
                resume=eff_resume,
                backend=backend,
                model=model,
            )
        async for event in self.stream(turn):
            yield event

    async def stream(self, turn: AgentTurn) -> AsyncIterator[AgentStreamEvent]:
        """Main execution stream generator with concurrency lock and lifecycle guarantees."""
        from contextlib import nullcontext

        semaphore = self._get_semaphore()
        lock_ctx = semaphore if semaphore is not None else nullcontext()

        async with lock_ctx:
            async for event in self._stream_inner(turn):
                yield event

    async def _stream_inner(self, turn: AgentTurn) -> AsyncIterator[AgentStreamEvent]:
        from src.graphs.chat.factory import DeepAgentEnvironmentFactory
        from src.graphs.chat.prompts import MAIN_SYSTEM_PROMPT
        from src.infrastructure import (
            FakeChatModelAdapter,
            RedisStreamingCallbackHandler,
            get_langfuse_callback,
            get_llm,
        )

        thread_id = turn.thread_id
        lc_messages = _normalize_turn_messages(turn.input, system_prompt=turn.system_prompt)
        effective_model = turn.model or self.model or get_llm()

        # If model is FakeChatModelAdapter, run lightweight fake stream directly
        if isinstance(effective_model, FakeChatModelAdapter):
            yield AgentStreamEvent.node_transition(
                node="agent_entry",
                state_summary={"thread_id": thread_id, "agent_type": turn.agent_type},
            )
            total_tokens = 0
            async for chunk in effective_model.generate_stream(
                messages=[ChatMessage(role="user", content="msg")],
                system_prompt=turn.system_prompt or MAIN_SYSTEM_PROMPT,
            ):
                if chunk.token:
                    total_tokens += len(chunk.token)
                    yield AgentStreamEvent.token(chunk.token)

            # Sync artifacts
            await self._sync_and_emit_artifacts(thread_id, turn.assistant_message_id)
            async for art_ev in self._emit_artifact_events(thread_id, turn.assistant_message_id):
                yield art_ev

            yield AgentStreamEvent.done(
                finish_reason="stop",
                metadata={"total_chars": total_tokens, "thread_id": thread_id},
            )
            return

        if turn.agent_type == "direct" and hasattr(effective_model, "astream"):
            total_tokens = 0
            direct_config = {"configurable": {"thread_id": thread_id}}
            try:
                async for chunk in effective_model.astream(lc_messages, config=direct_config):
                    # Check for tool call chunks
                    if hasattr(chunk, "tool_call_chunks") and chunk.tool_call_chunks:
                        for tc_chunk in chunk.tool_call_chunks:
                            name = tc_chunk.get("name") if isinstance(tc_chunk, dict) else getattr(tc_chunk, "name", None)
                            args = tc_chunk.get("args") if isinstance(tc_chunk, dict) else getattr(tc_chunk, "args", {})
                            tc_id = tc_chunk.get("id") if isinstance(tc_chunk, dict) else getattr(tc_chunk, "id", None)
                            if name:
                                yield AgentStreamEvent.tool_start(
                                    tool=name,
                                    tool_input=args,
                                    run_id=tc_id,
                                )
                    elif hasattr(chunk, "tool_calls") and chunk.tool_calls:
                        for tc in chunk.tool_calls:
                            yield AgentStreamEvent.tool_start(
                                tool=tc.get("name", ""),
                                tool_input=tc.get("args", {}),
                                run_id=tc.get("id"),
                            )
                    content = chunk.content if hasattr(chunk, "content") else str(chunk)
                    if content:
                        total_tokens += len(content)
                        yield AgentStreamEvent.token(content)
                yield AgentStreamEvent.done(
                    finish_reason="stop",
                    metadata={"total_chars": total_tokens, "thread_id": thread_id},
                )
            except Exception as direct_err:
                yield AgentStreamEvent.error(
                    message=str(direct_err),
                    code="STREAM_FAILED",
                )
            return

        # 2. Compile LangGraph Agent via Factory
        checkpointer = getattr(self.persistence, "checkpointer", None)
        store = getattr(self.persistence, "store", None)

        callbacks = []
        lf_callback = get_langfuse_callback()
        if lf_callback:
            callbacks.append(lf_callback)
        if self.event_broker and self.event_broker.is_connected():
            callbacks.append(RedisStreamingCallbackHandler(self.event_broker, thread_id))

        stream_config: dict[str, Any] = {
            "configurable": {"thread_id": thread_id},
            "callbacks": callbacks,
            "metadata": {
                "langfuse_session_id": thread_id,
                "langfuse_trace_name": f"Agent Stream ({turn.agent_type})",
            },
            "recursion_limit": 100,
        }

        # Resolve Sandbox backend
        from src.graphs.chat.backends import get_session_backend

        backend = turn.backend or get_session_backend(thread_id)

        from src.graphs.registry import global_graph_registry
        reg = self.registry or global_graph_registry
        if hasattr(reg, "has_graph") and reg.has_graph(turn.agent_type):
            graph = reg.get_graph(
                agent_type=turn.agent_type,
                checkpointer=checkpointer,
                store=store,
                model=effective_model,
                system_prompt=turn.system_prompt,
                backend=backend,
            )
        else:
            graph = DeepAgentEnvironmentFactory.create_agent(
                checkpointer=checkpointer,
                store=store,
                model=effective_model,
                system_prompt=turn.system_prompt,
                backend=backend,
            )

        # Determine graph input: Command(resume=...) for HITL or initial messages
        if isinstance(turn.input, ApprovalDecision):
            decisions = (
                [{"type": "approve"}]
                if turn.input.approved
                else [{"type": "reject", "message": turn.input.feedback or "Rejected"}]
            )
            graph_input = Command(resume={"decisions": decisions})
        elif turn.resume is not None:
            if isinstance(turn.resume, dict):
                approved = turn.resume.get("approved", True)
                reason = turn.resume.get("reason", turn.resume.get("feedback", "Rejected"))
                tool_call_id = turn.resume.get("tool_call_id", turn.resume.get("toolCallId"))
                decisions = (
                    [{"type": "approve", "tool_call_id": tool_call_id}]
                    if approved
                    else [{"type": "reject", "message": reason, "tool_call_id": tool_call_id}]
                )
                graph_input = Command(resume={"decisions": decisions})
            else:
                graph_input = Command(resume=turn.resume)
        else:
            non_default_msgs = [
                m
                for m in lc_messages
                if not (isinstance(m, SystemMessage) and m.content == MAIN_SYSTEM_PROMPT)
            ]
            graph_input = {"messages": non_default_msgs if non_default_msgs else lc_messages}

            # Active path message deduplication
            if hasattr(graph, "aget_state") and hasattr(graph, "aupdate_state"):
                try:
                    curr_state = await graph.aget_state(stream_config)
                    if curr_state and curr_state.values and "messages" in curr_state.values:
                        existing = curr_state.values.get("messages", [])
                        if existing and len(non_default_msgs) > 1:
                            remove_ops = [
                                RemoveMessage(id=m.id)
                                for m in existing
                                if getattr(m, "id", None)
                            ]
                            if remove_ops:
                                await graph.aupdate_state(stream_config, {"messages": remove_ops})
                except Exception as sync_err:
                    logger.debug("Active path sync skipped: %s", sync_err)

        total_tokens = 0
        try:
            async for event in graph.astream_events(graph_input, config=stream_config, version="v2"):
                kind = event.get("event")
                if kind == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk")
                    content = getattr(chunk, "content", "")
                    if content and isinstance(content, str):
                        total_tokens += len(content)
                        yield AgentStreamEvent.token(content=content)
                elif kind == "on_chat_model_end":
                    output = event.get("data", {}).get("output")
                    end_content = getattr(output, "content", "")
                    if end_content and isinstance(end_content, str) and total_tokens == 0:
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
                    tool_name = event.get("name", "tool")
                    tool_input = event.get("data", {}).get("input")
                    if tool_name == "task" and isinstance(tool_input, dict):
                        yield AgentStreamEvent.subagent_start(
                            subagent=tool_input.get("subagent_type", "subagent"),
                            task=tool_input.get("description", ""),
                            run_id=event.get("run_id"),
                        )
                    elif tool_name == "write_todos" and isinstance(tool_input, dict):
                        todos = tool_input.get("todos")
                        if todos and isinstance(todos, list):
                            yield AgentStreamEvent.todo_update(todos=todos)

                    yield AgentStreamEvent.tool_start(
                        tool=tool_name,
                        tool_input=tool_input if isinstance(tool_input, dict) else {},
                        run_id=event.get("run_id"),
                    )
                elif kind == "on_tool_end":
                    tool_name = event.get("name", "tool")
                    tool_output = event.get("data", {}).get("output")
                    if tool_name == "task":
                        yield AgentStreamEvent.subagent_end(
                            subagent="subagent",
                            output=str(tool_output),
                            run_id=event.get("run_id"),
                        )
                    elif tool_name == "write_todos":
                        todos = (
                            getattr(tool_output, "update", {}).get("todos")
                            if hasattr(tool_output, "update")
                            else (
                                tool_output.get("todos")
                                if isinstance(tool_output, dict)
                                else None
                            )
                        )
                        if todos and isinstance(todos, list):
                            yield AgentStreamEvent.todo_update(todos=todos)

                    yield AgentStreamEvent.tool_end(
                        tool=tool_name,
                        output=tool_output,
                        run_id=event.get("run_id"),
                    )
                elif kind == "on_chain_start" and event.get("name") in ("agent", "tools", "generate"):
                    yield AgentStreamEvent.node_transition(node=event.get("name", "node"))
        except Exception as stream_err:
            logger.error("Stream execution error: %s", stream_err)
            yield AgentStreamEvent.error(message=str(stream_err), code="STREAM_FAILED")
            return

        # Check for HITL interrupts
        if hasattr(graph, "aget_state"):
            graph_state = await graph.aget_state(stream_config)
            interrupt_events = _extract_interrupt_events(graph_state)
            if interrupt_events:
                for ie in interrupt_events:
                    yield ie
                yield AgentStreamEvent.done(
                    finish_reason="interrupt",
                    metadata={"total_chars": total_tokens, "thread_id": thread_id, "interrupted": True},
                )
                return

        # Synchronize and emit artifacts
        async for art_ev in self._emit_artifact_events(thread_id, turn.assistant_message_id, backend=backend):
            yield art_ev

        yield AgentStreamEvent.done(
            finish_reason="stop",
            metadata={"total_chars": total_tokens, "thread_id": thread_id},
        )

    async def _sync_and_emit_artifacts(
        self, thread_id: str, message_id: str | None = None
    ) -> list[AgentStreamEvent]:
        events = []
        async for ev in self._emit_artifact_events(thread_id, message_id):
            events.append(ev)
        return events

    async def _emit_artifact_events(
        self, thread_id: str, message_id: str | None = None, backend: Any = None
    ) -> AsyncIterator[AgentStreamEvent]:
        from src.infrastructure import guess_mime_type, is_denied_path

        try:
            workspace_files: list[FileDescriptor] = []
            if backend and hasattr(backend, "root_dir"):
                root_path = Path(backend.root_dir)
                art_dir = root_path / "artifacts" if (root_path / "artifacts").exists() else root_path
                for p in art_dir.rglob("*"):
                    if p.is_file() and not is_denied_path(p.name) and (p.parent.name == "artifacts" or "artifacts" in str(p)):
                        data = p.read_bytes()
                        h = hashlib.sha256(data).hexdigest()
                        rel_path = str(p.relative_to(root_path)).replace("\\", "/")
                        workspace_files.append(
                            FileDescriptor(
                                path=rel_path,
                                size_bytes=len(data),
                                content_hash=h,
                                mime_type=guess_mime_type(p),
                            )
                        )
            if not workspace_files:
                workspace_files = await self.sandbox.list_workspace_artifacts(thread_id)
            if not workspace_files:
                return

            synced_hashes = await self.storage.get_synced_hashes(thread_id)

            for f in workspace_files:
                filename = Path(f.path).name
                prev_hash = synced_hashes.get(filename) or synced_hashes.get(f.path)
                if prev_hash == f.content_hash:
                    continue

                # Read bytes and upload
                if backend and hasattr(backend, "root_dir"):
                    target_p = Path(backend.root_dir) / f.path
                    data = target_p.read_bytes() if target_p.exists() else await self.sandbox.read_artifact_bytes(thread_id, f.path)
                else:
                    data = await self.sandbox.read_artifact_bytes(thread_id, f.path)

                storage_key = f"artifacts/sessions/{thread_id}/{message_id or 'default'}/{filename}"
                await self.storage.upload(storage_key, data, f.mime_type)

                download_url = await self.storage.generate_presigned_url(storage_key)
                art_id = str(uuid.uuid4())

                desc = ArtifactDescriptor(
                    id=art_id,
                    session_id=thread_id,
                    message_id=message_id,
                    name=filename,
                    download_url=download_url,
                    storage_key=storage_key,
                    mime_type=f.mime_type,
                    size_bytes=f.size_bytes,
                    content_hash=f.content_hash,
                )
                await self.storage.record_artifact_metadata(desc)

                yield AgentStreamEvent.artifact_created(
                    id=art_id,
                    session_id=thread_id,
                    message_id=message_id,
                    name=filename,
                    url=download_url,
                    storage_key=storage_key,
                    mime_type=f.mime_type,
                    size_bytes=f.size_bytes,
                )
        except Exception as e:
            logger.warning("Artifact emission skipped: %s", e)

    async def inspect(self, thread_id: str) -> AgentStateSnapshot:
        """Retrieves read-only state snapshot for a thread."""
        state = await self.persistence.get_state(thread_id)
        is_interrupted = bool(state and getattr(state, "next_nodes", None))

        pending_approvals: list[dict[str, Any]] = []
        if state and getattr(state, "tasks", None):
            for task in state.tasks:
                for interrupt in getattr(task, "interrupts", []):
                    val = getattr(interrupt, "value", None)
                    if isinstance(val, dict):
                        for req in val.get("action_requests", []):
                            pending_approvals.append(req)

        active_artifacts: list[str] = []
        try:
            art_files = await self.sandbox.list_workspace_artifacts(thread_id)
            active_artifacts = [f.path for f in art_files]
        except Exception:
            pass

        return AgentStateSnapshot(
            thread_id=thread_id,
            is_interrupted=is_interrupted,
            pending_tool_approvals=pending_approvals,
            turn_count=len(state.values.get("messages", [])) if state and state.values else 0,
            active_artifacts=active_artifacts,
        )

    async def _collect_events(self, turn: AgentTurn) -> list[AgentStreamEvent]:
        """Helper collecting all events from stream into a list."""
        events: list[AgentStreamEvent] = []
        async for event in self.stream(turn):
            events.append(event)
        return events
