# 21. Linear Session Architecture with Forking and Deep Agents Rich UI

Date: 2026-08-16

## Status
Accepted

## Context
1. **In-Session DAG Cognitive Load**: The previous in-session message tree (DAG) architecture allowed branching (`< 1/3 >` pagination) within a single chat session. In practice, this created significant cognitive load for users (navigating hidden sibling branches) and introduced heavy state-machine overhead across both the database and the frontend.
2. **LangGraph Checkpointer Mismatch**: In-session DAG branching required complex `Active Path Synchronization` and state-cleanup maneuvers (`RemoveMessage`) to reconcile client message trees with LangGraph's linear thread checkpointer.
3. **Deep Agents Rich Event Visualization Gap**: While the Python Deep Agent service emits rich SSE events (`todo_update`, `subagent_start/end`, `tool_start/end`) and writes sandbox artifacts (`chart.png`), the web frontend lacked dedicated components to visualize these live planning and execution stages.

## Decision
1. **Linear Session Architecture (1D Message Sequence)**: Simplify each chat session to a strictly linear sequence of messages ordered by creation time. Eliminate recursive in-session DAG branching, active leaf tracking, and in-place sibling pagination.
2. **Fork to New Session from Past Turns**: Allow editing/regenerating the latest message in-place within the current session. When a user wishes to branch from an earlier turn, provide a "Fork to New Session" action that creates a new independent session cloned up to that point.
3. **1:1 Session-Thread-Sandbox Mapping**: Map each `session_id` 1:1 to a LangGraph `thread_id` and an isolated sandbox workspace (`workspace/sessions/{session_id}`).
4. **Deep Agents Rich UI & Artifact Serving**:
   - Add inline collapsible cards for real-time To-do plans (`TodoListMiddleware` updates).
   - Add specialist delegation cards for subagents (`data_analyst`, `chart_generator`).
   - Introduce a session artifact serving endpoint (`/api/chat/sessions/:sessionId/artifacts/:filename`) and an interactive lightbox viewer for generated charts (`chart.png`) and datasets.

## Consequences
- **Positive**:
  - **Crystal-Clear User Experience**: Eliminates the confusion of hidden in-session branch paginations.
  - **Drastic Code Simplification**: Removes recursive CTEs, active leaf tracking, and tree traversal algorithms across DB, web client, and agent gateway.
  - **Direct LangGraph Harmony**: Zero friction between web sessions and LangGraph checkpoint threads.
  - **Rich Visibility**: Complete transparency into agent planning (To-do), delegation (Subagents), and sandbox outputs (Charts).
- **Negative / Trade-offs**:
  - Branching from past turns creates additional session entries in the sidebar list rather than compacting within a single session entry.
