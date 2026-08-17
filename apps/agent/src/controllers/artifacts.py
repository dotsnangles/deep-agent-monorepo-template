import mimetypes
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from src.infrastructure.sandbox.adapter import is_denied_path
from src.graphs.chat.backends import DEFAULT_WORKSPACE_DIR

artifacts_router = APIRouter(prefix="/sessions", tags=["artifacts"])

MIME_TYPE_OVERRIDES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".html": "text/html; charset=utf-8",
    ".json": "application/json",
    ".csv": "text/csv; charset=utf-8",
    ".pdf": "application/pdf",
}


@artifacts_router.get("/{session_id}/artifacts/{file_path:path}")
async def get_session_artifact(session_id: str, file_path: str):
    """Securely serve generated artifacts from the session sandbox workspace."""
    if is_denied_path(file_path) or is_denied_path(session_id):
        raise HTTPException(status_code=403, detail="Access denied")

    base_dir = DEFAULT_WORKSPACE_DIR.resolve() / session_id
    target_file = (base_dir / "artifacts" / file_path).resolve()
    if not target_file.is_file():
        target_file = (base_dir / file_path).resolve()

    try:
        target_file.relative_to(base_dir)
    except ValueError:
        raise HTTPException(status_code=403, detail="Directory traversal attempt detected")

    if not target_file.is_file():
        raise HTTPException(status_code=404, detail=f"Artifact '{file_path}' not found")

    suffix = target_file.suffix.lower()
    media_type = MIME_TYPE_OVERRIDES.get(suffix)
    if not media_type:
        guessed_type, _ = mimetypes.guess_type(str(target_file))
        media_type = guessed_type or "application/octet-stream"

    return FileResponse(
        path=str(target_file),
        media_type=media_type,
        filename=target_file.name,
    )
