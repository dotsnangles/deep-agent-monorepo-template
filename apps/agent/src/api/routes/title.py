from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.core.config import LLM_PROVIDER
from src.graphs.chat.graph import generate_title

title_router = APIRouter(tags=["Title Summarization"])


class TitleRequest(BaseModel):
    prompt: str = Field(..., description="First user prompt to summarize into a concise title")


class TitleResponse(BaseModel):
    title: str
    provider: str


@title_router.post("/api/title", response_model=TitleResponse)
async def create_title(body: TitleRequest):
    """Generates a smart summary title using LangChain and the configured LLM provider."""
    summary_title = await generate_title(body.prompt)
    return {"title": summary_title, "provider": LLM_PROVIDER}
