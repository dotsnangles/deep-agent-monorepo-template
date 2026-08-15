import { describe, it, expect } from "vitest";
import { fuzzyMatch } from "../fuzzy-match";

describe("fuzzyMatch", () => {
  it("returns matched true and no highlight for empty query", () => {
    const result = fuzzyMatch("새로운 대화", "");
    expect(result.matched).toBe(true);
    expect(result.score).toBe(0);
    expect(result.segments).toEqual([{ text: "새로운 대화", highlight: false }]);
  });

  it("handles case-insensitive substring match and segments", () => {
    const result = fuzzyMatch("Deep Agent Platform", "agent");
    expect(result.matched).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.segments).toEqual([
      { text: "Deep ", highlight: false },
      { text: "Agent", highlight: true },
      { text: " Platform", highlight: false },
    ]);
  });

  it("handles Korean substring match", () => {
    const result = fuzzyMatch("사용자별 세션 기록 관리", "세션 기록");
    expect(result.matched).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.segments).toEqual([
      { text: "사용자별 ", highlight: false },
      { text: "세션 기록", highlight: true },
      { text: " 관리", highlight: false },
    ]);
  });

  it("handles multi-token search across disjoint words", () => {
    const result = fuzzyMatch("Next.js 16 App Router Tutorial", "next router");
    expect(result.matched).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.segments).toEqual([
      { text: "Next", highlight: true },
      { text: ".js 16 App ", highlight: false },
      { text: "Router", highlight: true },
      { text: " Tutorial", highlight: false },
    ]);
  });

  it("returns matched false when tokens do not match", () => {
    const result = fuzzyMatch("Hello World", "xyz");
    expect(result.matched).toBe(false);
    expect(result.score).toBe(-1);
    expect(result.segments).toEqual([{ text: "Hello World", highlight: false }]);
  });

  it("handles repeated search tokens across target string", () => {
    const result = fuzzyMatch("chat with chat bot", "chat chat");
    expect(result.matched).toBe(true);
    expect(result.segments).toEqual([
      { text: "chat", highlight: true },
      { text: " with ", highlight: false },
      { text: "chat", highlight: true },
      { text: " bot", highlight: false },
    ]);
  });

  it("gives higher score to prefix matches than suffix matches", () => {
    const prefixMatch = fuzzyMatch("Agent System", "agent");
    const suffixMatch = fuzzyMatch("System Agent", "agent");
    expect(prefixMatch.score).toBeGreaterThan(suffixMatch.score);
  });
});
