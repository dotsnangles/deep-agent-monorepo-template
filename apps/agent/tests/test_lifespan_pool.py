from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langgraph.checkpoint.memory import MemorySaver
from langgraph.store.memory import InMemoryStore

from src.api.app import create_app
from src.core.checkpointer import CheckpointerFactory


@pytest.mark.asyncio
async def test_lifespan_manages_postgres_pool_lifecycle_and_injections():
    """Verifies that FastAPI lifespan initializes, sets up, injects, and closes the pool."""

    class MockSaver(MemorySaver):
        def __init__(self):
            super().__init__()
            self.setup = AsyncMock()

    class MockStore(InMemoryStore):
        def __init__(self):
            super().__init__()
            self.setup = AsyncMock()

    mock_pool = MagicMock()
    mock_pool.close = AsyncMock()

    mock_checkpointer = MockSaver()
    mock_store = MockStore()

    mock_redis = MagicMock()
    mock_redis.ping = AsyncMock()
    mock_redis.aclose = AsyncMock()

    async def fake_create_pool(db_url=None, max_size=20):
        CheckpointerFactory._pool = mock_pool
        return mock_pool

    with (
        patch(
            "src.api.app.DATABASE_URL",
            "postgresql://postgres:password@localhost:5432/app_test_db",
        ),
        patch("src.api.app.REDIS_URL", "redis://localhost:6379/0"),
        patch("src.api.app.ENABLE_TITLE_WORKER", True),
        patch(
            "src.core.checkpointer.CheckpointerFactory.create_pool",
            side_effect=fake_create_pool,
        ) as mock_create_pool,
        patch(
            "src.core.checkpointer.CheckpointerFactory.create_checkpointer",
            return_value=mock_checkpointer,
        ) as mock_create_cp,
        patch(
            "src.core.checkpointer.CheckpointerFactory.create_store",
            return_value=mock_store,
        ) as mock_create_st,
        patch("redis.asyncio.from_url", return_value=mock_redis),
        patch("src.api.app.TitleGenerationWorker") as mock_worker_cls,
    ):
        mock_worker_inst = MagicMock()
        mock_worker_inst.start = MagicMock()
        mock_worker_inst.stop = AsyncMock()
        mock_worker_cls.return_value = mock_worker_inst

        app = create_app()

        async with app.router.lifespan_context(app):
            # 1. Verify pool creation & setup called
            mock_create_pool.assert_awaited_once_with(
                "postgresql://postgres:password@localhost:5432/app_test_db"
            )
            mock_create_cp.assert_called()
            mock_checkpointer.setup.assert_awaited_once()

            mock_create_st.assert_called()
            mock_store.setup.assert_awaited_once()

            # 2. Verify state injections
            assert app.state.pg_pool == mock_pool
            assert app.state.checkpointer == mock_checkpointer
            assert app.state.store == mock_store
            assert app.state.gateway is not None
            assert app.state.gateway.checkpointer == mock_checkpointer
            assert app.state.gateway.store == mock_store

            # 3. Verify worker received shared pg_pool
            mock_worker_cls.assert_called_once()
            _, worker_kwargs = mock_worker_cls.call_args
            assert worker_kwargs.get("pg_pool") == mock_pool
            mock_worker_inst.start.assert_called_once()

        # 4. Verify teardown
        mock_worker_inst.stop.assert_awaited_once()
        mock_pool.close.assert_awaited_once()
        mock_redis.aclose.assert_awaited_once()
