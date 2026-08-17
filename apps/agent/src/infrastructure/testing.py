import json
from collections.abc import AsyncIterator, Iterator, Sequence
from typing import Any

from langchain_core.callbacks import AsyncCallbackManagerForLLMRun, CallbackManagerForLLMRun
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, AIMessageChunk, BaseMessage
from langchain_core.messages.tool import ToolCallChunk
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult
from langchain_core.tools import BaseTool
from pydantic import Field


class SharedTurnState:
    def __init__(self) -> None:
        self.turn_idx: int = 0
        self.bound_tools: list[Any] = []
        self.received_messages: list[list[BaseMessage]] = []


class FakeChatModel(BaseChatModel):
    """Deterministic in-memory Fake Chat Model for offline, zero-cost testing."""

    responses: list[str] = Field(default_factory=lambda: ["안녕하세요! 무엇을 도와드릴까요?"])
    tokens: list[str] | None = None
    tool_calls: list[dict[str, Any]] | None = None
    turn_sequence: list[dict[str, Any]] | None = None
    bound_tools: list[Any] = Field(default_factory=list)
    tracker: SharedTurnState = Field(default_factory=SharedTurnState)

    @property
    def _llm_type(self) -> str:
        return "fake-chat-model"

    @property
    def received_messages(self) -> list[list[BaseMessage]]:
        return self.tracker.received_messages

    @received_messages.setter
    def received_messages(self, val: list[list[BaseMessage]]) -> None:
        self.tracker.received_messages = val

    def bind_tools(
        self,
        tools: Sequence[dict[str, Any] | type | BaseTool | Any],
        **kwargs: Any,
    ) -> "FakeChatModel":
        """Simulates binding tools to the model."""
        tool_list = list(tools)
        self.tracker.bound_tools = tool_list
        self.bound_tools = tool_list
        bound = self.__class__(
            responses=self.responses,
            tokens=self.tokens,
            tool_calls=self.tool_calls,
            turn_sequence=self.turn_sequence,
            bound_tools=tool_list,
            tracker=self.tracker,
        )
        return bound

    def _resolve_current_turn(
        self,
    ) -> tuple[list[str] | None, list[dict[str, Any]] | None, str]:
        if self.turn_sequence and len(self.turn_sequence) > 0:
            idx = self.tracker.turn_idx
            if idx < len(self.turn_sequence):
                turn = self.turn_sequence[idx]
                self.tracker.turn_idx += 1
                t_tokens = turn.get("tokens")
                t_tools = turn.get("tool_calls")
                t_resps = turn.get("responses")
                t_resp = t_resps[0] if t_resps else ""
                return t_tokens, t_tools, t_resp
            else:
                final_turn = self.turn_sequence[-1]
                t_tokens = final_turn.get("tokens")
                t_resps = final_turn.get("responses")
                t_resp = t_resps[0] if t_resps else "완료"
                return t_tokens, None, t_resp

        t_tokens = self.tokens
        t_tools = self.tool_calls
        idx = self.tracker.turn_idx
        t_resp = self.responses[idx % len(self.responses)]
        self.tracker.turn_idx += 1
        return t_tokens, t_tools, t_resp

    def _get_tokens_for_turn(self, tokens: list[str] | None, fallback_text: str) -> list[str]:
        if tokens:
            return tokens
        if not fallback_text:
            return []
        return [fallback_text[i : i + 4] for i in range(0, len(fallback_text), 4)]

    def _generate_tool_chunks_for_turn(
        self, tool_calls: list[dict[str, Any]] | None
    ) -> list[ChatGenerationChunk]:
        chunks: list[ChatGenerationChunk] = []
        if tool_calls:
            for idx, tc in enumerate(tool_calls):
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
        self.tracker.received_messages.append(list(messages))
        _, current_tools, current_resp = self._resolve_current_turn()
        message = AIMessage(
            content=current_resp,
            tool_calls=current_tools or [],
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
        self.tracker.received_messages.append(list(messages))
        current_tokens, current_tools, current_resp = self._resolve_current_turn()
        tool_chunks = self._generate_tool_chunks_for_turn(current_tools)
        if tool_chunks:
            for chunk in tool_chunks:
                yield chunk
            return

        for token in self._get_tokens_for_turn(current_tokens, current_resp):
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
        self.tracker.received_messages.append(list(messages))
        current_tokens, current_tools, current_resp = self._resolve_current_turn()
        tool_chunks = self._generate_tool_chunks_for_turn(current_tools)
        if tool_chunks:
            for chunk in tool_chunks:
                yield chunk
            return

        for token in self._get_tokens_for_turn(current_tokens, current_resp):
            chunk = ChatGenerationChunk(message=AIMessageChunk(content=token))
            if run_manager:
                await run_manager.on_llm_new_token(token, chunk=chunk)
            yield chunk
