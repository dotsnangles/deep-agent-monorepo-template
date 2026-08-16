import json
import logging
import mimetypes
import uuid
from pathlib import Path
from typing import Any

from src.graphs.chat.backends import DEFAULT_WORKSPACE_DIR, _is_denied_path
from src.schemas.events import ArtifactCreatedEventData

logger = logging.getLogger(__name__)

MIME_TYPE_OVERRIDES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".html": "text/html; charset=utf-8",
    ".json": "application/json",
    ".csv": "text/csv; charset=utf-8",
    ".pdf": "application/pdf",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
}


def guess_artifact_mime_type(file_path: Path | str) -> str:
    path = Path(file_path)
    suffix = path.suffix.lower()
    if suffix in MIME_TYPE_OVERRIDES:
        return MIME_TYPE_OVERRIDES[suffix]
    guessed, _ = mimetypes.guess_type(str(path))
    return guessed or "application/octet-stream"


class ArtifactSyncProcessor:
    """Synchronizes generated artifacts from session workspace to Object Storage and Database."""

    def __init__(
        self,
        workspace_dir: Path | str | None = None,
        storage_service: Any = None,
        db_pool: Any = None,
    ) -> None:
        self.workspace_dir = (
            Path(workspace_dir).resolve()
            if workspace_dir is not None
            else DEFAULT_WORKSPACE_DIR.resolve()
        )
        self.storage_service = storage_service
        self.db_pool = db_pool
        # In-memory tracking of processed file signatures (session_id -> set of relative_paths)
        self._synced_files: dict[str, set[str]] = {}

    def _get_synced_set(self, session_id: str) -> set[str]:
        if session_id not in self._synced_files:
            self._synced_files[session_id] = set()
        return self._synced_files[session_id]

    async def sync_session_artifacts(
        self,
        session_id: str,
        message_id: str | None = None,
    ) -> list[ArtifactCreatedEventData]:
        """Scans the artifacts/ directory of a session, uploads new items,
        persists to DB, and returns event data."""
        session_dir = self.workspace_dir / session_id
        artifacts_dir = session_dir / "artifacts"

        if not artifacts_dir.exists() or not artifacts_dir.is_dir():
            return []

        synced_set = self._get_synced_set(session_id)
        created_events: list[ArtifactCreatedEventData] = []

        try:
            for file_path in artifacts_dir.iterdir():
                if not file_path.is_file():
                    continue

                if _is_denied_path(file_path.name) or file_path.name.startswith("."):
                    continue

                rel_name = file_path.name
                if rel_name in synced_set:
                    continue

                # 1. Build metadata and keys
                mime_type = guess_artifact_mime_type(file_path)
                size_bytes = file_path.stat().st_size
                artifact_id = f"art_{uuid.uuid4().hex[:12]}"

                if message_id:
                    storage_key = f"artifacts/sessions/{session_id}/{message_id}/{rel_name}"
                else:
                    storage_key = f"artifacts/sessions/{session_id}/{rel_name}"

                # 2. Upload to Storage Service if available, otherwise generate local fallback URL
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

                # 3. Persist metadata to PostgreSQL database if pool available
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
                                        json.dumps({}),
                                    ),
                                )
                    except Exception as db_err:
                        logger.warning("DB artifact insert failed for %s: %s", artifact_id, db_err)

                # 4. Record as synced and append event
                synced_set.add(rel_name)
                event_data = ArtifactCreatedEventData(
                    id=artifact_id,
                    session_id=session_id,
                    message_id=message_id,
                    name=rel_name,
                    url=download_url,
                    storage_key=storage_key,
                    mime_type=mime_type,
                    size_bytes=size_bytes,
                    metadata={},
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
