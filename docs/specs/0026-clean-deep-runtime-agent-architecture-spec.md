# Specification: Clean Deep Runtime Agent Architecture (`apps/agent`)

## Problem Statement

Currently, developers maintaining and extending the Python Deep Agent service (`apps/agent`) face high cognitive load due to an overloaded monolithic gateway (`AgentExecutionGateway`) that tightly couples HTTP SSE streaming, PostgreSQL checkpointer connections, Docker sandbox execution, S3 file uploads, LangGraph AST stream demuxing, and concurrency locking into a 700+ line module. This violates the Single Responsibility Principle, creates a shallow abstraction with 43+ callers directly accessing internal plumbing, and forces unit tests to depend on live PostgreSQL/Docker infrastructure, resulting in slow test cycles and high maintenance friction.

## Solution

Refactor `apps/agent` into a Clean Architecture centered around a single Deep Module (`AgentRuntime`). The application layer (FastAPI route controllers) communicates with the agent engine exclusively through a minimal external seam (`stream(turn)` and `inspect(thread_id)`). External infrastructure dependencies (PostgreSQL checkpointing, Docker sandbox execution, S3 blob storage, foundation model inference) are isolated behind four abstract domain port protocols (`PersistencePort`, `SandboxExecutionPort`, `StoragePort`, `ModelProviderPort`). This eliminates monolithic coupling, allows 100% hermetic in-memory testing in <50ms, and provides a clear, conventional directory structure (`controllers/`, `runtime/`, `domain/`, `infrastructure/`, `workers/`).

## User Stories

1. As an API client developer, I want to send chat requests to `POST /chat/stream` with multimodal attachments, so that the agent can seamlessly process images and documents alongside text.
2. As an API client developer, I want to receive a normalized stream of Server-Sent Events (`token`, `tool_start`, `tool_end`, `todo_update`, `subagent_start`, `subagent_end`, `approval_request`, `artifact_created`, `done`), so that the frontend UI renders real-time reasoning and actions.
3. As a frontend engineer, I want the agent server to emit `approval_request` events when sensitive tools are triggered, so that users can approve or reject actions via Human-in-the-Loop cards.
4. As an API client developer, I want to resume interrupted conversations by passing an `ApprovalDecision` payload to `POST /chat/stream`, so that the agent continues execution from the paused state without replaying prior tools.
5. As a system operator running local SLMs (Ollama), I want the agent runtime to enforce single-flight inference serialization (`concurrency=1`), so that the server prevents local GPU/memory exhaustion and OOM crashes.
6. As an AI engineer, I want files generated in the session workspace (`artifacts/`) to be automatically hashed (SHA-256), uploaded to S3/MinIO, and emitted as `artifact_created` events with presigned URLs, so that generated charts and reports are immediately available to users.
7. As a backend maintainer, I want all PostgreSQL checkpointer lifecycle management and connection pools isolated inside `PostgresPersistenceAdapter`, so that database failures or pool configuration changes do not contaminate core AI domain logic.
8. As a backend maintainer, I want Docker container execution and workspace path sanitization isolated inside `DockerSandboxAdapter`, so that sandbox security rules (`.env`, `.git` denial) are strictly enforced in one dedicated component.
9. As a developer writing tests, I want to instantiate `AgentRuntime.create_in_memory()` with in-memory adapters, so that full turn execution and streaming tests run hermetically in <50ms without Docker, PostgreSQL, S3, or API keys.
10. As a backend developer, I want `apps/agent/src` organized cleanly into `controllers/`, `runtime/`, `domain/`, `infrastructure/`, and `workers/`, so that I can instantly locate files matching industry-standard Clean Architecture practices.
11. As an API developer, I want the FastAPI application lifespan to initialize and teardown all persistent adapter connections cleanly in one place, so that database and Redis sockets never leak on server restart.
12. As an observability engineer, I want Langfuse tracing metadata and turn snippets automatically generated and attached to agent runs, so that production LLM invocations and token latencies are fully observable.
13. As a chat user, I want new conversations to automatically receive concise Korean summary titles generated asynchronously by a background Redis worker, so that sidebar navigation is organized without delaying the main chat stream.

## Implementation Decisions

