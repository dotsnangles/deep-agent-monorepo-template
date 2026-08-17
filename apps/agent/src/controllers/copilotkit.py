from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from copilotkit import LangGraphAGUIAgent
from fastapi import FastAPI

from src.infrastructure import (
    RedisEventBroker,
    RedisStreamingCallbackHandler,
    get_langfuse_callback,
)
from src.graphs import build_agent


class SessionTrackingLangGraphAGUIAgent(LangGraphAGUIAgent):
    """LangGraphAGUIAgent that propagates conversation thread_id to Langfuse and Redis Pub/Sub."""

    def __init__(self, *args, broker: RedisEventBroker | None = None, **kwargs):
        super().__init__(*args, **kwargs)
        self.broker = broker

    async def prepare_stream(self, input, agent_state, config):
        thread_id = getattr(input, "thread_id", None)
        if thread_id:
            config_meta = config.setdefault("metadata", {})
            config_meta.setdefault("langfuse_session_id", str(thread_id))
            config_meta.setdefault("langfuse_trace_name", "Deep Agent")

            if self.broker and self.broker.is_connected():
                callbacks = config.setdefault("callbacks", [])
                if isinstance(callbacks, list):
                    callbacks.append(RedisStreamingCallbackHandler(self.broker, str(thread_id)))

        return await super().prepare_stream(input, agent_state, config)


def register_copilotkit_agent(app: FastAPI) -> SessionTrackingLangGraphAGUIAgent:
    """Initializes and registers the default LangGraph AG-UI agent onto FastAPI."""
    lf_callback = get_langfuse_callback()
    initial_callbacks = [lf_callback] if lf_callback else []
    agent_config = {"callbacks": initial_callbacks}

    default_agent = SessionTrackingLangGraphAGUIAgent(
        name="default",
        description="Deep Agent (LangChain deepagents)",
        graph=build_agent(),
        config=agent_config,
    )

    add_langgraph_fastapi_endpoint(
        app=app,
        agent=default_agent,
        path="/copilotkit",
    )

    return default_agent
