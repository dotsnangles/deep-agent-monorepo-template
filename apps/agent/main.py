import os

from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from copilotkit import LangGraphAGUIAgent
from dotenv import load_dotenv
from fastapi import FastAPI

from agent import LLM_PROVIDER, build_agent
from observability import get_langfuse_callback

load_dotenv()

app = FastAPI(
    title="Hollow Echo Deep Agent Server",
    description="Python Deep Agent Server with LangChain deepagents & CopilotKit AG-UI",
    version="0.2.0",
)


class SessionTrackingLangGraphAGUIAgent(LangGraphAGUIAgent):
    """LangGraphAGUIAgent that propagates conversation thread_id to Langfuse session_id."""

    async def prepare_stream(self, input, agent_state, config):
        thread_id = getattr(input, "thread_id", None)
        if thread_id:
            config_meta = config.setdefault("metadata", {})
            config_meta.setdefault("langfuse_session_id", str(thread_id))
            config_meta.setdefault("langfuse_trace_name", "Hollow Echo Deep Agent")
        return await super().prepare_stream(input, agent_state, config)


# Build compiled LangChain Deep Agent graph
agent_graph = build_agent()
lf_callback = get_langfuse_callback()
agent_config = {"callbacks": [lf_callback]} if lf_callback else None

add_langgraph_fastapi_endpoint(
    app=app,
    agent=SessionTrackingLangGraphAGUIAgent(
        name="default",
        description="Hollow Echo Deep Agent (LangChain deepagents)",
        graph=agent_graph,
        config=agent_config,
    ),
    path="/copilotkit",
)


@app.get("/")
def root():
    return {
        "service": "Hollow Echo Deep Agent Server",
        "framework": "LangChain deepagents + AG-UI",
        "status": "running",
        "llm_provider": LLM_PROVIDER,
        "endpoint": "/copilotkit",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "framework": "deepagents",
        "provider": LLM_PROVIDER,
    }


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("SERVER_HOST", "0.0.0.0")
    port = int(os.getenv("SERVER_PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=True)
