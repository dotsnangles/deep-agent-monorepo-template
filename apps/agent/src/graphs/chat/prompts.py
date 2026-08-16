from langchain_core.prompts import ChatPromptTemplate

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
