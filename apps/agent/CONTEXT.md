# Agent Domain Context (`apps/agent`)

Domain glossary and architectural concepts for the Python Deep Agent service:

| Term | Definition | Location |
| --- | --- | --- |
| Deep Agent | LangChain `create_deep_agent` graph instance with system prompt, tool registry, and memory | `src/graphs/chat/` |
| AG-UI Endpoint | SSE streaming protocol endpoint for CopilotKit runtime integration | `src/api/routes/copilotkit.py` |
| Thread ID | Unique session identifier mapping 1:1 with LangGraph state checkpoints and Redis Pub/Sub channels | `src/api/routes/events.py` |
| Checkpointer | State persistence layer (`AsyncPostgresSaver` / `MemorySaver`) | `src/api/app.py` |
| Store | Long-term cross-thread memory store (`AsyncPostgresStore`) | `src/api/app.py` |
| Title Worker | Background task consumer listening on `queue:title_generation` to summarize chat titles asynchronously | `src/workers/title_worker.py` |
| Tool Registry | Custom tool definitions exposed to the LLM agent | `src/tools/system.py` |
