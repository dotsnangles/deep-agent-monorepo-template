"""Deep Agent Environment Factory.

Assembles tailored Deep Agent graphs based on active runtime environment
(Local SLM vs Production Cloud Multi-LLM) following ADR-0022.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from copilotkit import CopilotKitMiddleware
from deepagents import (
    GeneralPurposeSubagentProfile,
    HarnessProfile,
    RubricMiddleware,
    create_deep_agent,
    register_harness_profile,
)
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend
from deepagents.middleware.summarization import create_summarization_tool_middleware
from langchain.agents.middleware import (
    ModelCallLimitMiddleware,
    ModelFallbackMiddleware,
    ModelRetryMiddleware,
    TodoListMiddleware,
    ToolCallLimitMiddleware,
    ToolRetryMiddleware,
)

from src.core.checkpointer import CheckpointerFactory
from src.core.config import (
    ENABLE_SUBAGENTS,
    EnvironmentMode,
    get_deep_agent_mode,
    get_llm,
)
from src.graphs.chat.prompts import MAIN_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

DEFAULT_INTERRUPT_TOOLS: dict[str, Any] = {}


def _load_agents_memory() -> str | None:
    """Reads repository AGENTS.md instructions if available."""
    agents_md = Path("AGENTS.md")
    if agents_md.exists():
        try:
            return agents_md.read_text(encoding="utf-8")
        except Exception:
            pass
    return None


class DeepAgentEnvironmentFactory:
    """Factory constructing optimized Deep Agent graphs per environment."""

    @classmethod
    def create_agent(
        cls,
        checkpointer: Any = None,
        store: Any = None,
        subagents: list[dict[str, Any]] | None = None,
        enable_subagents: bool | None = None,
        model: Any = None,
        tools: list[Any] | None = None,
        interrupt_on: dict[str, Any] | None = None,
        middleware: list[Any] | None = None,
        backend: Any = None,
        system_prompt: str | None = None,
        mode: EnvironmentMode | None = None,
        rubric: str | None = None,
        grader_model: Any = None,
        max_rubric_iterations: int = 3,
        on_rubric_evaluation: Any = None,
        rubric_tools: list[Any] | None = None,
        fallback_model: Any = None,
        model_call_limit: int | None = None,
        tool_call_limit: int | None = None,
        tool_retry_config: dict[str, Any] | None = None,
        enable_summarization_tool: bool = True,
        **kwargs: Any,
    ) -> Any:
        effective_mode = mode or get_deep_agent_mode()
        llm = model if model is not None else get_llm()
        effective_tools = list(tools) if tools is not None else []
        effective_prompt = system_prompt or MAIN_SYSTEM_PROMPT

        effective_checkpointer = (
            checkpointer
            if checkpointer is not None
            else CheckpointerFactory.get_default_checkpointer()
        )
        effective_store = store if store is not None else CheckpointerFactory.get_default_store()
        effective_interrupt_on = (
            interrupt_on if interrupt_on is not None else DEFAULT_INTERRUPT_TOOLS
        )

        effective_backend = backend

        # Model ID resolution for profile registration
        model_id = getattr(llm, "model", getattr(llm, "model_name", "deep_agent_model"))

        # -----------------------------------------------------------------
        # 1. Environment-Specific Defaults & Profile Registration
        # -----------------------------------------------------------------
        if effective_mode == EnvironmentMode.LOCAL_SLM:
            is_subagents_allowed = (
                enable_subagents if enable_subagents is not None else ENABLE_SUBAGENTS
            )
            effective_subagents = (
                list(subagents) if (subagents is not None and is_subagents_allowed) else []
            )

            try:
                register_harness_profile(
                    str(model_id),
                    HarnessProfile(
                        system_prompt_suffix="Keep answers concise and direct.",
                        general_purpose_subagent=GeneralPurposeSubagentProfile(
                            enabled=is_subagents_allowed
                        ),
                    ),
                )
            except Exception as e:
                logger.debug("Harness profile registration skipped: %s", e)

            effective_model_limit = model_call_limit if model_call_limit is not None else 30
            effective_tool_limit = tool_call_limit if tool_call_limit is not None else 100

            effective_middleware = list(
                middleware
                if middleware is not None
                else [
                    TodoListMiddleware(),
                    CopilotKitMiddleware(),
                    ModelCallLimitMiddleware(run_limit=effective_model_limit),
                    ToolCallLimitMiddleware(run_limit=effective_tool_limit),
                ]
            )

        # -----------------------------------------------------------------
        # 2. CLOUD PROVIDER MULTI-LLM MODE (OpenAI, Anthropic, Gemini, etc.)
        # -----------------------------------------------------------------
        else:
            is_subagents_allowed = enable_subagents if enable_subagents is not None else True
            effective_subagents = (
                list(subagents) if (subagents is not None and is_subagents_allowed) else []
            )

            try:
                register_harness_profile(
                    str(model_id),
                    HarnessProfile(
                        general_purpose_subagent=GeneralPurposeSubagentProfile(
                            enabled=is_subagents_allowed
                        ),
                    ),
                )
            except Exception as e:
                logger.debug("Harness profile registration skipped: %s", e)

            effective_model_limit = model_call_limit if model_call_limit is not None else 50
            effective_tool_limit = tool_call_limit if tool_call_limit is not None else 200

            effective_middleware = list(
                middleware
                if middleware is not None
                else [
                    TodoListMiddleware(),
                    CopilotKitMiddleware(),
                    ModelRetryMiddleware(max_retries=3),
                    ModelCallLimitMiddleware(run_limit=effective_model_limit),
                    ToolCallLimitMiddleware(run_limit=effective_tool_limit),
                ]
            )

            if effective_backend is None and effective_store is not None:
                from src.graphs.chat.backends import get_session_backend

                session_sb = get_session_backend("default")
                effective_backend = CompositeBackend(
                    default=session_sb,
                    routes={
                        "/memories/": StoreBackend(store=effective_store, namespace=("memories",)),
                    },
                )

        # -----------------------------------------------------------------
        # 3. Dynamic Feature Middlewares (Fault Tolerance, Summarization, Rubric)
        # -----------------------------------------------------------------
        if fallback_model is not None:
            effective_middleware.append(ModelFallbackMiddleware(fallback_model))
        if tool_retry_config is not None:
            effective_middleware.append(ToolRetryMiddleware(**tool_retry_config))

        if enable_summarization_tool:
            compaction_backend = (
                effective_backend if effective_backend is not None else StateBackend()
            )
            try:
                effective_middleware.append(
                    create_summarization_tool_middleware(llm, compaction_backend)
                )
            except Exception as sum_err:
                logger.warning("Summarization tool attachment skipped: %s", sum_err)

        if rubric is not None or grader_model is not None:
            target_grader = grader_model if grader_model is not None else llm
            rubric_kwargs: dict[str, Any] = {
                "model": target_grader,
                "max_iterations": max_rubric_iterations,
            }
            if on_rubric_evaluation is not None:
                rubric_kwargs["on_evaluation"] = on_rubric_evaluation
            if rubric_tools is not None:
                rubric_kwargs["tools"] = rubric_tools
            effective_middleware.append(RubricMiddleware(**rubric_kwargs))

        agent_kwargs: dict[str, Any] = {
            "model": llm,
            "system_prompt": effective_prompt,
            "tools": effective_tools,
            "subagents": effective_subagents,
            "middleware": effective_middleware,
            "interrupt_on": effective_interrupt_on,
            "checkpointer": effective_checkpointer,
            "store": effective_store,
            **kwargs,
        }
        if effective_backend is not None:
            agent_kwargs["backend"] = effective_backend

        if effective_mode == EnvironmentMode.CLOUD_PROVIDER:
            skills_dir = Path("./.agents/skills")
            if skills_dir.exists():
                agent_kwargs["skills"] = [str(skills_dir)]

        # Common memory loading
        memory_content = _load_agents_memory()
        if memory_content:
            agent_kwargs["memory"] = memory_content

        agent_graph = create_deep_agent(**agent_kwargs)
        logger.info(
            "[AGENT] Graph compiled (mode=%s, subagents=%d, cp=%s)",
            effective_mode.value,
            len(effective_subagents),
            type(effective_checkpointer).__name__,
        )
        return agent_graph
