import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ReasoningCard } from "../reasoning-card";

describe("ReasoningCard Unit Tests", () => {
  it("returns null when reasoning string is empty or whitespace", () => {
    const html = renderToString(<ReasoningCard reasoning="" />);
    expect(html).toBe("");
  });

  it("renders live thinking state with spinner when isThinking is true (collapsed by default)", () => {
    const html = renderToString(
      <ReasoningCard
        reasoning="데이터를 분석하기 위해 파이썬 코드를 작성해야 합니다."
        isThinking={true}
      />
    );

    expect(html).toContain('data-testid="reasoning-card"');
    expect(html).toContain("생각하는 중...");
    expect(html).toContain('aria-expanded="false"');
  });

  it("renders completed thought badge with duration when isThinking is false even during answer generation", () => {
    const html = renderToString(
      <ReasoningCard
        reasoning="완료된 사고 과정 세부 내용입니다."
        duration={3.42}
        isThinking={false}
        isGenerating={true}
      />
    );

    expect(html).toContain('data-testid="reasoning-card"');
    expect(html).toContain("사고 과정");
    expect(html).toContain("3.4초 동안 생각함");
    expect(html).not.toContain("생각하는 중...");
  });

  it("renders expanded accordion content when defaultOpen is true", () => {
    const html = renderToString(
      <ReasoningCard
        reasoning="상세한 사고 과정 텍스트"
        duration={1.5}
        isThinking={false}
        defaultOpen={true}
      />
    );

    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("상세한 사고 과정 텍스트");
  });
});
