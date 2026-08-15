from typing import Any

from copilotkit import CopilotKitMiddleware
from deepagents import create_deep_agent
from langchain_core.output_parsers import StrOutputParser
from langgraph.checkpoint.memory import MemorySaver

from src.core.config import get_llm
from src.graphs.chat.prompts import MAIN_SYSTEM_PROMPT, TITLE_PROMPT
from src.tools.system import get_default_tools


def build_agent(
    checkpointer: Any = None,
    store: Any = None,
    subagents: list[dict[str, Any]] | None = None,
):
    """Build and compile the Deep Agent graph equipped with CopilotKitMiddleware.

    Args:
        checkpointer: Persistent checkpointer (e.g. AsyncPostgresSaver) or None.
        store: Long-term store (e.g. AsyncPostgresStore) or None.
        subagents: Optional list of subagent configuration dicts.
    """
    llm = get_llm()
    tools = get_default_tools()
    effective_checkpointer = checkpointer if checkpointer is not None else MemorySaver()

    agent_graph = create_deep_agent(
        model=llm,
        system_prompt=MAIN_SYSTEM_PROMPT,
        tools=tools,
        subagents=subagents,
        middleware=[CopilotKitMiddleware()],
        checkpointer=effective_checkpointer,
        store=store,
    )

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
