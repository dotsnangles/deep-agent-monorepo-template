# 2. MinIO Object Storage with AWS S3 SDK

Date: 2026-08-15

## Status

Accepted

## Context

The application requires object storage (file uploads, image storage, attachments). MinIO provides a high-performance S3-compatible local storage service for development via Docker.

## Decision

1. Run MinIO locally via `docker-compose.yml` (`minio/minio` image on API port 9000 and Console port 9001).
2. Create `@hollow-echo-distant-signal/storage` in `packages/storage` using `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.
3. Configure MinIO credentials and endpoint in `@hollow-echo-distant-signal/env`.

## Consequences

- Full S3 compatibility allows seamless switching between local MinIO and production AWS S3.
- Storage operations are encapsulated in `packages/storage`.
