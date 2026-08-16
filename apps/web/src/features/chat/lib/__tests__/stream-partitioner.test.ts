import { describe, it, expect, vi, beforeEach } from "vitest";
import { StreamReasoningPartitioner } from "../stream-partitioner";

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
});
