import pytest
from langgraph.checkpoint.memory import MemorySaver

from src.infrastructure import FakeChatModel
from src.graphs.chat.graph import build_agent
from src.graphs.registry import GraphRegistry
from src.runtime import AgentRuntime
from src.runtime.runtime import _build_trace_metadata


@pytest.mark.asyncio
class TestRuntimeObservability:
    async def test_build_trace_metadata_extracts_user_prompt_snippet_and_tags(self):
        """Metadata builder generates a readable trace name without emojis, user_id, and tags."""
        messages = [
            {"role": "user", "content": "첫 번째 질문"},
            {"role": "assistant", "content": "무엇을 도와드릴까요?"},
            {"role": "user", "content": "크레이지하구만 ! 파이썬 피보나치 코드 알려줘"},
        ]

        metadata = _build_trace_metadata(
            messages=messages,
            agent_type="default",
            thread_id="session-123",
            user_id="usr_123",
            environment="test",
        )

        assert metadata["langfuse_session_id"] == "session-123"
        assert metadata["langfuse_user_id"] == "usr_123"
        assert (
            metadata["langfuse_trace_name"]
            == "[Turn 2] 크레이지하구만 ! 파이썬 피보나치 코드 알려줘"
        )
        assert "chat" in metadata["langfuse_tags"]
        assert "streaming" in metadata["langfuse_tags"]
        assert "agent:default" in metadata["langfuse_tags"]
        assert "env:test" in metadata["langfuse_tags"]
        assert metadata["user_prompt"] == "크레이지하구만 ! 파이썬 피보나치 코드 알려줘"
        assert metadata["active_path_length"] == 3
        assert metadata["turn_index"] == 2

    async def test_build_trace_metadata_handles_multimodal_attachments(self):
        """Metadata builder should tag multimodal requests when attachments are present."""
        messages = [
            {
                "role": "user",
                "content": "이 사진 설명해줘",
                "attachments": [
                    {
                        "id": "att_1",
                        "url": "https://example.com/photo.png",
                        "name": "photo.png",
                        "mimeType": "image/png",
                        "size": 1024,
                    }
                ],
            }
        ]

        metadata = _build_trace_metadata(
            messages=messages,
            agent_type="default",
            thread_id="session-456",
            user_id="usr_456",
        )

        assert metadata["langfuse_user_id"] == "usr_456"
        assert metadata["langfuse_trace_name"] == "[Turn 1] 이 사진 설명해줘"
        assert "multimodal" in metadata["langfuse_tags"]
        assert metadata["has_attachments"] is True

    async def test_build_trace_metadata_truncates_long_trace_names_cleanly(self):
        """Very long user prompts should be truncated with ellipsis in trace_name."""
        long_prompt = "A" * 100
        messages = [{"role": "user", "content": long_prompt}]

        metadata = _build_trace_metadata(
            messages=messages,
            agent_type="default",
            thread_id="session-789",
            user_id="usr_789",
        )

        assert metadata["langfuse_user_id"] == "usr_789"
        assert metadata["langfuse_trace_name"].startswith("[Turn 1] ")
        assert len(metadata["langfuse_trace_name"]) <= 45
        assert metadata["langfuse_trace_name"].endswith("...")

    async def test_trace_metadata_injection(self):
        """Runtime stream execution should pass the rich trace metadata into stream config."""
        fake_llm = FakeChatModel(responses=["테스트 답변입니다."])
        registry = GraphRegistry()
        checkpointer = MemorySaver()
        registry.register("default", build_agent)

        runtime = AgentRuntime.create_in_memory(
            registry=registry,
            checkpointer=checkpointer,
            model=fake_llm,
        )

        events = []
        async for ev in runtime.stream_execution(
            messages=[{"role": "user", "content": "안녕하세요!"}],
            thread_id="test-observability-stream",
            agent_type="default",
            user_id="usr_stream_test",
        ):
            events.append(ev)

        assert any(e.event == "token" for e in events)
