# Database Domain Context (`@repo/db`)

Domain glossary and architectural concepts for database access and persistence:

| Term | Definition | Location |
| --- | --- | --- |
| Chat Session Entity | Persistent metadata record of a user conversation with active leaf pointer and timestamps | `src/schema/chat.ts` |
| Chat Message Entity | Persistent message node record belonging to a session with self-referencing parent ID | `src/schema/chat.ts` |
| Chat Repository | Deep domain repository interface encapsulating session/message CRUD, tree queries, and transactional mutations | `src/repositories/chat-repository.ts` |
| Drizzle Chat Repository | Concrete Drizzle ORM implementation providing atomic database transactions for subtree pruning and message insertion | `src/repositories/drizzle-chat-repository.ts` |
| Fake Chat Repository | In-memory test double implementing ChatRepository with zero database dependencies for instant unit tests | `src/repositories/fake-chat-repository.ts` |
| Atomic Prune Transaction | Single-transaction database execution deleting descendant message rows and updating the session active leaf pointer | `src/repositories/drizzle-chat-repository.ts` |
