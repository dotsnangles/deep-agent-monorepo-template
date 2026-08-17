# 16. Multimodal File Attachments & Direct Storage Gateway

## Status

Accepted (Decision 3 superseded by [ADR-0025](0025-native-uuid-domain-schema-and-id-standardization.md))

## Context

Users need the ability to attach diverse files (images, PDF, CSV, Markdown, text) to chat messages for multimodal analysis and document question-answering.

Prior to this decision, the chat system only accepted plain text messages (`content: string`). Passing file uploads through server memory or proxying file streams through Next.js/FastAPI introduces severe CPU/RAM overhead, network saturation, and complex multipart parsing bottlenecks. Furthermore, because conversation messages in the system support immutable tree branching (fork & edit), attachment metadata must be efficiently inherited or cloned across conversation branches without heavy relational join queries.

## Decisions

1. **Direct-to-S3 Presigned URL Upload Pattern**
   - The client requests a pre-authenticated PUT URL via a fast Next.js endpoint (`/api/storage/presigned-url`).
   - The browser uploads binary payloads directly to MinIO/S3 using the presigned URL with progress tracking.
   - Web and API servers experience zero bandwidth or memory consumption from file transfers.

2. **`StorageService` Port & Zero-IO Fake Test Double (`@repo/storage`)**
   - Define a `StorageService` interface in `@repo/storage` exposing:
     - `generatePresignedUploadUrl(params: PresignedUploadParams): Promise<PresignedUploadResult>`
     - `generatePresignedDownloadUrl(params: PresignedDownloadParams): Promise<string>`
     - `deleteObject(key: string): Promise<boolean>`
   - Provide `MinioStorageService` for production/local MinIO environments and `FakeStorageService` for in-memory, deterministic testing (<1ms, zero network I/O).

3. **Embedded JSONB `attachments` on `MessageNode`** *(Superseded by ADR-0025)*
   - Rather than creating a separate relational table with foreign key joins, store an array of `AttachmentEntity` (`id`, `url`, `name`, `mimeType`, `size`, `s3Key`) directly on the `MessageNode`.
   - When users fork a conversation branch or regenerate responses, parent attachments remain immutable and instantaneously accessible without joining multiple tables.
   - *> **Update (2026-08-17)**: Superseded by [ADR-0025](0025-native-uuid-domain-schema-and-id-standardization.md). To guarantee foreign key integrity, standard cascade deletions, and UUID consistency, attachments are persisted in a dedicated `chat_attachment` relational table.*

4. **Whitelist MIME Validation & Security Guardrails (`@repo/validators`)**
   - Strict validation restricts upload requests to approved MIME types:
     - Images: `image/png`, `image/jpeg`, `image/webp`, `image/gif`
     - Documents: `application/pdf`, `text/plain`, `text/markdown`, `text/csv`, `application/json`
   - Hard limits enforce maximum 20MB per file and maximum 5 attachments per message turn.

5. **Multimodal Vision & Document Context Injection (`apps/agent`)**
   - `AgentExecutionGateway` inspects attached files:
     - Image attachments are converted into standard LangChain multimodal vision content blocks (`{"type": "image_url", "image_url": {"url": ...}}`).
     - Text/PDF/Markdown/CSV documents are fetched and formatted into structured contextual document sections within the agent prompt.

## Consequences

- **Positive**:
  - Near-zero server memory/bandwidth footprint during large file uploads.
  - Full compatibility with immutable message branching and fast subtree pruning.
  - Zero-cost testability via `FakeStorageService` in Vitest and Pytest.
  - Seamless multimodal reasoning in LangGraph agents.
- **Negative / Trade-offs**:
  - MinIO local development environment requires proper CORS configuration (`AllowedOrigins`, `AllowedMethods: PUT, GET`).
  - Presigned upload URLs have strict TTL expiration (e.g. 15 minutes) and require validation before issuance.
