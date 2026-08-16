# 24. Unified PostgreSQL Checkpointer & Store Lifecycle and Deterministic Storage Seam

Date: 2026-08-17

## Status
Accepted

## Context
1. **Environment Sniffing Technical Debt**: Previously, `CheckpointerFactory` used implicit heuristics (`is_test_environment()`, inspecting `sys.modules`, checking `os.getenv("_")`) to switch between `MemorySaver` and `AsyncPostgresSaver`. This led to unpredictable initialization timing, background `AsyncConnectionPool` connection errors, and behavioral divergence between local development and production.
2. **Dev/Prod Parity Principle**: The local development infrastructure (running via Docker Compose) provides identical PostgreSQL 18 and Redis 7 services as production. The backend should operate against real PostgreSQL checkpointer and store instances uniformly across all environments.
3. **Clean Test Seam vs Runtime Magic**: Unit tests that need fast, zero-dependency in-memory execution should achieve it via explicit Dependency Injection (`create_agent(checkpointer=MemorySaver())`) rather than through hidden runtime environment sniffers.

## Decision
1. **Eliminate Magic Environment Sniffing**:
   - Completely remove `is_test_environment()` and `sys.modules` heuristics from `CheckpointerFactory`.
   - Resolve storage backend deterministically: if `DATABASE_URL` is configured, construct `AsyncPostgresSaver` and `AsyncPostgresStore`; if `DATABASE_URL` is empty or omitted, gracefully default to in-memory instances.
2. **FastAPI Lifespan-Managed Singleton Connection Pool**:
   - Manage the `AsyncConnectionPool` explicitly inside the FastAPI `lifespan` lifecycle:
     - Startup: `pool = await CheckpointerFactory.create_pool(DATABASE_URL)`, run `checkpointer.setup()` and `store.setup()`.
     - Teardown: `await pool.close()`.
   - Share the opened pool across Checkpointer, Store, and Title Generation workers to prevent connection leaks.
3. **Explicit Dependency Injection Seam for Testing**:
   - Retain `DeepAgentEnvironmentFactory.create_agent(checkpointer=..., store=...)` as the primary seam for tests.
   - Unit tests that test agent orchestration logic pass `MemorySaver()` / `InMemoryStore()` directly into `create_agent()`.
4. **12-Factor App Configuration Separation**:
   - Keep sensitive database credentials in `.env` (`DATABASE_URL`).
   - Keep `agent.config.yaml` focused on declarative VFS routes (`memory_route`, `sessions_dir`) and runtime feature toggles.

## Consequences
- **Positive**:
  - **100% Dev/Prod Parity**: Zero discrepancies in checkpointer serialization, state persistence, or locking between local development and production.
  - **Clean & Predictable Lifecycle**: Elimination of un-opened connection pool warnings (`error connecting in 'pool-1'`).
  - **Zero Magic in Factory**: Factory code remains pure and declarative without environment-sniffing conditionals.
- **Negative / Trade-offs**:
  - Requires integration tests running against PostgreSQL to ensure the local DB container is reachable, while pure unit tests explicitly inject `MemorySaver`.
