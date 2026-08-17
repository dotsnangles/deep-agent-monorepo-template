import pytest
from langgraph.checkpoint.memory import MemorySaver
from pydantic import Field

from src.core.testing import FakeChatModel
from src.graphs.chat.graph import build_agent
from src.graphs.registry import GraphRegistry
from src.runtime import AgentRuntime


class RecordingFakeChatModel(FakeChatModel):
    """Fake model recording every prompt history it receives."""

    received_prompts: list[list[dict[str, str]]] = Field(default_factory=list)

    async def _agenerate(self, messages, stop=None, run_manager=None, **kwargs):
        recorded = [
            {"role": getattr(m, "type", "unknown"), "content": str(getattr(m, "content", ""))}
            for m in messages
        ]
        self.received_prompts.append(recorded)
        return await super()._agenerate(messages, stop=stop, run_manager=run_manager, **kwargs)


@pytest.mark.asyncio
class TestActivePathSyncAndLiveInference:
    async def test_active_path_sync_prevents_quadratic_message_accumulation(self):
        """Regression test for ADR 0017:
        Multi-turn active path sends should NOT duplicate messages.
        """
        checkpointer = MemorySaver()
        fake_llm = RecordingFakeChatModel(
            responses=[
                "Answer 1",
                "Answer 2",
                "Answer 3",
            ]
        )

        registry = GraphRegistry()
        registry.register("default", build_agent)

        gateway = AgentRuntime.create_in_memory(
            registry=registry,
            checkpointer=checkpointer,
            model=fake_llm,
        )

        thread_id = "test-session-tree-sync"

        # Turn 1: Client sends [User 1]
        events_1 = []
        async for ev in gateway.stream_execution(
            messages=[{"role": "user", "content": "Question 1"}],
            thread_id=thread_id,
            agent_type="default",
        ):
            events_1.append(ev)

        assert any(e.event == "token" for e in events_1)

        # Turn 2: Client sends full active path [User 1, Asst 1, User 2]
        events_2 = []
        async for ev in gateway.stream_execution(
            messages=[
                {"role": "user", "content": "Question 1"},
                {"role": "assistant", "content": "Answer 1"},
                {"role": "user", "content": "Question 2"},
            ],
            thread_id=thread_id,
            agent_type="default",
        ):
            events_2.append(ev)

        assert any(e.event == "token" for e in events_2)

        # Turn 3: Client regenerates Question 2 (same active path [User 1, Asst 1, User 2])
        events_3 = []
        async for ev in gateway.stream_execution(
            messages=[
                {"role": "user", "content": "Question 1"},
                {"role": "assistant", "content": "Answer 1"},
                {"role": "user", "content": "Question 2"},
            ],
            thread_id=thread_id,
            agent_type="default",
        ):
            events_3.append(ev)

        assert any(e.event == "token" for e in events_3)

        # Inspect LLM invocations
        assert len(fake_llm.received_messages) == 3

        # Turn 1 prompt: [System, Question 1] -> 2 messages
        assert len(fake_llm.received_messages[0]) == 2

        # Turn 2 prompt: [System, Question 1, Answer 1, Question 2] -> 4 messages
        # If operator.add bug is present, this will fail with 6 messages!
        assert len(fake_llm.received_messages[1]) == 4, (
            f"Expected 4 messages on Turn 2, got {len(fake_llm.received_messages[1])}: "
            f"{fake_llm.received_messages[1]}"
        )

        # Turn 3 prompt: [System, Question 1, Answer 1, Question 2] -> 4 messages
        # If operator.add bug is present, this will fail with 10 messages!
        assert len(fake_llm.received_messages[2]) == 4, (
            f"Expected 4 messages on Turn 3, got {len(fake_llm.received_messages[2])}: "
            f"{fake_llm.received_messages[2]}"
        )

        # Count occurrences of "Question 1" in Turn 3 prompt - MUST BE EXACTLY 1
        q1_count = sum(
            1 for m in fake_llm.received_messages[2] if getattr(m, "content", "") == "Question 1"
        )
        assert q1_count == 1, f"Question 1 was duplicated {q1_count} times in prompt!"

    async def test_live_inference_ensures_fresh_generation_on_identical_prompts(self):
        """Regression test for ADR 0017:
        Consecutive identical prompts must invoke model freshly.
        """
        fake_llm = FakeChatModel(tokens=["Token A", "Token B"])
        gateway = AgentRuntime.create_in_memory(model=fake_llm)

        prompt = "파이썬으로 최적화된 피보나치 수열 생성 함수를 작성하고 시간 복잡도를 설명해줘."

        # First send
        tokens_1 = []
        async for ev in gateway.stream_execution(
            messages=[{"role": "user", "content": prompt}],
            thread_id="session-fresh-1",
            agent_type="direct",
        ):
            if ev.event == "token":
                tokens_1.append(ev.data.content)

        # Second send with identical prompt
        tokens_2 = []
        async for ev in gateway.stream_execution(
            messages=[{"role": "user", "content": prompt}],
            thread_id="session-fresh-2",
            agent_type="direct",
        ):
            if ev.event == "token":
                tokens_2.append(ev.data.content)

        assert len(tokens_1) > 0
        assert len(tokens_2) > 0
        assert len(fake_llm.received_messages) == 2, (
            "Model should have been called twice, not cached!"
        )
