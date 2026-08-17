import pytest
from httpx import ASGITransport, AsyncClient

from src.controllers.app import create_app
from src.runtime.runtime import AgentRuntime
from src.infrastructure.models.adapter import FakeChatModelAdapter


@pytest.fixture
def app_with_test_runtime():
    app = create_app()
    fake_model = FakeChatModelAdapter(scripted_tokens=["Hello", " from", " test", " controller!"])
    app.state.agent_runtime = AgentRuntime.create_in_memory(model=fake_model)
    return app


class TestControllers:
    @pytest.mark.asyncio
    async def test_health_endpoint(self, app_with_test_runtime):
        async with AsyncClient(
            transport=ASGITransport(app=app_with_test_runtime), base_url="http://test"
        ) as client:
            res = await client.get("/health")
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "healthy"

    @pytest.mark.asyncio
    async def test_chat_stream_endpoint(self, app_with_test_runtime):
        payload = {
            "threadId": "test-controller-thread-1",
            "messages": [
                {
                    "role": "user",
                    "content": "Hello controller",
                    "attachments": [],
                }
            ],
            "agentType": "default",
        }
        async with AsyncClient(
            transport=ASGITransport(app=app_with_test_runtime), base_url="http://test"
        ) as client:
            res = await client.post("/chat/stream", json=payload)
            assert res.status_code == 200
            assert "text/event-stream" in res.headers["content-type"]
            body = res.text
            assert "event: token" in body
            assert "event: done" in body
            assert "Hello" in body

    @pytest.mark.asyncio
    async def test_chat_stream_resume_endpoint(self, app_with_test_runtime):
        payload = {
            "threadId": "test-controller-thread-2",
            "resume": {
                "toolCallId": "call_123",
                "approved": True,
                "reason": "Proceed with operation",
            },
        }
        async with AsyncClient(
            transport=ASGITransport(app=app_with_test_runtime), base_url="http://test"
        ) as client:
            res = await client.post("/chat/stream", json=payload)
            assert res.status_code == 200
            assert "text/event-stream" in res.headers["content-type"]
            body = res.text
            assert "event: done" in body
