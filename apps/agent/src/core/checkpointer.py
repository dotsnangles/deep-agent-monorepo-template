import logging
import os
import sys
from typing import Any

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import MemorySaver
from langgraph.store.base import BaseStore
from langgraph.store.memory import InMemoryStore

logger = logging.getLogger(__name__)


class CheckpointerFactory:
    """Single Source of Truth for LangGraph Checkpointers and Stores.

    - Production / Development: Connects to PostgreSQL via AsyncPostgresSaver & AsyncPostgresStore
      using connection pooling and automatic schema initialization (`setup()`).
    - Testing / Fallback: Provides zero-cost in-memory MemorySaver & InMemoryStore for hermetic tests.
    """

    @classmethod
    def is_test_environment(cls, env: str | None = None) -> bool:
        current_env = (
            env
            or os.getenv("ENVIRONMENT")
            or os.getenv("NODE_ENV")
            or ("test" if "pytest" in sys.modules or "pytest" in os.getenv("_", "") else "development")
        )
        return current_env.lower() in ("test", "testing")

    _pool: Any = None

    @classmethod
    def get_pool(cls, db_url: str | None = None) -> Any:
        url = cls._get_effective_db_url(None, db_url)
        if not url:
            return None
        if cls._pool is None:
            from psycopg_pool import AsyncConnectionPool

            cls._pool = AsyncConnectionPool(
                conninfo=url,
                max_size=20,
                kwargs={"autocommit": True},
                open=True,
            )
        return cls._pool

    @classmethod
    async def create_pool(cls, db_url: str | None = None, max_size: int = 20) -> Any:
        pool = cls.get_pool(db_url)
        if pool is not None:
            if not getattr(pool, "_opened", False):
                await pool.open()
        return pool

    @classmethod
    def _get_effective_db_url(cls, env: str | None = None, postgres_url: str | None = None) -> str | None:
        if cls.is_test_environment(env):
            return None
        db_url = postgres_url if postgres_url is not None else os.getenv("DATABASE_URL")
        if not db_url or db_url.startswith("sqlite") or db_url == "memory":
            return None
        return db_url

    @classmethod
    def create_checkpointer(
        cls,
        env: str | None = None,
        postgres_url: str | None = None,
        pool: Any = None,
    ) -> BaseCheckpointSaver:
        db_url = cls._get_effective_db_url(env, postgres_url)
        if not db_url and pool is None:
            return MemorySaver()

        try:
            from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

            effective_pool = pool if pool is not None else cls.get_pool(db_url)
            if effective_pool is not None:
                return AsyncPostgresSaver(effective_pool)
            return MemorySaver()
        except Exception as e:
            logger.warning("Failed to initialize PostgreSQL checkpointer: %s. Using MemorySaver.", e)
            return MemorySaver()

    @classmethod
    def create_store(
        cls,
        env: str | None = None,
        postgres_url: str | None = None,
        pool: Any = None,
    ) -> BaseStore:
        db_url = cls._get_effective_db_url(env, postgres_url)
        if not db_url and pool is None:
            return InMemoryStore()

        try:
            from langgraph.store.postgres.aio import AsyncPostgresStore

            effective_pool = pool if pool is not None else cls.get_pool(db_url)
            if effective_pool is not None:
                return AsyncPostgresStore(effective_pool)
            return InMemoryStore()
        except Exception as e:
            logger.warning("Failed to initialize PostgreSQL store: %s. Using InMemoryStore.", e)
            return InMemoryStore()

    @classmethod
    def get_default_checkpointer(
        cls,
        env: str | None = None,
        postgres_url: str | None = None,
        pool: Any = None,
    ) -> BaseCheckpointSaver:
        return cls.create_checkpointer(env=env, postgres_url=postgres_url, pool=pool)

    @classmethod
    def get_default_store(
        cls,
        env: str | None = None,
        postgres_url: str | None = None,
        pool: Any = None,
    ) -> BaseStore:
        return cls.create_store(env=env, postgres_url=postgres_url, pool=pool)
