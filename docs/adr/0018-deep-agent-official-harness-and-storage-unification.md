# 18. Deep Agent Official Harness & Storage Architecture Unification

Date: 2026-08-16

## Status
Accepted

## Context
Previously, `apps/agent` maintained two bifurcated graph pipelines:
1. `build_hitl_agent_graph` (`hitl_graph.py`): A custom-coded LangGraph `StateGraph(AgentState)` managing manual human-in-the-loop tool interrupts.
2. `build_agent` (`graph.py`): A partial invocation of `create_deep_agent` missing VFS backends, skills, and planning middlewares.

This bifurcation prevented the system from leveraging official LangChain Deep Agent capabilities (automatic history summarization, large result context offloading, progressive skill disclosure, and structured task planning).

## Decision
1. **Harness Unification**: Consolidate all agent execution paths under official `deepagents.create_deep_agent`. Replace custom `hitl_graph.py` nodes with declarative `interrupt_on={"execute_command": True, "write_file": True, "delete_resource": True}`.
2. **Storage & VFS Integration**: Pair `AsyncPostgresStore` with `StoreBackend` for cross-session persistent storage and memory, alongside path-permissioned `FilesystemBackend` for isolated workspace interactions.
3. **Task Planning Middleware**: Enable `TodoListMiddleware()` to provide the agent with `write_todos` and stream structured progress events (`pending`, `in_progress`, `completed`) to the client UI.
4. **Progressive Memory & Skills**: Wire repository `AGENTS.md` into `memory` (always-loaded rules) and `.agents/skills/` into `skills` (progressive on-demand loading).

## Consequences
- **Positive**:
  - Eliminates custom graph maintenance overhead and aligns 100% with official LangChain standards.
  - Enables automatic context management and token reduction on long multi-turn sessions.
  - Structured todo list streaming provides visual task progress to web users.
- **Negative / Trade-offs**:
  - Requires updating the SSE Gateway (`gateway.py`) to parse official `write_todos` tool calls and translate them into `todo_update` stream events.
  - Requires defining declarative permission policies for file tools.
