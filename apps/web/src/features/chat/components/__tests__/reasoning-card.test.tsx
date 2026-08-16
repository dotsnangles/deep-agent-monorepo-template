import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ReasoningCard } from "../reasoning-card";

describe("ReasoningCard Unit Tests", () => {
  it("returns null when reasoning string is empty or whitespace", () => {
    const html = renderToString(<ReasoningCard reasoning="" />);
    expect(html).toBe("");
  });

  it("renders live thinking state with pulsing/spinner indicator when isGenerating is true", () => {
    const html = renderToString(
      <ReasoningCard
        reasoning="데이터를 분석하기 위해 파이썬 코드를 작성해야 합니다."
        isGenerating={true}
      />
    );

    expect(html).toContain("data-testid=\"reasoning-card\"");
    expect(html).toContain("생각하는 중...");
    expect(html).toContain("데이터를 분석하기 위해 파이썬 코드를 작성해야 합니다.");
  });

  it("renders collapsed thought badge with formatted duration when completed", () => {
    const html = renderToString(
      <ReasoningCard
        reasoning="완료된 사고 과정 세부 내용입니다."
        duration={3.42}
        isGenerating={false}
      />
    );

    expect(html).toContain("data-testid=\"reasoning-card\"");
    expect(html).toContain("3.4초 동안 생각함");
  });
});
