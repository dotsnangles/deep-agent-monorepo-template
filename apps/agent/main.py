import json
import os
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from copilotkit import LangGraphAGUIAgent
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from langchain_core.globals import set_llm_cache
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.store.postgres.aio import AsyncPostgresStore
from psycopg_pool import AsyncConnectionPool
from pydantic import BaseModel

from agent import LLM_PROVIDER, build_agent, generate_title
from event_broker import RedisEventBroker, RedisStreamingCallbackHandler, StandardRedisCache
from observability import get_langfuse_callback
from title_worker import TitleGenerationWorker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
REDIS_URL = os.getenv("REDIS_URL")


class SessionTrackingLangGraphAGUIAgent(LangGraphAGUIAgent):
    """LangGraphAGUIAgent that propagates conversation thread_id to Langfuse and Redis Pub/Sub."""

    def __init__(self, *args, broker: RedisEventBroker | None = None, **kwargs):
        super().__init__(*args, **kwargs)
        self.broker = broker

    async def prepare_stream(self, input, agent_state, config):
        thread_id = getattr(input, "thread_id", None)
        if thread_id:
            config_meta = config.setdefault("metadata", {})
            config_meta.setdefault("langfuse_session_id", str(thread_id))
            config_meta.setdefault("langfuse_trace_name", "Hollow Echo Deep Agent")

            # Attach Redis streaming callback handler to broadcast events across workers
            if self.broker and self.broker.is_connected():
                callbacks = config.setdefault("callbacks", [])
                if isinstance(callbacks, list):
                    callbacks.append(RedisStreamingCallbackHandler(self.broker, str(thread_id)))

        return await super().prepare_stream(input, agent_state, config)


# Initialize default in-memory agent graph for startup route registration
lf_callback = get_langfuse_callback()
initial_callbacks = [lf_callback] if lf_callback else []
agent_config = {"callbacks": initial_callbacks}

default_agent = SessionTrackingLangGraphAGUIAgent(
    name="default",
    description="Hollow Echo Deep Agent (LangChain deepagents)",
    graph=build_agent(),
    config=agent_config,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for initializing and tearing down Postgres & Redis connections."""
    app.state.pg_pool = None
    app.state.checkpointer = None
    app.state.store = None
    app.state.redis = None
    app.state.broker = None

    # 1. Initialize Redis Cache, Client & Event Broker
    if REDIS_URL:
        try:
            r = aioredis.from_url(REDIS_URL, decode_responses=True)
            await r.ping()
            app.state.redis = r
            broker = RedisEventBroker(r)
            app.state.broker = broker
            default_agent.broker = broker

            # Set global LLM response cache using standard Redis key-value
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
            default_agent.graph = build_agent(checkpointer=checkpointer, store=store)
            print(f"[INIT] PostgreSQL checkpointer & store ready ({DATABASE_URL}).")
        except Exception as e:
            print(f"[WARN] PostgreSQL connection failed: {e}. Using in-memory fallback.")

    # 3. Initialize & Start Title Generation Queue Worker
    title_worker = None
    if app.state.redis and app.state.pg_pool:
        title_worker = TitleGenerationWorker(
            redis_client=app.state.redis,
            pg_pool=app.state.pg_pool,
            event_broker=app.state.broker,
        )
        title_worker.start()
        app.state.title_worker = title_worker

    yield

    # Teardown resources
    if title_worker:
        await title_worker.stop()
    if app.state.pg_pool:
        await app.state.pg_pool.close()
        print("[SHUTDOWN] PostgreSQL connection pool closed.")
    if app.state.redis:
        await app.state.redis.aclose()
        print("[SHUTDOWN] Redis client closed.")


app = FastAPI(
    title="Hollow Echo Deep Agent Server",
    description="Production Python Deep Agent Server with LangChain deepagents, PostgreSQL & Redis",
    version="0.3.0",
    lifespan=lifespan,
)

# Register AG-UI endpoint on FastAPI
add_langgraph_fastapi_endpoint(
    app=app,
    agent=default_agent,
    path="/copilotkit",
)


@app.get("/")
def root():
    return {
        "service": "Hollow Echo Deep Agent Server",
        "framework": "LangChain deepagents + AG-UI",
        "status": "running",
        "llm_provider": LLM_PROVIDER,
        "endpoint": "/copilotkit",
        "persistence": {
            "postgres": bool(DATABASE_URL),
            "redis_cache": bool(REDIS_URL),
            "redis_pubsub": bool(REDIS_URL),
        },
    }


@app.get("/health")
async def health():
    postgres_status = "disabled"
    if app.state.pg_pool:
        try:
            async with app.state.pg_pool.connection() as conn:
                await conn.execute("SELECT 1")
            postgres_status = "connected"
        except Exception as e:
            postgres_status = f"error: {e}"

    redis_status = "disabled"
    if app.state.redis:
        try:
            await app.state.redis.ping()
            redis_status = "connected"
        except Exception as e:
            redis_status = f"error: {e}"

    return {
        "status": "healthy",
        "framework": "deepagents",
        "provider": LLM_PROVIDER,
        "postgres": postgres_status,
        "redis": redis_status,
        "pubsub_broker": "active" if app.state.broker else "inactive",
        "checkpointer": "AsyncPostgresSaver" if app.state.checkpointer else "MemorySaver",
        "store": "AsyncPostgresStore" if app.state.store else "None",
    }


@app.get("/events/{thread_id}")
async def stream_events(thread_id: str):
    """Server-Sent Events (SSE) endpoint streaming real-time agent events via Redis Pub/Sub."""
    broker: RedisEventBroker | None = getattr(app.state, "broker", None)
    if not broker or not broker.is_connected():
        return {"error": "Redis event broker is not active."}

    async def event_generator():
        async for event in broker.subscribe(thread_id):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


class TitleRequest(BaseModel):
    prompt: str


class TitleResponse(BaseModel):
    title: str
    provider: str


@app.post("/api/title", response_model=TitleResponse)
async def create_title(body: TitleRequest):
    """Generates a smart summary title using LangChain and the configured LLM provider."""
    summary_title = await generate_title(body.prompt)
    return {"title": summary_title, "provider": LLM_PROVIDER}


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("SERVER_HOST", "0.0.0.0")
    port = int(os.getenv("SERVER_PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=True)
