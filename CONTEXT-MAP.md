# Context Map

Overview of bounded contexts and package documentation in `starter-monorepo`:

| Context / Package | Location / Context Doc | Description |
| --- | --- | --- |
| Root Context | `CONTEXT.md` | Core domain glossary and cross-cutting architectural concepts |
| Architecture Guide | `docs/architecture/project-structure.md` | Complete monorepo structure and directory guide |
| Python Agent | `apps/agent/CONTEXT.md` (`apps/agent`) | Python Deep Agents, CopilotKit Remote Endpoint, LangGraph (`uv`) |
| Express Server | `apps/server/CONTEXT.md` (`apps/server`) | Express REST API server, Better-Auth handler, Drizzle DB integration |
| Web Application | `apps/web/CONTEXT.md` (`apps/web`) | Next.js 16 App Router UI, CopilotKit runtime integration, Feature modules |
| Storage | `@repo/storage` (`packages/storage`) | MinIO & AWS S3 Object Storage handling (`@aws-sdk/client-s3`) |
| Redis / KV | `@repo/redis` (`packages/redis`) | In-memory key-value cache and client (`ioredis`) |
| Validators | `@repo/validators` (`packages/validators`) | Shared Zod schemas and DTO validations |
| DB | `packages/db/CONTEXT.md` (`@repo/db`) | Database schema, Drizzle ORM setup & ChatRepository |

| Auth | `@repo/auth` (`packages/auth`) | Better-Auth authentication configuration |
| Env | `@repo/env` (`packages/env`) | Type-safe environment variables (`@t3-oss/env-*`) |
| UI | `@repo/ui` (`packages/ui`) | Shared React components and Tailwind styling |
