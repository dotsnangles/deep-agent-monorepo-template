# 0025. Native UUID Domain Schema and ID Standardization

## Status
Accepted

## Context
Previously, domain entity IDs across chat sessions, messages, artifacts, and attachments were stored in PostgreSQL as arbitrary `text` columns. Additionally, ad-hoc string prefix formats (e.g. `art_...`, `att_...`) were used for artifacts and attachments during early prototyping. While external library tables (`user`, `session`, `account` from Better-Auth, and `checkpoints` from LangGraph) manage their own internal ID formats, our core chat domain entities lacked storage-level invariant enforcement and suffered from ID format fragmentation.

## Decision
We standardize all internal chat domain entity identifiers to PostgreSQL native `uuid` types and RFC 4122 standard UUIDs (v4):

1. **PostgreSQL Native UUID Schema**: In `@repo/db` (`chat.ts`), primary keys and foreign keys for `chat_session`, `chat_message`, `chat_artifact`, and `chat_attachment` are defined as `uuid(...)` with `defaultRandom()`.
2. **External Boundary Preservation**: Foreign keys pointing to Better-Auth (`user_id`) remain `text` referencing `user.id` to preserve external package compatibility.
3. **Removal of Ad-hoc Prefixes**: All ID generation across Python Agent (`apps/agent/src/core/artifacts.py`) and Next.js Web (`apps/web/src/app/api/storage/presigned-url/route.ts`) emits pure canonical UUIDs (`str(uuid.uuid4())` and `crypto.randomUUID()`).
4. **Storage Key Determinism**: Object storage keys retain the established multi-tenant hierarchy using standard UUID identifiers (`attachments/{userId}/{sessionId}/{attachmentUuid}_{filename}` and `artifacts/sessions/{sessionId}/{messageId}/{filename}`).
5. **Runtime Validation Invariants**: Zod validator schemas in `@repo/validators` enforce `.uuid()` format constraints on all domain ID inputs.
