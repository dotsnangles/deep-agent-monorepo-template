import pytest
from langgraph.checkpoint.memory import MemorySaver

from src.core.gateway import AgentExecutionGateway, _build_trace_metadata
from src.core.testing import FakeChatModel
from src.graphs.chat.hitl_graph import build_hitl_agent_graph
from src.graphs.registry import GraphRegistry


@pytest.mark.asyncio
class TestGatewayObservability:
    async def test_build_trace_metadata_extracts_user_prompt_snippet_and_tags(self):
        """Metadata builder should generate a readable trace name and tags from messages."""
        messages = [
            {"role": "user", "content": "메롱"},
            {"role": "assistant", "content": "무엇을 도와드릴까요?"},
            {"role": "user", "content": "크레이지하구만 ! 파이썬 피보나치 코드 알려줘"},
        ]

        metadata = _build_trace_metadata(
            messages=messages,
            agent_type="default",
            thread_id="session-123",
        )

        assert metadata["langfuse_session_id"] == "session-123"
        assert metadata["langfuse_trace_name"] == "💬 크레이지하구만 ! 파이썬 피보나치 코드 알려줘"
        assert "chat" in metadata["langfuse_tags"]
        assert "streaming" in metadata["langfuse_tags"]
        assert "agent:default" in metadata["langfuse_tags"]
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
        )

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
        )

        assert len(metadata["langfuse_trace_name"]) <= 45
        assert metadata["langfuse_trace_name"].endswith("...")

    async def test_stream_execution_injects_enriched_metadata_into_run_config(self):
        """Gateway stream execution should pass the rich trace metadata into stream config."""
        fake_llm = FakeChatModel(responses=["테스트 답변입니다."])
        registry = GraphRegistry()
        checkpointer = MemorySaver()
        registry.register("default", build_hitl_agent_graph)

        gateway = AgentExecutionGateway(
            registry=registry,
            checkpointer=checkpointer,
            model=fake_llm,
        )

        events = []
        async for ev in gateway.stream_execution(
            messages=[{"role": "user", "content": "안녕하세요!"}],
            thread_id="test-observability-stream",
            agent_type="default",
        ):
            events.append(ev)

        assert any(e.event == "token" for e in events)
