# Storage Context

MinIO / S3 Object storage service wrapper using AWS SDK v3.

## Key Exports

- `s3Client`: Configured `S3Client` instance connecting to local MinIO or AWS S3.
- `getPresignedUploadUrl`: Helper to generate presigned URLs for client-side uploads.
- `getPresignedDownloadUrl`: Helper to generate presigned URLs for downloading files.
