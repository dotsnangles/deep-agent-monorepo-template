"""Declarative Agent Configuration and Settings Loader.

Implements ADR-0023 for multi-source configuration (YAML + .env + defaults)
with type-safe Pydantic models and domain grouping.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field

from src.core.config import EnvironmentMode, get_deep_agent_mode

logger = logging.getLogger(__name__)


class AgentGroup(BaseModel):
    """Core agent identification and execution environment."""

    mode: EnvironmentMode = Field(default_factory=get_deep_agent_mode)
    name: str = "Deep Assistant"
    debug: bool = True


class ModelsGroup(BaseModel):
    """Configured LLM endpoints for primary execution, fallback, and grading."""

    primary: str = "ollama:gemma4"
    fallback: str | None = None
    grader: str | None = None


class LimitsGroup(BaseModel):
    """Protective limits for call capping and recursion safety."""

    model_calls: int = 30
    tool_calls: int = 100
    recursion: int = 100


class FeaturesGroup(BaseModel):
    """Toggleable capabilities across subagents, summarization, and rubrics."""

    enable_subagents: bool = True
    enable_summarization_tool: bool = True
    rubric_enabled: bool = False
    max_rubric_iterations: int = 3


class StorageGroup(BaseModel):
    """Storage and virtual filesystem paths."""

    memory_route: str = "/memories/"
    sessions_dir: str = "workspace/sessions"


class AgentConfig(BaseModel):
    """Domain-grouped declarative configuration for Deep Agent instances."""

    agent: AgentGroup = Field(default_factory=AgentGroup)
    models: ModelsGroup = Field(default_factory=ModelsGroup)
    limits: LimitsGroup = Field(default_factory=LimitsGroup)
    features: FeaturesGroup = Field(default_factory=FeaturesGroup)
    storage: StorageGroup = Field(default_factory=StorageGroup)


class AgentConfigLoader:
    """Loader resolving configuration across YAML files and environment overrides."""

    def __init__(self, config_path: Path | str | None = None) -> None:
        self.config_path = Path(config_path) if config_path is not None else None

    def _resolve_file_path(self) -> Path | None:
        if self.config_path is not None and self.config_path.exists():
            return self.config_path

        candidates = [
            Path("agent.config.yaml"),
            Path("apps/agent/agent.config.yaml"),
            Path(__file__).parent.parent.parent / "agent.config.yaml",
        ]
        for c in candidates:
            if c.exists():
                return c
        return None

    def load(self) -> AgentConfig:
        """Parses YAML file, applies environment overrides, and validates schema."""
        raw_dict: dict[str, Any] = {}
        target_file = self._resolve_file_path()

        if target_file and target_file.is_file():
            try:
                content = target_file.read_text(encoding="utf-8")
                parsed = yaml.safe_load(content)
                if isinstance(parsed, dict):
                    raw_dict = parsed
            except Exception as e:
                logger.warning("Failed to parse YAML from %s: %s", target_file, e)
                raise

        # Ensure top-level sections exist as dicts
        for sec in ("agent", "models", "limits", "features", "storage"):
            if sec not in raw_dict or not isinstance(raw_dict[sec], dict):
                raw_dict[sec] = {}

        # -----------------------------------------------------------------
        # Environment Variable Overrides (Precedence: ENV > YAML > Defaults)
        # -----------------------------------------------------------------
        if "DEEP_AGENT_MODE" in os.environ:
            raw_mode = os.environ["DEEP_AGENT_MODE"].strip().lower()
            if raw_mode in ("local_slm", "local"):
                raw_dict["agent"]["mode"] = EnvironmentMode.LOCAL_SLM
            elif raw_mode in ("cloud_provider", "cloud", "production_cloud"):
                raw_dict["agent"]["mode"] = EnvironmentMode.CLOUD_PROVIDER

        if "PRIMARY_MODEL" in os.environ:
            raw_dict["models"]["primary"] = os.environ["PRIMARY_MODEL"]
        elif "LLM_MODEL" in os.environ:
            raw_dict["models"]["primary"] = os.environ["LLM_MODEL"]

        if "FALLBACK_MODEL" in os.environ:
            raw_dict["models"]["fallback"] = os.environ["FALLBACK_MODEL"]

        if "GRADER_MODEL" in os.environ:
            raw_dict["models"]["grader"] = os.environ["GRADER_MODEL"]

        if "MODEL_CALL_LIMIT" in os.environ:
            try:
                raw_dict["limits"]["model_calls"] = int(os.environ["MODEL_CALL_LIMIT"])
            except ValueError:
                pass

        if "TOOL_CALL_LIMIT" in os.environ:
            try:
                raw_dict["limits"]["tool_calls"] = int(os.environ["TOOL_CALL_LIMIT"])
            except ValueError:
                pass

        if "ENABLE_SUBAGENTS" in os.environ:
            raw_dict["features"]["enable_subagents"] = (
                os.environ["ENABLE_SUBAGENTS"].lower() == "true"
            )

        if "ENABLE_SUMMARIZATION_TOOL" in os.environ:
            raw_dict["features"]["enable_summarization_tool"] = (
                os.environ["ENABLE_SUMMARIZATION_TOOL"].lower() == "true"
            )

        if "RUBRIC_ENABLED" in os.environ:
            raw_dict["features"]["rubric_enabled"] = os.environ["RUBRIC_ENABLED"].lower() == "true"

        return AgentConfig(**raw_dict)


_cached_agent_config: AgentConfig | None = None


def get_agent_config(reload: bool = False, config_path: Path | str | None = None) -> AgentConfig:
    """Returns singleton AgentConfig instance with optional reload."""
    global _cached_agent_config
    if _cached_agent_config is None or reload:
        _cached_agent_config = AgentConfigLoader(config_path=config_path).load()
    return _cached_agent_config
