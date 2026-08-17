# 7. Message Tree and Immutable Forking for Chat Interface

Date: 2026-08-15

## Status

Superseded by [ADR-0021](0021-linear-session-architecture-and-deep-agents-rich-ui.md) (Linear Session Architecture with Forking and Deep Agents Rich UI)

## Context

기존 시스템은 단일 선형 대화 구조로 LangGraph 체크포인트 바이너리(`checkpoints`)에 의존하여 대화를 복원하고 있었습니다.
사용자가 이전 질문을 수정하거나 AI 답변을 재생성(Regenerate)할 때 과거 대화를 유실하지 않고 버전별(`< 1/2 >`)로 전환 및 탐색할 수 있는 현대적인 메시지 트리(Message Tree) UX를 지원해야 합니다.

## Decision

1. **인접 리스트 데이터 모델 (`chat_message`)**:
   - `@repo/db`에 `chat_message` 테이블(`id`, `sessionId`, `parentId`, `role`, `content`, `createdAt`)을 신설하여 부모-자식 인접 리스트 방식으로 계층 구조를 저장합니다.
2. **불변 포크 (Immutable Forking)**:
   - 메시지 수정 또는 답변 재생성 시 기존 노드를 덮어쓰지 않고 새로운 형제(Sibling) 노드를 추가하여 새 브랜치를 생성합니다.
3. **활성 경로 (Active Path) 분리**:
   - `chat_session`에 현재 선택된 `active_leaf_id`를 관리하고, 프론트엔드 렌더링 및 AI 에이전트 호출 시 `Root -> Active Leaf`의 1차원 선형 경로만 추출하여 전달합니다.
4. **연쇄 삭제 (Cascade Delete)**:
   - 특정 중간 노드 삭제 시 하위 자식 노드들을 확인 모달과 함께 연쇄 삭제합니다.
5. **커스텀 Chat UI**:
   - `@copilotkit/react-core` 훅을 활용하여 인라인 브랜치 페이징(`< 1/3 >`), 스마트 호버 액션 툴바, 분기 전환을 제어하는 자체 Feature UI를 구축합니다.

## Consequences

- 사용자는 이전 질문 수정 및 답변 재생성 시 이전 대화 흐름을 잃지 않고 언제든 분기를 넘나들 수 있습니다.
- 백엔드 LLM 에이전트는 버려진 브랜치의 노이즈 없이 정제된 선형 컨텍스트만 수신합니다.
- 복잡한 LangGraph 내부 바이너리 파싱 없이 Drizzle ORM을 통해 직관적으로 대화 트리를 조회/조작할 수 있습니다.
