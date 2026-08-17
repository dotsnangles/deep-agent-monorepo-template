import logging
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI

from src.controllers.artifacts import artifacts_router
from src.controllers.chat import chat_router
from src.controllers.copilotkit import register_copilotkit_agent
from src.controllers.events import events_router
from src.controllers.health import health_router
from src.controllers.title import title_router
from src.infrastructure.config import DATABASE_URL, ENABLE_TITLE_WORKER, REDIS_URL
from src.infrastructure.redis import RedisEventBroker
from src.runtime.runtime import AgentRuntime
from src.workers import TitleGenerationWorker

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """FastAPI application factory with Clean Architecture and lifespan management."""

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.pg_pool = None
        app.state.redis = None
        app.state.broker = None
        app.state.title_worker = None
        app.state.agent_runtime = None

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

        # 2. Initialize AgentRuntime with Production Adapters
        try:
            runtime = await AgentRuntime.create_production(
                db_url=DATABASE_URL,
                redis_url=REDIS_URL,
            )
            app.state.agent_runtime = runtime
            app.state.pg_pool = getattr(getattr(runtime, "persistence", None), "pool", None)
            logger.info("AgentRuntime ready with production adapters.")
        except Exception as e:
            logger.warning("AgentRuntime production initialization failed: %s. Falling back to in-memory.", e)
            app.state.agent_runtime = AgentRuntime.create_in_memory()

        # 3. Initialize & Start Title Generation Queue Worker
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
        if hasattr(app.state, "agent_runtime") and app.state.agent_runtime:
            persistence = getattr(app.state.agent_runtime, "persistence", None)
            if hasattr(persistence, "close"):
                await persistence.close()
        logger.info("Agent runtime connections closed.")
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
