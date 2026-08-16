# 0014. Decoupled Smart Title Generation Pipeline and Client Heuristic Fallback

## Status
Accepted

## Context
In the chat interface, when a user sends their initial prompt in a new conversation, the session title defaults to `"새로운 대화"`. Previously, title summarization was enqueued to a Redis task queue, where the Python worker ran raw SQL updates directly against the PostgreSQL database. In Ticket #19, we decoupled the Python worker by having it publish an event (`events:session:title_updated`) over Redis Pub/Sub instead of modifying the database directly.

However, three architectural gaps remained:
1. **Lack of a Server-Side Event Consumer**: No service was subscribing to `events:session:title_updated` to persist the updated title to PostgreSQL via `ChatRepository`.
2. **Missing Client Heuristic Fallback**: If Redis or the Agent service was down or delayed, the user's conversation was stuck displaying `"새로운 대화"`.
3. **Real-time UI Synchronization**: The client UI (`ChatEngineRegistry` and `AppSidebar`) lacked a deterministic mechanism to receive title updates without manual polling.

## Decision
1. **3-Tier Progressive Title Lifecycle**:
   - **Tier 1 (Instant / 0ms)**: Pure in-memory client heuristic `deriveSessionTitle(prompt)` immediately populates the UI with a sanitized, 24-character summary on the first message send.
   - **Tier 2 (Async AI Summary / 1-2s)**: `generateSmartTitleInBackground(sessionId, userPrompt)` enqueues the task to Redis `queue:title_generation`, where `TitleGenerationWorker` generates an LLM-summarized title.
   - **Tier 3 (Realtime Sync & Persistence)**: The backend Redis event subscriber persists the AI title to PostgreSQL via `ChatRepository` and notifies the client via `ChatEngineRegistry` events / SSE.
2. **Pure Client-Side Heuristic (`deriveSessionTitle`)**:
   - Strips leading Markdown symbols (`#`, `-`, `*`, code fences, quotes).
   - Extracts the first meaningful sentence or line, truncated to 24 characters with ellipsis (`...`).
   - Pure, deterministic, zero-dependency, and 100% testable in <1ms.
3. **Backend Title Event Subscriber (`@repo/redis` / `server`)**:
   - Listens to Redis Pub/Sub topic `events:session:title_updated`.
   - Safely patches session titles in PostgreSQL using `chatRepository.patchSession(userId, sessionId, { title })`.
4. **Real-time Title Event Bus Integration**:
   - `ChatEngineRegistry` emits `titleUpdated({ sessionId, title })` to update active and inactive sidebar sessions immediately without page refreshes.

## Consequences
- Zero-latency feedback: Users immediately see an accurate conversational title on their first prompt.
- High resilience: Complete fault tolerance against Redis outages or Agent server latency.
- Deep modularity: Strict separation of concerns between client heuristics, AI worker queues, and database persistence.