1. **Deep Runtime Seam (`src/runtime/`)**:
   - The module `AgentRuntime` exposes strictly two public methods: `stream(turn: AgentTurn) -> AsyncIterator[AgentStreamEvent]` and `inspect(thread_id: str) -> AgentStateSnapshot`.
   - `AgentTurn` accepts polymorphic inputs: raw string, list of `ChatMessage` (with multimodal attachments), or `ApprovalDecision` (HITL resume).
   - Encapsulates concurrency semaphore acquisition, active-path message deduplication, LangGraph compilation, AST event demuxing, artifact diff scanning, and terminal cleanup.

2. **Domain Port Protocols (`src/domain/ports.py`)**:
   - `PersistencePort`: Pure protocol for state snapshots, checkpoints, and long-term key-value store operations.
   - `SandboxExecutionPort`: Pure protocol for workspace command execution (`execute_command`), file I/O (`read_file`, `write_file`), and artifact discovery (`list_workspace_artifacts`, `read_artifact_bytes`).
   - `StoragePort`: Pure protocol for binary blob upload, presigned download URL generation, and artifact registry metadata recording.
   - `ModelProviderPort`: Pure protocol for foundation model token streaming and tool definitions.

3. **Infrastructure Adapter Implementations (`src/infrastructure/`)**:
   - `persistence/`: `PostgresPersistenceAdapter` wrapping `AsyncPostgresSaver`/`AsyncPostgresStore` with connection pool lifespan, alongside `InMemoryPersistenceAdapter`.
   - `sandbox/`: `DockerSandboxAdapter` wrapping `agent-sandbox-runner` container execution with security deny-lists (`.env`, `.git`, `..`), alongside `InProcessSandboxAdapter`.
   - `storage/`: `S3StorageAdapter` wrapping `boto3` for MinIO/AWS S3, alongside `InMemoryStorageAdapter`.
   - `models/`: `LangChainModelAdapter` wrapping multi-provider Chat models, alongside `FakeChatModelAdapter`.

4. **Directory Restructuring**:
   - `src/controllers/`: `chat_controller.py`, `artifact_controller.py`, `copilotkit_controller.py`, `health_controller.py`, `title_controller.py`, `app.py`.
   - `src/runtime/`: `runtime.py`, `types.py`, `events.py`.
   - `src/domain/`: `ports.py`, `factory.py`, `prompts.py`, `subagents.py`, `registry.py`.
   - `src/infrastructure/`: `persistence/`, `sandbox/`, `storage/`, `models/`, `config.py`, `settings.py`, `redis.py`, `observability.py`.
   - `src/workers/`: `title_worker.py`.

5. **Clean Cutover**:
   - Fully remove `src/core/gateway.py` and replace all 43 references across routes and tests with `AgentRuntime`.

## Testing Decisions

1. **Test Philosophy**:
   - Tests assert strictly on external behavior observed through `AgentRuntime.stream(turn)` or HTTP route responses, never asserting on private internal state.
   - Replace slow, mock-heavy unit tests with fast hermetic tests using `AgentRuntime.create_in_memory()`.
2. **Modules to Test**:
   - `AgentRuntime` turn execution, token streaming, and terminal event guarantees.
   - HITL interrupt detection and `ApprovalDecision` resumption.
   - Active path synchronization and message pruning.
   - Artifact discovery, SHA-256 deduplication, and `artifact_created` event emission.
   - Concurrency semaphore serialization under burst requests.
   - E2E live lifespan and Docker sandbox execution (`test_live_lifespan_integration.py`, `test_data_analysis_e2e.py`).
3. **Prior Art**:
   - Existing integration suites (`tests/test_api_integration.py`, `tests/test_artifact_sync_and_stream.py`, `tests/test_active_path_sync_and_live_inference.py`).

## Out of Scope

- Changes to the Next.js frontend UI (`apps/web`) or Express server (`apps/server`).
- Alterations to PostgreSQL schema definitions in `@repo/db` or shared DTO schemas in `@repo/validators`.
- Rewriting the LangGraph Deep Agent prompt engineering catalog (`prompts/system_prompt.md`).

## Further Notes

- All changes are developed and validated in the dedicated worktree `.worktrees/agent-architecture-refactor` on branch `refactor/agent-architecture`.
