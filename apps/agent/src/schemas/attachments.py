from pydantic import BaseModel, ConfigDict, Field


class AttachmentInput(BaseModel):
    """File attachment metadata matching @repo/validators AttachmentEntity."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    url: str
    mime_type: str = Field(..., alias="mimeType")
    size: int
    s3_key: str = Field(..., alias="s3Key")
