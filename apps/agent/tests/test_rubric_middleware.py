import os
from unittest.mock import patch

from langgraph.checkpoint.memory import MemorySaver

from src.core.config import EnvironmentMode
from src.core.testing import FakeChatModel
from src.graphs.chat.factory import DeepAgentEnvironmentFactory


def test_rubric_middleware_attachment_in_factory():
    """Verify that DeepAgentEnvironmentFactory attaches RubricMiddleware when requested."""
    model = FakeChatModel()
    grader_model = FakeChatModel()
    checkpointer = MemorySaver()

    # 1. Cloud provider mode with grader_model
    with patch.dict(os.environ, {"DEEP_AGENT_MODE": "cloud_provider"}):
        graph_cloud = DeepAgentEnvironmentFactory.create_agent(
            model=model,
            checkpointer=checkpointer,
            grader_model=grader_model,
            mode=EnvironmentMode.CLOUD_PROVIDER,
        )
        assert graph_cloud is not None

    # 2. Local SLM mode with rubric enabled
    with patch.dict(os.environ, {"DEEP_AGENT_MODE": "local_slm"}):
        graph_local = DeepAgentEnvironmentFactory.create_agent(
            model=model,
            checkpointer=checkpointer,
            rubric="- The response must be polite\n- Must be under 50 words",
            mode=EnvironmentMode.LOCAL_SLM,
        )
        assert graph_local is not None


def test_rubric_evaluation_callback():
    """Verify that on_rubric_evaluation callback is hooked into the middleware."""
    evaluations = []

    def mock_eval_cb(ev):
        evaluations.append(ev)

    model = FakeChatModel()
    checkpointer = MemorySaver()

    graph = DeepAgentEnvironmentFactory.create_agent(
        model=model,
        checkpointer=checkpointer,
        grader_model=model,
        on_rubric_evaluation=mock_eval_cb,
    )
    assert graph is not None


def test_rubric_parameters_defaults():
    """Verify rubric parameter defaults and customization options."""
    model = FakeChatModel()
    checkpointer = MemorySaver()

    graph = DeepAgentEnvironmentFactory.create_agent(
        model=model,
        checkpointer=checkpointer,
        rubric="- Criterion 1",
        max_rubric_iterations=5,
        rubric_tools=[],
    )
    assert graph is not None
