import hashlib
import json
import logging
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

import redis
import redis.asyncio as aioredis
from langchain_core.caches import RETURN_VAL_TYPE, BaseCache
from langchain_core.callbacks import AsyncCallbackHandler
from langchain_core.load import dumpd, load

logger = logging.getLogger("agent.event_broker")


class StandardRedisCache(BaseCache):
    def __init__(self, redis_url: str, ttl: int = 86400, prefix: str = "llm_cache:"):
        self.redis_url = redis_url
        self.ttl = ttl
        self.prefix = prefix
        self._sync_client = redis.from_url(redis_url, decode_responses=True)
        self._async_client = aioredis.from_url(redis_url, decode_responses=True)

    def _key(self, prompt: str, llm_string: str) -> str:
        prompt_hash = hashlib.sha256(f"{prompt}###{llm_string}".encode()).hexdigest()
        return f"{self.prefix}{prompt_hash}"

    def lookup(self, prompt: str, llm_string: str) -> RETURN_VAL_TYPE | None:
        try:
            val = self._sync_client.get(self._key(prompt, llm_string))
            if val:
                data = json.loads(val)
                return [load(item) for item in data]
        except Exception as exc:
            logger.debug("Redis cache lookup failed: %s", exc)
        return None

    def update(self, prompt: str, llm_string: str, return_val: RETURN_VAL_TYPE) -> None:
        try:
            serialized = json.dumps([dumpd(item) for item in return_val])
            self._sync_client.set(self._key(prompt, llm_string), serialized, ex=self.ttl)
        except Exception as exc:
            logger.debug("Redis cache update failed: %s", exc)

    async def alookup(self, prompt: str, llm_string: str) -> RETURN_VAL_TYPE | None:
        try:
            val = await self._async_client.get(self._key(prompt, llm_string))
            if val:
                data = json.loads(val)
                return [load(item) for item in data]
        except Exception as exc:
            logger.debug("Redis async cache lookup failed: %s", exc)
        return None

    async def aupdate(self, prompt: str, llm_string: str, return_val: RETURN_VAL_TYPE) -> None:
        try:
            serialized = json.dumps([dumpd(item) for item in return_val])
            await self._async_client.set(self._key(prompt, llm_string), serialized, ex=self.ttl)
        except Exception as exc:
            logger.debug("Redis async cache update failed: %s", exc)

    def clear(self, **kwargs: Any) -> None:
        pass


class RedisEventBroker:
    def __init__(self, redis_client: aioredis.Redis | None = None):
        self.redis = redis_client

    def is_connected(self) -> bool:
        return self.redis is not None

    async def publish(self, channel: str, event_type: str, payload: dict[str, Any]) -> None:
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
    def __init__(self, broker: RedisEventBroker, thread_id: str):
        super().__init__()
        self.broker = broker
        self.thread_id = thread_id

    async def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        await self.broker.publish(
            self.thread_id,
            "on_llm_new_token",
            {"token": token},
        )

    async def on_tool_start(
        self, serialized: dict[str, Any], input_str: str, **kwargs: Any
    ) -> None:
        tool_name = serialized.get("name", "tool") if serialized else "tool"
        await self.broker.publish(
            self.thread_id,
            "on_tool_start",
            {"tool": tool_name, "input": input_str},
        )

    async def on_tool_end(self, output: Any, **kwargs: Any) -> None:
        await self.broker.publish(
            self.thread_id,
            "on_tool_end",
            {"output": str(output)},
        )

    async def on_tool_error(self, error: BaseException, **kwargs: Any) -> None:
        await self.broker.publish(
            self.thread_id,
            "on_tool_error",
            {"error": str(error)},
        )

    async def on_chain_start(
        self, serialized: dict[str, Any], inputs: dict[str, Any], **kwargs: Any
    ) -> None:
        name = serialized.get("name", "chain") if serialized else "chain"
        await self.broker.publish(
            self.thread_id,
            "on_chain_start",
            {"name": name},
        )

    async def on_chain_end(self, outputs: dict[str, Any], **kwargs: Any) -> None:
        await self.broker.publish(
            self.thread_id,
            "on_chain_end",
            {"outputs": str(outputs)},
        )
