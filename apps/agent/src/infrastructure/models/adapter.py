from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from src.domain.ports import ModelChunk, ModelProviderPort, ToolDefinition
from src.runtime.types import ChatMessage


class FakeChatModelAdapter(ModelProviderPort):
    """Deterministic in-memory fake model adapter for fast unit testing."""

    def __init__(
        self,
        scripted_tokens: list[str] | None = None,
        scripted_tool_calls: list[dict[str, Any]] | None = None,
    ):
        self.scripted_tokens = scripted_tokens or ["Fake", " model", " response."]
        self.scripted_tool_calls = scripted_tool_calls or []

    async def generate_stream(
        self,
        messages: list[ChatMessage],
        system_prompt: str,
        tools: list[ToolDefinition] | None = None,
        config: dict[str, Any] | None = None,
    ) -> AsyncIterator[ModelChunk]:
        for tok in self.scripted_tokens:
            yield ModelChunk(token=tok)

        if self.scripted_tool_calls:
            yield ModelChunk(tool_calls=self.scripted_tool_calls)

        yield ModelChunk(finish_reason="stop")


class LangChainModelAdapter(ModelProviderPort):
    """Production model provider wrapping LangChain chat models."""

    def __init__(self, llm: Any = None):
        self.llm = llm

    def _get_llm(self) -> Any:
        if self.llm is not None:
            return self.llm
        from src.infrastructure.config import get_llm

        return get_llm()

    async def generate_stream(
        self,
        messages: list[ChatMessage],
        system_prompt: str,
        tools: list[ToolDefinition] | None = None,
        config: dict[str, Any] | None = None,
    ) -> AsyncIterator[ModelChunk]:
        from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

        model = self._get_llm()
        lc_messages = [SystemMessage(content=system_prompt)]
        for m in messages:
            if m.role == "user":
                lc_messages.append(HumanMessage(content=m.content))
            elif m.role == "assistant":
                lc_messages.append(AIMessage(content=m.content))

        async for chunk in model.astream(lc_messages, config=config):
            content = getattr(chunk, "content", "")
            tool_chunks = getattr(chunk, "tool_call_chunks", None) or []
            tool_calls = [
                {"name": tc.get("name"), "args": tc.get("args"), "id": tc.get("id")}
                for tc in tool_chunks
            ]
            yield ModelChunk(
                token=content if isinstance(content, str) and content else None,
                tool_calls=tool_calls,
            )
