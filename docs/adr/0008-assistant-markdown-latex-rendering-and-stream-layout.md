# 8. Assistant Markdown/LaTeX Rendering and Clean Stream Canvas Layout

Date: 2026-08-15

## Status

Accepted

## Context

기존 채팅 UI는 다음과 같은 시각적 및 기능적 한계가 있었습니다:
1. AI 어시스턴트의 출력이 단순 텍스트(`whitespace-pre-wrap`)로 표시되어 Markdown, LaTeX 수식($..$, $$..$$), 다중 언어 코드 블록이 렌더링되지 않았습니다.
2. AI 메시지가 바깥쪽 행 테두리(`bg-muted/30 border`)와 내부 버블 테두리로 이중 감싸져 있어 시각적 노이즈가 심하고 답답한 레이아웃이었습니다.
3. 텍스트 크기(`text-xs`)와 컨테이너 너비(`max-w-5xl`)의 비율이 최적화되지 않아 긴 응답 시 가독성이 떨어졌습니다.

## Decision

1. **AI 전용 Markdown & LaTeX 렌더링 파이프라인 (`Assistant Markdown Renderer`)**:
   - `react-markdown`, `remark-math`, `remark-gfm`, `rehype-katex`, `katex`를 도입하여 AI 답변에 대한 완전한 마크다운, 수식, 테이블 렌더링을 지원합니다.
   - 코드 블록에는 언어 태그 뱃지, 테마 구문 강조, 원클릭 복사 버튼을 제공합니다.
   - 사용자 입력 메시지는 일반 텍스트로 유지하여 불필요한 포맷 오작동을 방지합니다.
2. **클린 스트림 캔버스 레이아웃 (`Message Canvas Layout`)**:
   - AI 메시지 바깥의 이중 감싸기 테두리를 제거하고 캔버스 위에 자연스럽게 펼쳐지도록 구성합니다.
   - 사용자 메시지만 우측 정렬된 깔끔한 컬러 버블로 배치합니다.
3. **가독성 황금비율 스케일링**:
   - 본문 텍스트 크기를 `text-sm (14px)` 및 `leading-relaxed`로 상향하고, 컨테이너 너비를 `max-w-4xl`로 집중시켜 시선 이동 피로를 줄입니다.
4. **스마트 입력창 및 미니멀 액션바**:
   - 멀티라인 입력 시 자동 높이 조절(Auto-grow) Textarea를 적용하고 메시지 하단에 미니멀한 액션 툴바를 배치합니다.

## Consequences

- 개발/수학/일반 문서 등 다양한 AI 응답이 현대적인 표준 형태로 시각화됩니다.
- 이중 테두리가 제거되어 넓고 쾌적한 화면 레이아웃을 제공합니다.
- 스트리밍 중에도 깨짐 없이 안정적으로 렌더링됩니다.
