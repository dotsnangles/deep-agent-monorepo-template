import os
from unittest.mock import MagicMock, patch

import pytest
from langgraph.checkpoint.memory import MemorySaver
from langgraph.store.memory import InMemoryStore

from src.core.checkpointer import CheckpointerFactory
from src.core.gateway import AgentExecutionGateway


class TestCheckpointerFactory:
    def test_test_environment_returns_memory_saver(self):
        saver = CheckpointerFactory.create_checkpointer(env="test")
        assert isinstance(saver, MemorySaver)

        store = CheckpointerFactory.create_store(env="test")
        assert isinstance(store, InMemoryStore)

    def test_no_db_url_returns_memory_saver(self):
        with patch.dict(os.environ, {"DATABASE_URL": "", "ENVIRONMENT": "production"}):
            saver = CheckpointerFactory.create_checkpointer(env="production", postgres_url="")
            assert isinstance(saver, MemorySaver)

            store = CheckpointerFactory.create_store(env="production", postgres_url="")
            assert isinstance(store, InMemoryStore)

    def test_sqlite_or_memory_url_fallback(self):
        saver = CheckpointerFactory.create_checkpointer(
            env="production", postgres_url="sqlite:///test.db"
        )
        assert isinstance(saver, MemorySaver)

        store = CheckpointerFactory.create_store(
            env="production", postgres_url="memory"
        )
        assert isinstance(store, InMemoryStore)

    def test_postgres_saver_and_store_instantiation(self):
        mock_pool = MagicMock()
        mock_saver_inst = MagicMock()
        mock_store_inst = MagicMock()

        with patch("langgraph.checkpoint.postgres.aio.AsyncPostgresSaver", return_value=mock_saver_inst) as mock_saver_cls, \
             patch("langgraph.store.postgres.aio.AsyncPostgresStore", return_value=mock_store_inst) as mock_store_cls:
            saver = CheckpointerFactory.create_checkpointer(
                env="production",
                postgres_url="postgresql://user:pass@localhost:5432/db",
                pool=mock_pool,
            )
            mock_saver_cls.assert_called_once_with(mock_pool)
            assert saver == mock_saver_inst

            store = CheckpointerFactory.create_store(
                env="production",
                postgres_url="postgresql://user:pass@localhost:5432/db",
                pool=mock_pool,
            )
            mock_store_cls.assert_called_once_with(mock_pool)
            assert store == mock_store_inst

    def test_gateway_default_checkpointer_integration(self):
        with patch.object(CheckpointerFactory, "get_default_checkpointer", return_value=MemorySaver()) as mock_get_default:
            gateway = AgentExecutionGateway()
            mock_get_default.assert_called_once()
            assert isinstance(gateway.checkpointer, MemorySaver)
