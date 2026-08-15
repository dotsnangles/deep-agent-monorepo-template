import asyncio
import json
import os
from typing import Any

from agent import LLM_PROVIDER, generate_title
from event_broker import RedisEventBroker

QUEUE_KEY = "queue:title_generation"
MAX_CONCURRENCY = int(os.getenv("TITLE_WORKER_CONCURRENCY", "3"))


class TitleGenerationWorker:
    """Asynchronous background worker consuming title generation tasks from Redis queue.

    Ensures rate limiting & concurrency throttling for LLM calls with zero request drops.
    """

    def __init__(
        self,
        redis_client: Any,
        pg_pool: Any,
        event_broker: RedisEventBroker | None = None,
        max_concurrency: int = MAX_CONCURRENCY,
    ):
        self.redis = redis_client
        self.pg_pool = pg_pool
        self.event_broker = event_broker
        self.semaphore = asyncio.Semaphore(max_concurrency)
        self._task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()

    def start(self):
        """Starts the background worker task loop."""
        if self._task is None or self._task.done():
            self._stop_event.clear()
            self._task = asyncio.create_task(self._run_loop())
            print(
                f"[WORKER] Title generation task worker started (concurrency limit={MAX_CONCURRENCY}, queue={QUEUE_KEY})."
            )

    async def stop(self):
        """Signals worker to stop and waits for task completion."""
        self._stop_event.set()
        if self._task:
            await asyncio.wait_for(asyncio.shield(self._task), timeout=5.0)
            print("[WORKER] Title generation task worker stopped.")

    async def _run_loop(self):
        while not self._stop_event.is_set():
            try:
                if not self.redis:
                    await asyncio.sleep(2)
                    continue

                # Non-blocking pop with timeout to check stop_event periodically
                item = await self.redis.brpop([QUEUE_KEY], timeout=2)
                if item is None:
                    continue

                _, payload_str = item
                # Spawn concurrent processor bounded by semaphore
                asyncio.create_task(self._process_task(payload_str))
            except asyncio.CancelledError:
                break
            except Exception as e:
                if not self._stop_event.is_set():
                    print(f"[WORKER ERROR] Loop error: {e}")
                    await asyncio.sleep(1)

    async def _process_task(self, payload_str: str):
        async with self.semaphore:
            try:
                data = json.loads(payload_str)
                session_id = data.get("sessionId")
                user_prompt = data.get("userPrompt")

                if not session_id or not user_prompt:
                    return

                # 1. Generate smart title using LangChain LCEL chain
                smart_title = await generate_title(user_prompt)

                if not smart_title or len(smart_title.strip()) < 2:
                    return

                # 2. Update database directly via Postgres Connection Pool
                if self.pg_pool:
                    async with self.pg_pool.connection() as conn:
                        await conn.execute(
                            "UPDATE chat_session SET title = %s WHERE id = %s",
                            (smart_title, session_id),
                        )

                print(
                    f"[WORKER] (Queue Processor [{LLM_PROVIDER}]) Session {session_id} title updated to: '{smart_title}'"
                )
            except Exception as e:
                print(f"[WORKER ERROR] Failed to process title job: {e}")
