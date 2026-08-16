# 20. Self-Hosted Docker Sandbox Backend for Data Analysis Agent

Date: 2026-08-16

## Status
Accepted

## Context
Building a robust Data Analysis Agent requires safe, autonomous Python execution (`pandas`, `numpy`, `matplotlib`, `seaborn`, `scipy`) and arbitrary shell command execution (`execute`). 
- Relying directly on the host operating system's local shell creates severe security and isolation risks (e.g. infinite loops, high memory consumption, unintended file deletion).
- Relying solely on paid cloud SaaS sandboxes (E2B, LangSmith Sandbox) introduces ongoing subscription/usage costs and vendor lock-in during early development.
- The project already maintains a multi-service `docker-compose.yml` infrastructure (PostgreSQL, Redis, MinIO).

## Decision
1. **Self-Hosted Docker Sandbox**: Implement a custom `DockerSandboxBackend` satisfying the official Deep Agents `SandboxBackendProtocolV2`.
2. **Container Composition**: Add a dedicated, lightweight data-science container service (`sandbox-runner`) to `docker-compose.yml` pre-baked with Python 3.13 and core data analysis libraries.
3. **Session Volume Mount**: Mount session-scoped workspace directories (`./workspace/sessions/{thread_id}/`) into the container to enable zero-overhead artifact sharing (charts, reports, CSV exports) between the sandbox, the agent server, and client SSE streams.
4. **Cloud Pluggability Seam**: Retain the `get_session_backend(thread_id)` factory pattern so that external cloud sandboxes (e.g. E2B) can still be plugged in seamlessly via environment variables if needed in the future.

## Consequences
- **Positive**:
  - **Zero Cost & Offline-Friendly**: 100% free for both local development and self-hosted production deployment.
  - **Dev-Prod Parity**: Identical execution environment across macOS development machines and production Linux servers.
  - **Host Security**: Complete isolation of arbitrary Python code from the host machine and production server filesystem.
- **Negative / Trade-offs**:
  - Requires Docker Desktop or a local Docker daemon to be running during development.
  - Requires managing container CPU/memory limits and zombie process reaping in `docker-compose.yml`.
