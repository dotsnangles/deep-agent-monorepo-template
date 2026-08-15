import os
from typing import Any

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import MemorySaver


class CheckpointerFactory:
    """Factory creating in-memory checkpointer for testing and PostgreSQL checkpointer."""

    @staticmethod
    def create_checkpointer(
        env: str | None = None,
        postgres_url: str | None = None,
        pool: Any = None,
    ) -> BaseCheckpointSaver:
        current_env = env or os.getenv("ENVIRONMENT", os.getenv("NODE_ENV", "development"))
        db_url = postgres_url if postgres_url is not None else os.getenv("DATABASE_URL")

        # In testing or when no Postgres URL is provided, always use MemorySaver
        if current_env == "test" or not db_url or db_url.startswith("sqlite") or db_url == "memory":
            return MemorySaver()

        try:
            from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

            if pool is not None:
                return AsyncPostgresSaver(pool)
            return AsyncPostgresSaver.from_conn_string(db_url)
        except Exception as e:
            print(f"[WARN] Failed to instantiate AsyncPostgresSaver: {e}")
            return MemorySaver()
