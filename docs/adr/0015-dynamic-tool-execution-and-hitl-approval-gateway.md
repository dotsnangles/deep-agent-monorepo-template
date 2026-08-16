# ADR 0015: Dynamic Tool Execution & Human-In-The-Loop (HITL) Approval Gateway

## Context
As agent workflows evolve to execute operations with side effects (such as file modifications, code execution, database mutations, or external API transactions), executing these actions autonomously without user oversight introduces safety and operational risks.

We need a resilient, interactive mechanism that:
1. Suspends execution before executing designated sensitive tools.
2. Emits real-time approval requests over Server-Sent Events (SSE) to the web UI.
3. Allows the user to inspect formatted parameters, approve or reject the action.
4. Resumes LangGraph execution cleanly via persistent checkpointers (`AsyncPostgresSaver` / `MemorySaver`) without losing conversation context or message history.

## Decision

### 1. Sensitive Tool Metadata & Declaration
Tools with potential side effects are decorated or registered with an explicit approval requirement metadata (`requires_approval = True`). Read-only and deterministic mathematical tools continue executing automatically.

### 2. LangGraph Interrupt & Command Resume Seam
- When the agent graph plans a tool call requiring approval, an interrupt breakpoint (`interrupt()`) is triggered before the tool node executes.
- Execution halts, state is checkpointed in PostgreSQL (`AsyncPostgresSaver`) / Memory, and an SSE event `approval_request` (`{ toolCallId, tool, input, description }`) is emitted.
- To resolve the interrupt, the client sends a resume payload (`Command(resume={"approved": boolean, "reason": str})`) over `POST /api/chat/stream`.
- If approved, the tool executes and yields output. If rejected, a structured `ToolMessage` with status `cancelled` is injected into state, allowing the LLM to adapt and provide context-aware follow-up.

### 3. Dedicated Event Schemas (`approval_request`)
The SSE stream protocol is extended with:
- `approval_request`: Emitted when the agent pauses for user decision. Contains `toolCallId`, `tool`, `input`, and summary.
- `tool_start` & `tool_end`: Emitted only when the approved tool actually executes.

### 4. Inline Tool Action Card UI
- `MessageItem` renders an interactive `ToolActionCard` displaying the pending tool details and [승인], [거절] action buttons.
- On click, `ChatEngine` dispatches the resume stream request, disabling buttons and providing instant visual feedback.

### 5. Checkpointer Hydration & Offline Resumption
Threads reloaded or refreshed while in a pending approval state query LangGraph checkpointer state to rehydrate the interactive action card, ensuring seamless multi-device or reload continuity.

## Consequences
- **Pros**:
  - Maximum safety and auditability for sensitive autonomous actions.
  - Zero-loss resumption leveraging LangGraph native checkpointer checkpoints.
  - Clean separation between approval requests and actual tool execution events.
  - Testable offline via `FakeChatModel` and simulated interrupt test doubles in pytest and Vitest.
- **Cons**:
  - Requires maintaining checkpointer state consistency across client resume calls.
