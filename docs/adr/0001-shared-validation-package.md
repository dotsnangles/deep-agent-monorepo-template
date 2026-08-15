# 1. Shared Zod Validation Schema Package

Date: 2026-08-15

## Status

Accepted

## Context

We have an Express backend server (`apps/server`) and a Next.js frontend web app (`apps/web`). Both require strict input/output data validation and shared TypeScript types for DTOs and API payloads.

## Decision

We create a dedicated workspace package `@repo/validators` in `packages/validators`. All cross-cutting Zod schemas and inferred TypeScript types will be exported from this package to maintain a single source of truth between server and client.

## Consequences

- Server and client share exact runtime validation schemas and static types.
- Changes to API contracts require updating a single shared schema.
- Reduces schema duplication across apps.
