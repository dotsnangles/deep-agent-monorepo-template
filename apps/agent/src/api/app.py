import logging
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI

from src.api.routes.artifacts import artifacts_router
from src.api.routes.chat import chat_router
from src.api.routes.copilotkit import register_copilotkit_agent
from src.api.routes.events import events_router
from src.api.routes.health import health_router
from src.api.routes.title import title_router
from src.core.checkpointer import CheckpointerFactory
from src.core.config import DATABASE_URL, ENABLE_TITLE_WORKER, REDIS_URL
from src.core.gateway import AgentExecutionGateway
from src.core.redis import RedisEventBroker
from src.graphs.chat.graph import build_agent
from src.workers import TitleGenerationWorker

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """FastAPI application factory with lifecycle management."""

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.pg_pool = None
        app.state.checkpointer = CheckpointerFactory.create_checkpointer()
        app.state.store = None
        app.state.redis = None
        app.state.broker = None
        app.state.title_worker = None
        app.state.gateway = None

        # 1. Initialize Redis Client & Event Broker
        if REDIS_URL:
            try:
                r = aioredis.from_url(REDIS_URL, decode_responses=True)
                await r.ping()
                app.state.redis = r
                broker = RedisEventBroker(r)
                app.state.broker = broker
                if hasattr(app.state, "copilotkit_agent") and app.state.copilotkit_agent:
                    app.state.copilotkit_agent.broker = broker

                logger.info("Redis connected, Pub/Sub broker active (%s).", REDIS_URL)
            except Exception as e:
                logger.warning("Redis connection failed: %s. Using memory fallback.", e)

        # 2. Initialize PostgreSQL Checkpointer & Store via CheckpointerFactory
        if (
            DATABASE_URL
            and not DATABASE_URL.startswith("sqlite")
            and not CheckpointerFactory.is_test_environment()
        ):
            try:
                pool = await CheckpointerFactory.create_pool(DATABASE_URL)
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

                    # Recompile agent graph with persistent checkpointer & store
                    if hasattr(app.state, "copilotkit_agent") and app.state.copilotkit_agent:
                        app.state.copilotkit_agent.graph = build_agent(
                            checkpointer=checkpointer, store=store
                        )
                    logger.info(
                        "PostgreSQL checkpointer & store ready via CheckpointerFactory (%s).",
                        DATABASE_URL,
                    )
            except Exception as e:
                logger.warning("PostgreSQL connection failed: %s. Using in-memory fallback.", e)

        # 3. Initialize AgentExecutionGateway
        app.state.gateway = AgentExecutionGateway(
            checkpointer=app.state.checkpointer,
            store=app.state.store,
            event_broker=app.state.broker,
        )

        # 4. Initialize & Start Title Generation Queue Worker
        if app.state.redis and ENABLE_TITLE_WORKER:
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
        if app.state.pg_pool:
            await app.state.pg_pool.close()
            logger.info("PostgreSQL connection pool closed.")
        if app.state.redis:
            await app.state.redis.aclose()
            logger.info("Redis client closed.")

    app = FastAPI(
        title="Hollow Echo Deep Agent Server",
        description=(
            "Production Python Deep Agent Server with LangChain deepagents, PostgreSQL & Redis"
        ),
        version="0.3.0",
        lifespan=lifespan,
    )

    # Register AG-UI agent endpoint and store on app.state
    app.state.copilotkit_agent = register_copilotkit_agent(app)

    # Register HTTP Routers
    app.include_router(health_router)
    app.include_router(events_router)
    app.include_router(title_router)
    app.include_router(chat_router)
    app.include_router(artifacts_router)

    return app
