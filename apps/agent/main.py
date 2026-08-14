import os

from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from copilotkit import LangGraphAGUIAgent
from dotenv import load_dotenv
from fastapi import FastAPI

from agent import LLM_PROVIDER, build_agent

load_dotenv()

app = FastAPI(
    title="Hollow Echo Deep Agent Server",
    description="Python Deep Agent Server with LangChain deepagents & CopilotKit AG-UI",
    version="0.2.0",
)

# Build compiled LangChain Deep Agent graph
agent_graph = build_agent()

add_langgraph_fastapi_endpoint(
    app=app,
    agent=LangGraphAGUIAgent(
        name="default",
        description="Hollow Echo Deep Agent (LangChain deepagents)",
        graph=agent_graph,
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
