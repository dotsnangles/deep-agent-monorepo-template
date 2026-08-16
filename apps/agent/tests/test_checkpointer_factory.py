import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langgraph.checkpoint.memory import MemorySaver
from langgraph.store.memory import InMemoryStore

from src.core.checkpointer import CheckpointerFactory
from src.core.gateway import AgentExecutionGateway


class TestCheckpointerFactory:
    def setup_method(self):
        CheckpointerFactory._pool = None

    def test_no_db_url_returns_memory_saver(self):
        with patch.dict(os.environ, {"DATABASE_URL": ""}):
            saver = CheckpointerFactory.create_checkpointer(postgres_url="")
            assert isinstance(saver, MemorySaver)

            store = CheckpointerFactory.create_store(postgres_url="")
            assert isinstance(store, InMemoryStore)

    def test_sqlite_or_memory_url_fallback(self):
        saver = CheckpointerFactory.create_checkpointer(postgres_url="sqlite:///test.db")
        assert isinstance(saver, MemorySaver)

        store = CheckpointerFactory.create_store(postgres_url="memory")
        assert isinstance(store, InMemoryStore)

    def test_unopened_pool_fallback_to_memory(self):
        # When db_url is set but no pool is opened yet, returns MemorySaver safely
        saver = CheckpointerFactory.create_checkpointer(
            postgres_url="postgresql://user:pass@localhost:5432/db", pool=None
        )
        assert isinstance(saver, MemorySaver)

        store = CheckpointerFactory.create_store(
            postgres_url="postgresql://user:pass@localhost:5432/db", pool=None
        )
        assert isinstance(store, InMemoryStore)

    def test_postgres_saver_and_store_instantiation_with_pool(self):
        mock_pool = MagicMock()
        mock_saver_inst = MagicMock()
        mock_store_inst = MagicMock()

        with (
            patch(
                "langgraph.checkpoint.postgres.aio.AsyncPostgresSaver", return_value=mock_saver_inst
            ) as mock_saver_cls,
            patch(
                "langgraph.store.postgres.aio.AsyncPostgresStore", return_value=mock_store_inst
            ) as mock_store_cls,
        ):
            saver = CheckpointerFactory.create_checkpointer(
                postgres_url="postgresql://user:pass@localhost:5432/db",
                pool=mock_pool,
            )
            mock_saver_cls.assert_called_once_with(mock_pool)
            assert saver == mock_saver_inst

            store = CheckpointerFactory.create_store(
                postgres_url="postgresql://user:pass@localhost:5432/db",
                pool=mock_pool,
            )
            mock_store_cls.assert_called_once_with(mock_pool)
            assert store == mock_store_inst

    @pytest.mark.asyncio
    async def test_create_pool_async_open(self):
        mock_pool_instance = MagicMock()
        mock_pool_instance.open = AsyncMock()

        with patch(
            "psycopg_pool.AsyncConnectionPool", return_value=mock_pool_instance
        ) as mock_pool_cls:
            pool = await CheckpointerFactory.create_pool("postgresql://user:pass@localhost:5432/db")
            assert pool == mock_pool_instance
            mock_pool_cls.assert_called_once()
            mock_pool_instance.open.assert_awaited_once()

    def test_gateway_default_checkpointer_integration(self):
        with patch.object(
            CheckpointerFactory, "get_default_checkpointer", return_value=MemorySaver()
        ) as mock_get_default:
            gateway = AgentExecutionGateway()
            mock_get_default.assert_called_once()
            assert isinstance(gateway.checkpointer, MemorySaver)
