from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

from src.domain.ports import ArtifactDescriptor, StoragePort

logger = logging.getLogger(__name__)


class InMemoryStorageAdapter(StoragePort):
    """In-memory storage adapter for hermetic testing."""

    def __init__(self, base_url: str = "http://testserver/storage"):
        self.base_url = base_url
        self.blobs: dict[str, bytes] = {}
        self.metadata_registry: dict[str, list[ArtifactDescriptor]] = {}

    async def upload(
        self, storage_key: str, data: bytes, mime_type: str
    ) -> None:
        self.blobs[storage_key] = data

    async def generate_presigned_url(
        self, storage_key: str, expires_in_seconds: int = 3600
    ) -> str:
        return f"{self.base_url}/{storage_key}?expires={expires_in_seconds}"

    async def record_artifact_metadata(
        self, artifact: ArtifactDescriptor
    ) -> None:
        if artifact.session_id not in self.metadata_registry:
            self.metadata_registry[artifact.session_id] = []
        self.metadata_registry[artifact.session_id].append(artifact)

    async def get_synced_hashes(self, session_id: str) -> dict[str, str]:
        records = self.metadata_registry.get(session_id, [])
        return {r.storage_key: r.content_hash for r in records}


class S3StorageAdapter(StoragePort):
    """Production S3 and MinIO storage adapter."""

    def __init__(
        self,
        bucket_name: str | None = None,
        db_pool: Any = None,
        s3_client: Any = None,
    ):
        self.bucket_name = (
            bucket_name
            or os.getenv("MINIO_BUCKET_NAME")
            or os.getenv("S3_BUCKET_NAME")
            or "app-storage"
        )
        self.db_pool = db_pool
        self._client = s3_client

    def _get_client(self) -> Any:
        if self._client is None:
            import boto3
            from botocore.client import Config

            endpoint_url = os.getenv("MINIO_ENDPOINT") or os.getenv("S3_ENDPOINT")
            if endpoint_url and not endpoint_url.startswith("http"):
                port = os.getenv("MINIO_PORT", "9000")
                use_ssl = os.getenv("MINIO_USE_SSL", "false").lower() == "true"
                proto = "https" if use_ssl else "http"
                endpoint_url = f"{proto}://{endpoint_url}:{port}"

            access_key = (
                os.getenv("MINIO_ACCESS_KEY")
                or os.getenv("AWS_ACCESS_KEY_ID")
                or "minioadmin"
            )
            secret_key = (
                os.getenv("MINIO_SECRET_KEY")
                or os.getenv("AWS_SECRET_ACCESS_KEY")
                or "minioadmin"
            )

            client_kwargs: dict[str, Any] = {
                "service_name": "s3",
                "aws_access_key_id": access_key,
                "aws_secret_access_key": secret_key,
                "config": Config(signature_version="s3v4"),
            }
            if endpoint_url:
                client_kwargs["endpoint_url"] = endpoint_url

            self._client = boto3.client(**client_kwargs)
            try:
                self._client.head_bucket(Bucket=self.bucket_name)
            except Exception:
                try:
                    self._client.create_bucket(Bucket=self.bucket_name)
                except Exception:
                    pass
        return self._client

    async def upload(
        self, storage_key: str, data: bytes, mime_type: str
    ) -> None:
        client = self._get_client()
        await asyncio.to_thread(
            client.put_object,
            Bucket=self.bucket_name,
            Key=storage_key,
            Body=data,
            ContentType=mime_type,
        )

    async def generate_presigned_url(
        self, storage_key: str, expires_in_seconds: int = 3600
    ) -> str:
        client = self._get_client()
        return await asyncio.to_thread(
            client.generate_presigned_url,
            "get_object",
            Params={"Bucket": self.bucket_name, "Key": storage_key},
            ExpiresIn=expires_in_seconds,
        )

    async def record_artifact_metadata(
        self, artifact: ArtifactDescriptor
    ) -> None:
        if not self.db_pool:
            return
        try:
            async with self.db_pool.connection() as conn:
                meta_json = json.dumps(
                    {
                        **artifact.metadata,
                        "storageKey": artifact.storage_key,
                        "downloadUrl": artifact.download_url,
                        "contentHash": artifact.content_hash,
                    }
                )
                query = (
                    "INSERT INTO chat_artifact "
                    "(id, session_id, message_id, name, storage_key, mime_type, size_bytes, metadata, created_at) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW()) "
                    "ON CONFLICT (id) DO UPDATE SET "
                    "name = EXCLUDED.name, storage_key = EXCLUDED.storage_key, "
                    "mime_type = EXCLUDED.mime_type, size_bytes = EXCLUDED.size_bytes, "
                    "metadata = EXCLUDED.metadata"
                )
                await conn.execute(
                    query,
                    (
                        artifact.id,
                        artifact.session_id,
                        artifact.message_id,
                        artifact.name,
                        artifact.storage_key,
                        artifact.mime_type,
                        artifact.size_bytes,
                        meta_json,
                    ),
                )
        except Exception as e:
            logger.warning("Failed to record artifact in PostgreSQL: %s", e)

    async def get_synced_hashes(self, session_id: str) -> dict[str, str]:
        if not self.db_pool:
            return {}
        synced: dict[str, str] = {}
        try:
            async with self.db_pool.connection() as conn:
                query = (
                    "SELECT name, metadata FROM chat_artifact "
                    "WHERE session_id = %s"
                )
                cursor = await conn.execute(query, (session_id,))
                rows = await cursor.fetchall()
                for row in rows:
                    name, raw_meta = row[0], row[1]
                    meta = raw_meta if isinstance(raw_meta, dict) else json.loads(raw_meta or "{}")
                    h = meta.get("contentHash")
                    if h:
                        synced[name] = str(h)
        except Exception as e:
            logger.debug("Failed to query synced artifact hashes: %s", e)
        return synced
