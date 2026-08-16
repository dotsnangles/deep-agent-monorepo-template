import asyncio
import os
from unittest.mock import patch

import pytest
from langchain_core.messages import HumanMessage

from src.core.config import (
    EnvironmentMode,
    get_deep_agent_mode,
    get_inference_concurrency_limit,
)
from src.core.gateway import AgentExecutionGateway
from src.core.testing import FakeChatModel


def test_environment_mode_defaults_and_resolution():
    """Verify DEEP_AGENT_MODE defaults to local_slm for Ollama and allows overrides."""
    with patch.dict(os.environ, {"LLM_PROVIDER": "ollama", "DEEP_AGENT_MODE": ""}):
        mode = get_deep_agent_mode()
        assert mode == EnvironmentMode.LOCAL_SLM
        assert get_inference_concurrency_limit() == 1

    with patch.dict(os.environ, {"LLM_PROVIDER": "openai", "DEEP_AGENT_MODE": ""}):
        mode = get_deep_agent_mode()
        assert mode == EnvironmentMode.PRODUCTION_CLOUD
        assert get_inference_concurrency_limit() is None

    with patch.dict(os.environ, {"LLM_PROVIDER": "ollama", "DEEP_AGENT_MODE": "production_cloud"}):
        mode = get_deep_agent_mode()
        assert mode == EnvironmentMode.PRODUCTION_CLOUD

    with patch.dict(os.environ, {"LLM_PROVIDER": "anthropic", "DEEP_AGENT_MODE": "local_slm"}):
        mode = get_deep_agent_mode()
        assert mode == EnvironmentMode.LOCAL_SLM
        assert get_inference_concurrency_limit() == 1

    with patch.dict(os.environ, {"LLM_CONCURRENCY_LIMIT": "3"}):
        assert get_inference_concurrency_limit() == 3


@pytest.mark.asyncio
async def test_inference_serialization_gateway_serializes_local_slm():
    """Verify that multiple concurrent streams are serialized under local_slm mode."""
    execution_order = []
    active_concurrent_count = 0
    max_observed_concurrency = 0

    class DelayedFakeChatModel(FakeChatModel):
        async def astream(self, messages, config=None):
            nonlocal active_concurrent_count, max_observed_concurrency
            active_concurrent_count += 1
            max_observed_concurrency = max(max_observed_concurrency, active_concurrent_count)
            task_id = config.get("configurable", {}).get("thread_id", "unknown")
            execution_order.append(f"start_{task_id}")
            await asyncio.sleep(0.05)
            execution_order.append(f"end_{task_id}")
            active_concurrent_count -= 1
            yield HumanMessage(content=f"Reply to {task_id}")

    # Set local_slm mode with concurrency_limit = 1
    with patch.dict(os.environ, {"DEEP_AGENT_MODE": "local_slm", "LLM_PROVIDER": "ollama"}):
        model = DelayedFakeChatModel()
        gateway = AgentExecutionGateway(model=model)

        async def run_stream(thread_id: str):
            events = []
            async for ev in gateway.stream_execution(
                messages=[{"role": "user", "content": f"Hello from {thread_id}"}],
                thread_id=thread_id,
                agent_type="direct",
                model=model,
            ):
                events.append(ev)
            return events

        # Launch 3 streams simultaneously
        await asyncio.gather(
            run_stream("t1"),
            run_stream("t2"),
            run_stream("t3"),
        )

        # Under local_slm Single-Flight serialization, max concurrency MUST be 1
        assert max_observed_concurrency == 1
        assert len(execution_order) == 6
        # Every start must be immediately followed by its end before next start
        for i in range(0, 6, 2):
            start_item = execution_order[i]
            end_item = execution_order[i + 1]
            task_name = start_item.replace("start_", "")
            assert start_item == f"start_{task_name}"
            assert end_item == f"end_{task_name}"
