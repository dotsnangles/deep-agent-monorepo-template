import json

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from src.core.redis import RedisEventBroker

events_router = APIRouter(tags=["Events"])


@events_router.get("/events/{thread_id}")
async def stream_events(thread_id: str, request: Request):
    """Server-Sent Events (SSE) endpoint streaming real-time agent events via Redis Pub/Sub."""
    broker: RedisEventBroker | None = getattr(request.app.state, "broker", None)
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
