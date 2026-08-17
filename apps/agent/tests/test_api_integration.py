import pytest
from httpx import ASGITransport, AsyncClient
from langchain_core.tools import tool
from langgraph.checkpoint.memory import MemorySaver

from src.controllers.app import create_app
from src.core import FakeChatModel
from src.graphs.chat import build_agent
from src.graphs.registry import GraphRegistry
from src.runtime import AgentRuntime


@pytest.mark.asyncio
async def test_chat_stream_api_endpoint_returns_sse_stream():
    app = create_app()

    fake_model = FakeChatModel(tokens=["FastAPI", " ", "SSE", " ", "Response"])
    app.state.agent_runtime = AgentRuntime.create_in_memory(model=fake_model)

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
async def test_chat_stream_api_endpoint_accepts_attachments():
    app = create_app()

    fake_model = FakeChatModel(tokens=["Visual", " ", "Summary"])
    app.state.agent_runtime = AgentRuntime.create_in_memory(model=fake_model)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "threadId": "test_session_multimodal_sse",
            "messages": [
                {
                    "role": "user",
                    "content": "Please analyze this image",
                    "attachments": [
                        {
                            "id": "att-api-1",
                            "name": "preview.png",
                            "url": "https://s3.local/preview.png",
                            "mimeType": "image/png",
                            "size": 4096,
                            "s3Key": "attachments/preview.png",
                        }
                    ],
                },
            ],
            "agentType": "direct",
        }

        response = await client.post("/chat/stream", json=payload)
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")

        body_text = response.text
        assert "event: token" in body_text
        assert "Visual" in body_text
        assert "event: done" in body_text


@pytest.mark.asyncio
async def test_chat_stream_api_endpoint_accepts_user_id():
    app = create_app()

    fake_model = FakeChatModel(tokens=["User", " ", "Traced"])
    app.state.agent_runtime = AgentRuntime.create_in_memory(model=fake_model)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "threadId": "test_session_user_traced",
            "userId": "usr_test_stream_user",
            "messages": [
                {"role": "user", "content": "Hello with user tracing"},
            ],
            "agentType": "direct",
        }

        response = await client.post("/chat/stream", json=payload)
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")

        body_text = response.text
        assert "event: token" in body_text
        assert "User" in body_text
        assert "event: done" in body_text


@pytest.mark.asyncio
async def test_chat_stream_api_endpoint_handles_hitl_interrupt_and_approval():
    app = create_app()

    tool_call = {
        "name": "execute_command",
        "args": {"command": "ls -la"},
        "id": "call_api_1",
    }
    fake_model = FakeChatModel(
        tool_calls=[tool_call],
        tokens=["디렉토리", " ", "조회", " ", "완료"],
    )

    @tool
    def execute_command(command: str) -> str:
        """Executes command."""
        return f"Executed: {command}"

    checkpointer = MemorySaver()
    registry = GraphRegistry()
    registry.register(
        "hitl_api",
        lambda **kw: build_agent(
            tools=[execute_command],
            interrupt_on={"execute_command": True},
            **kw,
        ),
    )

    runtime = AgentRuntime.create_in_memory(
        model=fake_model,
        registry=registry,
    )
    runtime.persistence.checkpointer = checkpointer
    app.state.agent_runtime = runtime

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. First stream triggers interrupt
        payload1 = {
            "threadId": "thread_api_hitl_approve",
            "messages": [{"role": "user", "content": "목록 보여줘"}],
            "agentType": "hitl_api",
        }
        res1 = await client.post("/chat/stream", json=payload1)
        assert res1.status_code == 200
        assert "event: approval_request" in res1.text
        assert '"toolCallId": "call_api_1"' in res1.text
        assert '"finish_reason": "interrupt"' in res1.text

        # 2. Next invocation clears tool calls so it generates completion tokens
        fake_model.tool_calls = None

        # 3. Second stream resumes with approval
        payload2 = {
            "threadId": "thread_api_hitl_approve",
            "messages": [],
            "agentType": "hitl_api",
            "resume": {
                "toolCallId": "call_api_1",
                "approved": True,
            },
        }
        res2 = await client.post("/chat/stream", json=payload2)
        assert res2.status_code == 200
        assert "event: token" in res2.text
        assert "조회" in res2.text
        assert '"finish_reason": "stop"' in res2.text


@pytest.mark.asyncio
async def test_chat_stream_api_endpoint_handles_hitl_rejection():
    app = create_app()

    tool_call = {
        "name": "delete_resource",
        "args": {"resource_id": "res_del_1"},
        "id": "call_api_del_1",
    }
    fake_model = FakeChatModel(
        tool_calls=[tool_call],
        tokens=["삭제가", " ", "거절되었습니다."],
    )

    @tool
    def delete_resource(resource_id: str) -> str:
        """Deletes resource."""
        return f"Deleted: {resource_id}"

    checkpointer = MemorySaver()
    registry = GraphRegistry()
    registry.register(
        "hitl_api",
        lambda **kw: build_agent(
            tools=[delete_resource],
            interrupt_on={"delete_resource": True},
            **kw,
        ),
    )

    runtime = AgentRuntime.create_in_memory(
        model=fake_model,
        registry=registry,
    )
    runtime.persistence.checkpointer = checkpointer
    app.state.agent_runtime = runtime

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Trigger interrupt
        payload1 = {
            "threadId": "thread_api_hitl_reject",
            "messages": [{"role": "user", "content": "삭제"}],
            "agentType": "hitl_api",
        }
        res1 = await client.post("/chat/stream", json=payload1)
        assert res1.status_code == 200
        assert "event: approval_request" in res1.text

        # 2. Clear tool calls
        fake_model.tool_calls = None

        # 3. Resume with rejection
        payload2 = {
            "threadId": "thread_api_hitl_reject",
            "messages": [],
            "agentType": "hitl_api",
            "resume": {
                "toolCallId": "call_api_del_1",
                "approved": False,
                "reason": "사용자가 거부했습니다.",
            },
        }
        res2 = await client.post("/chat/stream", json=payload2)
        assert res2.status_code == 200
        assert "event: token" in res2.text
        assert "거절" in res2.text
        assert '"finish_reason": "stop"' in res2.text


@pytest.mark.asyncio
async def test_chat_stream_api_endpoint_handles_internal_errors():
    app = create_app()

    class BrokenModel(FakeChatModel):
        def _generate(self, *args, **kwargs):
            raise RuntimeError("Database connection dropped during inference")

        async def _agenerate(self, *args, **kwargs):
            raise RuntimeError("Database connection dropped during inference")

        async def _astream(self, *args, **kwargs):
            raise RuntimeError("Database connection dropped during inference")
            yield

    app.state.agent_runtime = AgentRuntime.create_in_memory(model=BrokenModel())

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "threadId": "thread_err_1",
            "messages": [{"role": "user", "content": "Error trigger"}],
            "agentType": "direct",
        }
        response = await client.post("/chat/stream", json=payload)
        assert response.status_code == 200
        assert "event: error" in response.text
        assert "Database connection dropped during inference" in response.text
