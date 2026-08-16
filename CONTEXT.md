# Core Context Glossary

Key terms and definitions used across `hollow-echo-distant-signal`:

| Term | Definition | Context |
| --- | --- | --- |
| Object Storage | File and asset storage system powered by MinIO locally and AWS S3 in production | Storage (`@repo/storage`) |
| Key-Value Cache | High-speed in-memory data store powered by Redis for caching and rate limiting | Cache (`@repo/redis`) |
| Validator Schema | Zod-based runtime validation schema shared between server and web DTOs | Validation (`@repo/validators`) |
| Chat Session | A user-owned conversation container with persistent metadata (title, timestamps) | Web & DB (`@repo/db`) |
| Thread | Unique execution ID (`thread_id`) mapping 1:1 with a LangGraph state graph & checkpoints | Python Agent (`apps/agent`) |
| Lazy Session | A client-only draft conversation state that is only persisted to database upon sending the first user message | Web Client (`apps/web`) |
| Smart Title Worker | Redis Task Queue (`queue:title_generation`) background worker on Python Agent server that throttles and processes title generation via LangChain LCEL | Python Agent & Redis (`apps/agent`, `@repo/redis`) |
| Message Tree | A hierarchical conversation structure where messages can fork into multiple branches via edit or regenerate actions | Web & DB (`@repo/db`, `apps/web`) |
| Active Path | The single linear sequence of messages from the root message to the currently selected leaf node, displayed to the user and sent to the LLM | Web & Agent (`apps/web`, `apps/agent`) |
| Immutable Forking | An append-only branching strategy where editing or regenerating a message creates a new sibling node without modifying existing history | Web & DB (`@repo/db`, `apps/web`) |
| Cascade Delete | A pruning strategy where deleting a message node permanently removes all of its descendant child nodes | Web & DB (`@repo/db`, `apps/web`) |
| Global Stream Manager | Client-side lifecycle coordinator managing active HTTP stream connections and buffers decoupled from view unmounts | Web Client (`apps/web`) |
| Stream Reconnection | Restoring buffered stream chunks and re-attaching live chunk rendering upon re-entering an actively generating session | Web Client (`apps/web`) |
| Chat Engine | In-process state machine encapsulating message tree mutations, stream chunk accumulation, and optimistic rollback | Web Client (`apps/web`) |
| Chat Engine Registry | Global singleton coordinating session engine lifecycles, stream persistence across routes, and event-driven updates | Web Client (`apps/web`) |
| Chat Transport | Ports-and-adapters network interface decoupling state management from HTTP streaming and database endpoints | Web Client (`apps/web`) |
| Chat Repository | Deep domain repository interface encapsulating session/message CRUD, tree queries, and transactional mutations | Database (`@repo/db`) |
| Drizzle Chat Repository | Concrete Drizzle ORM implementation providing atomic database transactions for subtree pruning and message insertion | Database (`@repo/db`) |
| Fake Chat Repository | In-memory test double implementing ChatRepository with zero database dependencies for instant unit tests | Database (`@repo/db`) |
| Derived Session Title | Pure in-memory client heuristic extracting a clean, concise title from the user's initial prompt with 0ms network latency | Web Client (`apps/web`) |
| Title Lifecycle Pipeline | 3-tier progressive promotion pipeline (Optimistic Heuristic -> Async AI Summary -> Realtime Sync) | Fullstack (`apps/web`, `apps/agent`, `@repo/redis`) |
| Redis Title Event Subscriber | Node.js background event subscriber listening to `events:session:title_updated` and syncing PostgreSQL via `ChatRepository` | Backend (`apps/server`, `@repo/redis`) |
| Sensitive Tool | An agent tool with mutations or side effects requiring explicit human authorization before execution | Agent (`apps/agent`) |
| HITL Breakpoint | A LangGraph interrupt suspended state halting execution before sensitive tool invocation until user decision | Agent (`apps/agent`) |
| Approval Request Event | SSE stream event (`approval_request`) emitted when an agent encounters an approval-required tool breakpoint | Agent & Web (`apps/agent`, `apps/web`) |
| Tool Action Card | Interactive React component rendering pending tool parameters, formatted diffs, and Approve/Reject buttons | Web Client (`apps/web`) |
| Resume Command | LangGraph `Command(resume=...)` payload sent over `/chat/stream` delivering human approval or rejection to continue execution | Agent & Web (`apps/agent`, `apps/web`) |
