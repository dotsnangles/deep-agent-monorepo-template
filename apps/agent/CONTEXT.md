# Agent Domain Context (`apps/agent`)

Domain glossary and architectural concepts for the Python Deep Agent service:

| Term | Definition | Location |
| --- | --- | --- |
| Deep Agent Harness | Unified LangChain `create_deep_agent` instance orchestrating declarative HITL (`interrupt_on`), context offloading, skills, and memory | `src/graphs/chat/` |
| Agent Execution Gateway | Deep execution facade orchestrating graph resolution, checkpointer injection, and unified SSE event streaming | `src/core/gateway.py` |
| Docker Sandbox Backend | Self-hosted Linux container environment implementing `SandboxBackendProtocolV2` for isolated Python data analysis execution (`execute`) | `src/graphs/chat/backends.py` |
| Graph Registry | Registry managing compilable graph factories (Chat, Data Analysis, Code) and routing by `agent_type` | `src/graphs/registry.py` |
| Agent Stream Event | Structured Server-Sent Event payload emitted during execution (`token`, `tool_start`, `tool_end`, `node_transition`, `todo_update`, `subagent_start`, `subagent_end`, `approval_request`, `error`, `done`) | `src/schemas/events.py` |
| Store Backend (VFS) | Virtual filesystem backend backed by `AsyncPostgresStore` for cross-thread persistence and artifact storage | `src/graphs/chat/backends.py` |
| Todo Planning Middleware | Harness middleware (`TodoListMiddleware`) enabling structured task decomposition and status tracking via `write_todos` | `src/graphs/chat/middleware.py` |
| Subagent Delegation Channel | Ephemeral child agent execution layer spawned via `task` tool with isolated context windows and final report compression | `src/graphs/chat/subagents.py` |
| Filesystem Permission Boundary | Declarative rule list restricting file I/O against sensitive system/credential paths while permitting workspace access | `src/graphs/chat/permissions.py` |
| Unified Graph Seam | Common compilable graph instance shared between CopilotKit AG-UI runtime and custom Gateway SSE streaming | `src/api/app.py` |
| Progressive Skills & Memory | Context layer combining `AGENTS.md` (always-loaded persistent rules) and `.agents/skills/` (progressive on-demand skill discovery) | `src/graphs/chat/context.py` |
| Fake Chat Model | In-memory test double mimicking LLM token streaming and tool invocation for 100% offline, zero-cost deterministic tests | `src/core/testing.py` |
| Title Event Seam | Redis Pub/Sub event channel (`events:session:title_updated`) decoupling background title generation from SQL database updates | `src/workers/title_worker.py` |
| AG-UI Endpoint | SSE streaming protocol endpoint for CopilotKit runtime integration | `src/api/routes/copilotkit.py` |
| Thread ID | Unique session identifier mapping 1:1 with LangGraph state checkpoints and Redis Pub/Sub channels | `src/api/routes/events.py` |
| Checkpointer | State persistence layer (`AsyncPostgresSaver` / `MemorySaver`) | `src/api/app.py` |
| Store | Long-term cross-thread memory store (`AsyncPostgresStore`) | `src/api/app.py` |
| Title Worker | Background task consumer listening on `queue:title_generation` to summarize chat titles asynchronously | `src/workers/title_worker.py` |
| Declarative Tool Approval | Tool gating mechanism using `interrupt_on` mapping tool names to human-in-the-loop review before execution | `src/graphs/chat/graph.py` |
| Active Path Synchronization | State replacement strategy synchronizing LangGraph state directly with client active path, avoiding $O(N^2)$ message inflation | `src/core/gateway.py` |
| Live LLM Inference | Prohibition of global response caches (`set_llm_cache`) in interactive chat pipelines to ensure real-time token streaming | `src/api/app.py` |
| Inference Serialization Gateway | Global semaphore/concurrency controller enforcing single-flight execution (`concurrency=1`) to prevent local SLM/Ollama OOM and crashes | `src/core/gateway.py` |
| Single-Flight Inference | Strict execution constraint guaranteeing only one LLM generation request runs at any instant under compute/VRAM-constrained environments | `src/core/gateway.py` |
| Dual-Environment Preset | Pre-configured runtime profile bundle (`local_slm` vs `cloud_provider`) mapping concurrency limits, subagent topologies, and background worker policies | `src/core/config.py` |
| Heuristic Title Strategy | Zero-inference title generation via string slicing (`user_prompt[:25]`) in local mode, eliminating background LLM queue contention | `src/workers/title_worker.py` |
| Environment-Aware Agent Factory | Factory dynamically assembling Deep Agent graphs with tailored profiles, backends, permissions, and middleware per active environment | `src/graphs/chat/factory.py` |
| General-Purpose Subagent | Native super-model inheriting subagent topology for on-demand context quarantine without pre-declared personas | `src/graphs/chat/subagents.py` |
| Rubric Quality Loop | Self-correction iterative evaluation middleware (`RubricMiddleware`) using LLM-as-a-judge for automated quality gates | `src/graphs/chat/factory.py` |
| Fault Tolerance Package | Layered resilience suite (`ModelFallback`, `ToolRetry`, `ModelCallLimit`, `ToolCallLimit`) preventing runaway loops and outages | `src/graphs/chat/factory.py` |
| Context Compaction Engine | Dual-action context management combining automatic 85% window summarization and on-demand `compact_conversation` tool | `src/graphs/chat/factory.py` |
| Agent Config Loader | Multi-source configuration resolver (`agent.config.yaml` + `.env`) providing type-safe Pydantic settings with fail-fast validation | `src/core/settings.py` |
| Prompt Catalog | File-based prompt management layer loading externalized Markdown templates (`prompts/*.md`) with safe variable interpolation | `src/graphs/chat/prompts.py` |
| Deterministic Storage Seam | URL-driven checkpointer/store resolver eliminating environment sniffing in favor of explicit `DATABASE_URL` resolution and test DI | `src/core/checkpointer.py` |
| Lifespan-Managed Connection Pool | Singleton `AsyncConnectionPool` managed exclusively within the FastAPI lifecycle, shared across checkpointer, store, and worker | `src/core/checkpointer.py` |
