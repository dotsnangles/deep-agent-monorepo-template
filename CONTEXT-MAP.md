# Context Map

Overview of bounded contexts and packages in `hollow-echo-distant-signal`:

| Context / Package | Location / Package Name | Description |
| --- | --- | --- |
| Root Context | `CONTEXT.md` | Core domain glossary and cross-cutting architectural concepts |
| Python Agent | `apps/agent` | Python Deep Agents, CopilotKit Remote Endpoint, LangGraph (`uv`) |
| Storage | `@repo/storage` (`packages/storage`) | MinIO & AWS S3 Object Storage handling (`@aws-sdk/client-s3`) |
| Redis / KV | `@repo/redis` (`packages/redis`) | In-memory key-value cache and client (`ioredis`) |
| Validators | `@repo/validators` (`packages/validators`) | Shared Zod schemas and DTO validations |
| DB | `@repo/db` (`packages/db`) | Database schema & Drizzle ORM setup |
| Auth | `@repo/auth` (`packages/auth`) | Better-Auth authentication configuration |
| Env | `@repo/env` (`packages/env`) | Type-safe environment variables (`@t3-oss/env-*`) |
| UI | `@repo/ui` (`packages/ui`) | Shared React components and Tailwind styling |
