# 0011. Deep ChatEngine and Ports-and-Adapters Transport Seam

## Status
Accepted

## Context
The client-side chat system manages hierarchical message tree branching, live token streaming buffers, optimistic leaf updates, unmount resilience across route changes, and database persistence. Previously, these concerns were spread across 4 shallow files (`use-message-tree.ts`, `stream-manager.ts`, `tree.ts`, `chat-session-context.tsx`). This resulted in leaking storage concerns into stream receivers, brittle multi-session array merging, and a continuous 4-second polling timer in the session context provider.

## Decision
We establish a deep in-process chat architecture based on the Ports-and-Adapters pattern:
1. **Pure TypeScript State Engine (`ChatEngine`)**: A zero-React-dependency state machine encapsulating message tree traversal, immutable forking, stream chunk accumulation, and optimistic state rollbacks. React components bind via `useSyncExternalStore`.
2. **Injected Transport Seam (`ChatTransport`)**: Network operations (`fetchTree`, `streamResponse`, `persistNode`, `updateActiveLeaf`) are isolated behind a clean interface. Production uses `HttpChatTransport`, while unit tests use `FakeChatTransport` without mocking DOM globals or HTTP interceptors.
3. **Global Multi-Session Lifecycle (`ChatEngineRegistry`)**: A singleton registry maintaining session engines across route navigations, guaranteeing that in-flight background streams never drop chunks when components unmount.
4. **Event-Driven Session Synchronization**: `ChatEngineRegistry` publishes session lifecycle events, eliminating the 4-second polling interval in `ChatSessionProvider` and reducing unnecessary re-renders.
5. **Preserved Error Nodes & Resilient Retries**: Failed or interrupted streaming responses preserve user and assistant nodes with an error status and provide explicit `retry()` capabilities instead of destructive rollbacks.
