# 0026. Clean Deep Runtime Agent Architecture

## Status
Accepted

## Context
Previously, `apps/agent` was structured around a bloated `core/gateway.py` (`AgentExecutionGateway`) with 43+ callers coupled to internal implementation details. The gateway mixed HTTP SSE streaming, PostgreSQL checkpointers, Docker sandbox execution, S3 file uploads, LangGraph AST event parsing, and concurrency semaphores into a single 700+ line monolith. This made unit testing difficult without live database/Docker dependencies, obscured domain boundaries, and created cognitive friction for backend engineers accustomed to clean separation of concerns.

## Decision
We refactor `apps/agent` into a **Clean Architecture with a Deep Module Runtime (`AgentRuntime`)**:

1. **Deep Runtime Seam (`src/runtime/`)**:
   - The application layer interacts with the agent engine exclusively through a minimal public interface (`AgentRuntime.stream(turn)` and `AgentRuntime.inspect(thread_id)`).
   - All concurrency locking, active-path synchronization, LangGraph v2 stream demuxing, HITL interrupt parsing, and artifact synchronization are completely encapsulated behind this seam.
2. **Strict Outbound Ports (`src/domain/ports.py`)**:
   - The core AI domain defines four pure Python protocol ports without external SDK dependencies:
     - `PersistencePort`: Session checkpointing and long-term memory.
     - `SandboxExecutionPort`: Isolated Python/shell workspace execution.
     - `StoragePort`: Object storage blob uploads and presigned URLs.
     - `ModelProviderPort`: Foundation model streaming and tool invocation.
3. **Infrastructure Adapters (`src/infrastructure/`)**:
   - Concrete drivers satisfy the domain ports with strict separation:
     - `persistence/`: `PostgresPersistenceAdapter` (production) & `InMemoryPersistenceAdapter` (test).
     - `sandbox/`: `DockerSandboxAdapter` (production) & `InProcessSandboxAdapter` (test).
     - `storage/`: `S3StorageAdapter` (production) & `InMemoryStorageAdapter` (test).
     - `models/`: `LangChainModelAdapter` (production) & `FakeChatModelAdapter` (test).
4. **Clean Directory Taxonomy**:
   - `src/controllers/`: HTTP and SSE endpoints (FastAPI routers).
   - `src/runtime/`: Deep runtime engine and lifecycle coordinator.
   - `src/domain/`: Pure AI agent logic, prompts catalog, and port definitions.
   - `src/infrastructure/`: Technical drivers and persistence adapters.
   - `src/workers/`: Background asynchronous task consumers.
5. **Hermetic In-Memory Testing**:
   - Provide `AgentRuntime.create_in_memory()` allowing comprehensive integration testing of the entire agent lifecycle in <50ms without Docker, PostgreSQL, S3, or API keys.
6. **Clean Cutover**:
   - Completely replace `AgentExecutionGateway` across all production routes and test suites with zero residual technical debt.
