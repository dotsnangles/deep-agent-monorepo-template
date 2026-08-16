import { describe, expect, it } from "vitest";
import {
  DEFAULT_SESSION_TITLE,
  MAX_DERIVED_TITLE_LENGTH,
  deriveSessionTitle,
} from "../session-title";

describe("deriveSessionTitle (Pure Client Heuristic)", () => {
  it("returns default title when prompt is empty, null, or whitespace", () => {
    expect(deriveSessionTitle("")).toBe(DEFAULT_SESSION_TITLE);
    expect(deriveSessionTitle("   ")).toBe(DEFAULT_SESSION_TITLE);
    expect(deriveSessionTitle(null as any)).toBe(DEFAULT_SESSION_TITLE);
    expect(deriveSessionTitle(undefined as any)).toBe(DEFAULT_SESSION_TITLE);
  });

  it("extracts clean title from plain text prompt", () => {
    expect(deriveSessionTitle("피보나치 수열 알고리즘")).toBe("피보나치 수열 알고리즘");
    const enTitle = deriveSessionTitle("What is React Server Components?");
    expect(enTitle.length).toBeLessThanOrEqual(MAX_DERIVED_TITLE_LENGTH);
    expect(enTitle).toBe("What is React Server...");
  });

  it("strips leading Markdown headers and list symbols", () => {
    expect(deriveSessionTitle("# React Next.js 16 아키텍처")).toBe("React Next.js 16 아키텍처");
    expect(deriveSessionTitle("### PostgreSQL 인덱스 최적화")).toBe("PostgreSQL 인덱스 최적화");
    expect(deriveSessionTitle("- Docker Compose 설정 방법")).toBe("Docker Compose 설정 방법");
    expect(deriveSessionTitle("1. Kubernetes 배포 파이프라인")).toBe("Kubernetes 배포 파이프라인");
    expect(deriveSessionTitle("> 인용문 시작 부분 질문")).toBe("인용문 시작 부분 질문");
    expect(deriveSessionTitle(">인용문띄어쓰기없음")).toBe("인용문띄어쓰기없음");
  });

  it("skips leading symbols/markers and code blocks on earlier lines", () => {
    expect(deriveSessionTitle("#\n실제 의미 있는 질문")).toBe("실제 의미 있는 질문");
    const promptWithCode = "```typescript\nconst a = 10;\n```\n이 코드 어떻게 최적화해?";
    expect(deriveSessionTitle(promptWithCode)).toBe("이 코드 어떻게 최적화해?");
  });

  it("strips bold, italic, and strikethrough markdown formatting", () => {
    expect(deriveSessionTitle("**중요한** `useChatEngine` 질문")).toBe("중요한 useChatEngine 질문");
    expect(deriveSessionTitle("*기울임 텍스트* 질문")).toBe("기울임 텍스트 질문");
    expect(deriveSessionTitle("~~취소선~~ 질문")).toBe("취소선 질문");
    expect(deriveSessionTitle("_언더스코어_ 질문")).toBe("언더스코어 질문");
  });

  it("splits at first sentence punctuation when within length limit", () => {
    expect(
      deriveSessionTitle("오늘은 날씨가 참 좋습니다. 내일은 비가 올까요?"),
    ).toBe("오늘은 날씨가 참 좋습니다");
  });

  it("strictly bounds output length to <= MAX_DERIVED_TITLE_LENGTH (24 chars)", () => {
    const longPrompt = "대한민국 헌법 제1조 1항은 대한민국은 민주공화국이다라는 내용입니다.";
    const result = deriveSessionTitle(longPrompt);
    expect(result.length).toBeLessThanOrEqual(MAX_DERIVED_TITLE_LENGTH);
    expect(result.endsWith("...")).toBe(true);
  });

  it("removes URLs and falls back to default title if only symbols remain", () => {
    expect(deriveSessionTitle("https://google.com")).toBe(DEFAULT_SESSION_TITLE);
    expect(deriveSessionTitle("???!!!###---")).toBe(DEFAULT_SESSION_TITLE);
    expect(deriveSessionTitle("```python\nprint('hello')\n```")).toBe(DEFAULT_SESSION_TITLE);
  });
});
