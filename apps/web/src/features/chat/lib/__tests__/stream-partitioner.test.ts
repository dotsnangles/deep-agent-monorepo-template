import { describe, it, expect, vi, beforeEach } from "vitest";
import { StreamReasoningPartitioner, partitionMessageContent } from "../stream-partitioner";

describe("StreamReasoningPartitioner", () => {
  let partitioner: StreamReasoningPartitioner;

  beforeEach(() => {
    partitioner = new StreamReasoningPartitioner();
  });

  it("handles regular text without thinking tags", () => {
    partitioner.feedToken("안녕하세요. ");
    partitioner.feedToken("무엇을 도와드릴까요?");

    const state = partitioner.getState();
    expect(state.content).toBe("안녕하세요. 무엇을 도와드릴까요?");
    expect(state.reasoning).toBeUndefined();
    expect(state.isThinking).toBe(false);
    expect(state.reasoningDuration).toBeUndefined();
  });

  it("extracts complete <think>...</think> block across multiple chunks", () => {
    partitioner.feedToken("<think>\n데이터 분석 계획을 세우자.\n");
    expect(partitioner.getState().isThinking).toBe(true);
    expect(partitioner.getState().reasoning).toBe("데이터 분석 계획을 세우자.\n");
    expect(partitioner.getState().content).toBe("");

    partitioner.feedToken("1. CSV 파일 생성\n2. 파이썬 실행\n</think>\n");
    expect(partitioner.getState().isThinking).toBe(false);
    expect(partitioner.getState().reasoning).toBe(
      "데이터 분석 계획을 세우자.\n1. CSV 파일 생성\n2. 파이썬 실행\n"
    );
    expect(partitioner.getState().content).toBe("");

    partitioner.feedToken("분석을 시작합니다.");
    expect(partitioner.getState().content).toBe("분석을 시작합니다.");
    expect(partitioner.getState().reasoningDuration).toBeGreaterThanOrEqual(0);
  });

  it("handles split <think> and </think> delimiters across chunk boundaries", () => {
    partitioner.feedToken("<thi");
    partitioner.feedToken("nk>내부 생각 중입니다...</thi");
    partitioner.feedToken("nk>최종 답변입니다.");

    const state = partitioner.getState();
    expect(state.isThinking).toBe(false);
    expect(state.reasoning).toBe("내부 생각 중입니다...");
    expect(state.content).toBe("최종 답변입니다.");
  });

  it("supports explicit SSE reasoning event chunks via feedReasoning", () => {
    partitioner.feedReasoning("모델이 추론을 시작합니다. ");
    partitioner.feedReasoning("단계별로 계산합니다.");

    expect(partitioner.getState().isThinking).toBe(true);
    expect(partitioner.getState().reasoning).toBe("모델이 추론을 시작합니다. 단계별로 계산합니다.");
    expect(partitioner.getState().content).toBe("");

    partitioner.feedToken("계산 결과는 42입니다.");
    expect(partitioner.getState().isThinking).toBe(false);
    expect(partitioner.getState().content).toBe("계산 결과는 42입니다.");
    expect(partitioner.getState().reasoningDuration).toBeDefined();
  });

  it("accurately tracks reasoning duration in seconds on completion", () => {
    vi.useFakeTimers();
    const p = new StreamReasoningPartitioner();
    p.feedToken("<think>생각 시작");
    vi.advanceTimersByTime(2500); // 2.5 seconds
    p.feedToken("</think>답변 시작");

    const state = p.getState();
    expect(state.reasoningDuration).toBeCloseTo(2.5, 1);
    vi.useRealTimers();
  });

  it("handles multi-turn reasoning with multiple <think>...</think> blocks across tool loops", () => {
    // Turn 1: Initial plan
    partitioner.feedToken("<think>1단계: orders.csv 생성 계획</think>");
    partitioner.feedToken("작업을 시작하겠습니다.\n");

    let state = partitioner.getState();
    expect(state.content).toBe("작업을 시작하겠습니다.");
    expect(state.reasoning).toBe("1단계: orders.csv 생성 계획");

    // Turn 2: Second thought after tool execution (like in the user screenshot)
    partitioner.feedToken(
      "<think>The first step, generating mock data is done. Now executing analysis script.</think>"
    );
    partitioner.feedToken("분석 결과 요약입니다.");

    state = partitioner.getState();
    expect(state.content).not.toContain("<think>");
    expect(state.content).not.toContain("</think>");
    expect(state.content).not.toContain("The first step");
    expect(state.content).toBe("작업을 시작하겠습니다.\n\n분석 결과 요약입니다.");
    expect(state.reasoning).toContain("1단계: orders.csv 생성 계획");
    expect(state.reasoning).toContain("The first step, generating mock data is done");
  });

  it("handles mixed mode: explicit reasoning chunk in turn 1 followed by <think> tag in turn 2", () => {
    // Turn 1: explicit reasoning SSE event
    partitioner.feedReasoning("초기 분석 추론 내용입니다.");
    partitioner.feedToken("분석을 시작합니다.");

    let state = partitioner.getState();
    expect(state.reasoning).toBe("초기 분석 추론 내용입니다.");
    expect(state.content).toBe("분석을 시작합니다.");

    // Turn 2: tool execution finished, LLM emits raw <think> tags in token stream
    partitioner.feedToken(
      "<think>데이터 분석 완료. 이제 결과 테이블을 마크다운으로 구성하자.</think>"
    );
    partitioner.feedToken("\n최종 보고서입니다.");

    state = partitioner.getState();
    expect(state.content).not.toContain("<think>");
    expect(state.content).not.toContain("</think>");
    expect(state.content).not.toContain("데이터 분석 완료");
    expect(state.content).toBe("분석을 시작합니다.\n\n최종 보고서입니다.");
    expect(state.reasoning).toContain("초기 분석 추론 내용입니다.");
    expect(state.reasoning).toContain("데이터 분석 완료");
  });

  it("sets isThinking to true when a second <think> block is actively streaming", () => {
    partitioner.feedToken("<think>1차 생각 완료</think>1차 답변 완료.");
    expect(partitioner.getState().isThinking).toBe(false);

    // 2nd turn starts streaming think
    partitioner.feedToken("<think>2차 도구 실행 후 중간 생각 중...");
    expect(partitioner.getState().isThinking).toBe(true);
    expect(partitioner.getState().reasoning).toContain("1차 생각 완료");
    expect(partitioner.getState().reasoning).toContain("2차 도구 실행 후 중간 생각 중...");
    expect(partitioner.getState().content).toBe("1차 답변 완료.");
  });

  it("returns lossless raw content with getRawContent preserving <think> tags", () => {
    partitioner.feedToken("<think>\n단계별 사고 과정\n</think>\n최종 분석 결과입니다.");
    expect(partitioner.getRawContent()).toBe(
      "<think>\n단계별 사고 과정\n</think>\n최종 분석 결과입니다."
    );
  });

  it("formats explicit reasoning into <think> block in getRawContent if explicit SSE reasoning was used", () => {
    partitioner.feedReasoning("SSE reasoning chunk");
    partitioner.feedToken("답변 내용입니다.");
    expect(partitioner.getRawContent()).toBe(
      "<think>\nSSE reasoning chunk\n</think>\n\n답변 내용입니다."
    );
  });

  it("partitions raw stored message using partitionMessageContent utility", () => {
    const rawStored = "<think>\n복원된 사고 과정\n</think>\n화면에 보여질 답변입니다.";
    const parsed = partitionMessageContent(rawStored);
    expect(parsed.reasoning).toBe("복원된 사고 과정\n");
    expect(parsed.content).toBe("화면에 보여질 답변입니다.");
    expect(parsed.reasoningDuration).toBeUndefined();
  });
});

