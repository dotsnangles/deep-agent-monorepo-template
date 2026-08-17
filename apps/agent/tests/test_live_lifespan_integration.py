import json
import logging
import time

import pytest
from httpx import ASGITransport, AsyncClient

from src.controllers.app import create_app
from src.infrastructure import FakeChatModel


@pytest.mark.asyncio
async def test_live_fastapi_lifespan_and_chat_streaming(caplog):
    """End-to-end integration test for FastAPI lifespan, /health endpoint,

    and /chat/stream SSE event streaming with zero connection pool warnings.
    """
    caplog.set_level(logging.WARNING)

    app = create_app()

    async with app.router.lifespan_context(app):
        # Override runtime model with deterministic FakeChatModel
        fake_model = FakeChatModel(tokens=["안녕하세요!", " ", "통합", " ", "테스트입니다."])
        app.state.agent_runtime.model = fake_model

        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport, base_url="http://testserver", timeout=30.0
        ) as client:
            # 1. Verify GET /health
            health_res = await client.get("/health")
            assert health_res.status_code == 200
            health_data = health_res.json()
            assert health_data["status"] == "healthy"
            assert health_data["framework"] == "deepagents"

            # 2. Verify POST /chat/stream
            session_id = f"test-stream-session-{int(time.time())}"
            stream_payload = {
                "thread_id": session_id,
                "messages": [
                    {
                        "role": "user",
                        "content": "테스트 메시지입니다.",
                    }
                ],
                "agent_type": "direct",
            }

            token_chunks = []
            events_received = []

            current_event = None
            async with client.stream("POST", "/chat/stream", json=stream_payload) as response:
                assert response.status_code == 200
                assert "text/event-stream" in response.headers.get("content-type", "")

                async for line in response.aiter_lines():
                    if line.startswith("event: "):
                        current_event = line[7:].strip()
                        events_received.append(current_event)
                    elif line.startswith("data: "):
                        data_str = line[6:].strip()
                        try:
                            data = json.loads(data_str)
                            if current_event == "token":
                                token_chunks.append(data.get("content", ""))
                        except Exception:
                            pass

            assert "token" in events_received
            assert "done" in events_received
            full_response = "".join(token_chunks)
            assert "안녕하세요!" in full_response
            assert "통합" in full_response

    # 3. Verify zero connection pool warnings occurred
    for record in caplog.records:
        assert "error connecting in 'pool-1'" not in record.message
