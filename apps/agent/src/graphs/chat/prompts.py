"""Prompt Catalog and Externalized Template Management.

Implements ADR-0023 for loading and interpolating external Markdown prompts
(system_prompt.md, title_prompt.md, rubric.md) with development hot-reloading.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

from langchain_core.prompts import ChatPromptTemplate

logger = logging.getLogger(__name__)

MAIN_SYSTEM_PROMPT = """
You are an expert autonomous Deep Agent powered by LangChain `deepagents` and CopilotKit.

When solving tasks:
1. When planning complex tasks, call `write_todos` to initialize the step-by-step plan.
2. CRITICAL: Do NOT stop after writing todos. Immediately continue in the same turn
   to execute the first step using available tools (e.g. running Python code via `execute`,
   reading/writing files, or calculating).
3. Keep todo statuses updated as you make progress.
4. Always produce a comprehensive, structured response with your final findings,
   explanations, and generated artifacts before calling `finalize()`.
""".strip()

TITLE_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "사용자 질문의 핵심 주제를 나타내는 간결하고 명확한 제목을 "
                "한국어 명사형(20자 이내)으로 작성해줘. "
                "부가 설명, 따옴표, 접두어(예: '제목:') 없이 오직 요약된 제목 텍스트만 출력해."
            ),
        ),
        ("human", "{user_prompt}"),
    ]
)


class PromptCatalog:
    """Manages file-based prompt templates with safe interpolation and hot-reloading."""

    def __init__(self, prompts_dir: Path | str | None = None, debug: bool = True) -> None:
        self.prompts_dir = Path(prompts_dir) if prompts_dir is not None else None
        self.debug = debug
        self._cache: dict[str, str] = {}

    def _resolve_file(self, filename: str) -> Path | None:
        if self.prompts_dir is not None:
            direct_file = self.prompts_dir / filename
            if direct_file.is_file():
                return direct_file

        candidates = [
            Path("prompts") / filename,
            Path("apps/agent/prompts") / filename,
            Path(__file__).parent.parent.parent.parent / "prompts" / filename,
            Path(__file__).parent.parent.parent / "prompts" / filename,
        ]
        for c in candidates:
            if c.is_file():
                return c
        return None

    def _read_file(self, filename: str) -> str | None:
        if not self.debug and filename in self._cache:
            return self._cache[filename]

        target_file = self._resolve_file(filename)
        if target_file and target_file.is_file():
            try:
                content = target_file.read_text(encoding="utf-8").strip()
                if not self.debug:
                    self._cache[filename] = content
                return content
            except Exception as e:
                logger.warning("Failed to read prompt file %s: %s", target_file, e)

        return None

    @staticmethod
    def format_template(template_str: str, **kwargs: Any) -> str:
        """Safely interpolates {key} placeholders without failing on unprovided braces."""
        if not kwargs:
            return template_str

        def replacer(match: re.Match) -> str:
            key = match.group(1)
            if key in kwargs:
                return str(kwargs[key])
            return match.group(0)

        return re.sub(r"\{([a-zA-Z0-9_]+)\}", replacer, template_str)

    def get_system_prompt(self, **kwargs: Any) -> str:
        """Returns the base system prompt, interpolated with provided keyword variables."""
        content = self._read_file("system_prompt.md")
        base = content if content else MAIN_SYSTEM_PROMPT
        return self.format_template(base, **kwargs)

    def get_title_prompt(self) -> ChatPromptTemplate:
        """Returns the ChatPromptTemplate for session title summarization."""
        content = self._read_file("title_prompt.md")
        if content:
            return ChatPromptTemplate.from_messages(
                [
                    ("system", content),
                    ("human", "{user_prompt}"),
                ]
            )
        return TITLE_PROMPT

    def get_rubric_prompt(self, **kwargs: Any) -> str | None:
        """Returns the rubric evaluation criteria prompt if configured."""
        content = self._read_file("rubric.md")
        if content:
            return self.format_template(content, **kwargs)
        return None


_cached_prompt_catalog: PromptCatalog | None = None


def get_prompt_catalog(prompts_dir: Path | str | None = None, debug: bool = True) -> PromptCatalog:
    """Returns singleton PromptCatalog instance."""
    global _cached_prompt_catalog
    if _cached_prompt_catalog is None or prompts_dir is not None:
        _cached_prompt_catalog = PromptCatalog(prompts_dir=prompts_dir, debug=debug)
    return _cached_prompt_catalog
