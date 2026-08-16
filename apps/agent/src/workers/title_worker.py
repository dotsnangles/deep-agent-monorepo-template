import asyncio
import json
import logging
import os
from typing import Any

from pydantic import BaseModel, Field

from src.core.redis import RedisEventBroker
from src.graphs.chat.graph import generate_title

logger = logging.getLogger(__name__)

QUEUE_KEY = "queue:title_generation"
TITLE_UPDATED_CHANNEL = "events:session:title_updated"
MAX_CONCURRENCY = int(os.getenv("TITLE_WORKER_CONCURRENCY", "3"))


class TitleTaskPayload(BaseModel):
    """Payload schema for title generation queue task."""

    sessionId: str = Field(..., description="Chat session ID")
    userPrompt: str = Field(..., description="First user prompt to summarize")


class TitleGenerationWorker:
    """Asynchronous background worker consuming title generation tasks from Redis queue.

    Decoupled from PostgreSQL: publishes 'events:session:title_updated' events over Redis Pub/Sub.
    """

    def __init__(
        self,
        redis_client: Any,
        event_broker: RedisEventBroker | None = None,
        max_concurrency: int = MAX_CONCURRENCY,
        title_generator: Any = None,
        pg_pool: Any = None,
    ):
        self.redis = redis_client
        self.event_broker = event_broker
        self.semaphore = asyncio.Semaphore(max_concurrency)
        self.title_generator = title_generator or generate_title
        self.pg_pool = pg_pool
        self._task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()

    def start(self):
        """Starts the background worker task loop."""
        if self._task is None or self._task.done():
            self._stop_event.clear()
            self._task = asyncio.create_task(self._run_loop())
            logger.info(
                "Title generation worker started (concurrency=%d, queue=%s)",
                MAX_CONCURRENCY,
                QUEUE_KEY,
            )

    async def stop(self):
        """Signals worker to stop and cancels the task loop cleanly."""
        self._stop_event.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
            logger.info("Title generation task worker stopped.")

    async def _run_loop(self):
        while not self._stop_event.is_set():
            try:
                if not self.redis:
                    await asyncio.sleep(1)
                    continue

                # Non-blocking pop with timeout to check stop_event periodically
                item = await self.redis.brpop([QUEUE_KEY], timeout=1)
                if item is None:
                    await asyncio.sleep(0.05)
                    continue

                _, payload_str = item
                # Spawn concurrent processor bounded by semaphore
                asyncio.create_task(self._process_task(payload_str))
            except asyncio.CancelledError:
                break
            except Exception as e:
                if not self._stop_event.is_set():
                    logger.error("Title worker loop error: %s", e)
                    await asyncio.sleep(0.1)

    async def _process_task(self, payload_str: str):
        async with self.semaphore:
            try:
                raw_data = json.loads(payload_str)
                task = TitleTaskPayload(**raw_data)

                # 1. Generate smart title using injected or default title generator
                smart_title = await self.title_generator(task.userPrompt)

                if not smart_title or len(smart_title.strip()) < 2:
                    return

                # 2. Persist directly to PostgreSQL if pool is available
                if self.pg_pool:
                    try:
                        async with self.pg_pool.connection() as conn:
                            await conn.execute(
                                "UPDATE chat_session SET title = %s, updated_at = NOW() WHERE id = %s",
                                (smart_title, task.sessionId),
                            )
                            logger.info(
                                "Session %s title persisted in PostgreSQL: '%s'",
                                task.sessionId,
                                smart_title,
                            )
                    except Exception as pg_err:
                        logger.warning("Direct PostgreSQL title update failed: %s", pg_err)

                # 3. Publish title update event over Redis Pub/Sub
                event_payload = {
                    "sessionId": task.sessionId,
                    "title": smart_title,
                }
                serialized = json.dumps(event_payload)

                if self.redis:
                    await self.redis.publish(TITLE_UPDATED_CHANNEL, serialized)

                if self.event_broker and self.event_broker.is_connected():
                    await self.event_broker.publish(
                        task.sessionId,
                        "title_updated",
                        event_payload,
                    )

                logger.info(
                    "Session %s title generated: '%s' and published to %s",
                    task.sessionId,
                    smart_title,
                    TITLE_UPDATED_CHANNEL,
                )
            except Exception as e:
                logger.error("Failed to process title job: %s", e)
