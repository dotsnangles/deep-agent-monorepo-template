# Database Domain Context (`@repo/db`)

Domain glossary and architectural concepts for database access and persistence:

| Term | Definition | Location |
| --- | --- | --- |
| Chat Session Entity | Persistent metadata record of a user conversation with active pointer and timestamps | `src/schema/chat.ts` |
| Chat Message Entity | Persistent message record belonging to a session with self-referencing parent ID | `src/schema/chat.ts` |
| Chat Repository | Deep domain repository interface encapsulating session/message CRUD, linear queries, and transactional forking | `src/repositories/chat-repository.ts` |
| Drizzle Chat Repository | Concrete Drizzle ORM implementation providing atomic database transactions for session forking and message insertion | `src/repositories/drizzle-chat-repository.ts` |
| Fake Chat Repository | In-memory test double implementing ChatRepository with zero database dependencies for instant unit tests | `src/repositories/fake-chat-repository.ts` |
| Atomic Session Fork Transaction | Single-transaction database execution creating a new session and cloning message history up to a turn | `src/repositories/drizzle-chat-repository.ts` |
