from pathlib import Path

from langgraph.checkpoint.memory import MemorySaver

from src.core.config import EnvironmentMode
from src.core.settings import get_agent_config
from src.core.testing import FakeChatModel
from src.graphs.chat.factory import DeepAgentEnvironmentFactory


def test_factory_driven_by_yaml_config(tmp_path: Path):
    """Verify factory builds agent driven by YAML configuration and prompt catalog."""
    config_file = tmp_path / "agent.config.yaml"
    prompts_dir = tmp_path / "prompts"
    prompts_dir.mkdir()

    config_file.write_text(
        """
agent:
  mode: "cloud_provider"
  debug: false
limits:
  model_calls: 42
  tool_calls: 142
features:
  enable_subagents: true
  enable_summarization_tool: true
  rubric_enabled: true
  max_rubric_iterations: 4
""",
        encoding="utf-8",
    )

    (prompts_dir / "system_prompt.md").write_text(
        "Custom YAML driven prompt for testing.",
        encoding="utf-8",
    )
    (prompts_dir / "rubric.md").write_text(
        "Custom Rubric Criteria from YAML test.",
        encoding="utf-8",
    )

    # Force load config
    get_agent_config(reload=True, config_path=config_file)

    model = FakeChatModel()
    checkpointer = MemorySaver()

    graph = DeepAgentEnvironmentFactory.create_agent(
        model=model,
        checkpointer=checkpointer,
    )
    assert graph is not None


def test_factory_explicit_overrides_yaml_config(tmp_path: Path):
    """Verify explicit create_agent arguments override YAML configuration."""
    config_file = tmp_path / "agent.config.yaml"
    config_file.write_text(
        """
agent:
  mode: "cloud_provider"
limits:
  model_calls: 50
features:
  enable_subagents: false
""",
        encoding="utf-8",
    )
    get_agent_config(reload=True, config_path=config_file)

    model = FakeChatModel()
    checkpointer = MemorySaver()

    # Explicit override mode=LOCAL_SLM, enable_subagents=True
    graph = DeepAgentEnvironmentFactory.create_agent(
        model=model,
        checkpointer=checkpointer,
        mode=EnvironmentMode.LOCAL_SLM,
        enable_subagents=True,
        system_prompt="Explicit Prompt Override",
    )
    assert graph is not None
