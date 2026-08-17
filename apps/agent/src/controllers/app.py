import logging
import os
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI

from src.controllers.artifacts import artifacts_router
from src.controllers.chat import chat_router
from src.controllers.copilotkit import register_copilotkit_agent
from src.controllers.events import events_router
from src.controllers.health import health_router
from src.controllers.title import title_router
from src.core.checkpointer import CheckpointerFactory
from src.core.config import DATABASE_URL, ENABLE_TITLE_WORKER, REDIS_URL
from src.core.redis import RedisEventBroker
from src.graphs.chat.graph import build_agent
from src.infrastructure.persistence.adapter import (
    InMemoryPersistenceAdapter,
    PostgresPersistenceAdapter,
)
from src.infrastructure.sandbox.adapter import InProcessSandboxAdapter
from src.infrastructure.storage.adapter import (
    InMemoryStorageAdapter,
    S3StorageAdapter,
)
from src.runtime import AgentRuntime
from src.workers import TitleGenerationWorker

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """FastAPI application factory with Clean Architecture and lifespan management."""

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        db_url = os.getenv("DATABASE_URL") or DATABASE_URL
        redis_url = os.getenv("REDIS_URL") or REDIS_URL
        enable_title_worker = (os.getenv("ENABLE_TITLE_WORKER", "false").lower() == "true") or ENABLE_TITLE_WORKER

        app.state.pg_pool = None
        app.state.checkpointer = CheckpointerFactory.create_checkpointer()
        app.state.store = None
        app.state.redis = None
        app.state.broker = None
        app.state.title_worker = None
        app.state.agent_runtime = None

        # 1. Initialize Redis Client & Event Broker
        if redis_url:
            try:
                r = aioredis.from_url(redis_url, decode_responses=True)
                await r.ping()
                app.state.redis = r
                broker = RedisEventBroker(r)
                app.state.broker = broker
                if hasattr(app.state, "copilotkit_agent") and app.state.copilotkit_agent:
                    app.state.copilotkit_agent.broker = broker

                logger.info("Redis connected, Pub/Sub broker active (%s).", redis_url)
            except Exception as e:
                logger.warning("Redis connection failed: %s. Using memory fallback.", e)

        # 2. Initialize PostgreSQL Checkpointer & Store via CheckpointerFactory
        if db_url and not db_url.startswith("sqlite"):
            try:
                pool = await CheckpointerFactory.create_pool(db_url)
                if pool:
                    checkpointer = CheckpointerFactory.create_checkpointer(pool=pool)
                    if hasattr(checkpointer, "setup"):
                        await checkpointer.setup()

                    store = CheckpointerFactory.create_store(pool=pool)
                    if hasattr(store, "setup"):
                        await store.setup()

                    app.state.pg_pool = pool
                    app.state.checkpointer = checkpointer
                    app.state.store = store

                    if hasattr(app.state, "copilotkit_agent") and app.state.copilotkit_agent:
                        app.state.copilotkit_agent.graph = build_agent(
                            checkpointer=checkpointer, store=store
                        )
                    logger.info(
                        "PostgreSQL checkpointer & store ready via CheckpointerFactory (%s).",
                        db_url,
                    )
            except Exception as e:
                logger.warning("PostgreSQL connection failed: %s. Using in-memory fallback.", e)

        # 3. Initialize AgentRuntime
        if app.state.pg_pool:
            persistence = PostgresPersistenceAdapter(
                checkpointer=app.state.checkpointer,
                store=app.state.store,
                pool=app.state.pg_pool,
            )
            storage = S3StorageAdapter(db_pool=app.state.pg_pool)
        else:
            persistence = InMemoryPersistenceAdapter(
                checkpointer=app.state.checkpointer,
                store=app.state.store,
            )
            storage = InMemoryStorageAdapter()

        sandbox = InProcessSandboxAdapter()
        app.state.agent_runtime = AgentRuntime(
            persistence=persistence,
            sandbox=sandbox,
            storage=storage,
            event_broker=app.state.broker,
        )

        # 4. Initialize & Start Title Generation Queue Worker
        if app.state.redis and enable_title_worker:
            title_worker = TitleGenerationWorker(
                redis_client=app.state.redis,
                event_broker=app.state.broker,
                pg_pool=app.state.pg_pool,
            )
            title_worker.start()
            app.state.title_worker = title_worker
        elif app.state.redis:
            logger.info("Title generation worker disabled (ENABLE_TITLE_WORKER=false).")

        yield

        # Teardown
        if app.state.title_worker:
            await app.state.title_worker.stop()
        await CheckpointerFactory.close_pool()
        logger.info("PostgreSQL connection pool closed.")
        if app.state.redis:
            await app.state.redis.aclose()
            logger.info("Redis client closed.")

    app = FastAPI(
        title="Agent Server",
        description="Clean Architecture Python Deep Agent Server with LangChain deepagents & AgentRuntime",
        version="0.4.0",
        lifespan=lifespan,
    )

    # Register AG-UI agent endpoint and store on app.state
    app.state.copilotkit_agent = register_copilotkit_agent(app)

    # Register HTTP Controllers
    app.include_router(health_router)
    app.include_router(events_router)
    app.include_router(title_router)
    app.include_router(chat_router)
    app.include_router(artifacts_router)

    return app


# Default app instance for ASGI servers
app = create_app()
