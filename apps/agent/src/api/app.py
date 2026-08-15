from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI
from langchain_core.globals import set_llm_cache
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.store.postgres.aio import AsyncPostgresStore
from psycopg_pool import AsyncConnectionPool

from src.api.routes.chat import chat_router
from src.api.routes.copilotkit import register_copilotkit_agent
from src.api.routes.events import events_router
from src.api.routes.health import health_router
from src.api.routes.title import title_router
from src.core.config import DATABASE_URL, REDIS_URL
from src.core.redis import RedisEventBroker, StandardRedisCache
from src.graphs.chat.graph import build_agent
from src.workers.title_worker import TitleGenerationWorker


def create_app() -> FastAPI:
    """FastAPI application factory with lifecycle management."""

    # Temporary placeholder reference for the agent to update during lifespan
    agent_holder: dict = {}

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.pg_pool = None
        app.state.checkpointer = None
        app.state.store = None
        app.state.redis = None
        app.state.broker = None
        app.state.title_worker = None

        # 1. Initialize Redis Cache, Client & Event Broker
        if REDIS_URL:
            try:
                r = aioredis.from_url(REDIS_URL, decode_responses=True)
                await r.ping()
                app.state.redis = r
                broker = RedisEventBroker(r)
                app.state.broker = broker
                if "agent" in agent_holder:
                    agent_holder["agent"].broker = broker

                # Global LLM cache
                set_llm_cache(StandardRedisCache(redis_url=REDIS_URL, ttl=86400))
                print(f"[INIT] Redis connected, Pub/Sub broker & LLM cache active ({REDIS_URL}).")
            except Exception as e:
                print(f"[WARN] Redis connection failed: {e}. Running without Redis cache/broker.")

        # 2. Initialize PostgreSQL Checkpointer & Store
        if DATABASE_URL:
            try:
                pool = AsyncConnectionPool(
                    conninfo=DATABASE_URL,
                    max_size=20,
                    kwargs={"autocommit": True},
                    open=False,
                )
                await pool.open()

                checkpointer = AsyncPostgresSaver(pool)
                await checkpointer.setup()

                store = AsyncPostgresStore(pool)
                await store.setup()

                app.state.pg_pool = pool
                app.state.checkpointer = checkpointer
                app.state.store = store

                # Recompile agent graph with persistent checkpointer & store
                if "agent" in agent_holder:
                    agent_holder["agent"].graph = build_agent(
                        checkpointer=checkpointer, store=store
                    )
                print(f"[INIT] PostgreSQL checkpointer & store ready ({DATABASE_URL}).")
            except Exception as e:
                print(f"[WARN] PostgreSQL connection failed: {e}. Using in-memory fallback.")

        # 3. Initialize & Start Title Generation Queue Worker
        if app.state.redis and app.state.pg_pool:
            title_worker = TitleGenerationWorker(
                redis_client=app.state.redis,
                pg_pool=app.state.pg_pool,
                event_broker=app.state.broker,
            )
            title_worker.start()
            app.state.title_worker = title_worker

        yield

        # Teardown
        if app.state.title_worker:
            await app.state.title_worker.stop()
        if app.state.pg_pool:
            await app.state.pg_pool.close()
            print("[SHUTDOWN] PostgreSQL connection pool closed.")
        if app.state.redis:
            await app.state.redis.aclose()
            print("[SHUTDOWN] Redis client closed.")

    app = FastAPI(
        title="Hollow Echo Deep Agent Server",
        description=(
            "Production Python Deep Agent Server with LangChain deepagents, PostgreSQL & Redis"
        ),
        version="0.3.0",
        lifespan=lifespan,
    )

    # Register AG-UI agent endpoint
    agent_holder["agent"] = register_copilotkit_agent(app)

    # Register HTTP Routers
    app.include_router(health_router)
    app.include_router(events_router)
    app.include_router(title_router)
    app.include_router(chat_router)

    return app
