# Hollow Echo Deep Agent

This service builds a LangChain Deep Agent and exposes it as an AG-UI endpoint for the
CopilotKit Runtime in `apps/web`.

```text
CopilotKit React UI
  -> Next.js Copilot Runtime (/api/copilotkit)
  -> LangGraphHttpAgent
  -> FastAPI AG-UI endpoint (/copilotkit)
  -> LangGraphAGUIAgent
  -> LangChain Deep Agent
  -> Ollama or another configured model provider
```

AG-UI is the streaming protocol between the CopilotKit Runtime and the Python agent. The
FastAPI endpoint accepts `RunAgentInput` requests and streams lifecycle, message, state, and
tool-call events over Server-Sent Events.

## Run locally

Make sure Ollama is running and the configured model is installed, then run:

```bash
uv sync
uv run python main.py
```

The service listens on `http://localhost:8000` by default.

- Agent endpoint: `POST http://localhost:8000/copilotkit`
- Agent health: `GET http://localhost:8000/copilotkit/health`
- Service health: `GET http://localhost:8000/health`

## Configuration

The defaults use local Ollama. Override them with environment variables when needed:

```dotenv
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:e4b-it-q4_K_M
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
```

Supported `LLM_PROVIDER` values are `ollama`, `openai`, `anthropic`, and `google`.

## Official references

- [CopilotKit Deep Agents quickstart](https://docs.copilotkit.ai/deepagents/quickstart)
- [CopilotKit LangGraph FastAPI](https://docs.copilotkit.ai/langgraph-fastapi)
- [LangChain Deep Agents overview](https://docs.langchain.com/oss/python/deepagents/overview)
