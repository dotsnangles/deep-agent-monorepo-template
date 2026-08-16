import asyncio
import json
import os
from unittest.mock import AsyncMock, patch

import pytest

from src.workers.title_worker import TITLE_UPDATED_CHANNEL, TitleGenerationWorker


@pytest.mark.asyncio
async def test_title_worker_cloud_provider_mode_uses_llm_generator():
    """In cloud_provider mode, TitleGenerationWorker uses injected LLM title generator."""
    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock()
    mock_title_generator = AsyncMock(return_value="React Next.js 아키텍처")

    with patch.dict(os.environ, {"DEEP_AGENT_MODE": "cloud_provider"}):
        worker = TitleGenerationWorker(
            redis_client=mock_redis,
            event_broker=None,
            title_generator=mock_title_generator,
        )

        task_payload = json.dumps(
            {
                "sessionId": "sess_abc_123",
                "userPrompt": "React Next.js 아키텍처 설계 질문",
            }
        )

        await worker._process_task(task_payload)

        mock_title_generator.assert_called_once_with("React Next.js 아키텍처 설계 질문")
        assert mock_redis.publish.call_count >= 1

        channel, published_data = mock_redis.publish.call_args_list[0][0]
        assert channel == TITLE_UPDATED_CHANNEL
        parsed = json.loads(published_data)
        assert parsed["sessionId"] == "sess_abc_123"
        assert parsed["title"] == "React Next.js 아키텍처"


@pytest.mark.asyncio
async def test_title_worker_local_slm_uses_heuristic_slicing():
    """In local_slm mode, TitleGenerationWorker uses instant heuristic slicing."""
    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock()
    mock_title_generator = AsyncMock(return_value="Unused LLM Title")

    with patch.dict(os.environ, {"DEEP_AGENT_MODE": "local_slm", "LLM_PROVIDER": "ollama"}):
        worker = TitleGenerationWorker(
            redis_client=mock_redis,
            event_broker=None,
            title_generator=mock_title_generator,
        )

        long_prompt = (
            "이것은 로컬 SLM 모드에서 25글자 이상으로 아주 길게 작성된 사용자 질문 프롬프트입니다."
        )
        task_payload = json.dumps(
            {
                "sessionId": "sess_local_456",
                "userPrompt": long_prompt,
            }
        )

        await worker._process_task(task_payload)

        # In local_slm, LLM title generator MUST NOT be called (0 LLM inference overhead)
        mock_title_generator.assert_not_called()
        assert mock_redis.publish.call_count >= 1

        channel, published_data = mock_redis.publish.call_args_list[0][0]
        assert channel == TITLE_UPDATED_CHANNEL
        parsed = json.loads(published_data)
        assert parsed["sessionId"] == "sess_local_456"
        expected_title = long_prompt[:25].strip()
        assert parsed["title"] == expected_title


@pytest.mark.asyncio
async def test_title_worker_start_and_stop_lifecycle():
    mock_redis = AsyncMock()
    mock_redis.brpop = AsyncMock(side_effect=asyncio.CancelledError)

    worker = TitleGenerationWorker(redis_client=mock_redis)
    worker.start()
    assert worker._task is not None

    await asyncio.sleep(0.01)
    await worker.stop()
    assert worker._task.done() or worker._stop_event.is_set()
