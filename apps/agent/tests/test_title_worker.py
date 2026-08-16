import asyncio
import json
from unittest.mock import AsyncMock

import pytest

from src.workers.title_worker import TITLE_UPDATED_CHANNEL, TitleGenerationWorker


@pytest.mark.asyncio
async def test_title_worker_processes_job_and_publishes_event():
    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock()
    mock_title_generator = AsyncMock(return_value="React Next.js 아키텍처")

    worker = TitleGenerationWorker(
        redis_client=mock_redis,
        event_broker=None,
        title_generator=mock_title_generator,
    )

    task_payload = json.dumps({
        "sessionId": "sess_abc_123",
        "userPrompt": "React Next.js 아키텍처 설계 질문",
    })

    await worker._process_task(task_payload)

    mock_title_generator.assert_called_once_with("React Next.js 아키텍처 설계 질문")
    assert mock_redis.publish.call_count >= 1

    # Check published payload
    channel, published_data = mock_redis.publish.call_args_list[0][0]
    assert channel == TITLE_UPDATED_CHANNEL
    parsed = json.loads(published_data)
    assert parsed["sessionId"] == "sess_abc_123"
    assert parsed["title"] == "React Next.js 아키텍처"


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
