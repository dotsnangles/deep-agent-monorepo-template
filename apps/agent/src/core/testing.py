import json
from collections.abc import AsyncIterator, Iterator, Sequence
from typing import Any

from langchain_core.callbacks import AsyncCallbackManagerForLLMRun, CallbackManagerForLLMRun
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, AIMessageChunk, BaseMessage
from langchain_core.messages.tool import ToolCallChunk
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult
from langchain_core.tools import BaseTool


class FakeChatModel(BaseChatModel):
    """Deterministic in-memory Fake Chat Model for offline, zero-cost testing."""

    responses: list[str] = ["안녕하세요! 무엇을 도와드릴까요?"]
    tokens: list[str] | None = None
    tool_calls: list[dict[str, Any]] | None = None
    bound_tools: list[Any] = []
    _idx: int = 0

    @property
    def _llm_type(self) -> str:
        return "fake-chat-model"

    def bind_tools(
        self,
        tools: Sequence[dict[str, Any] | type | BaseTool | Any],
        **kwargs: Any,
    ) -> "FakeChatModel":
        """Simulates binding tools to the model."""
        return FakeChatModel(
            responses=self.responses,
            tokens=self.tokens,
            tool_calls=self.tool_calls,
            bound_tools=list(tools),
        )

    def _get_tokens(self) -> list[str]:
        if self.tokens:
            return self.tokens
        full_text = self.responses[self._idx % len(self.responses)]
        self._idx += 1
        return [full_text[i : i + 4] for i in range(0, len(full_text), 4)]

    def _generate_tool_chunks(self) -> list[ChatGenerationChunk]:
        """Helper generating ToolCallChunk generation chunks from tool_calls."""
        chunks: list[ChatGenerationChunk] = []
        if self.tool_calls:
            for idx, tc in enumerate(self.tool_calls):
                args_val = tc.get("args", {})
                args_str = json.dumps(args_val) if isinstance(args_val, dict) else str(args_val)
                tc_chunk = ToolCallChunk(
                    name=tc.get("name"),
                    args=args_str,
                    id=tc.get("id", f"call_{idx}"),
                    index=idx,
                )
                chunks.append(
                    ChatGenerationChunk(
                        message=AIMessageChunk(content="", tool_call_chunks=[tc_chunk])
                    )
                )
        return chunks

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: CallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        response_text = self.responses[self._idx % len(self.responses)]
        self._idx += 1
        message = AIMessage(
            content=response_text,
            tool_calls=self.tool_calls or [],
        )
        generation = ChatGeneration(message=message)
        return ChatResult(generations=[generation])

    async def _agenerate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: AsyncCallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        return self._generate(messages, stop=stop, **kwargs)

    def _stream(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: CallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> Iterator[ChatGenerationChunk]:
        tool_chunks = self._generate_tool_chunks()
        if tool_chunks:
            for chunk in tool_chunks:
                yield chunk
            return

        for token in self._get_tokens():
            chunk = ChatGenerationChunk(message=AIMessageChunk(content=token))
            if run_manager:
                run_manager.on_llm_new_token(token, chunk=chunk)
            yield chunk

    async def _astream(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: AsyncCallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[ChatGenerationChunk]:
        tool_chunks = self._generate_tool_chunks()
        if tool_chunks:
            for chunk in tool_chunks:
                yield chunk
            return

        for token in self._get_tokens():
            chunk = ChatGenerationChunk(message=AIMessageChunk(content=token))
            if run_manager:
                await run_manager.on_llm_new_token(token, chunk=chunk)
            yield chunk
