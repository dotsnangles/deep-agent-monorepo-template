import datetime
import os
from typing import Any

from copilotkit import CopilotKitMiddleware
from deepagents import create_deep_agent
from dotenv import load_dotenv
from langchain_core.tools import tool
from langgraph.checkpoint.memory import MemorySaver

load_dotenv()

# LLM Provider selection (default: ollama)
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama").lower()
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma4:e4b-it-q4_K_M")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-20241022")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


def get_llm():
    """Factory function for creating the configured LLM model."""
    if LLM_PROVIDER == "openai" and OPENAI_API_KEY:
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(model=OPENAI_MODEL, api_key=OPENAI_API_KEY, temperature=0.7)
    elif LLM_PROVIDER == "anthropic" and ANTHROPIC_API_KEY:
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(model=ANTHROPIC_MODEL, api_key=ANTHROPIC_API_KEY, temperature=0.7)
    elif LLM_PROVIDER in ("google", "gemini") and GOOGLE_API_KEY:
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=GEMINI_MODEL, google_api_key=GOOGLE_API_KEY, temperature=0.7
        )
    else:
        from langchain_ollama import ChatOllama

        return ChatOllama(base_url=OLLAMA_BASE_URL, model=OLLAMA_MODEL, temperature=0.7)


# =====================================================================
# 1. Custom Tools Definition (Add your own tools here!)
# =====================================================================


@tool
def get_current_time() -> str:
    """Returns the current date and time."""
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


@tool
def calculate(expression: str) -> str:
    """Evaluates a basic mathematical expression safely.

    Args:
        expression: A mathematical expression string, e.g. "12 * 8 + 4"
    """
    try:
        allowed = set("0123456789+-*/(). ")
        if not set(expression).issubset(allowed):
            return "Error: Unsupported characters in mathematical expression"
        result = eval(expression, {"__builtins__": {}})
        return f"Result: {result}"
    except Exception as e:
        return f"Calculation error: {e}"


@tool
def query_system_info() -> str:
    """Returns basic system status information."""
    return "System Status: Online | Agent Engine: LangChain Deep Agent + CopilotKit AG-UI"


@tool
def finalize() -> dict[str, str]:
    """Signal task completion."""
    return {"status": "done", "message": "Task execution completed successfully."}


# =====================================================================
# 2. System Prompt & Subagent Configuration
# =====================================================================

MAIN_SYSTEM_PROMPT = """
You are a custom Deep Agent powered by LangChain `deepagents` and CopilotKit.

Follow these steps for complex tasks:
1. Break down user requests into actionable todo steps.
2. Use tools to execute tasks step-by-step.
3. Summarize findings for the user.
4. Call `finalize()` when all steps are completed.
""".strip()

# Optional Subagents list (Add subagents here if needed)
SUBAGENTS: list[dict[str, Any]] = [
    # Example subagent:
    # {
    #     "name": "helper-agent",
    #     "description": "Performs specialized helper tasks",
    #     "system_prompt": "You are a specialized helper agent.",
    #     "tools": [get_current_time],
    # }
]


# =====================================================================
# 3. Build Deep Agent Graph
# =====================================================================


def build_agent():
    """Build and compile the basic Deep Agent graph equipped with CopilotKitMiddleware."""
    llm = get_llm()

    tools = [
        get_current_time,
        calculate,
        query_system_info,
        finalize,
    ]

    agent_graph = create_deep_agent(
        model=llm,
        system_prompt=MAIN_SYSTEM_PROMPT,
        tools=tools,
        subagents=SUBAGENTS if SUBAGENTS else None,
        middleware=[CopilotKitMiddleware()],
        checkpointer=MemorySaver(),
    )

    print("[AGENT] Basic Deep Agent graph compiled successfully with CopilotKitMiddleware.")
    return agent_graph
