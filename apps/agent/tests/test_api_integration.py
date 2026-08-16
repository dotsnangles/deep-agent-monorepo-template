import pytest
from httpx import ASGITransport, AsyncClient

from src.api.app import create_app
from src.core.gateway import AgentExecutionGateway
from src.core.testing import FakeChatModel


@pytest.mark.asyncio
async def test_chat_stream_api_endpoint_returns_sse_stream():
    app = create_app()

    fake_model = FakeChatModel(tokens=["FastAPI", " ", "SSE", " ", "Response"])
    app.state.gateway = AgentExecutionGateway(model=fake_model)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "thread_id": "test_session_sse",
            "messages": [
                {"role": "user", "content": "Hello agent"},
            ],
            "agent_type": "direct",
        }

        response = await client.post("/chat/stream", json=payload)
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")

        body_text = response.text
        assert "event: token" in body_text
        assert "FastAPI" in body_text
        assert "event: done" in body_text
        assert '"finish_reason": "stop"' in body_text


@pytest.mark.asyncio
async def test_health_check_endpoint():
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
