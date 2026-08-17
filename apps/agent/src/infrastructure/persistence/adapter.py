from __future__ import annotations

import logging
from typing import Any
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import MemorySaver
from langgraph.store.base import BaseStore
from langgraph.store.memory import InMemoryStore

from src.domain.ports import PersistencePort, StateSnapshot

logger = logging.getLogger(__name__)


class InMemoryPersistenceAdapter(PersistencePort):
    """In-memory persistence adapter for hermetic testing and stateless execution."""

    def __init__(
        self,
        checkpointer: BaseCheckpointSaver | None = None,
        store: BaseStore | None = None,
    ):
        self.checkpointer = checkpointer or MemorySaver()
        self.store = store or InMemoryStore()
        self._states: dict[str, StateSnapshot] = {}

    async def get_state(self, thread_id: str) -> StateSnapshot | None:
        return self._states.get(thread_id)

    async def save_checkpoint(
        self, thread_id: str, state: dict[str, Any], metadata: dict[str, Any]
    ) -> None:
        self._states[thread_id] = StateSnapshot(
            values=state,
            next_nodes=(),
            config={"configurable": {"thread_id": thread_id}},
            metadata=metadata,
            created_at="2026-08-17T00:00:00Z",
        )

    async def clear_messages(self, thread_id: str, message_ids: list[str]) -> None:
        pass

    async def store_get(
        self, namespace: tuple[str, ...], key: str
    ) -> dict[str, Any] | None:
        res = await self.store.aget(namespace, key) if hasattr(self.store, "aget") else self.store.get(namespace, key)
        return getattr(res, "value", res) if res else None

    async def store_put(
        self, namespace: tuple[str, ...], key: str, value: dict[str, Any]
    ) -> None:
        if hasattr(self.store, "aput"):
            await self.store.aput(namespace, key, value)
        else:
            self.store.put(namespace, key, value)


class PostgresPersistenceAdapter(PersistencePort):
    """PostgreSQL persistence adapter using AsyncPostgresSaver and AsyncPostgresStore."""

    def __init__(self, pool: Any, checkpointer: Any, store: Any):
        self.pool = pool
        self.checkpointer = checkpointer
        self.store = store

    @classmethod
    async def create(cls, db_url: str | None = None, max_size: int = 20) -> PostgresPersistenceAdapter:
        from psycopg_pool import AsyncConnectionPool
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
        from langgraph.store.postgres.aio import AsyncPostgresStore
        import os

        url = db_url or os.getenv("DATABASE_URL")
        if not url or url.startswith("sqlite") or url == "memory":
            raise ValueError(f"Invalid PostgreSQL URL: {url}")

        pool = AsyncConnectionPool(
            conninfo=url,
            max_size=max_size,
            kwargs={"autocommit": True},
            open=False,
        )
        await pool.open()
        checkpointer = AsyncPostgresSaver(pool)
        if hasattr(checkpointer, "setup"):
            await checkpointer.setup()

        store = AsyncPostgresStore(pool)
        if hasattr(store, "setup"):
            await store.setup()

        return cls(pool=pool, checkpointer=checkpointer, store=store)

    async def close(self) -> None:
        if self.pool:
            await self.pool.close()

    async def get_state(self, thread_id: str) -> StateSnapshot | None:
        config = {"configurable": {"thread_id": thread_id}}
        state = await self.checkpointer.aget(config)
        if not state:
            return None
        return StateSnapshot(
            values=getattr(state, "values", {}),
            next_nodes=getattr(state, "next", ()),
            config=config,
            metadata=getattr(state, "metadata", {}),
            created_at=str(getattr(state, "created_at", "")),
        )

    async def save_checkpoint(
        self, thread_id: str, state: dict[str, Any], metadata: dict[str, Any]
    ) -> None:
        pass

    async def clear_messages(self, thread_id: str, message_ids: list[str]) -> None:
        pass

    async def store_get(
        self, namespace: tuple[str, ...], key: str
    ) -> dict[str, Any] | None:
        item = await self.store.aget(namespace, key)
        return getattr(item, "value", item) if item else None

    async def store_put(
        self, namespace: tuple[str, ...], key: str, value: dict[str, Any]
    ) -> None:
        await self.store.aput(namespace, key, value)
