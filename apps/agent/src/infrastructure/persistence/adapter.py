from __future__ import annotations

import logging
from typing import Any
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import MemorySaver
from langgraph.store.base import BaseStore
from langgraph.store.memory import InMemoryStore

from src.domain.ports import PersistencePort, StateSnapshot

logger = logging.getLogger(__name__)


class CheckpointerFactory:
    """Single Source of Truth for LangGraph Checkpointers and Stores (ADR-0024)."""

    _pool: Any = None

    @classmethod
    def get_pool(cls, db_url: str | None = None) -> Any:
        return cls._pool

    @classmethod
    async def create_pool(cls, db_url: str | None = None, max_size: int = 20) -> Any:
        url = cls._get_effective_db_url(db_url)
        if not url:
            return None
        if cls._pool is None:
            from psycopg_pool import AsyncConnectionPool

            cls._pool = AsyncConnectionPool(
                conninfo=url,
                max_size=max_size,
                kwargs={"autocommit": True},
                open=False,
            )
            await cls._pool.open()
        return cls._pool

    @classmethod
    async def close_pool(cls) -> None:
        if cls._pool is not None:
            try:
                await cls._pool.close()
            except Exception as e:
                logger.warning("Error closing PostgreSQL connection pool: %s", e)
            finally:
                cls._pool = None

    @classmethod
    def _get_effective_db_url(cls, postgres_url: str | None = None) -> str | None:
        import os
        db_url = postgres_url if postgres_url is not None else os.getenv("DATABASE_URL")
        if not db_url or db_url.startswith("sqlite") or db_url == "memory":
            return None
        return db_url

    @classmethod
    def _resolve_pool(
        cls, postgres_url: str | None = None, pool: Any = None
    ) -> tuple[str | None, Any]:
        db_url = cls._get_effective_db_url(postgres_url)
        effective_pool = pool if pool is not None else cls._pool
        return db_url, effective_pool

    @classmethod
    def create_checkpointer(
        cls,
        postgres_url: str | None = None,
        pool: Any = None,
    ) -> BaseCheckpointSaver:
        db_url, effective_pool = cls._resolve_pool(postgres_url, pool)
        if not db_url or effective_pool is None:
            return MemorySaver()
        try:
            from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
            return AsyncPostgresSaver(effective_pool)
        except Exception as e:
            logger.warning("Failed to initialize PostgreSQL checkpointer: %s. Using MemorySaver.", e)
            return MemorySaver()

    @classmethod
    def create_store(
        cls,
        postgres_url: str | None = None,
        pool: Any = None,
    ) -> BaseStore:
        db_url, effective_pool = cls._resolve_pool(postgres_url, pool)
        if not db_url or effective_pool is None:
            return InMemoryStore()
        try:
            from langgraph.store.postgres.aio import AsyncPostgresStore
            return AsyncPostgresStore(effective_pool)
        except Exception as e:
            logger.warning("Failed to initialize PostgreSQL store: %s. Using InMemoryStore.", e)
            return InMemoryStore()

    @classmethod
    def get_default_checkpointer(
        cls,
        postgres_url: str | None = None,
        pool: Any = None,
    ) -> BaseCheckpointSaver:
        return cls.create_checkpointer(postgres_url=postgres_url, pool=pool)

    @classmethod
    def get_default_store(
        cls,
        postgres_url: str | None = None,
        pool: Any = None,
    ) -> BaseStore:
        return cls.create_store(postgres_url=postgres_url, pool=pool)


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
        if thread_id in self._states:
            return self._states[thread_id]
        if self.checkpointer:
            config = {"configurable": {"thread_id": thread_id}}
            raw = self.checkpointer.get(config) if hasattr(self.checkpointer, "get") else None
            if raw:
                checkpoint = getattr(raw, "checkpoint", raw)
                channel_values = checkpoint.get("channel_values", {}) if isinstance(checkpoint, dict) else getattr(checkpoint, "channel_values", {})
                return StateSnapshot(
                    values=channel_values,
                    next_nodes=getattr(raw, "next", ()),
                    config=config,
                    metadata=getattr(raw, "metadata", {}),
                    created_at=str(getattr(raw, "created_at", "")),
                    tasks=tuple(getattr(raw, "tasks", ())),
                )
        return None

    async def save_checkpoint(
        self, thread_id: str, state: dict[str, Any], metadata: dict[str, Any]
    ) -> None:
        tasks = state.pop("tasks", ()) if isinstance(state, dict) else ()
        self._states[thread_id] = StateSnapshot(
            values=state,
            next_nodes=(),
            config={"configurable": {"thread_id": thread_id}},
            metadata=metadata,
            created_at="2026-08-17T00:00:00Z",
            tasks=tuple(tasks) if isinstance(tasks, (list, tuple)) else (),
        )

    async def clear_messages(self, thread_id: str, message_ids: list[str]) -> None:
        if thread_id in self._states:
            st = self._states[thread_id]
            if "messages" in st.values:
                remaining = [
                    m for m in st.values["messages"]
                    if getattr(m, "id", None) not in message_ids
                ]
                new_values = {**st.values, "messages": remaining}
                self._states[thread_id] = StateSnapshot(
                    values=new_values,
                    next_nodes=st.next_nodes,
                    config=st.config,
                    metadata=st.metadata,
                    created_at=st.created_at,
                    tasks=st.tasks,
                )

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
            tasks=tuple(getattr(state, "tasks", ())),
        )

    async def save_checkpoint(
        self, thread_id: str, state: dict[str, Any], metadata: dict[str, Any]
    ) -> None:
        config = {"configurable": {"thread_id": thread_id}}
        if hasattr(self.checkpointer, "aput"):
            await self.checkpointer.aput(config, state, metadata, {})

    async def clear_messages(self, thread_id: str, message_ids: list[str]) -> None:
        config = {"configurable": {"thread_id": thread_id}}
        state = await self.checkpointer.aget(config) if hasattr(self.checkpointer, "aget") else None
        if state and hasattr(state, "values") and "messages" in state.values:
            remaining = [
                m for m in state.values["messages"]
                if getattr(m, "id", None) not in message_ids
            ]
            state.values["messages"] = remaining

    async def store_get(
        self, namespace: tuple[str, ...], key: str
    ) -> dict[str, Any] | None:
        item = await self.store.aget(namespace, key)
        return getattr(item, "value", item) if item else None

    async def store_put(
        self, namespace: tuple[str, ...], key: str, value: dict[str, Any]
    ) -> None:
        await self.store.aput(namespace, key, value)
