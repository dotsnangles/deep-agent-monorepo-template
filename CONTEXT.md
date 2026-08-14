# Core Context Glossary

Key terms and definitions used across `hollow-echo-distant-signal`:

| Term | Definition | Context |
| --- | --- | --- |
| Object Storage | File and asset storage system powered by MinIO locally and AWS S3 in production | Storage (`packages/storage`) |
| Key-Value Cache | High-speed in-memory data store powered by Redis for caching and rate limiting | Cache (`packages/redis`) |
| Validator Schema | Zod-based runtime validation schema shared between server and web DTOs | Validation (`packages/validators`) |
