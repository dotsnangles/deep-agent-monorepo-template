from fastapi import APIRouter, Request

from src.infrastructure.config import DATABASE_URL, LLM_PROVIDER, REDIS_URL

health_router = APIRouter(tags=["Health & Status"])


@health_router.get("/")
def root():
    return {
        "service": "Agent Server",
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


@health_router.get("/health")
async def health(request: Request):
    app = request.app
    postgres_status = "disabled"
    if getattr(app.state, "pg_pool", None):
        try:
            async with app.state.pg_pool.connection() as conn:
                await conn.execute("SELECT 1")
            postgres_status = "connected"
        except Exception as e:
            postgres_status = f"error: {e}"

    redis_status = "disabled"
    if getattr(app.state, "redis", None):
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
        "pubsub_broker": "active" if getattr(app.state, "broker", None) else "inactive",
        "runtime": "AgentRuntime",
    }
