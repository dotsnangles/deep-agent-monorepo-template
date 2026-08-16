import enum
import os

from dotenv import load_dotenv

load_dotenv()


class EnvironmentMode(enum.StrEnum):
    LOCAL_SLM = "local_slm"
    CLOUD_PROVIDER = "cloud_provider"


# LLM Provider selection
LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "ollama").lower()


def get_deep_agent_mode() -> EnvironmentMode:
    """Resolves active Deep Agent mode: explicit env takes precedence, defaulting by provider."""
    raw = os.getenv("DEEP_AGENT_MODE", "").strip().lower()
    if raw in ("local_slm", "local"):
        return EnvironmentMode.LOCAL_SLM
    if raw in ("cloud_provider", "cloud", "production_cloud"):
        return EnvironmentMode.CLOUD_PROVIDER

    # Auto-detection: Ollama defaults to LOCAL_SLM; cloud providers default to CLOUD_PROVIDER
    if os.getenv("LLM_PROVIDER", "ollama").lower() == "ollama":
        return EnvironmentMode.LOCAL_SLM
    return EnvironmentMode.CLOUD_PROVIDER


def get_inference_concurrency_limit() -> int | None:
    """Returns maximum allowed concurrent LLM inferences.

    Defaults to 1 for LOCAL_SLM (Single-Flight Inference to prevent OOMs),
    and None (unbounded) for CLOUD_PROVIDER. Overridable via LLM_CONCURRENCY_LIMIT.
    """
    raw_limit = os.getenv("LLM_CONCURRENCY_LIMIT")
    if raw_limit:
        try:
            return max(1, int(raw_limit))
        except ValueError:
            pass

    mode = get_deep_agent_mode()
    if mode == EnvironmentMode.LOCAL_SLM:
        return 1
    return None


DEEP_AGENT_MODE: str = get_deep_agent_mode().value
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "gemma4:e4b-it-q4_K_M")
OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
ANTHROPIC_API_KEY: str | None = os.getenv("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL: str = os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-20241022")
GOOGLE_API_KEY: str | None = os.getenv("GOOGLE_API_KEY")
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

DATABASE_URL: str | None = os.getenv("DATABASE_URL")
REDIS_URL: str | None = os.getenv("REDIS_URL")
SERVER_HOST: str = os.getenv("SERVER_HOST", "0.0.0.0")
SERVER_PORT: int = int(os.getenv("SERVER_PORT", "8000"))
TITLE_WORKER_CONCURRENCY: int = int(os.getenv("TITLE_WORKER_CONCURRENCY", "3"))
ENABLE_SUBAGENTS: bool = os.getenv("ENABLE_SUBAGENTS", "false").lower() == "true"
ENABLE_TITLE_WORKER: bool = os.getenv("ENABLE_TITLE_WORKER", "false").lower() == "true"


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
