# 0012. Deep ChatRepository and Database Seam in @repo/db

## Status
Accepted

## Context
Currently, HTTP route handlers across Next.js (`apps/web/src/app/api/chat/*`) and Express server (`apps/server`) construct and execute raw Drizzle ORM SQL queries directly. Multi-step operations—such as cascading message subtree deletions followed by session active leaf recalculations, and first-message session upserts—are executed across multiple separate queries without database transaction boundaries, creating risks of data corruption or orphaned leaf pointers. Furthermore, testing route handlers requires a live PostgreSQL instance or brittle Drizzle mock spies.

## Decision
We establish a deep repository boundary in `@repo/db` using the Ports-and-Adapters pattern:
1. **Deep Repository Port (`ChatRepository`)**: A high-leverage interface exposing clean domain entities (`MessageNode`, `ChatSessionEntity`, `TreeResult`) and hiding all SQL, column mapping, and ORM query composition.
2. **Mandatory Tenant Authorization**: Every repository query method requires `userId` as an argument (`getSessions`, `getTree`, `saveMessage`, `deleteSubtree`), enforcing tenant isolation at the data access seam.
3. **Atomic Transactional Pruning & Upserts**: `DrizzleChatRepository` encapsulates subtree deletions (`db.delete(chatMessage)`) and active leaf updates (`db.update(chatSession)`) inside `db.transaction()`. Saving a message into a new session automatically upserts the session record atomically.
4. **Zero-DB Test Double (`FakeChatRepository`)**: `@repo/db` exports an in-memory implementation of `ChatRepository` supporting instant (<10ms) integration testing of HTTP routes, background title workers, and server services without Docker or database spin-up.
5. **Route Handler Simplification**: Route handlers in `apps/web` and `apps/server` become thin adapters translating HTTP requests into repository method calls and returning standard JSON.
