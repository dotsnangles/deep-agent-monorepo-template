from fastapi import Request
from src.runtime import AgentRuntime


def get_agent_runtime(request: Request) -> AgentRuntime:
    """Dependency provider resolving AgentRuntime from FastAPI app.state."""
    if hasattr(request.app.state, "agent_runtime") and request.app.state.agent_runtime:
        return request.app.state.agent_runtime
    if hasattr(request.app.state, "gateway") and request.app.state.gateway:
        gw = request.app.state.gateway
        return getattr(gw, "runtime", gw)
    return AgentRuntime.create_in_memory()
