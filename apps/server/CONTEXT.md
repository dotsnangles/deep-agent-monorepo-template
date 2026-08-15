# Server Domain Context (`apps/server`)

Domain glossary and architectural concepts for the Express REST server:

| Term | Definition | Location |
| --- | --- | --- |
| App Factory | Decoupled Express app instance generator for isolated integration testing | `src/app.ts` |
| Server Runtime | Process bootstrap with graceful shutdown listeners (`SIGINT`, `SIGTERM`) | `src/server.ts` |
| Auth Router | Better-Auth catch-all handler mounted on `/api/auth/*` | `src/modules/auth/` |
| Sessions Module | Chat session database CRUD queries backed by Drizzle ORM | `src/modules/sessions/` |
| Storage Module | Presigned S3/MinIO upload and download URL generator | `src/modules/storage/` |
| Error Middleware | Centralized error handler formatting ZodError and standard exceptions | `src/middlewares/error-handler.ts` |
