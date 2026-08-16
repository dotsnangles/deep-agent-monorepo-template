import logging
import os
from typing import Any

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import MemorySaver
from langgraph.store.base import BaseStore
from langgraph.store.memory import InMemoryStore

logger = logging.getLogger(__name__)


class CheckpointerFactory:
    """Single Source of Truth for LangGraph Checkpointers and Stores (ADR-0024).

    - PostgreSQL Mode: When `DATABASE_URL` or an active `AsyncConnectionPool` is provided,
      instantiates `AsyncPostgresSaver` and `AsyncPostgresStore`.
    - Memory Fallback: When no database URL or pool is provided, safely returns
      `MemorySaver` and `InMemoryStore` for lightweight testing or stateless workflows.
    """

    _pool: Any = None

    @classmethod
    def get_pool(cls, db_url: str | None = None) -> Any:
        """Returns the active shared connection pool instance if opened."""
        return cls._pool

    @classmethod
    async def create_pool(cls, db_url: str | None = None, max_size: int = 20) -> Any:
        """Asynchronously initializes and opens the singleton connection pool.

        Must be called within an active async event loop (e.g. during FastAPI lifespan).
        """
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
        """Gracefully closes the active singleton connection pool and resets the reference."""
        if cls._pool is not None:
            try:
                await cls._pool.close()
            except Exception as e:
                logger.warning("Error closing PostgreSQL connection pool: %s", e)
            finally:
                cls._pool = None

    @classmethod
    def _get_effective_db_url(cls, postgres_url: str | None = None) -> str | None:
        """Extracts and validates database connection URL without heuristic sniffing."""
        db_url = postgres_url if postgres_url is not None else os.getenv("DATABASE_URL")
        if not db_url or db_url.startswith("sqlite") or db_url == "memory":
            return None
        return db_url

    @classmethod
    def _resolve_pool(
        cls, postgres_url: str | None = None, pool: Any = None
    ) -> tuple[str | None, Any]:
        """Resolves effective database URL and connection pool."""
        db_url = cls._get_effective_db_url(postgres_url)
        effective_pool = pool if pool is not None else cls._pool
        return db_url, effective_pool

    @classmethod
    def create_checkpointer(
        cls,
        postgres_url: str | None = None,
        pool: Any = None,
    ) -> BaseCheckpointSaver:
        """Creates a checkpointer instance deterministically based on pool or URL."""
        db_url, effective_pool = cls._resolve_pool(postgres_url, pool)

        if not db_url or effective_pool is None:
            return MemorySaver()

        try:
            from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

            return AsyncPostgresSaver(effective_pool)
        except Exception as e:
            logger.warning(
                "Failed to initialize PostgreSQL checkpointer: %s. Using MemorySaver.", e
            )
            return MemorySaver()

    @classmethod
    def create_store(
        cls,
        postgres_url: str | None = None,
        pool: Any = None,
    ) -> BaseStore:
        """Creates a store instance deterministically based on pool or URL."""
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
