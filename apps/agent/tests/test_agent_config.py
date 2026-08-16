import os
from pathlib import Path
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from src.core.config import EnvironmentMode
from src.core.settings import AgentConfig, AgentConfigLoader


def test_default_agent_config():
    """Verify default AgentConfig instantiated with sensible defaults."""
    config = AgentConfig()
    assert config.agent.mode in (EnvironmentMode.LOCAL_SLM, EnvironmentMode.CLOUD_PROVIDER)
    assert config.models.primary != ""
    assert config.limits.recursion > 0
    assert config.features.enable_subagents is True


def test_load_from_yaml(tmp_path: Path):
    """Verify AgentConfigLoader loads and validates YAML content."""
    yaml_content = """
agent:
  mode: "cloud_provider"
  name: "Custom Agent"
  debug: false
models:
  primary: "openai:gpt-5.5"
  fallback: "anthropic:claude-sonnet-4-6"
  grader: "google_genai:gemini-3.6-flash"
limits:
  model_calls: 40
  tool_calls: 150
  recursion: 80
features:
  enable_subagents: true
  enable_summarization_tool: false
  rubric_enabled: true
  max_rubric_iterations: 5
storage:
  memory_route: "/custom_memories/"
  sessions_dir: "custom_sessions"
"""
    config_file = tmp_path / "agent.config.yaml"
    config_file.write_text(yaml_content, encoding="utf-8")

    loader = AgentConfigLoader(config_path=config_file)
    config = loader.load()

    assert config.agent.mode == EnvironmentMode.CLOUD_PROVIDER
    assert config.agent.name == "Custom Agent"
    assert config.agent.debug is False
    assert config.models.primary == "openai:gpt-5.5"
    assert config.models.fallback == "anthropic:claude-sonnet-4-6"
    assert config.models.grader == "google_genai:gemini-3.6-flash"
    assert config.limits.model_calls == 40
    assert config.limits.tool_calls == 150
    assert config.limits.recursion == 80
    assert config.features.enable_summarization_tool is False
    assert config.features.rubric_enabled is True
    assert config.features.max_rubric_iterations == 5
    assert config.storage.memory_route == "/custom_memories/"


def test_fail_fast_on_invalid_yaml(tmp_path: Path):
    """Verify AgentConfigLoader raises ValidationError on malformed schema."""
    invalid_yaml = """
agent:
  mode: "invalid_mode_value"
limits:
  model_calls: "not_an_int"
"""
    config_file = tmp_path / "invalid.yaml"
    config_file.write_text(invalid_yaml, encoding="utf-8")

    loader = AgentConfigLoader(config_path=config_file)
    with pytest.raises(ValidationError):
        loader.load()


def test_env_override_precedence(tmp_path: Path):
    """Verify environment variables override YAML configuration."""
    yaml_content = """
agent:
  mode: "local_slm"
models:
  primary: "ollama:gemma4"
limits:
  model_calls: 20
"""
    config_file = tmp_path / "agent.config.yaml"
    config_file.write_text(yaml_content, encoding="utf-8")

    with patch.dict(
        os.environ,
        {
            "DEEP_AGENT_MODE": "cloud_provider",
            "PRIMARY_MODEL": "anthropic:claude-sonnet-4-6",
            "MODEL_CALL_LIMIT": "55",
        },
    ):
        loader = AgentConfigLoader(config_path=config_file)
        config = loader.load()

        assert config.agent.mode == EnvironmentMode.CLOUD_PROVIDER
        assert config.models.primary == "anthropic:claude-sonnet-4-6"
        assert config.limits.model_calls == 55
