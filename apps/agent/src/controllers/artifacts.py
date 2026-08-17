import mimetypes
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from src.infrastructure import MIME_TYPE_OVERRIDES, guess_mime_type, is_denied_path
from src.graphs import DEFAULT_WORKSPACE_DIR

artifacts_router = APIRouter(prefix="/sessions", tags=["artifacts"])


@artifacts_router.get("/{session_id}/artifacts/{file_path:path}")
async def get_session_artifact(session_id: str, file_path: str):
    """Securely serve generated artifacts from the session sandbox workspace."""
    if is_denied_path(file_path) or is_denied_path(session_id):
        raise HTTPException(status_code=403, detail="Access denied")

    candidate_bases = [
        DEFAULT_WORKSPACE_DIR.resolve() / session_id,
        Path("workspace/sessions").resolve() / session_id,
        Path("apps/agent/workspace/sessions").resolve() / session_id,
    ]

    target_file = None
    matched_base = None
    for base_dir in candidate_bases:
        cand_art = (base_dir / "artifacts" / file_path).resolve()
        cand_root = (base_dir / file_path).resolve()
        if cand_art.is_file():
            target_file = cand_art
            matched_base = base_dir
            break
        elif cand_root.is_file():
            target_file = cand_root
            matched_base = base_dir
            break

    if not target_file or not matched_base or not target_file.is_file():
        raise HTTPException(status_code=404, detail=f"Artifact '{file_path}' not found")

    try:
        target_file.relative_to(matched_base)
    except ValueError:
        raise HTTPException(status_code=403, detail="Directory traversal attempt detected")

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
