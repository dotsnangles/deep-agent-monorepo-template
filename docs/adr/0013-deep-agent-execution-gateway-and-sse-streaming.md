# 0013. Deep AgentExecutionGateway and SSE Streaming Protocol in apps/agent

## Status
Accepted

## Context
Currently, `apps/agent/src/api/routes/chat.py` couples HTTP routing directly to LangChain raw `llm.astream` calls with ad-hoc plain-text yields. It lacks checkpointer state persistence, structured event emission (tool calling, node transitions), and multi-graph routing. Furthermore, `title_worker.py` holds a direct PostgreSQL pool connection executing raw SQL updates (`UPDATE chat_session SET title = ...`), coupling the Python service to database schema tables. Testing agent workflows currently requires external LLM API keys or live Postgres/Redis infrastructure.

## Decision
1. **Deep AgentExecutionGateway (`src/core/gateway.py`)**:
   - Provide a unified, high-leverage execution interface: `stream_execution(thread_id, messages, agent_type, config) -> AsyncIterator[AgentStreamEvent]`.
   - Hide LLM instantiation, LangGraph node transitions, callback registration, and checkpointer bindings behind the gateway.
2. **GraphRegistry & Strategy Pattern (`src/graphs/registry.py`)**:
   - Manage pluggable `StateGraph` workflows (e.g., Default Chat Graph, Tool Graph, Research Graph) registered dynamically.
3. **Structured SSE Protocol (`src/schemas/events.py`)**:
   - Emit standard Server-Sent Events (`text/event-stream`): `token`, `tool_start`, `tool_end`, `node_transition`, `error`, `done`.
4. **Dual Checkpointer Adapter (InMemorySaver & AsyncPostgresSaver)**:
   - Default to `MemorySaver` in development and unit tests for sub-millisecond execution without databases, while injecting `AsyncPostgresSaver` in production for resilient thread state checkpoints.
5. **Deterministic Offline Test Double (`FakeChatModel`)**:
   - Provide an in-memory LLM test double mimicking token streaming and tool invocation without API costs or network latency.
6. **Title Worker Event Seam (`events:session:title_updated`)**:
   - Refactor `TitleGenerationWorker` to publish completion events over Redis Pub/Sub, removing raw SQL database queries from Python agent workers.
