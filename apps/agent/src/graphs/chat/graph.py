from pathlib import Path
from typing import Any

from copilotkit import CopilotKitMiddleware
from deepagents import create_deep_agent
from langchain.agents.middleware import TodoListMiddleware
from langchain_core.output_parsers import StrOutputParser
from langgraph.checkpoint.memory import MemorySaver

from src.core.config import get_llm
from src.graphs.chat.prompts import MAIN_SYSTEM_PROMPT, TITLE_PROMPT
from src.tools.sensitive import get_sensitive_tools
from src.tools.system import get_default_tools

DEFAULT_INTERRUPT_TOOLS = {
    "execute_command": True,
    "write_file": True,
    "delete_resource": True,
    "execute": True,
    "delete": True,
}


def build_agent(
    checkpointer: Any = None,
    store: Any = None,
    subagents: list[dict[str, Any]] | None = None,
    model: Any = None,
    tools: list[Any] | None = None,
    interrupt_on: dict[str, Any] | None = None,
    middleware: list[Any] | None = None,
    backend: Any = None,
    system_prompt: str | None = None,
    **kwargs: Any,
):
    """Build and compile the unified Deep Agent graph using official create_deep_agent.

    Args:
        checkpointer: Persistent checkpointer (e.g. AsyncPostgresSaver) or MemorySaver.
        store: Long-term store (e.g. AsyncPostgresStore) or None.
        subagents: Optional list of subagent configuration dicts.
        model: Custom or Fake LLM instance, or None to use default get_llm().
        tools: List of tools to provide, or None for default system + sensitive tools.
        interrupt_on: Tool gating map for HITL approval.
        middleware: List of middlewares, defaults to [TodoListMiddleware(), CopilotKitMiddleware()].
        backend: VFS or Sandbox backend instance.
        system_prompt: Base prompt override.
    """
    llm = model if model is not None else get_llm()
    effective_tools = list(
        tools if tools is not None else (get_default_tools() + get_sensitive_tools())
    )
    effective_checkpointer = checkpointer if checkpointer is not None else MemorySaver()
    effective_interrupt_on = interrupt_on if interrupt_on is not None else DEFAULT_INTERRUPT_TOOLS
    effective_middleware = list(
        middleware if middleware is not None else [TodoListMiddleware(), CopilotKitMiddleware()]
    )
    effective_prompt = system_prompt or MAIN_SYSTEM_PROMPT

    agent_kwargs: dict[str, Any] = {
        "model": llm,
        "system_prompt": effective_prompt,
        "tools": effective_tools,
        "subagents": subagents,
        "middleware": effective_middleware,
        "interrupt_on": effective_interrupt_on,
        "checkpointer": effective_checkpointer,
        "store": store,
    }
    if backend is not None:
        agent_kwargs["backend"] = backend

    # Check for repository AGENTS.md memory file
    agents_md = Path("AGENTS.md")
    if agents_md.exists():
        try:
            agent_kwargs["memory"] = agents_md.read_text(encoding="utf-8")
        except Exception:
            pass

    agent_graph = create_deep_agent(**agent_kwargs)

    cp_name = type(effective_checkpointer).__name__
    st_name = type(store).__name__ if store is not None else "None"
    print(f"[AGENT] Deep Agent graph compiled (checkpointer={cp_name}, store={st_name}).")
    return agent_graph


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
