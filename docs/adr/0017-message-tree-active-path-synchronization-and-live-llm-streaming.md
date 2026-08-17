# 0017. Message Tree Active Path Synchronization and Live LLM Streaming

## Status
Partially Superseded by [ADR-0021](0021-linear-session-architecture-and-deep-agents-rich-ui.md) (In-session DAG active path synchronization replaced by Linear Session Architecture with Forking)

## Context
1. **메시지 트리와 LangGraph 체크포인터의 충돌**:
   - 프론트엔드는 PostgreSQL `chat_message`의 인접 리스트(`parent_id`)를 기반으로 트리 분기 및 재생성을 수행하며, 매 턴마다 현재 활성 브랜치의 전체 선형 경로(`Active Path`)를 백엔드로 전송합니다.
   - 그러나 백엔드 `hitl_graph.py`의 `AgentState`가 `messages: Annotated[list, operator.add]`와 영구 체크포인터를 사용하여, 프론트엔드가 보낸 전체 경로가 기존 체크포인트에 덧붙여지며 메시지가 $O(N^2)$로 중복 복제되고 Langfuse 트레이스가 오염되었습니다.
2. **전역 LLM 캐시로 인한 0.1초 고정 응답**:
   - `apps/agent/src/api/app.py`에 등록된 `set_llm_cache(StandardRedisCache)`로 인해, 프리셋이나 동일 질문 시 Ollama 추론을 건너뛰고 0.001초 만에 과거 응답을 반환하여 스트리밍 및 생성 다양성이 파괴되었습니다.

## Decision
1. **PostgreSQL을 대화 트리의 단일 진실 공급원(SSOT)으로 확정**:
   - 대화 히스토리의 저장 및 브랜치 관리는 DB와 프론트엔드가 전담합니다.
2. **LangGraph AgentState 메시지 교체(Replace) 시맨틱 적용** *(ADR-0021에서 선형 세션 및 포크 구조로 단순화)*:
   - `AgentState`의 `messages` 필드에서 `operator.add` 리듀서를 제거(또는 Active Path 덮어쓰기)하여, 백엔드 에이전트가 매 턴마다 프론트엔드가 전달한 정확한 Active Path만을 컨텍스트로 사용하도록 동기화합니다.
3. **전역 LLM 응답 캐시(`set_llm_cache`) 제거**:
   - 대화형 에이전트 경로에서 `set_llm_cache`를 비활성화하여 항상 실시간 토큰 스트리밍과 신선한 응답 생성을 보장합니다.
4. **체크포인터의 역할 명확화**:
   - `AsyncPostgresSaver`는 민감한 도구 실행 전 HITL 승인 대기(`interrupt`) 및 `Command(resume=...)` 재개에만 사용합니다.

## Consequences
- 프리셋 버튼 클릭 또는 동일 질문 입력 시 언제나 실시간으로 새로운 AI 토큰이 스트리밍됩니다.
- 이전 메시지 수정, 재생성 등 임의의 트리 분기 시에도 Langfuse 트레이스와 LLM 프롬프트가 단일 활성 경로만 깔끔하게 기록됩니다.
- $O(N^2)$ 컨텍스트 오염으로 인한 모델 품질 저하 및 무한 복제 버그가 원천 방지됩니다.
