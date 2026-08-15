# 3. Redis Service with ioredis Client

Date: 2026-08-15

## Status

Accepted

## Context

The application requires fast key-value storage, caching, rate limiting, and potential pub/sub or job queue infrastructure.

## Decision

1. Run Redis locally via `docker-compose.yml` (`redis:7-alpine` image on port 6379).
2. Create `@repo/redis` in `packages/redis` using `ioredis`.
3. Expose `REDIS_URL` in `@repo/env`.

## Consequences

- High-performance in-memory caching and messaging.
- Modularized in `packages/redis` for reusability across server endpoints and background workers.
