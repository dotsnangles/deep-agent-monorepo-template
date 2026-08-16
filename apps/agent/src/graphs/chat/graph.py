from typing import Any

from langchain_core.output_parsers import StrOutputParser

from src.core.config import get_llm
from src.graphs.chat.factory import DeepAgentEnvironmentFactory
from src.graphs.chat.prompts import TITLE_PROMPT

# Default interrupt policy: empty by default so sandboxed tools run autonomously.
DEFAULT_INTERRUPT_TOOLS: dict[str, Any] = {}


def build_agent(
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
    **kwargs: Any,
):
    """Build and compile the unified Deep Agent graph delegating to DeepAgentEnvironmentFactory.

    Preserves 100% backward compatibility with existing callers, routes, and tests.
    """
    return DeepAgentEnvironmentFactory.create_agent(
        checkpointer=checkpointer,
        store=store,
        subagents=subagents,
        enable_subagents=enable_subagents,
        model=model,
        tools=tools,
        interrupt_on=interrupt_on,
        middleware=middleware,
        backend=backend,
        system_prompt=system_prompt,
        **kwargs,
    )


def get_title_chain():
    """Builds a LangChain LCEL runnable for session title summarization using configured LLM."""
    return TITLE_PROMPT | get_llm() | StrOutputParser()


async def generate_title(user_prompt: str) -> str:
    """Generates a concise Korean summary title for a chat session via LangChain."""
    try:
        chain = get_title_chain()
        result = await chain.ainvoke({"user_prompt": user_prompt})
        clean = (
            str(result)
            .strip()
            .replace('"', "")
            .replace("'", "")
            .replace("`", "")
            .replace("제목:", "")
            .strip()
        )
        lines = [line.strip() for line in clean.splitlines() if line.strip()]
        final_title = lines[0] if lines else user_prompt[:25]
        return final_title[:25].strip()
    except Exception as e:
        print(f"[WARN] LangChain title generation failed: {e}")
        return user_prompt[:25].strip()
