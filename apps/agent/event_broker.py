import json
import logging
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

import redis.asyncio as aioredis
from langchain_core.callbacks import AsyncCallbackHandler

logger = logging.getLogger("agent.event_broker")


class RedisEventBroker:
    """Redis Pub/Sub Event Broker & Distributed Lock for multi-worker deployments."""

    def __init__(self, redis_client: aioredis.Redis | None = None):
        self.redis = redis_client

    def is_connected(self) -> bool:
        return self.redis is not None

    async def publish(self, channel: str, event_type: str, payload: dict[str, Any]) -> None:
        """Publishes an event to a Redis channel: agent:events:{channel}."""
        if not self.redis:
            return

        message = {
            "event": event_type,
            "channel": channel,
            "timestamp": time.time(),
            "data": payload,
        }
        try:
            await self.redis.publish(
                f"agent:events:{channel}",
                json.dumps(message, default=str),
            )
        except Exception as exc:
            logger.warning("Failed to publish event to Redis: %s", exc)

    async def subscribe(self, channel: str) -> AsyncGenerator[dict[str, Any]]:
        """Subscribes to agent:events:{channel} and yields incoming events."""
        if not self.redis:
            return

        pubsub = self.redis.pubsub()
        channel_name = f"agent:events:{channel}"
        await pubsub.subscribe(channel_name)
        try:
            async for message in pubsub.listen():
                if message and message.get("type") == "message":
                    raw_data = message.get("data")
                    if raw_data:
                        try:
                            yield json.loads(raw_data)
                        except Exception:
                            yield {"raw": raw_data}
        finally:
            try:
                await pubsub.unsubscribe(channel_name)
                await pubsub.aclose()
            except Exception:
                pass

    @asynccontextmanager
    async def lock(
        self,
        resource_id: str,
        timeout: float = 30.0,
        blocking_timeout: float = 5.0,
    ):
        """Async context manager acquiring a Redis distributed mutex lock."""
        if not self.redis:
            yield True
            return

        lock_key = f"agent:lock:{resource_id}"
        async with self.redis.lock(
            lock_key,
            timeout=timeout,
            blocking_timeout=blocking_timeout,
        ):
            yield True


class RedisStreamingCallbackHandler(AsyncCallbackHandler):
    """LangChain CallbackHandler that broadcasts execution events to Redis Pub/Sub."""

    def __init__(self, broker: RedisEventBroker, thread_id: str):
        super().__init__()
        self.broker = broker
        self.thread_id = thread_id

    async def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        """Broadcast token streaming chunks."""
        await self.broker.publish(
            self.thread_id,
            "on_llm_new_token",
            {"token": token},
        )

    async def on_tool_start(
        self, serialized: dict[str, Any], input_str: str, **kwargs: Any
    ) -> None:
        """Broadcast tool invocation start."""
        tool_name = serialized.get("name", "tool") if serialized else "tool"
        await self.broker.publish(
            self.thread_id,
            "on_tool_start",
            {"tool": tool_name, "input": input_str},
        )

    async def on_tool_end(self, output: Any, **kwargs: Any) -> None:
        """Broadcast tool execution completion."""
        await self.broker.publish(
            self.thread_id,
            "on_tool_end",
            {"output": str(output)},
        )

    async def on_tool_error(self, error: BaseException, **kwargs: Any) -> None:
        """Broadcast tool execution error."""
        await self.broker.publish(
            self.thread_id,
            "on_tool_error",
            {"error": str(error)},
        )

    async def on_chain_start(
        self, serialized: dict[str, Any], inputs: dict[str, Any], **kwargs: Any
    ) -> None:
        """Broadcast chain/node start."""
        name = serialized.get("name", "chain") if serialized else "chain"
        await self.broker.publish(
            self.thread_id,
            "on_chain_start",
            {"name": name},
        )

    async def on_chain_end(self, outputs: dict[str, Any], **kwargs: Any) -> None:
        """Broadcast chain/node completion."""
        await self.broker.publish(
            self.thread_id,
            "on_chain_end",
            {"outputs": str(outputs)},
        )
