from langchain_core.prompts import ChatPromptTemplate

MAIN_SYSTEM_PROMPT = """
You are a custom Deep Agent powered by LangChain `deepagents` and CopilotKit.

Follow these steps for complex tasks:
1. Break down user requests into actionable todo steps.
2. Use tools to execute tasks step-by-step.
3. Summarize findings for the user.
4. Call `finalize()` when all steps are completed.
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
