from fastapi import Request
from src.runtime.runtime import AgentRuntime


def get_agent_runtime(request: Request) -> AgentRuntime:
    """Dependency provider resolving AgentRuntime from FastAPI app.state."""
    if hasattr(request.app.state, "agent_runtime") and request.app.state.agent_runtime:
        return request.app.state.agent_runtime
    return AgentRuntime.create_in_memory()
