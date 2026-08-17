from pathlib import Path

import yaml
from langgraph.checkpoint.memory import MemorySaver

from src.infrastructure import AgentConfig, AgentConfigLoader
from src.infrastructure import FakeChatModel
from src.graphs.chat.factory import DeepAgentEnvironmentFactory
from src.graphs.chat.prompts import PromptCatalog


def test_default_config_file_validity():
    """Verify default agent.config.yaml exists and parses with valid schema."""
    config_file = Path("agent.config.yaml")
    if not config_file.exists():
        config_file = Path("apps/agent/agent.config.yaml")

    assert config_file.exists()
    loader = AgentConfigLoader(config_path=config_file)
    cfg = loader.load()
    assert isinstance(cfg, AgentConfig)


def test_example_config_file_validity():
    """Verify agent.config.example.yaml parses into valid AgentConfig."""
    example_file = Path("agent.config.example.yaml")
    if not example_file.exists():
        example_file = Path("apps/agent/agent.config.example.yaml")

    assert example_file.exists()
    content = example_file.read_text(encoding="utf-8")
    raw = yaml.safe_load(content)
    cfg = AgentConfig(**raw)
    assert isinstance(cfg, AgentConfig)


def test_default_prompts_assets_exist():
    """Verify default prompts/ directory contains system, title, and rubric markdown."""
    catalog = PromptCatalog()
    system_prompt = catalog.get_system_prompt()
    assert "Execution Guidelines" in system_prompt or "You are an expert" in system_prompt

    title_prompt = catalog.get_title_prompt()
    assert title_prompt is not None

    rubric_prompt = catalog.get_rubric_prompt()
    assert rubric_prompt is not None
    assert "Correctness" in rubric_prompt


def test_out_of_the_box_factory_build():
    """Verify agent factory compiles cleanly out of the box with zero custom parameters."""
    model = FakeChatModel()
    checkpointer = MemorySaver()

    graph = DeepAgentEnvironmentFactory.create_agent(
        model=model,
        checkpointer=checkpointer,
    )
    assert graph is not None
