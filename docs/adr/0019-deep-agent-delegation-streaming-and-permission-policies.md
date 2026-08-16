# 19. Deep Agent Delegation, Streaming Event Protocol, and Permission Boundaries

Date: 2026-08-16

## Status
Accepted

## Context
Following the core harness unification in ADR 0018, operational details for subtask delegation, client stream event schemas, and filesystem security boundaries needed formal definition.
1. Complex or long-running subtasks need isolated context execution to avoid polluting the parent agent's context window.
2. The Server-Sent Events (SSE) gateway required first-class schema extensions to communicate task planning checklist updates and subagent progress to the web frontend.
3. Automated file tools (`write_file`, `edit_file`, `delete`) required strict perimeter defense against sensitive system files and credentials.
4. The CopilotKit runtime endpoint and custom SSE gateway needed to guarantee state and tool parity.

## Decision
1. **Subagent Delegation Architecture**: Enable the built-in `task` tool with the default `general-purpose` subagent, and introduce a subagent registry seam in `registry.py` allowing specialized child agents (`researcher`, `code_analyst`) to be declared and spawned.
2. **SSE Event Protocol Extension**: Add typed `todo_update` (payload with tasks array, status, and IDs) and `subagent_start` / `subagent_end` events to `AgentStreamEvent` in `src/schemas/events.py`, dispatching them in real-time from `gateway.py`.
3. **Filesystem Permission Perimeter**: Configure declarative `permissions` with first-match-wins evaluation:
   - `deny`: `.env*`, `.git/**`, `**/secrets*`, system configuration files.
   - `allow`: `/workspace/**`, session artifact paths.
4. **Shared Graph Instance**: Both `/copilotkit` (via `SessionTrackingLangGraphAGUIAgent`) and `/chat/stream` (via `AgentExecutionGateway`) resolve against the same underlying compiled `create_deep_agent` graph instance with `CopilotKitMiddleware`.

## Consequences
- **Positive**:
  - Provides a safe sandbox for file manipulation without risking repository credentials.
  - Gives the web client rich, typed streams for live task checklists and subagent trees.
  - Ensures 100% feature and state parity regardless of whether requests arrive via CopilotKit or the custom SSE endpoint.
- **Negative / Trade-offs**:
  - Web client UI components in `apps/web` must be updated to consume the new `todo_update` SSE event type.
