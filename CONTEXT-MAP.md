# Context Map

Overview of bounded contexts and packages in `hollow-echo-distant-signal`:

| Context / Package | Location | Description |
| --- | --- | --- |
| Root Context | `CONTEXT.md` | Core domain glossary and cross-cutting architectural concepts |
| Storage | `packages/storage` | MinIO & AWS S3 Object Storage handling (`@aws-sdk/client-s3`) |
| Redis / KV | `packages/redis` | In-memory key-value cache and client (`ioredis`) |
| Validators | `packages/validators` | Shared Zod schemas and DTO validations |
| DB | `packages/db` | Database schema & Drizzle ORM setup |
| Auth | `packages/auth` | Better-Auth authentication configuration |
| Env | `packages/env` | Type-safe environment variables (`@t3-oss/env-*`) |
| UI | `packages/ui` | Shared React components and Tailwind styling |
