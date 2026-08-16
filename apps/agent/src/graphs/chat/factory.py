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
    create_deep_agent,
    register_harness_profile,
)
from deepagents.backends import CompositeBackend, StoreBackend
from langchain.agents.middleware import ModelRetryMiddleware, TodoListMiddleware

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

        # -----------------------------------------------------------------
        # 1. LOCAL SLM MODE (Ollama / Small Local Models)
        # -----------------------------------------------------------------
        if effective_mode == EnvironmentMode.LOCAL_SLM:
            # Enforce single-flight safety: disable general subagents by default
            is_subagents_allowed = (
                enable_subagents if enable_subagents is not None else ENABLE_SUBAGENTS
            )
            effective_subagents = (
                list(subagents) if (subagents is not None and is_subagents_allowed) else []
            )

            # Register defensive profile for local model
            model_id = getattr(llm, "model", getattr(llm, "model_name", "ollama_slm"))
            try:
                register_harness_profile(
                    str(model_id),
                    HarnessProfile(
                        system_prompt_suffix="Keep answers concise.",
                        general_purpose_subagent=GeneralPurposeSubagentProfile(
                            enabled=is_subagents_allowed
                        ),
                    ),
                )
            except Exception as e:
                logger.debug("Harness profile registration skipped: %s", e)

            effective_middleware = list(
                middleware
                if middleware is not None
                else [TodoListMiddleware(), CopilotKitMiddleware()]
            )

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
            if backend is not None:
                agent_kwargs["backend"] = backend

            agents_md = Path("AGENTS.md")
            if agents_md.exists():
                try:
                    agent_kwargs["memory"] = agents_md.read_text(encoding="utf-8")
                except Exception:
                    pass

            agent_graph = create_deep_agent(**agent_kwargs)
            logger.info(
                "[AGENT] Deep Agent graph compiled (mode=LOCAL_SLM, subagents=%d, checkpointer=%s)",
                len(effective_subagents),
                type(effective_checkpointer).__name__,
            )
            return agent_graph

        # -----------------------------------------------------------------
        # 2. PRODUCTION CLOUD MULTI-LLM MODE
        # -----------------------------------------------------------------
        else:
            is_subagents_allowed = enable_subagents if enable_subagents is not None else True
            effective_subagents = (
                list(subagents)
                if subagents is not None
                else ([] if not is_subagents_allowed else [])
            )

            effective_middleware = list(
                middleware
                if middleware is not None
                else [
                    TodoListMiddleware(),
                    CopilotKitMiddleware(),
                    ModelRetryMiddleware(max_retries=3),
                ]
            )

            effective_backend = backend
            if effective_backend is None and effective_store is not None:
                from src.graphs.chat.backends import get_session_backend

                session_sb = get_session_backend("default")
                effective_backend = CompositeBackend(
                    default=session_sb,
                    routes={
                        "/memories/": StoreBackend(store=effective_store, namespace=("memories",)),
                    },
                )

            agent_kwargs = {
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

            agents_md = Path("AGENTS.md")
            if agents_md.exists():
                try:
                    agent_kwargs["memory"] = agents_md.read_text(encoding="utf-8")
                except Exception:
                    pass

            skills_dir = Path("./.agents/skills")
            if skills_dir.exists():
                agent_kwargs["skills"] = [str(skills_dir)]

            agent_graph = create_deep_agent(**agent_kwargs)
            logger.info(
                "[AGENT] Graph compiled (mode=PRODUCTION_CLOUD, subagents=%d, cp=%s)",
                len(effective_subagents),
                type(effective_checkpointer).__name__,
            )
            return agent_graph
