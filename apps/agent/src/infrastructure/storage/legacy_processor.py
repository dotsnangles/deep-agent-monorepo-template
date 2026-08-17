from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import mimetypes
import os
from pathlib import Path
from typing import Any
import uuid

from botocore.client import Config
from src.graphs.chat.backends import DEFAULT_WORKSPACE_DIR, _is_denied_path
from src.schemas.events import ArtifactCreatedEventData
from src.infrastructure.sandbox.adapter import MIME_TYPE_OVERRIDES, guess_mime_type

logger = logging.getLogger(__name__)


def guess_artifact_mime_type(file_path: Path | str) -> str:
    return guess_mime_type(file_path)


def compute_file_sha256(file_path: Path) -> str:
    """Computes the SHA-256 hex digest of a file."""
    sha = hashlib.sha256()
    with file_path.open("rb") as f:
        while chunk := f.read(65536):
            sha.update(chunk)
    return sha.hexdigest()


class S3StorageService:
    """Asynchronous S3 / MinIO storage service for uploading artifacts and generating presigned URLs."""

    def __init__(
        self,
        s3_client: Any = None,
        bucket_name: str | None = None,
    ) -> None:
        self.bucket_name = (
            bucket_name
            or os.getenv("MINIO_BUCKET_NAME")
            or os.getenv("S3_BUCKET_NAME")
            or "app-storage"
        )
        if s3_client is not None:
            self.client = s3_client
        else:
            import boto3

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

            self.client = boto3.client(**client_kwargs)
            self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        try:
            self.client.head_bucket(Bucket=self.bucket_name)
        except Exception:
            try:
                self.client.create_bucket(Bucket=self.bucket_name)
                logger.info("Created S3/MinIO bucket: %s", self.bucket_name)
            except Exception as e:
                logger.warning("Failed ensuring bucket %s: %s", self.bucket_name, e)

    async def upload_file(
        self,
        file_path: Path | str,
        storage_key: str,
        mime_type: str = "application/octet-stream",
    ) -> None:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
            None,
            lambda: self.client.upload_file(
                str(file_path),
                self.bucket_name,
                storage_key,
                ExtraArgs={"ContentType": mime_type},
            ),
        )

    async def generate_presigned_download_url(
        self,
        storage_key: str,
        expires_in: int = 3600,
    ) -> str:
        loop = asyncio.get_running_loop()
        url = await loop.run_in_executor(
            None,
            lambda: self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": storage_key},
                ExpiresIn=expires_in,
            ),
        )
        return url


class ArtifactSyncProcessor:
    """Scans session sandbox `artifacts/` folder, detects new/modified deliverables,"""

    def __init__(
        self,
        workspace_dir: Path | str = DEFAULT_WORKSPACE_DIR,
        storage_service: Any = None,
        db_pool: Any = None,
    ) -> None:
        self.workspace_dir = Path(workspace_dir)
        self.storage_service = storage_service
        self.db_pool = db_pool
        self._synced_cache: dict[str, dict[str, str]] = {}

    async def _get_synced_map(self, session_id: str) -> dict[str, str]:
        if session_id in self._synced_cache:
            return self._synced_cache[session_id]

        synced_map: dict[str, str] = {}
        if self.db_pool is not None:
            try:
                async with self.db_pool.connection() as conn:
                    async with conn.cursor() as cur:
                        await cur.execute(
                            """
                            SELECT name, metadata->>'content_hash'
                            FROM chat_artifact
                            WHERE session_id = %s
                            """,
                            (session_id,),
                        )
                        rows = await cur.fetchall()
                        for row in rows:
                            if row[0] and row[1]:
                                synced_map[row[0]] = row[1]
            except Exception as e:
                logger.warning("Failed querying existing artifacts for session %s: %s", session_id, e)

        self._synced_cache[session_id] = synced_map
        return synced_map

    async def sync_session_artifacts(
        self,
        session_id: str,
        message_id: str | None = None,
    ) -> list[ArtifactCreatedEventData]:
        session_dir = self.workspace_dir / session_id
        artifacts_dir = session_dir / "artifacts"

        if not artifacts_dir.exists() or not artifacts_dir.is_dir():
            return []

        synced_map = await self._get_synced_map(session_id)
        created_events: list[ArtifactCreatedEventData] = []

        try:
            for file_path in artifacts_dir.iterdir():
                if not file_path.is_file():
                    continue

                if _is_denied_path(file_path.name) or file_path.name.startswith("."):
                    continue

                rel_name = file_path.name
                content_hash = compute_file_sha256(file_path)
                last_hash = synced_map.get(rel_name)

                if last_hash == content_hash:
                    continue

                mime_type = guess_artifact_mime_type(file_path)
                size_bytes = file_path.stat().st_size
                artifact_id = str(uuid.uuid4())
                metadata = {"content_hash": content_hash}

                if message_id:
                    storage_key = f"artifacts/sessions/{session_id}/{message_id}/{rel_name}"
                else:
                    storage_key = f"artifacts/sessions/{session_id}/{rel_name}"

                download_url: str
                if self.storage_service is not None:
                    try:
                        if hasattr(self.storage_service, "upload_file"):
                            await self.storage_service.upload_file(
                                file_path, storage_key, mime_type
                            )
                        if hasattr(self.storage_service, "generate_presigned_download_url"):
                            download_url = (
                                await self.storage_service.generate_presigned_download_url(
                                    storage_key
                                )
                            )
                        else:
                            download_url = f"/sessions/{session_id}/artifacts/{rel_name}"
                    except Exception as upload_err:
                        logger.warning("Storage upload failed for %s: %s", storage_key, upload_err)
                        download_url = f"/sessions/{session_id}/artifacts/{rel_name}"
                else:
                    download_url = f"/sessions/{session_id}/artifacts/{rel_name}"

                if self.db_pool is not None:
                    try:
                        async with self.db_pool.connection() as conn:
                            async with conn.cursor() as cur:
                                await cur.execute(
                                    """
                                    INSERT INTO chat_artifact (
                                        id, session_id, message_id, name,
                                        storage_key, mime_type, size_bytes, metadata
                                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                                    ON CONFLICT (id) DO NOTHING
                                    """,
                                    (
                                        artifact_id,
                                        session_id,
                                        message_id,
                                        rel_name,
                                        storage_key,
                                        mime_type,
                                        size_bytes,
                                        json.dumps(metadata),
                                    ),
                                )
                    except Exception as db_err:
                        logger.warning("DB artifact insert failed for %s: %s", artifact_id, db_err)

                synced_map[rel_name] = content_hash
                event_data = ArtifactCreatedEventData(
                    id=artifact_id,
                    session_id=session_id,
                    message_id=message_id,
                    name=rel_name,
                    url=download_url,
                    storage_key=storage_key,
                    mime_type=mime_type,
                    size_bytes=size_bytes,
                    metadata=metadata,
                )
                created_events.append(event_data)

        except Exception as scan_err:
            logger.error("Artifact directory scan error for session %s: %s", session_id, scan_err)

        return created_events


_global_sync_processor: ArtifactSyncProcessor | None = None


def get_artifact_sync_processor() -> ArtifactSyncProcessor:
    global _global_sync_processor
    if _global_sync_processor is None:
        _global_sync_processor = ArtifactSyncProcessor()
    return _global_sync_processor


def set_artifact_sync_processor(processor: ArtifactSyncProcessor | None) -> None:
    global _global_sync_processor
    _global_sync_processor = processor
