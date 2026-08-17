# Agent Domain Context (`apps/agent`)

Domain glossary and architectural concepts for the Python Deep Agent service:

| Term | Definition | Location |
| --- | --- | --- |
| Agent Runtime Engine | Deep execution module (`AgentRuntime`) orchestrating graph resolution, concurrency semaphores, active-path synchronization, and unified SSE event streaming | `src/runtime/` |
| Deep Agent Harness | Unified LangChain `create_deep_agent` instance orchestrating declarative HITL (`interrupt_on`), context offloading, skills, and memory | `src/graphs/chat/factory.py` |
| Domain Ports & Types | Strict abstract protocol seams and pure dataclasses decoupling AI domain logic from infrastructure dependencies (`PersistencePort`, `SandboxExecutionPort`, `StoragePort`, `ModelProviderPort`, `AgentTurn`, `ApprovalDecision`) | `src/domain/` |
| Docker Sandbox Adapter | Self-hosted Linux container adapter implementing `SandboxExecutionPort` for isolated Python data analysis execution (`execute`) | `src/infrastructure/sandbox/` |
| Postgres Persistence Adapter | PostgreSQL checkpointing and long-term memory store adapter implementing `PersistencePort` via `AsyncPostgresSaver` and `AsyncPostgresStore` | `src/infrastructure/persistence/` |
| S3 Storage Adapter | Object storage adapter implementing `StoragePort` for incremental artifact hashing (SHA-256), S3/MinIO upload, and presigned URL generation | `src/infrastructure/storage/` |
| LangChain Model Adapter | Model provider adapter implementing `ModelProviderPort` for multi-provider LLM streaming and fallback policies | `src/infrastructure/models/` |
| Graph Registry | Registry managing compilable graph factories (Chat, Data Analysis, Code) and routing by `agent_type` | `src/graphs/registry.py` |
| Agent Stream Event | Structured Server-Sent Event payload emitted during execution (`token`, `tool_start`, `tool_end`, `node_transition`, `todo_update`, `subagent_start`, `subagent_end`, `approval_request`, `artifact_created`, `error`, `done`) | `src/runtime/events.py` |
| Store Backend (VFS) | Virtual filesystem backend backed by `AsyncPostgresStore` for cross-thread persistence and artifact storage | `src/infrastructure/persistence/` |
| Todo Planning Middleware | Harness middleware (`TodoListMiddleware`) enabling structured task decomposition and status tracking via `write_todos` | `src/graphs/chat/factory.py` |
| Subagent Delegation Channel | Ephemeral child agent execution layer spawned via `task` tool with isolated context windows and final report compression | `src/graphs/chat/subagents.py` |
| Filesystem Permission Boundary | Declarative rule list restricting file I/O against sensitive system/credential paths while permitting workspace access | `src/infrastructure/sandbox/` |
| Title Event Seam | Redis Pub/Sub event channel (`events:session:title_updated`) decoupling background title generation from SQL database updates | `src/workers/title_worker.py` |
| AG-UI Controller | SSE streaming protocol controller for CopilotKit runtime integration | `src/controllers/copilotkit.py` |
| Chat Stream Controller | Primary FastAPI route controller handling `POST /chat/stream` requests and driving `AgentRuntime` | `src/controllers/chat.py` |
| Thread ID | Unique session identifier mapping 1:1 with LangGraph state checkpoints and Redis Pub/Sub channels | `src/domain/types.py` |
| Title Worker | Background task consumer listening on `queue:title_generation` to summarize chat titles asynchronously | `src/workers/title_worker.py` |
| Declarative Tool Approval | Tool gating mechanism using `interrupt_on` mapping tool names to human-in-the-loop review before execution | `src/graphs/chat/factory.py` |
| Active Path Synchronization | State replacement strategy synchronizing LangGraph state directly with client active path, avoiding $O(N^2)$ message inflation | `src/runtime/` |
| Single-Flight Inference | Strict execution constraint guaranteeing only one LLM generation request runs at any instant under compute/VRAM-constrained environments | `src/runtime/` |
| Dual-Environment Preset | Pre-configured runtime profile bundle (`local_slm` vs `cloud_provider`) mapping concurrency limits, subagent topologies, and background worker policies | `src/infrastructure/config.py` |
| Heuristic Title Strategy | Zero-inference title generation via string slicing (`user_prompt[:25]`) in local mode, eliminating background LLM queue contention | `src/workers/title_worker.py` |
| Environment-Aware Agent Factory | Factory dynamically assembling Deep Agent graphs with tailored profiles, backends, permissions, and middleware per active environment | `src/graphs/chat/factory.py` |
| General-Purpose Subagent | Native super-model inheriting subagent topology for on-demand context quarantine without pre-declared personas | `src/graphs/chat/subagents.py` |
| Rubric Quality Loop | Self-correction iterative evaluation middleware (`RubricMiddleware`) using LLM-as-a-judge for automated quality gates | `src/graphs/chat/factory.py` |
| Fault Tolerance Package | Layered resilience suite (`ModelFallback`, `ToolRetry`, `ModelCallLimit`, `ToolCallLimit`) preventing runaway loops and outages | `src/graphs/chat/factory.py` |
| Context Compaction Engine | Dual-action context management combining automatic 85% window summarization and on-demand `compact_conversation` tool | `src/graphs/chat/factory.py` |
| Agent Config Loader | Multi-source configuration resolver (`agent.config.yaml` + `.env`) providing type-safe Pydantic settings with fail-fast validation | `src/infrastructure/settings.py` |
| Prompt Catalog | File-based prompt management layer loading externalized Markdown templates (`prompts/*.md`) with safe variable interpolation | `src/graphs/chat/prompts.py` |
| Lifespan-Managed Connection Pool | Singleton `AsyncConnectionPool` managed exclusively within the FastAPI lifecycle, shared across checkpointer, store, and worker | `src/infrastructure/persistence/` |
